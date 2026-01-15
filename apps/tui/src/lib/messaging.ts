/**
 * Messaging helpers for TUI
 * Handles encryption/decryption of messages
 */

import { encryptMessage, decryptMessage } from "@auxlink/crypto";
import { getPrivateKey } from "@auxlink/crypto/storage/tui";
import { trpc } from "../utils/trpc";

/**
 * Send an encrypted message to a recipient device
 * 
 * @param senderDeviceId - The sender's device ID
 * @param recipientDeviceId - The recipient's device ID
 * @param messageContent - The plaintext message to send
 * @returns Message ID and status
 */
export const sendEncryptedMessage = async (
  senderDeviceId: string,
  recipientDeviceId: string,
  messageContent: string
): Promise<{ id: string; status: string; sentAt: string }> => {
  // Get all devices and find the recipient
  const devices = await trpc.device.list.query();
  const recipientDevice = devices.find(d => d.id === recipientDeviceId);
  
  if (!recipientDevice) {
    throw new Error(`Recipient device ${recipientDeviceId} not found`);
  }
  
  if (!recipientDevice.publicKey) {
    throw new Error(`Recipient device ${recipientDeviceId} has no public key. Devices must be paired first.`);
  }

  // Encrypt the message with recipient's public key
  const encryptedContent = await encryptMessage(messageContent, recipientDevice.publicKey);

  // Send via tRPC
  return await trpc.message.send.mutate({
    senderDeviceId,
    recipientDeviceId,
    encryptedContent,
    contentType: "text",
  });
};

/**
 * Decrypt a received message
 * 
 * @param encryptedContent - The encrypted message content
 * @param deviceId - The local device ID (to retrieve private key)
 * @returns Decrypted message content
 */
export const decryptReceivedMessage = async (
  encryptedContent: string,
  deviceId: string
): Promise<string> => {
  // Get local device's private key
  const privateKey = await getPrivateKey(deviceId);
  
  if (!privateKey) {
    throw new Error(`No private key found for device ${deviceId}. Cannot decrypt message.`);
  }

  // Decrypt the message
  return await decryptMessage(encryptedContent, privateKey);
};

/**
 * Get all paired devices for a user
 * @returns Array of paired device IDs with their public keys
 */
export const getPairedDevices = async (): Promise<Array<{ id: string; name: string; publicKey: string | null }>> => {
  const devices = await trpc.device.list.query();
  return devices.filter(d => d.publicKey !== null);
};

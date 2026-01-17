/**
 * Messaging helpers for TUI
 * Handles encryption/decryption of messages and local storage
 */

import { encryptMessage, decryptMessage } from "@auxlink/crypto";
import { getPrivateKey } from "@auxlink/crypto/storage/tui";
import { trpc } from "../utils/trpc";
import { localDb } from "./local-db";

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
  const result = await trpc.message.send.mutate({
    senderDeviceId,
    recipientDeviceId,
    encryptedContent,
    contentType: "text",
  });

  // Store message locally
  localDb.saveMessage({
    id: result.id,
    conversationId: recipientDeviceId,
    content: messageContent, // Store decrypted content locally
    encryptedContent,
    isSent: true,
    status: result.status as "pending" | "sent" | "delivered" | "read",
    timestamp: new Date(result.sentAt).getTime(),
    contentType: "text",
  });

  return result;
};

/**
 * Decrypt a received message and store it locally
 * 
 * @param messageId - The message ID from the server
 * @param senderDeviceId - The sender's device ID
 * @param encryptedContent - The encrypted message content
 * @param deviceId - The local device ID (to retrieve private key)
 * @param timestamp - Message timestamp
 * @returns Decrypted message content
 */
export const decryptReceivedMessage = async (
  messageId: string,
  senderDeviceId: string,
  encryptedContent: string,
  deviceId: string,
  timestamp: number
): Promise<string> => {
  // Get local device's private key
  const privateKey = await getPrivateKey(deviceId);
  
  if (!privateKey) {
    throw new Error(`No private key found for device ${deviceId}. Cannot decrypt message.`);
  }

  // Decrypt the message
  const decryptedContent = await decryptMessage(encryptedContent, privateKey);

  // Store message locally
  localDb.saveMessage({
    id: messageId,
    conversationId: senderDeviceId,
    content: decryptedContent,
    encryptedContent,
    isSent: false,
    status: "delivered",
    timestamp,
    contentType: "text",
  });

  return decryptedContent;
};

/**
 * Get all paired devices for a user
 * @returns Array of paired device IDs with their public keys
 */
export const getPairedDevices = async (): Promise<Array<{ id: string; name: string; publicKey: string | null }>> => {
  const devices = await trpc.device.list.query();
  return devices.filter(d => d.publicKey !== null);
};

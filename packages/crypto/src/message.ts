/**
 * Message encryption helpers
 * 
 * Provides high-level functions for encrypting/decrypting messages
 * between paired devices using their stored public keys.
 */

import { encrypt, decrypt } from "./encryption";

/**
 * Encrypt a message for a recipient using their public key
 * 
 * @param message - The message content to encrypt
 * @param recipientPublicKey - The recipient's public key (base64 AES key)
 * @returns Promise<string> - Base64 encoded encrypted message
 */
export const encryptMessage = async (
  message: string,
  recipientPublicKey: string
): Promise<string> => {
  if (!message) {
    throw new Error("Message cannot be empty");
  }
  if (!recipientPublicKey) {
    throw new Error("Recipient public key is required");
  }

  try {
    return await encrypt(message, recipientPublicKey);
  } catch (error) {
    throw new Error(
      `Failed to encrypt message: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Decrypt a message using the local device's private key
 * 
 * @param encryptedMessage - Base64 encoded encrypted message
 * @param localPrivateKey - The local device's private key (base64 AES key)
 * @returns Promise<string> - Decrypted message content
 */
export const decryptMessage = async (
  encryptedMessage: string,
  localPrivateKey: string
): Promise<string> => {
  if (!encryptedMessage) {
    throw new Error("Encrypted message cannot be empty");
  }
  if (!localPrivateKey) {
    throw new Error("Private key is required");
  }

  try {
    return await decrypt(encryptedMessage, localPrivateKey);
  } catch (error) {
    throw new Error(
      `Failed to decrypt message: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Encrypt a message for multiple recipients
 * Useful for group chats or multi-device scenarios
 * 
 * @param message - The message content to encrypt
 * @param recipientPublicKeys - Array of recipient public keys
 * @returns Promise<Map<string, string>> - Map of publicKey -> encrypted message
 */
export const encryptMessageForMultiple = async (
  message: string,
  recipientPublicKeys: string[]
): Promise<Map<string, string>> => {
  const encrypted = new Map<string, string>();

  for (const publicKey of recipientPublicKeys) {
    const ciphertext = await encryptMessage(message, publicKey);
    encrypted.set(publicKey, ciphertext);
  }

  return encrypted;
};

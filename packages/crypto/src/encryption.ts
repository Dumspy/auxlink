/**
 * cross-platform compatible encryption using AES-256-GCM via noble-ciphers
 */

import { randomBytes } from "crypto";
import { gcm } from "@noble/ciphers/aes.js";

/**
 * Key pair interface (for symmetric encryption, both keys are the same)
 */
export interface KeyPair {
  publicKey: string;   // Base64 encoded AES key
  privateKey: string;  // Base64 encoded AES key (same as publicKey)
}

/**
 * Generate a random AES-256 key
 * Returns base64 encoded key
 */
export const generateAESKey = async (): Promise<string> => {
  // Generate 32 random bytes (256 bits) for AES-256
  const keyBytes = randomBytes(32);
  return Buffer.from(keyBytes).toString("base64");
};

/**
 * Encrypt data with AES-256-GCM
 * @param plaintext - String to encrypt
 * @param keyBase64 - AES key in base64 format
 * @returns Base64 encoded ciphertext with IV prepended
 */
export const encryptAES = async (plaintext: string, keyBase64: string): Promise<string> => {
  // Decode the key from base64
  const keyData = Buffer.from(keyBase64, "base64");
  
  // Generate random IV (12 bytes recommended for GCM)
  const iv = randomBytes(12);
  
  // Encode plaintext to bytes
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);
  
  // Use noble-ciphers AES-GCM
  const aes = gcm(keyData, iv);
  const ciphertext = aes.encrypt(plaintextBytes);
  
  // Combine IV + ciphertext
  const combined = Buffer.concat([iv, Buffer.from(ciphertext)]);
  
  // Return as base64
  return combined.toString("base64");
};

/**
 * Decrypt data with AES-256-GCM
 * @param ciphertextBase64 - Base64 encoded ciphertext with IV prepended
 * @param keyBase64 - AES key in base64 format
 * @returns Decrypted plaintext
 */
export const decryptAES = async (ciphertextBase64: string, keyBase64: string): Promise<string> => {
  // Decode the key from base64
  const keyData = Buffer.from(keyBase64, "base64");
  
  // Decode combined IV + ciphertext from base64
  const combined = Buffer.from(ciphertextBase64, "base64");
  
  // Extract IV (first 12 bytes) and ciphertext (rest)
  const iv = combined.subarray(0, 12);
  const ciphertext = combined.subarray(12);
  
  // Use noble-ciphers AES-GCM
  const aes = gcm(keyData, iv);
  const plaintextBytes = aes.decrypt(ciphertext);
  
  // Decode bytes to string
  const decoder = new TextDecoder();
  return decoder.decode(plaintextBytes);
};

/**
 * Generate "key pair" (actually just an AES key used symmetrically)
 * This maintains API compatibility while using symmetric encryption
 */
export const generateKeyPair = async (): Promise<KeyPair> => {
  const aesKey = await generateAESKey();
  return {
    publicKey: aesKey,
    privateKey: aesKey, // Same key for symmetric encryption
  };
};

/**
 * "Encrypt" using the shared AES key
 */
export const encrypt = async (plaintext: string, publicKeyPEM: string): Promise<string> => {
  return encryptAES(plaintext, publicKeyPEM);
};

/**
 * "Decrypt" using the shared AES key
 */
export const decrypt = async (ciphertext: string, privateKeyPEM: string): Promise<string> => {
  return decryptAES(ciphertext, privateKeyPEM);
};

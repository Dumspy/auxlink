/**
 * React Native compatible encryption using expo-crypto and Web Crypto API
 * 
 * Uses AES-256-GCM for symmetric encryption, which is:
 * - Supported by expo-crypto for random number generation
 * - Supported by Web Crypto API (available in React Native)
 * - Fast and secure for message encryption
 * - Doesn't require native modules
 */

import * as Crypto from "expo-crypto";

/**
 * Generate a random AES-256 key
 * Returns base64 encoded key
 */
export async function generateAESKey(): Promise<string> {
  // Generate 32 random bytes (256 bits) for AES-256
  const keyBytes = await Crypto.getRandomBytesAsync(32);
  return btoa(String.fromCharCode(...keyBytes));
}

/**
 * Encrypt data with AES-256-GCM
 * @param plaintext - String to encrypt
 * @param keyBase64 - AES key in base64 format
 * @returns Base64 encoded ciphertext with IV prepended
 */
export async function encryptAES(plaintext: string, keyBase64: string): Promise<string> {
  // Decode the key from base64
  const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
  
  // Import key for Web Crypto API
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  
  // Generate random IV (12 bytes recommended for GCM)
  const iv = await Crypto.getRandomBytesAsync(12);
  
  // Encode plaintext to bytes
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);
  
  // Encrypt
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    plaintextBytes
  );
  
  // Combine IV + ciphertext
  const ciphertext = new Uint8Array(ciphertextBuffer);
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv);
  combined.set(ciphertext, iv.length);
  
  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data with AES-256-GCM
 * @param ciphertextBase64 - Base64 encoded ciphertext with IV prepended
 * @param keyBase64 - AES key in base64 format
 * @returns Decrypted plaintext
 */
export async function decryptAES(ciphertextBase64: string, keyBase64: string): Promise<string> {
  // Decode the key from base64
  const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
  
  // Import key for Web Crypto API
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  
  // Decode combined IV + ciphertext from base64
  const combined = Uint8Array.from(atob(ciphertextBase64), c => c.charCodeAt(0));
  
  // Extract IV (first 12 bytes) and ciphertext (rest)
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  // Decrypt
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    ciphertext
  );
  
  // Decode bytes to string
  const decoder = new TextDecoder();
  return decoder.decode(plaintextBuffer);
}

// For compatibility with the existing API
export interface KeyPair {
  publicKey: string;  // For mobile, this will be the AES key (acting as "public")
  privateKey: string; // Same as publicKey for symmetric encryption
}

/**
 * Generate "key pair" for mobile (actually just an AES key used symmetrically)
 * This maintains API compatibility while using symmetric encryption
 */
export async function generateKeyPair(): Promise<KeyPair> {
  const aesKey = await generateAESKey();
  return {
    publicKey: aesKey,
    privateKey: aesKey, // Same key for symmetric encryption
  };
}

/**
 * "Encrypt" using the shared AES key
 */
export async function encrypt(plaintext: string, publicKeyPEM: string): Promise<string> {
  return encryptAES(plaintext, publicKeyPEM);
}

/**
 * "Decrypt" using the shared AES key
 */
export async function decrypt(ciphertext: string, privateKeyPEM: string): Promise<string> {
  return decryptAES(ciphertext, privateKeyPEM);
}

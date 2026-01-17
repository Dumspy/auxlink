/**
 * React Native compatible encryption using expo-crypto and noble-ciphers
 */

import * as Crypto from "expo-crypto";
import { gcm } from "@noble/ciphers/aes.js";
import { randomBytes } from "@noble/ciphers/utils.js";

/**
 * Generate a random AES-256 key
 * Returns base64 encoded key
 */
export async function generateAESKey(): Promise<string> {
  const keyBytes = await Crypto.getRandomBytesAsync(32);
  return btoa(String.fromCharCode.apply(null, Array.from(keyBytes)));
}

/**
 * Encrypt data with AES-256-GCM
 */
export async function encryptAES(plaintext: string, keyBase64: string): Promise<string> {
  const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
  const iv = await Crypto.getRandomBytesAsync(12);
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);
  
  // Use noble-ciphers AES-GCM
  const aes = gcm(keyData, iv);
  const ciphertext = aes.encrypt(plaintextBytes);
  
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv);
  combined.set(ciphertext, iv.length);
  
  return btoa(String.fromCharCode.apply(null, Array.from(combined)));
}

/**
 * Decrypt data with AES-256-GCM
 */
export async function decryptAES(ciphertextBase64: string, keyBase64: string): Promise<string> {
  const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
  const combined = Uint8Array.from(atob(ciphertextBase64), c => c.charCodeAt(0));
  
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  // Use noble-ciphers AES-GCM
  const aes = gcm(keyData, iv);
  const plaintextBytes = aes.decrypt(ciphertext);
  
  const decoder = new TextDecoder();
  return decoder.decode(plaintextBytes);
}

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export async function generateKeyPair(): Promise<KeyPair> {
  const aesKey = await generateAESKey();
  return {
    publicKey: aesKey,
    privateKey: aesKey,
  };
}

export async function encrypt(plaintext: string, publicKeyPEM: string): Promise<string> {
  return encryptAES(plaintext, publicKeyPEM);
}

export async function decrypt(ciphertext: string, privateKeyPEM: string): Promise<string> {
  return decryptAES(ciphertext, privateKeyPEM);
}

/**
 * Mobile pairing helpers
 * Handles key generation, storage, and pairing completion for mobile devices
 */

import { generateKeyPair } from "@auxlink/crypto";
import { storePrivateKey, getPrivateKey } from "@auxlink/crypto/storage/mobile";
import { trpcClient } from "../utils/trpc";

/**
 * Generate AES key pair and store securely
 * @param deviceId - The mobile device ID
 */
export const generateAndStoreKeys = async (deviceId: string): Promise<string> => {
  const keyPair = await generateKeyPair();
  await storePrivateKey(deviceId, keyPair.privateKey);
  return keyPair.publicKey;
};

/**
 * Check if device has stored keys
 * @param deviceId - The device ID to check
 */
export const hasStoredKeys = async (deviceId: string): Promise<boolean> => {
  const privateKey = await getPrivateKey(deviceId);
  return privateKey !== null;
};

/**
 * Complete pairing process by submitting mobile device info to server
 * 
 * @param sessionId - The pairing session ID from QR code
 * @param mobileDeviceId - This mobile device's ID
 * @returns TUI device info
 */
export const completePairing = async (
  sessionId: string,
  mobileDeviceId: string
): Promise<{ tuiDeviceId: string; tuiPublicKey: string; tuiDeviceName: string }> => {
  // Generate keys if not already present
  let publicKey: string;
  const hasKeys = await hasStoredKeys(mobileDeviceId);
  
  if (!hasKeys) {
    publicKey = await generateAndStoreKeys(mobileDeviceId);
  } else {
    // If keys exist, we still need to get the public key to send to server
    // For AES, public and private keys are the same, so we can retrieve it
    const privateKey = await getPrivateKey(mobileDeviceId);
    if (!privateKey) {
      throw new Error("Failed to retrieve stored keys");
    }
    publicKey = privateKey; // For symmetric encryption, they're the same
  }

  // Complete pairing via tRPC
  const result = await trpcClient.pairing.complete.mutate({
    sessionId,
    mobileDeviceId,
    mobilePublicKey: publicKey,
  });

  // Validate result has required fields
  if (!result.tuiPublicKey) {
    throw new Error("TUI device has no public key. Pairing incomplete.");
  }

  return {
    tuiDeviceId: result.tuiDeviceId,
    tuiPublicKey: result.tuiPublicKey,
    tuiDeviceName: result.tuiDeviceName,
  };
};

/**
 * Parse QR code payload
 * @param qrData - The scanned QR code data
 * @returns Parsed session ID and version
 */
export const parseQRPayload = (qrData: string): { sessionId: string; version: number } => {
  try {
    const payload = JSON.parse(qrData);
    
    if (!payload.sessionId) {
      throw new Error("Invalid QR code format: missing sessionId");
    }

    return {
      sessionId: payload.sessionId,
      version: payload.version || 1,
    };
  } catch (error) {
    throw new Error(
      `Invalid QR code: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

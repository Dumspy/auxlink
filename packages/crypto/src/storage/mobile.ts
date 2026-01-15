import { setItemAsync, getItemAsync, deleteItemAsync } from "expo-secure-store";

const PRIVATE_KEY_PREFIX = "auxlink_private_key_";

/**
 * Store RSA private key to Expo SecureStore
 * 
 * @param deviceId - Device UUID
 * @param privateKey - RSA private key in PEM format
 */
export const storePrivateKey = async (deviceId: string, privateKey: string): Promise<void> => {
  try {
    if (!deviceId) {
      throw new Error("Device ID is required");
    }
    if (!privateKey) {
      throw new Error("Private key is required");
    }

    const key = `${PRIVATE_KEY_PREFIX}${deviceId}`;
    await setItemAsync(key, privateKey);
  } catch (error) {
    throw new Error(`Failed to store private key: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Retrieve RSA private key from Expo SecureStore
 * 
 * @param deviceId - Device UUID
 * @returns Promise<string | null> - Private key in PEM format, or null if not found
 */
export const getPrivateKey = async (deviceId: string): Promise<string | null> => {
  try {
    if (!deviceId) {
      throw new Error("Device ID is required");
    }

    const key = `${PRIVATE_KEY_PREFIX}${deviceId}`;
    return await getItemAsync(key);
  } catch (error) {
    throw new Error(`Failed to retrieve private key: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Delete RSA private key from Expo SecureStore
 * 
 * @param deviceId - Device UUID
 */
export const deletePrivateKey = async (deviceId: string): Promise<void> => {
  try {
    if (!deviceId) {
      throw new Error("Device ID is required");
    }

    const key = `${PRIVATE_KEY_PREFIX}${deviceId}`;
    await deleteItemAsync(key);
  } catch (error) {
    throw new Error(`Failed to delete private key: ${error instanceof Error ? error.message : String(error)}`);
  }
};

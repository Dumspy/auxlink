import { setItemAsync, getItemAsync, deleteItemAsync } from "expo-secure-store";

const DEVICE_ID_KEY = "auxlink_device_id";

/**
 * Store device ID securely in device keychain/keystore
 */
export const storeDeviceId = async (deviceId: string): Promise<void> => {
  try {
    await setItemAsync(DEVICE_ID_KEY, deviceId);
  } catch (error) {
    console.error("[device-storage] Failed to store device ID:", error);
    throw error;
  }
};

/**
 * Retrieve device ID from secure storage
 * Returns null if not found
 */
export const getDeviceId = async (): Promise<string | null> => {
  try {
    return await getItemAsync(DEVICE_ID_KEY);
  } catch (error) {
    console.error("[device-storage] Failed to retrieve device ID:", error);
    return null;
  }
};

/**
 * Remove device ID from secure storage
 */
export const clearDeviceId = async (): Promise<void> => {
  try {
    await deleteItemAsync(DEVICE_ID_KEY);
  } catch (error) {
    console.error("[device-storage] Failed to clear device ID:", error);
    throw error;
  }
};

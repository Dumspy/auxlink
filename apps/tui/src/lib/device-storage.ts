const CONFIG_DIR = `${Bun.env.HOME}/.auxlink`;
const DEVICE_ID_FILE = `${CONFIG_DIR}/device-id`;

/**
 * Ensure config directory exists (no-op for Bun, which auto-creates directories)
 */

/**
 * Store device ID in file system (~/.auxlink/device-id)
 */
export const storeDeviceId = async (deviceId: string): Promise<void> => {
  try {
    await Bun.write(DEVICE_ID_FILE, deviceId);
  } catch (error) {
    console.error("[device-storage] Failed to store device ID:", error);
    throw error;
  }
};

/**
 * Retrieve device ID from file system
 * Returns null if not found
 */
export const getDeviceId = async (): Promise<string | null> => {
  try {
    const file = Bun.file(DEVICE_ID_FILE);
    if (!(await file.exists())) {
      return null;
    }
    return (await file.text()).trim();
  } catch (error) {
    console.error("[device-storage] Failed to retrieve device ID:", error);
    return null;
  }
};

/**
 * Remove device ID from file system
 */
export const clearDeviceId = async (): Promise<void> => {
  try {
    const file = Bun.file(DEVICE_ID_FILE);
    if (await file.exists()) {
      const { unlink } = await import("fs/promises");
      await unlink(DEVICE_ID_FILE);
    }
  } catch (error) {
    console.error("[device-storage] Failed to clear device ID:", error);
    throw error;
  }
};

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = join(homedir(), ".auxlink");
const DEVICE_ID_FILE = join(CONFIG_DIR, "device-id");

/**
 * Ensure config directory exists
 */
const ensureConfigDir = (): void => {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
};

/**
 * Store device ID in file system (~/.auxlink/device-id)
 */
export const storeDeviceId = (deviceId: string): void => {
  try {
    ensureConfigDir();
    writeFileSync(DEVICE_ID_FILE, deviceId, "utf-8");
  } catch (error) {
    console.error("[device-storage] Failed to store device ID:", error);
    throw error;
  }
};

/**
 * Retrieve device ID from file system
 * Returns null if not found
 */
export const getDeviceId = (): string | null => {
  try {
    if (!existsSync(DEVICE_ID_FILE)) {
      return null;
    }
    return readFileSync(DEVICE_ID_FILE, "utf-8").trim();
  } catch (error) {
    console.error("[device-storage] Failed to retrieve device ID:", error);
    return null;
  }
};

/**
 * Remove device ID from file system
 */
export const clearDeviceId = (): void => {
  try {
    if (existsSync(DEVICE_ID_FILE)) {
      rmSync(DEVICE_ID_FILE);
    }
  } catch (error) {
    console.error("[device-storage] Failed to clear device ID:", error);
    throw error;
  }
};

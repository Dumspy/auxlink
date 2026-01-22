import * as SecureStore from "expo-secure-store";
import { authClient } from "./auth-client";
import { localDb } from "./local-db";
import { clearDeviceId, getDeviceId } from "./device-storage";
import { deletePrivateKey } from "@auxlink/crypto/storage/mobile";
import { queryClient } from "../utils/trpc";

const STORAGE_PREFIX = "auxlink";
const PRIVATE_KEY_PREFIX = "auxlink_private_key_";

export const clearAllLocalData = async (): Promise<void> => {
  try {
    console.log("[clear-data] Starting local data cleanup...");

    const deviceId = await getDeviceId();

    await authClient.signOut();

    if (deviceId) {
      await clearDeviceId();
    }

    await localDb.clearAllMessages();
    console.log("[clear-data] Cleared local database messages");

    if (deviceId) {
      try {
        await deletePrivateKey(deviceId);
        console.log("[clear-data] Deleted private key");
      } catch (error) {
        console.warn("[clear-data] Failed to delete private key:", error);
      }
    }

    const keysToDelete: string[] = [];
    if (deviceId) {
      keysToDelete.push(`lastMessageId_${deviceId}`);
      keysToDelete.push(`lastMessageId_timestamp_${deviceId}`);
      keysToDelete.push(`${STORAGE_PREFIX}_session_token`);
      keysToDelete.push(`${STORAGE_PREFIX}_user_data`);
    }

    for (const key of keysToDelete) {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (error) {
        console.warn(`[clear-data] Failed to delete ${key}:`, error);
      }
    }
    console.log(`[clear-data] Cleared ${keysToDelete.length} SecureStore items`);

    await localDb.close();
    localDb.init();
    console.log("[clear-data] Reinitialized local database");

    queryClient.clear();
    console.log("[clear-data] Cleared TanStack Query cache");

    console.log("[clear-data] Local data cleanup completed successfully");
  } catch (error) {
    console.error("[clear-data] Failed to clear local data:", error);
    throw new Error(
      `Failed to clear data: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

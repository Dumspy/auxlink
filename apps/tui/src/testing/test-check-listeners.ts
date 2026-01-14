#!/usr/bin/env bun

/**
 * Test script to check EventEmitter listeners
 * This helps diagnose SSE subscription issues
 */

import { logger } from "../lib/logger";
import { trpc } from "../utils/trpc";
import { getDeviceId } from "../lib/device-storage";

async function main() {
  logger.log("[listener-check] Starting...");

  const deviceId = await getDeviceId();
  if (!deviceId) {
    logger.log("[listener-check] No device ID found");
    return;
  }

  logger.log(`[listener-check] Device ID: ${deviceId}`);

  // Try to query something to verify server is accessible
  try {
    logger.log("[listener-check] Testing server connection...");
    const result = await trpc.device.list.query();
    logger.log(`[listener-check] Server is accessible, found ${result.length} devices`);
  } catch (error: any) {
    logger.log("[listener-check] Server connection failed:", error.message);
  }

  logger.log("[listener-check] Done");
}

main().catch((error) => {
  logger.error("[listener-check] Fatal error:", error);
  process.exit(1);
});

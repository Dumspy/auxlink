#!/usr/bin/env bun
/**
 * Test Echo Trigger Script (Task 25-26)
 * 
 * Usage: bun run apps/tui/src/testing/test-echo-trigger.ts <device-id> <message>
 * 
 * This script triggers an echo event to a specific device ID.
 * Use this to test bidirectional event flow through the SSE pipeline.
 */

import { authClient } from "../lib/auth-client";
import { storage } from "../lib/storage";
import { trpc } from "../utils/trpc";

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error("Usage: bun run apps/tui/src/testing/test-echo-trigger.ts <device-id> <message>");
    console.error("\nExample:");
    console.error('  bun run apps/tui/src/testing/test-echo-trigger.ts "abc123" "Hello from echo test!"');
    console.error("\nTo get device IDs:");
    console.error("  1. Start the TUI/mobile app");
    console.error("  2. Check logs for device ID");
    console.error("  3. Or call: trpc.device.list.query()");
    process.exit(1);
  }

  const [deviceId, message] = args as [string, string];

  console.log("[echo-trigger] Starting...");
  console.log("[echo-trigger] Target device:", deviceId);
  console.log("[echo-trigger] Message:", message);

  // Check if we have a session token
  const token = await storage.getItem("better-auth.session_token");
  if (!token) {
    console.error("[echo-trigger] ERROR: No session token found");
    console.error("[echo-trigger] Please login to the TUI first:");
    console.error("  bun run dev:tui");
    process.exit(1);
  }

  console.log("[echo-trigger] Session token found ✓");

  try {
    // Trigger the echo
    console.log("[echo-trigger] Sending echo event...");
    const result = await trpc.test.triggerEcho.mutate({
      deviceId,
      message,
    });

    console.log("[echo-trigger] Success!", result);
    console.log("[echo-trigger] The target device should receive the echo event now.");
  } catch (error: any) {
    console.error("[echo-trigger] ERROR:", error.message || error);
    process.exit(1);
  }
}

main();

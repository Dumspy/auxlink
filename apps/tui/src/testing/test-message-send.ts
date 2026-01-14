#!/usr/bin/env bun
/**
 * Test Message Send Script (Task 27)
 * 
 * Usage: bun run apps/tui/src/testing/test-message-send.ts <sender-device-id> <recipient-device-id> <message>
 * 
 * This script sends a test message from one device to another.
 * Use this to test message routing through the SSE pipeline.
 */

import { storage } from "../lib/storage";
import { trpc } from "../utils/trpc";

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error("Usage: bun run apps/tui/src/testing/test-message-send.ts <sender-device-id> <recipient-device-id> <message>");
    console.error("\nExample:");
    console.error('  bun run apps/tui/src/testing/test-message-send.ts "abc123" "def456" "Hello from mobile!"');
    console.error("\nTo get device IDs:");
    console.error("  1. Check TUI device ID: cat ~/.auxlink/device-id");
    console.error("  2. Check mobile logs for device ID");
    console.error("  3. Or call: trpc.device.list.query()");
    process.exit(1);
  }

  const [senderDeviceId, recipientDeviceId, message] = args as [string, string, string];

  console.log("[message-send] Starting...");
  console.log("[message-send] Sender device:", senderDeviceId);
  console.log("[message-send] Recipient device:", recipientDeviceId);
  console.log("[message-send] Message:", message);

  // Check if we have a session token
  const token = storage.getItem("better-auth.session_token");
  if (!token) {
    console.error("[message-send] ERROR: No session token found");
    console.error("[message-send] Please login to the TUI first:");
    console.error("  bun run dev:tui");
    process.exit(1);
  }

  console.log("[message-send] Session token found ✓");

  try {
    // Encode message as base64 (simulating encryption)
    const encryptedContent = Buffer.from(message).toString("base64");
    
    // Send the message
    console.log("[message-send] Sending message...");
    const result = await trpc.message.send.mutate({
      senderDeviceId,
      recipientDeviceId,
      encryptedContent,
      messageType: "message",
      contentType: "text",
    });

    console.log("[message-send] Success!", result);
    console.log("[message-send] Message ID:", result.id);
    console.log("[message-send] Status:", result.status);
    console.log("[message-send] The recipient device should receive the message now.");
  } catch (error: any) {
    console.error("[message-send] ERROR:", error.message || error);
    if (error.data) {
      console.error("[message-send] Error details:", error.data);
    }
    process.exit(1);
  }
}

main();

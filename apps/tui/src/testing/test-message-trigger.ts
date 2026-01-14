#!/usr/bin/env bun
/**
 * Test Message Trigger Script (using test.triggerTestMessage)
 * 
 * Usage: bun run apps/tui/src/testing/test-message-trigger.ts <recipient-device-id> <message>
 */

import { storage } from "../lib/storage";
import { trpc } from "../utils/trpc";

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error("Usage: bun run apps/tui/src/testing/test-message-trigger.ts <recipient-device-id> <message>");
    process.exit(1);
  }

  const [recipientDeviceId, content] = args as [string, string];

  console.log("[message-trigger] Triggering test message...");
  console.log("[message-trigger] Recipient device:", recipientDeviceId);
  console.log("[message-trigger] Content:", content);

  const token = await storage.getItem("better-auth.session_token");
  if (!token) {
    console.error("[message-trigger] ERROR: No session token found");
    process.exit(1);
  }

  try {
    const result = await trpc.test.triggerTestMessage.mutate({
      recipientDeviceId,
      content,
    });

    console.log("[message-trigger] Success!", result);
    console.log("[message-trigger] Message ID:", result.messageId);
  } catch (error: any) {
    console.error("[message-trigger] ERROR:", error.message || error);
    process.exit(1);
  }
}

main();

#!/usr/bin/env bun
/**
 * Test Encrypted Messaging End-to-End
 * 
 * This script tests the full encryption flow:
 * 1. Generate test keys for two devices
 * 2. Encrypt a message with device B's public key
 * 3. Decrypt the message with device B's private key
 * 4. Verify the message matches
 */

import { generateKeyPair, encrypt, decrypt } from "@auxlink/crypto";

async function main() {
  console.log("🔐 Testing AES-256-GCM Encryption End-to-End\n");

  // Step 1: Generate key pairs for two devices
  console.log("[1/5] Generating key pair for Device A (TUI)...");
  const deviceA = await generateKeyPair();
  console.log("✓ Device A keys generated");
  console.log("   Public key (first 40 chars):", deviceA.publicKey.substring(0, 40) + "...");

  console.log("\n[2/5] Generating key pair for Device B (Mobile)...");
  const deviceB = await generateKeyPair();
  console.log("✓ Device B keys generated");
  console.log("   Public key (first 40 chars):", deviceB.publicKey.substring(0, 40) + "...");

  // Step 2: Device A sends a message to Device B
  const originalMessage = "Hello from Device A! This message is encrypted with AES-256-GCM. 🔒";
  console.log("\n[3/5] Device A encrypting message for Device B...");
  console.log("   Original message:", originalMessage);
  
  const encryptedMessage = await encrypt(originalMessage, deviceB.publicKey);
  console.log("✓ Message encrypted");
  console.log("   Encrypted (first 60 chars):", encryptedMessage.substring(0, 60) + "...");
  console.log("   Encrypted length:", encryptedMessage.length, "characters");

  // Step 3: Device B decrypts the message
  console.log("\n[4/5] Device B decrypting message...");
  const decryptedMessage = await decrypt(encryptedMessage, deviceB.privateKey);
  console.log("✓ Message decrypted");
  console.log("   Decrypted message:", decryptedMessage);

  // Step 4: Verify
  console.log("\n[5/5] Verifying messages match...");
  if (originalMessage === decryptedMessage) {
    console.log("✅ SUCCESS! Messages match perfectly.");
    console.log("\n✨ Encryption test passed!");
  } else {
    console.error("❌ FAILURE! Messages don't match.");
    console.error("   Expected:", originalMessage);
    console.error("   Got:", decryptedMessage);
    process.exit(1);
  }

  // Bonus: Test with a longer message
  console.log("\n[BONUS] Testing with a longer message...");
  const longMessage = "This is a much longer message to test AES-256-GCM encryption with larger payloads. ".repeat(10) + 
    "Unlike RSA-2048 which has a 190 byte limit, AES can handle messages of any size!";
  console.log("   Message length:", longMessage.length, "characters");
  
  const encryptedLong = await encrypt(longMessage, deviceB.publicKey);
  const decryptedLong = await decrypt(encryptedLong, deviceB.privateKey);
  
  if (longMessage === decryptedLong) {
    console.log("✅ Long message encryption passed!");
  } else {
    console.error("❌ Long message encryption failed!");
    process.exit(1);
  }

  console.log("\n🎉 All encryption tests passed! The system is ready for secure messaging.");
}

main().catch((error) => {
  console.error("\n❌ Test failed with error:");
  console.error(error);
  process.exit(1);
});

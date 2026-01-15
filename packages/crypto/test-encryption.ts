#!/usr/bin/env bun
/**
 * Test script for RSA encryption roundtrip
 * Usage: bun run packages/crypto/test-encryption.ts
 */

import { generateKeyPair, encrypt, decrypt } from "./src/encryption";

async function testEncryption() {
  console.log("[test] Starting RSA encryption test...\n");

  // Generate key pair
  console.log("[test] Generating RSA-2048 key pair...");
  const { publicKey, privateKey } = await generateKeyPair();
  console.log("[test] ✓ Key pair generated");
  console.log(`[test] Public key length: ${publicKey.length} chars`);
  console.log(`[test] Private key length: ${privateKey.length} chars\n`);

  // Test message
  const testMessage = "Hello from auxlink! This is a secret message. 🔐";
  console.log(`[test] Original message: "${testMessage}"\n`);

  // Encrypt
  console.log("[test] Encrypting message...");
  const encrypted = await encrypt(testMessage, publicKey);
  console.log("[test] ✓ Message encrypted");
  console.log(`[test] Ciphertext (base64): ${encrypted.substring(0, 50)}...\n`);

  // Decrypt
  console.log("[test] Decrypting message...");
  const decrypted = await decrypt(encrypted, privateKey);
  console.log("[test] ✓ Message decrypted");
  console.log(`[test] Decrypted message: "${decrypted}"\n`);

  // Verify
  if (decrypted === testMessage) {
    console.log("[test] ✅ SUCCESS: Encryption roundtrip works correctly!");
    return true;
  } else {
    console.log("[test] ❌ FAILURE: Decrypted message doesn't match original");
    return false;
  }
}

testEncryption()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("[test] ❌ Error:", error.message);
    process.exit(1);
  });

#!/usr/bin/env bun
/**
 * Device Debug Script
 * 
 * Checks device registration status and lists all devices for the current user.
 */

import { storage } from "../lib/storage";
import { getDeviceId } from "../lib/device-storage";
import { trpc } from "../utils/trpc";

async function main() {
  console.log("=== Device Debug Info ===\n");

  // Check session token
  const token = storage.getItem("better-auth.session_token");
  if (!token) {
    console.error("❌ No session token found");
    console.error("Please login to the TUI first");
    process.exit(1);
  }
  console.log("✅ Session token found");

  // Check device ID
  const deviceId = getDeviceId();
  if (!deviceId) {
    console.error("❌ No device ID found");
    console.error("Device has not been registered yet");
    process.exit(1);
  }
  console.log("✅ Device ID:", deviceId);

  try {
    // List all devices for the user
    console.log("\n=== All Devices for Current User ===");
    const devices = await trpc.device.list.query();
    
    if (devices.length === 0) {
      console.log("No devices found");
    } else {
      devices.forEach((dev, idx) => {
        const isCurrent = dev.id === deviceId;
        console.log(`\n${idx + 1}. ${dev.deviceType.toUpperCase()} ${isCurrent ? "(current)" : ""}`);
        console.log(`   ID: ${dev.id}`);
        console.log(`   Name: ${dev.name || "N/A"}`);
        console.log(`   Last Seen: ${dev.lastSeenAt ? new Date(dev.lastSeenAt).toLocaleString() : "Never"}`);
        console.log(`   Created: ${new Date(dev.createdAt).toLocaleString()}`);
      });
    }

    // Check if current device is in the list
    const currentDevice = devices.find(d => d.id === deviceId);
    if (!currentDevice) {
      console.log("\n❌ WARNING: Current device ID not found in user's devices!");
      console.log("This device needs to be re-registered");
      console.log("\nTo fix:");
      console.log("1. Delete device ID: rm ~/.auxlink/device-id");
      console.log("2. Restart TUI: It will auto-register");
    } else {
      console.log("\n✅ Current device is registered and belongs to this user");
    }

  } catch (error: any) {
    console.error("\n❌ Error fetching devices:", error.message || error);
    if (error.data) {
      console.error("Error details:", error.data);
    }
  }
}

main();

import { EventEmitter } from "events";
import type { AppEvent } from "./events";

// Singleton EventEmitter instance for SSE subscriptions
export const appEventEmitter = new EventEmitter();

// Increase max listeners for multiple subscriptions
// Each device connection = 1 listener, support up to 100 concurrent connections
appEventEmitter.setMaxListeners(100);

/**
 * Type-safe helper to emit events to a specific device
 * @param deviceId - Target device ID
 * @param event - Typed event payload
 */
export function emitAppEvent(deviceId: string, event: AppEvent): void {
  const channel = getDeviceChannel(deviceId);
  appEventEmitter.emit(channel, event);
}

/**
 * Get the channel name for a device
 * @param deviceId - Device ID
 * @returns Channel name in format "device:{deviceId}"
 */
export function getDeviceChannel(deviceId: string): string {
  return `device:${deviceId}`;
}

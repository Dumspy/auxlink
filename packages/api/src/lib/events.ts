// Event type definitions for tRPC SSE subscriptions

export const EventTypes = {
  MESSAGE_RECEIVED: "message:received",
  MESSAGE_STATUS_UPDATED: "message:status_updated",
  PAIRING_COMPLETED: "pairing:completed", // For Phase 3
  DEVICE_STATUS_CHANGED: "device:status_changed",
  TEST_PING: "test:ping",
  TEST_ECHO: "test:echo",
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

// Event payload types
export interface MessageReceivedEvent {
  type: typeof EventTypes.MESSAGE_RECEIVED;
  deviceId: string;
  message: {
    id: string;
    senderDeviceId: string;
    recipientDeviceId: string;
    encryptedContent: string;
    messageType: "prekey" | "message";
    contentType: string;
    sentAt: Date;
  };
}

export interface MessageStatusUpdatedEvent {
  type: typeof EventTypes.MESSAGE_STATUS_UPDATED;
  deviceId: string;
  messageId: string;
  status: "delivered" | "read";
  timestamp: Date;
}

export interface TestPingEvent {
  type: typeof EventTypes.TEST_PING;
  timestamp: Date;
  message: string;
}

export interface TestEchoEvent {
  type: typeof EventTypes.TEST_ECHO;
  deviceId: string;
  message: string;
}

export type AppEvent =
  | MessageReceivedEvent
  | MessageStatusUpdatedEvent
  | TestPingEvent
  | TestEchoEvent;

# E2EE Messenger Implementation Plan

## Executive Summary

Build a mobile-to-desktop E2EE messaging system where the React Native mobile app sends encrypted messages/links to a terminal-based TUI companion app. Uses Signal Protocol for E2EE, QR code pairing for device setup, and a central server for message routing and account management (future webhook support).

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Real-Time Communication: tRPC Subscriptions (SSE)](#2-real-time-communication-trpc-subscriptions-sse)
3. [OpenTUI QR Code Rendering](#3-opentui-qr-code-rendering)
4. [Database Schema (1 Mobile → N TUIs)](#4-database-schema-1-mobile--n-tuis)
5. [Message Storage Strategy (Hybrid)](#5-message-storage-strategy-hybrid)
6. [Signal Protocol Implementation](#6-signal-protocol-implementation)
7. [Dependencies](#7-dependencies)
8. [Implementation Phases](#8-implementation-phases)
9. [Key Decisions Summary](#9-key-decisions-summary)
10. [User Flows](#10-user-flows)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Mobile App                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ React Native + Expo                                     │ │
│  │ - QR Scanner (expo-camera)                              │ │
│  │ - Signal Protocol (libsignal-client)                    │ │
│  │ - Local SQLite (expo-sqlite)                            │ │
│  │ - tRPC Client (SSE subscriptions)                       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                             ↓ HTTPS + SSE
┌─────────────────────────────────────────────────────────────┐
│                      Server (Elysia)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ tRPC API (Queries + Mutations + Subscriptions)          │ │
│  │ - Device registration & pairing                         │ │
│  │ - Message storage (encrypted)                           │ │
│  │ - SSE event emitter (real-time push)                    │ │
│  │ - Better-Auth session management                        │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Database (SQLite/Turso)                                 │ │
│  │ - Users & sessions (Better-Auth)                        │ │
│  │ - Devices & pairings                                    │ │
│  │ - Encrypted messages (permanent record)                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                             ↑ HTTPS + SSE
┌─────────────────────────────────────────────────────────────┐
│                      TUI App (Node.js)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ OpenTUI (Terminal UI)                                   │ │
│  │ - Custom QR renderer (Unicode blocks)                   │ │
│  │ - Signal Protocol (libsignal-client)                    │ │
│  │ - Local SQLite (better-sqlite3)                         │ │
│  │ - tRPC Client (SSE subscriptions)                       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Features

- **E2EE with Signal Protocol**: Industry-standard end-to-end encryption
- **1 Mobile → N TUIs**: One mobile device can be paired with multiple desktops
- **QR Code Pairing**: Simple, secure device linking via QR code scan
- **Real-Time Delivery**: tRPC SSE subscriptions for instant message delivery
- **Hybrid Storage**: Messages stored both locally (fast) and on server (sync/backup)
- **Offline Support**: Messages queued on server, delivered on reconnection
- **Account-Based**: Ready for future webhook/service account integration

---

## 2. Real-Time Communication: tRPC Subscriptions (SSE)

### Why SSE over WebSockets?

From tRPC docs: **"We recommend using SSE for subscriptions as it's easier to setup and don't require setting up a WebSocket server."**

**Benefits:**
- Built into HTTP (no separate WS server needed)
- Auto-reconnection with `lastEventId` tracking (Signal Protocol message resumption)
- Works with existing tRPC setup
- Better with proxies/firewalls than WebSockets
- Simpler deployment (no sticky sessions needed)

### Server Implementation

```typescript
// apps/server/src/index.ts
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@auxlink/api";

app.all("/api/trpc/*", async (context) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: context.request,
    router: appRouter,
    createContext: () => createContext(context.request),
  });
});
```

### tRPC Subscription Router

```typescript
// packages/api/src/routers/message.ts
import { EventEmitter, on } from "events";
import { tracked } from "@trpc/server";

const messageEmitter = new EventEmitter();

export const messageRouter = router({
  // Subscribe to messages for a device
  onMessage: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
      lastEventId: z.string().optional() // For reconnection
    }))
    .subscription(async function* (opts) {
      const { deviceId, lastEventId } = opts.input;
      
      // First, yield any messages missed since lastEventId
      if (lastEventId) {
        const missedMessages = await db
          .select()
          .from(message)
          .where(and(
            eq(message.recipientDeviceId, deviceId),
            gt(message.id, lastEventId)
          ))
          .orderBy(asc(message.sentAt));
        
        for (const msg of missedMessages) {
          yield tracked(msg.id, msg);
        }
      }
      
      // Then listen for new messages in real-time
      for await (const [data] of on(messageEmitter, `message:${deviceId}`, {
        signal: opts.signal
      })) {
        const msg = data as typeof message.$inferSelect;
        yield tracked(msg.id, msg);
      }
    })
});

// Helper to emit message events
export function emitMessage(deviceId: string, message: any) {
  messageEmitter.emit(`message:${deviceId}`, message);
}
```

### Client Setup

```typescript
// Mobile & TUI: utils/trpc.ts
import { httpBatchLink, createTRPCProxyClient } from "@trpc/client";
import { httpSubscriptionLink } from "@trpc/client/links/httpSubscriptionLink";

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpSubscriptionLink({
      url: `${SERVER_URL}/api/trpc`,
    }),
    httpBatchLink({
      url: `${SERVER_URL}/api/trpc`,
    }),
  ],
});

// Subscribe to messages
const subscription = trpc.message.onMessage.subscribe(
  { deviceId: "my-device-id", lastEventId: undefined },
  {
    onData(message) {
      console.log("New message:", message);
      // Decrypt and display
    },
    onError(err) {
      console.error("Subscription error:", err);
    }
  }
);
```

### Mobile Background Strategy

**Approach: Polling on app reopen (no background tasks)**

```typescript
// apps/native/app/_layout.tsx
import { useEffect } from "react";
import { AppState } from "react-native";

function AppLayout() {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state === "active") {
        // App came to foreground, fetch missed messages
        const lastMessageId = await getLastMessageId();
        const missedMessages = await trpc.message.getPending.query({
          deviceId: myDeviceId,
          since: lastMessageId
        });
        
        // Decrypt and store locally
        for (const msg of missedMessages) {
          await decryptAndStoreMessage(msg);
        }
        
        // Re-establish subscription
        subscribeToMessages();
      }
    });
    
    return () => subscription.remove();
  }, []);
}
```

**Why not background tasks?**
- iOS restricts background execution heavily
- Battery drain concerns
- Polling on app open is simpler and reliable
- Push notifications (future phase) can wake app for critical messages

---

## 3. OpenTUI QR Code Rendering

### Custom ASCII/Unicode Renderer

Since OpenTUI uses a custom rendering system, we'll generate QR codes as 2D boolean arrays and render them using Unicode block characters.

```typescript
// packages/crypto/src/qr-renderer.ts
import QRCode from "qrcode";

export async function generateQRMatrix(data: string): Promise<boolean[][]> {
  const qr = await QRCode.create(data, { errorCorrectionLevel: "M" });
  const modules = qr.modules;
  
  const size = modules.size;
  const matrix: boolean[][] = [];
  
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) {
      row.push(modules.get(x, y) === 1);
    }
    matrix.push(row);
  }
  
  return matrix;
}

export function renderQRForOpenTUI(matrix: boolean[][]): string {
  // Add 2-module border (QR spec requires quiet zone)
  const bordered = addBorder(matrix, 2);
  
  // Use half-block characters to double density
  // ▀ (upper half) = U+2580
  // ▄ (lower half) = U+2584
  // █ (full block) = U+2588
  //   (space) = empty
  
  const lines: string[] = [];
  
  for (let y = 0; y < bordered.length; y += 2) {
    let line = "";
    for (let x = 0; x < bordered[y].length; x++) {
      const top = bordered[y][x];
      const bottom = y + 1 < bordered.length ? bordered[y + 1][x] : false;
      
      if (top && bottom) line += "█"; // Both filled
      else if (top) line += "▀";      // Top filled
      else if (bottom) line += "▄";   // Bottom filled
      else line += " ";               // Both empty
    }
    lines.push(line);
  }
  
  return lines.join("\n");
}

function addBorder(matrix: boolean[][], borderSize: number): boolean[][] {
  const size = matrix.length;
  const newSize = size + borderSize * 2;
  const bordered: boolean[][] = Array(newSize).fill(null).map(() => Array(newSize).fill(false));
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      bordered[y + borderSize][x + borderSize] = matrix[y][x];
    }
  }
  
  return bordered;
}
```

### OpenTUI Component

```typescript
// apps/tui/src/components/pairing.tsx
import { useEffect, useState } from "react";
import { generateQRMatrix, renderQRForOpenTUI } from "@auxlink/crypto";

export function PairingScreen({ onComplete }: { onComplete: () => void }) {
  const [qrCode, setQrCode] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  
  useEffect(() => {
    async function initiatePairing() {
      // Call tRPC to create pairing session
      const session = await trpc.pairing.initiate.mutate({
        tuiDeviceId: getDeviceId(),
        identityKeyPublic: getPublicKey()
      });
      
      // Generate QR code
      const qrPayload = JSON.stringify({
        sessionId: session.id,
        identityKey: session.identityKey,
        serverUrl: env.PUBLIC_SERVER_URL
      });
      
      const matrix = await generateQRMatrix(qrPayload);
      const rendered = renderQRForOpenTUI(matrix);
      setQrCode(rendered);
      
      // Start polling for completion
      pollPairingStatus(session.id);
    }
    
    initiatePairing();
  }, []);
  
  return (
    <box flexDirection="column" padding={2} border>
      <text fg="#00FF00" bold>Pair Mobile Device</text>
      <text>Scan this QR code with your mobile app:</text>
      
      <box marginTop={1}>
        <text>{qrCode}</text>
      </box>
      
      <text marginTop={1} fg="#FFFF00">
        Waiting for device... (expires in {Math.floor(timeLeft / 60)}m {timeLeft % 60}s)
      </text>
      
      <text marginTop={1} fg="#888888">[ESC] Cancel</text>
    </box>
  );
}
```

### Mobile QR Scanner

```typescript
// apps/native/app/(drawer)/pairing.tsx
import { CameraView, useCameraPermissions } from "expo-camera";

export function PairingScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  
  const handleQRScan = async ({ data }: { data: string }) => {
    try {
      const qrPayload = JSON.parse(data);
      const { sessionId, identityKey, serverUrl } = qrPayload;
      
      // Complete pairing
      await completePairing(sessionId, identityKey);
      
      // Navigate to messages
      router.push("/messages");
    } catch (error) {
      console.error("Invalid QR code", error);
    }
  };
  
  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1 }}
        onBarcodeScanned={handleQRScan}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      />
    </View>
  );
}
```

---

## 4. Database Schema (1 Mobile → N TUIs)

### Device Table

```typescript
// packages/db/src/schema/device.ts
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

export const device = sqliteTable("device", {
  id: text("id").primaryKey(), // UUID
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  deviceType: text("device_type", { enum: ["mobile", "tui"] }).notNull(),
  
  // Auto-generated names
  name: text("name").notNull(), // e.g. "iPhone 15 Pro (iOS 17.2)", "Ubuntu 22.04"
  
  // Signal Protocol Keys
  identityKeyPublic: text("identity_key_public").notNull(), // Base64
  signedPreKey: text("signed_pre_key"), // Base64 (for future multi-device)
  
  // Device metadata
  lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
}, (table) => ({
  userIdx: index("device_user_idx").on(table.userId)
}));

export const deviceRelations = relations(device, ({ one, many }) => ({
  user: one(user, { fields: [device.userId], references: [user.id] }),
  mobilePairings: many(devicePairing, { relationName: "mobilePairings" }),
  tuiPairings: many(devicePairing, { relationName: "tuiPairings" })
}));
```

### Device Pairing Table (Many-to-Many)

```typescript
// packages/db/src/schema/device-pairing.ts
import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { device } from "./device";

export const devicePairing = sqliteTable("device_pairing", {
  id: text("id").primaryKey(), // UUID
  mobileDeviceId: text("mobile_device_id").notNull().references(() => device.id, { onDelete: "cascade" }),
  tuiDeviceId: text("tui_device_id").notNull().references(() => device.id, { onDelete: "cascade" }),
  
  pairedAt: integer("paired_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  
  // Keep pairing even if devices disconnect (for message history)
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true)
}, (table) => ({
  uniquePair: uniqueIndex("device_pairing_unique").on(table.mobileDeviceId, table.tuiDeviceId),
  mobileIdx: index("device_pairing_mobile_idx").on(table.mobileDeviceId),
  tuiIdx: index("device_pairing_tui_idx").on(table.tuiDeviceId)
}));

export const devicePairingRelations = relations(devicePairing, ({ one }) => ({
  mobileDevice: one(device, { 
    fields: [devicePairing.mobileDeviceId], 
    references: [device.id],
    relationName: "mobilePairings"
  }),
  tuiDevice: one(device, { 
    fields: [devicePairing.tuiDeviceId], 
    references: [device.id],
    relationName: "tuiPairings"
  })
}));
```

### Pairing Session Table

```typescript
// packages/db/src/schema/pairing-session.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { device } from "./device";

export const pairingSession = sqliteTable("pairing_session", {
  id: text("id").primaryKey(), // UUID
  tuiDeviceId: text("tui_device_id").notNull().references(() => device.id, { onDelete: "cascade" }),
  
  // QR code data
  qrCodePayload: text("qr_code_payload").notNull(), // JSON: { identityKey, sessionId, serverUrl }
  
  // State
  status: text("status", { 
    enum: ["pending", "scanned", "completed", "expired"] 
  }).notNull().default("pending"),
  
  // Expiry (QR codes expire after 5 minutes)
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp_ms" })
});

export const pairingSessionRelations = relations(pairingSession, ({ one }) => ({
  tuiDevice: one(device, { fields: [pairingSession.tuiDeviceId], references: [device.id] })
}));
```

### Message Table

```typescript
// packages/db/src/schema/message.ts
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { device } from "./device";

export const message = sqliteTable("message", {
  id: text("id").primaryKey(), // UUID
  
  // Routing
  senderDeviceId: text("sender_device_id").notNull().references(() => device.id, { onDelete: "cascade" }),
  recipientDeviceId: text("recipient_device_id").notNull().references(() => device.id, { onDelete: "cascade" }),
  
  // Encrypted content (Signal Protocol output)
  encryptedContent: text("encrypted_content").notNull(), // Base64 encoded ciphertext
  messageType: text("message_type", { enum: ["prekey", "message"] }).notNull(), // Signal message types
  
  // Message metadata (unencrypted for server routing)
  contentType: text("content_type").notNull().default("text"), // "text", "link", "file" (for future)
  
  // Delivery tracking
  status: text("status", { 
    enum: ["pending", "sent", "delivered", "read"] 
  }).notNull().default("pending"),
  sentAt: integer("sent_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
  readAt: integer("read_at", { mode: "timestamp_ms" }),
  
  // TTL support (for future)
  expiresAt: integer("expires_at", { mode: "timestamp_ms" })
}, (table) => ({
  senderIdx: index("message_sender_idx").on(table.senderDeviceId),
  recipientIdx: index("message_recipient_idx").on(table.recipientDeviceId),
  statusIdx: index("message_status_idx").on(table.status)
}));

export const messageRelations = relations(message, ({ one }) => ({
  sender: one(device, { fields: [message.senderDeviceId], references: [device.id] }),
  recipient: one(device, { fields: [message.recipientDeviceId], references: [device.id] })
}));
```

### Signal Session Table

```typescript
// packages/db/src/schema/signal-session.ts
import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { device } from "./device";

export const signalSession = sqliteTable("signal_session", {
  id: text("id").primaryKey(), // UUID
  
  // Device pair
  deviceId: text("device_id").notNull().references(() => device.id, { onDelete: "cascade" }),
  remoteDeviceId: text("remote_device_id").notNull().references(() => device.id, { onDelete: "cascade" }),
  
  // Signal Protocol state (serialized)
  sessionState: text("session_state").notNull(), // Serialized Double Ratchet state
  
  // Metadata
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
}, (table) => ({
  uniquePair: uniqueIndex("signal_session_unique_pair").on(table.deviceId, table.remoteDeviceId)
}));

export const signalSessionRelations = relations(signalSession, ({ one }) => ({
  device: one(device, { fields: [signalSession.deviceId], references: [device.id] }),
  remoteDevice: one(device, { fields: [signalSession.remoteDeviceId], references: [device.id] })
}));
```

### Auto-Generated Device Names

```typescript
// packages/api/src/utils/device-name.ts
export function generateDeviceName(userAgent: string, deviceType: "mobile" | "tui"): string {
  if (deviceType === "tui") {
    // Extract OS from system
    const os = process.platform;
    const osMap: Record<string, string> = {
      darwin: "macOS",
      linux: "Linux",
      win32: "Windows"
    };
    return `${osMap[os] || "Unknown"} Desktop`;
  }
  
  // Parse mobile user agent
  // Example: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X)"
  if (userAgent.includes("iPhone")) {
    const match = userAgent.match(/iPhone OS ([\d_]+)/);
    const version = match ? match[1].replace(/_/g, ".") : "";
    return `iPhone (iOS ${version})`;
  }
  
  if (userAgent.includes("Android")) {
    const match = userAgent.match(/Android ([\d.]+)/);
    const version = match ? match[1] : "";
    return `Android (${version})`;
  }
  
  return `${deviceType} Device`;
}
```

---

## 5. Message Storage Strategy (Hybrid)

### Local Storage

**Mobile: expo-sqlite**

```typescript
// apps/native/lib/message-storage.ts
import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabase("auxlink.db");

export function initDB() {
  db.transaction((tx) => {
    tx.executeSql(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        recipientDeviceId TEXT NOT NULL,
        encryptedContent TEXT NOT NULL,
        decryptedContent TEXT,
        contentType TEXT,
        status TEXT,
        sentAt INTEGER,
        createdAt INTEGER
      )
    `);
  });
}

export async function storeMessage(message: Message): Promise<void> {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `INSERT OR REPLACE INTO messages 
         (id, recipientDeviceId, encryptedContent, decryptedContent, contentType, status, sentAt, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          message.recipientDeviceId,
          message.encryptedContent,
          message.decryptedContent,
          message.contentType,
          message.status,
          message.sentAt,
          Date.now()
        ],
        () => resolve(),
        (_, error) => reject(error)
      );
    });
  });
}

export async function getMessages(limit: number = 50): Promise<Message[]> {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        "SELECT * FROM messages ORDER BY sentAt DESC LIMIT ?",
        [limit],
        (_, { rows }) => resolve(rows._array),
        (_, error) => reject(error)
      );
    });
  });
}
```

**TUI: better-sqlite3**

```typescript
// apps/tui/src/lib/message-storage.ts
import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";
import { mkdirSync } from "fs";

const dbDir = join(homedir(), ".auxlink");
mkdirSync(dbDir, { recursive: true });

const dbPath = join(dbDir, "messages.db");
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    senderDeviceId TEXT NOT NULL,
    encryptedContent TEXT NOT NULL,
    decryptedContent TEXT,
    contentType TEXT,
    status TEXT,
    receivedAt INTEGER,
    createdAt INTEGER
  )
`);

export function storeMessage(message: Message): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO messages 
    (id, senderDeviceId, encryptedContent, decryptedContent, contentType, status, receivedAt, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    message.id,
    message.senderDeviceId,
    message.encryptedContent,
    message.decryptedContent,
    message.contentType,
    message.status,
    message.receivedAt,
    Date.now()
  );
}

export function getMessages(limit: number = 50): Message[] {
  const stmt = db.prepare("SELECT * FROM messages ORDER BY receivedAt DESC LIMIT ?");
  return stmt.all(limit) as Message[];
}
```

### Sync Strategy

1. **Mobile sends message**: Store locally + POST to server
2. **Server receives**: Store in DB + emit SSE event to all paired TUIs
3. **TUI receives**: Store locally + send delivery receipt
4. **Mobile/TUI offline**: Server queues messages, delivered on reconnect via `lastEventId`
5. **On app startup**: Fetch last 100 messages from server to ensure sync

---

## 6. Signal Protocol Implementation

### Key Generation

```typescript
// packages/crypto/src/signal.ts
import { 
  PrivateKey, 
  PublicKey, 
  SessionCipher,
  SignalProtocolAddress,
  SessionBuilder,
  PreKeyBundle
} from "@signalapp/libsignal-client";

export async function generateIdentityKeyPair() {
  const privateKey = PrivateKey.generate();
  const publicKey = privateKey.getPublicKey();
  
  return {
    privateKey: privateKey.serialize().toString("base64"),
    publicKey: publicKey.serialize().toString("base64")
  };
}

export async function initializeSession(
  localPrivateKey: string,
  remotePublicKey: string,
  localAddress: SignalProtocolAddress,
  remoteAddress: SignalProtocolAddress
) {
  // Perform ECDH key agreement
  const localPrivate = PrivateKey.deserialize(Buffer.from(localPrivateKey, "base64"));
  const remotePublic = PublicKey.deserialize(Buffer.from(remotePublicKey, "base64"));
  
  // Create PreKeyBundle (simplified for 1:1 pairing)
  const bundle = PreKeyBundle.new(
    remoteAddress.deviceId(),
    remoteAddress.deviceId(),
    null, // preKeyId
    null, // signedPreKeyId
    remotePublic,
    null, // signedPreKeyPublic
    null, // signedPreKeySignature
    remotePublic // identityKey
  );
  
  // Build session
  const builder = await SessionBuilder.new(/* ... */);
  await builder.processPreKeyBundle(bundle);
  
  return builder;
}

export async function encryptMessage(
  sessionCipher: SessionCipher,
  plaintext: string
): Promise<{ ciphertext: string; type: "prekey" | "message" }> {
  const message = await sessionCipher.encrypt(Buffer.from(plaintext, "utf8"));
  
  return {
    ciphertext: message.serialize().toString("base64"),
    type: message.type() === 3 ? "prekey" : "message"
  };
}

export async function decryptMessage(
  sessionCipher: SessionCipher,
  ciphertext: string,
  type: "prekey" | "message"
): Promise<string> {
  const buffer = Buffer.from(ciphertext, "base64");
  
  const plaintext = type === "prekey"
    ? await sessionCipher.decryptPreKeySignalMessage(buffer)
    : await sessionCipher.decryptSignalMessage(buffer);
  
  return plaintext.toString("utf8");
}
```

---

## 7. Dependencies

### Server

```json
{
  "dependencies": {
    "@signalapp/libsignal-client": "^0.86.11"
  }
}
```

### Mobile

```json
{
  "dependencies": {
    "@signalapp/libsignal-client": "^0.86.11",
    "expo-crypto": "~14.0.1",
    "expo-camera": "~16.0.6",
    "expo-sqlite": "~14.0.7"
  }
}
```

### TUI

```json
{
  "dependencies": {
    "@signalapp/libsignal-client": "^0.86.11",
    "qrcode": "^1.5.4",
    "better-sqlite3": "^11.7.0",
    "eventsource": "^2.0.2"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/qrcode": "^1.5.5"
  }
}
```

### New Package: `packages/crypto/`

```json
{
  "name": "@auxlink/crypto",
  "version": "0.0.1",
  "dependencies": {
    "@signalapp/libsignal-client": "^0.86.11",
    "qrcode": "^1.5.4"
  }
}
```

---

## 8. Implementation Phases

### Phase 0: UI/UX Foundation & Branding (Week 0-1)

**Goal:** Establish proper auth flows, clean UI structure, implement auxlink branding, and prepare navigation for messaging features.

---

#### A. Branding System

**Status:** Originally planned as a shared package but not implemented. Brand colors and assets are now managed directly in individual apps as needed.

**Completed:**
- ✅ Logo assets preserved in `/assets/` directory
- ✅ Branding applied across TUI and mobile apps

---

#### B. TUI Improvements

##### Issues to Fix:
- ❌ Hacky button pattern using `<input>` elements
- ❌ No proper navigation beyond logout
- ❌ Hardcoded hex colors instead of semantic tokens
- ❌ Dashboard is too minimal (no clear next steps)
- ❌ Emojis may not render in all terminals
- ❌ Fixed widths not responsive to terminal size

##### Component Improvements

**1. Create UI Component Library**

```typescript
// apps/tui/src/components/ui/button.tsx
import type { ReactNode } from "react";

interface ButtonProps {
  label: string;
  focused: boolean;
  onPress: () => void;
  variant?: "primary" | "danger" | "secondary";
  shortcut?: string;
}

export function Button({ 
  label, 
  focused, 
  onPress, 
  variant = "primary",
  shortcut 
}: ButtonProps) {
  const theme = {
    primary: { border: "#A78BFA", fg: "#F1F5F9" },
    danger: { border: "#F87171", fg: "#F87171" },
    secondary: { border: "#64748B", fg: "#64748B" }
  };
  
  const style = theme[variant];
  const displayLabel = shortcut ? `${label} [${shortcut}]` : label;
  
  return (
    <box 
      title={displayLabel}
      style={{
        border: true,
        borderColor: focused ? style.border : "#334155",
        padding: 1,
        height: 3
      }}
    >
      <input
        value=""
        placeholder="Press Enter"
        focused={focused}
        onInput={() => {}}
        onSubmit={onPress}
      />
    </box>
  );
}

// apps/tui/src/components/ui/icon.tsx
export const icons = {
  messages: "▶ MSG",
  pairing: "◆ PAIR",
  settings: "◉ SET",
  logout: "✕ EXIT",
  help: "? HELP"
};
```

**2. Unified Auth Screen with Tab Switching**

```typescript
// apps/tui/src/components/auth.tsx
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Login } from "./login";
import { SignUp } from "./sign-up";

interface AuthProps {
  onSuccess: () => void;
  onNavigationChange: (handlers: { onArrowUp: () => void; onArrowDown: () => void }) => void;
}

export function Auth({ onSuccess, onNavigationChange }: AuthProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [focusedTab, setFocusedTab] = useState<"login" | "signup">("login");
  
  return (
    <box style={{ flexDirection: "column", gap: 1, padding: 2, border: true, borderStyle: "double" }}>
      <text fg="#A78BFA" bold>auxlink TUI</text>
      
      {/* Tab Switcher */}
      <box style={{ flexDirection: "row", gap: 2, marginBottom: 1 }}>
        <box 
          style={{ 
            padding: 1, 
            border: true, 
            borderColor: mode === "login" ? "#A78BFA" : "#334155",
            flexGrow: 1 
          }}
        >
          <input
            value=""
            placeholder="Login"
            focused={focusedTab === "login" && mode !== "login"}
            onInput={() => {}}
            onSubmit={() => setMode("login")}
          />
        </box>
        <box 
          style={{ 
            padding: 1, 
            border: true, 
            borderColor: mode === "signup" ? "#A78BFA" : "#334155",
            flexGrow: 1 
          }}
        >
          <input
            value=""
            placeholder="Sign Up"
            focused={focusedTab === "signup" && mode !== "signup"}
            onInput={() => {}}
            onSubmit={() => setMode("signup")}
          />
        </box>
      </box>
      
      {/* Form Content */}
      {mode === "login" ? (
        <Login onSuccess={onSuccess} onSwitchToSignUp={() => setMode("signup")} onNavigationChange={onNavigationChange} />
      ) : (
        <SignUp onSuccess={onSuccess} onSwitchToLogin={() => setMode("login")} onNavigationChange={onNavigationChange} />
      )}
    </box>
  );
}
```

**3. Main Menu Dashboard with Navigation**

```typescript
// apps/tui/src/components/menu.tsx
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { icons } from "./ui/icon";

interface MenuProps {
  user: { name: string; email: string } | null;
  onNavigate: (screen: "messages" | "pairing" | "settings") => void;
  onLogout: () => void;
  onNavigationChange: (handlers: { onArrowUp: () => void; onArrowDown: () => void }) => void;
}

type MenuItemId = "messages" | "pairing" | "settings" | "logout";

export function Menu({ user, onNavigate, onLogout, onNavigationChange }: MenuProps) {
  const [focusedItem, setFocusedItem] = useState<MenuItemId>("messages");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  const menuItems: Array<{ id: MenuItemId; label: string; shortcut: string; variant: "primary" | "danger" | "secondary" }> = [
    { id: "messages", label: icons.messages, shortcut: "M", variant: "primary" },
    { id: "pairing", label: icons.pairing, shortcut: "P", variant: "primary" },
    { id: "settings", label: icons.settings, shortcut: "S", variant: "secondary" },
    { id: "logout", label: icons.logout, shortcut: "Q", variant: "danger" }
  ];
  
  // Arrow key navigation
  useEffect(() => {
    const currentIndex = menuItems.findIndex(item => item.id === focusedItem);
    
    onNavigationChange({
      onArrowUp: () => {
        if (currentIndex > 0) {
          setFocusedItem(menuItems[currentIndex - 1].id);
        }
      },
      onArrowDown: () => {
        if (currentIndex < menuItems.length - 1) {
          setFocusedItem(menuItems[currentIndex + 1].id);
        }
      }
    });
  }, [focusedItem, onNavigationChange]);
  
  function handleItemPress(itemId: MenuItemId) {
    if (itemId === "logout") {
      setShowLogoutConfirm(true);
    } else {
      onNavigate(itemId);
    }
  }
  
  if (showLogoutConfirm) {
    return (
      <box style={{ flexDirection: "column", gap: 1, padding: 2, border: true }}>
        <text fg="#FBBF24">Are you sure you want to logout?</text>
        
        <box style={{ flexDirection: "row", gap: 2, marginTop: 1 }}>
          <Button
            label="Cancel"
            focused={true}
            variant="secondary"
            onPress={() => setShowLogoutConfirm(false)}
          />
          <Button
            label="Logout"
            focused={false}
            variant="danger"
            onPress={onLogout}
          />
        </box>
      </box>
    );
  }
  
  return (
    <box style={{ flexDirection: "column", gap: 1, padding: 2, border: true, borderStyle: "double", width: 50 }}>
      <text fg="#A78BFA" bold>auxlink TUI</text>
      <text fg="#64748B">Welcome, {user?.name}</text>
      
      <box style={{ marginTop: 2, flexDirection: "column", gap: 1 }}>
        {menuItems.map(item => (
          <Button
            key={item.id}
            label={item.label}
            shortcut={item.shortcut}
            focused={focusedItem === item.id}
            variant={item.variant}
            onPress={() => handleItemPress(item.id)}
          />
        ))}
      </box>
      
      <text fg="#64748B" style={{ marginTop: 2 }}>
        Arrow keys: navigate • Enter: select • [?] Help
      </text>
    </box>
  );
}
```

**4. Update Main App to Use New Components**

```typescript
// apps/tui/src/index.tsx - Updated screen state
type Screen = "loading" | "auth" | "menu" | "messages" | "pairing" | "settings";

function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  // ... rest of implementation
  
  if (screen === "auth") {
    return (
      <box alignItems="center" justifyContent="center" flexGrow={1}>
        <NavigationContext.Provider value={navigationHandlers}>
          <Auth
            onSuccess={() => setScreen("menu")}
            onNavigationChange={setNavigationHandlers}
          />
        </NavigationContext.Provider>
      </box>
    );
  }
  
  if (screen === "menu") {
    return (
      <box alignItems="center" justifyContent="center" flexGrow={1}>
        <NavigationContext.Provider value={navigationHandlers}>
          <Menu
            user={user}
            onNavigate={(screen) => setScreen(screen)}
            onLogout={() => setScreen("auth")}
            onNavigationChange={setNavigationHandlers}
          />
        </NavigationContext.Provider>
      </box>
    );
  }
  
  // Add placeholder screens for messages, pairing, settings
}
```

**TUI Tasks Summary:**
1. ✅ Create `apps/tui/src/components/ui/button.tsx`
2. ✅ Create `apps/tui/src/components/ui/icon.tsx`
3. ✅ Create `apps/tui/src/components/auth.tsx`
4. ✅ Create `apps/tui/src/components/menu.tsx`
5. ✅ Update `apps/tui/src/components/login.tsx` to remove switch button
6. ✅ Update `apps/tui/src/components/sign-up.tsx` to remove switch button
7. ✅ Update `apps/tui/src/index.tsx` to use new screen flow
8. ✅ Replace hardcoded colors with auxlink palette
9. ✅ Replace emojis with text icons
10. ✅ Test full navigation flow

---

#### C. Mobile App Improvements

##### Issues to Fix:
- ❌ Auth forms shown on home screen (confusing UX)
- ❌ No dedicated auth flow
- ❌ "BETTER T STACK" placeholder branding
- ❌ Drawer has placeholder "Tabs" section
- ❌ No logout confirmation
- ❌ Theme toggle in header (takes space)
- ❌ Home screen cluttered with status cards

##### File Structure Changes

```
apps/native/app/
├── (auth)/                    # NEW: Auth stack
│   ├── _layout.tsx           # Stack navigator
│   ├── welcome.tsx           # Landing screen
│   ├── login.tsx             # Login screen
│   └── signup.tsx            # Signup screen
├── (drawer)/                  # Main app (protected)
│   ├── _layout.tsx           # Drawer navigator (updated)
│   ├── index.tsx             # Home dashboard (cleaned)
│   ├── messages/             # NEW: Messages section
│   │   └── _layout.tsx       # (Placeholder for now)
│   ├── pairing.tsx           # NEW: Pairing screen
│   └── settings.tsx          # NEW: Settings screen
└── _layout.tsx               # Root layout with auth guard
```

##### Implementation

**1. Create Auth Stack**

```typescript
// apps/native/app/(auth)/_layout.tsx
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
```

**2. Welcome Screen with Gradient and Logo**

```typescript
// apps/native/app/(auth)/welcome.tsx
import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Button } from "heroui-native";
import { Container } from "@/components/container";

export default function Welcome() {
  return (
    <View className="flex-1">
      {/* Gradient background like logo */}
      <LinearGradient
        colors={["#2563EB", "#7C3AED", "#DB2777"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />
      
      <Container className="flex-1 justify-center items-center px-6">
        {/* Logo */}
        <View className="items-center mb-8">
          <Image 
            source={require("@/../../assests/auxerasmaller.png")}
            style={{ width: 120, height: 120, borderRadius: 20 }}
          />
          
          <Text className="text-5xl font-bold text-white mt-6">auxlink</Text>
        </View>
        
        <Text className="text-white text-center mb-12 text-lg opacity-90 px-8">
          Secure messages from mobile to desktop
        </Text>
        
        <View className="w-full px-6 gap-3">
          <Button 
            onPress={() => router.push("/(auth)/login")}
            className="w-full bg-white"
          >
            <Button.Label className="text-primary font-semibold">Sign In</Button.Label>
          </Button>
          
          <Pressable 
            onPress={() => router.push("/(auth)/signup")}
            className="w-full py-3 border-2 border-white rounded-lg items-center"
          >
            <Text className="text-white font-semibold">Create Account</Text>
          </Pressable>
        </View>
      </Container>
    </View>
  );
}
```

**3. Dedicated Login Screen**

```typescript
// apps/native/app/(auth)/login.tsx
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Container } from "@/components/container";
import { SignIn } from "@/components/sign-in";

export default function Login() {
  return (
    <Container className="flex-1 justify-center px-6">
      <View className="mb-8">
        <Text className="text-4xl font-bold text-foreground mb-2">Welcome back</Text>
        <Text className="text-muted">Sign in to continue</Text>
      </View>
      
      <SignIn />
      
      <Pressable 
        onPress={() => router.push("/(auth)/signup")} 
        className="mt-6"
      >
        <Text className="text-muted text-center">
          Don't have an account?{" "}
          <Text className="text-primary font-medium">Sign Up</Text>
        </Text>
      </Pressable>
      
      <Pressable 
        onPress={() => router.back()} 
        className="mt-4"
      >
        <Text className="text-muted text-center">← Back</Text>
      </Pressable>
    </Container>
  );
}
```

**4. Dedicated Signup Screen**

```typescript
// apps/native/app/(auth)/signup.tsx
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Container } from "@/components/container";
import { SignUp } from "@/components/sign-up";

export default function Signup() {
  return (
    <Container className="flex-1 justify-center px-6">
      <View className="mb-8">
        <Text className="text-4xl font-bold text-foreground mb-2">Get started</Text>
        <Text className="text-muted">Create your auxlink account</Text>
      </View>
      
      <SignUp />
      
      <Pressable 
        onPress={() => router.push("/(auth)/login")} 
        className="mt-6"
      >
        <Text className="text-muted text-center">
          Already have an account?{" "}
          <Text className="text-primary font-medium">Sign In</Text>
        </Text>
      </Pressable>
      
      <Pressable 
        onPress={() => router.back()} 
        className="mt-4"
      >
        <Text className="text-muted text-center">← Back</Text>
      </Pressable>
    </Container>
  );
}
```

**5. Clean Home Dashboard**

```typescript
// apps/native/app/(drawer)/index.tsx (cleaned up)
import { Ionicons } from "@expo/vector-icons";
import { Card, useThemeColor } from "heroui-native";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";

export default function Home() {
  const { data: session } = authClient.useSession();
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const mutedColor = useThemeColor("muted");
  
  return (
    <Container className="p-6">
      {/* Header */}
      <View className="mb-8">
        <Text className="text-3xl font-bold text-foreground">auxlink</Text>
        <Text className="text-muted">Welcome back, {session?.user?.name}</Text>
      </View>
      
      {/* Quick Actions */}
      <View className="gap-4">
        <Card className="p-4">
          <Pressable onPress={() => router.push("/(drawer)/messages")}>
            <View className="flex-row items-center">
              <View 
                className="w-12 h-12 rounded-full items-center justify-center mr-4"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <Ionicons name="send" size={24} color={primaryColor} />
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-semibold text-lg">Send Message</Text>
                <Text className="text-muted text-sm">Send to your desktop</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={mutedColor} />
            </View>
          </Pressable>
        </Card>
        
        <Card className="p-4">
          <Pressable onPress={() => router.push("/(drawer)/pairing")}>
            <View className="flex-row items-center">
              <View 
                className="w-12 h-12 rounded-full items-center justify-center mr-4"
                style={{ backgroundColor: `${secondaryColor}20` }}
              >
                <Ionicons name="qr-code" size={24} color={secondaryColor} />
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-semibold text-lg">Pair Device</Text>
                <Text className="text-muted text-sm">Connect your desktop</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={mutedColor} />
            </View>
          </Pressable>
        </Card>
      </View>
    </Container>
  );
}
```

**6. Update Drawer Navigation**

```typescript
// apps/native/app/(drawer)/_layout.tsx (updated)
import { Ionicons } from "@expo/vector-icons";
import { Drawer } from "expo-router/drawer";
import { useThemeColor } from "heroui-native";

export default function DrawerLayout() {
  const themeColorForeground = useThemeColor("foreground");
  const themeColorBackground = useThemeColor("background");
  
  return (
    <Drawer
      screenOptions={{
        headerTintColor: themeColorForeground,
        headerStyle: { backgroundColor: themeColorBackground },
        headerTitleStyle: {
          fontWeight: "600",
          color: themeColorForeground,
        },
        drawerStyle: { backgroundColor: themeColorBackground },
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          headerTitle: "auxlink",
          drawerLabel: "Home",
          drawerIcon: ({ size, color }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          )
        }}
      />
      <Drawer.Screen
        name="messages"
        options={{
          headerTitle: "Messages",
          drawerLabel: "Messages",
          drawerIcon: ({ size, color }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          )
        }}
      />
      <Drawer.Screen
        name="pairing"
        options={{
          headerTitle: "Pair Device",
          drawerLabel: "Pair Device",
          drawerIcon: ({ size, color }) => (
            <Ionicons name="qr-code-outline" size={size} color={color} />
          )
        }}
      />
      <Drawer.Screen
        name="settings"
        options={{
          headerTitle: "Settings",
          drawerLabel: "Settings",
          drawerIcon: ({ size, color }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          )
        }}
      />
    </Drawer>
  );
}
```

**7. Settings Screen with Theme Toggle and Logout**

```typescript
// apps/native/app/(drawer)/settings.tsx
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Button, Card, useThemeColor } from "heroui-native";
import { Container } from "@/components/container";
import { ThemeToggle } from "@/components/theme-toggle";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/utils/trpc";

export default function Settings() {
  const { data: session } = authClient.useSession();
  const dangerColor = useThemeColor("danger");
  
  function handleLogout() {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => {
            authClient.signOut();
            queryClient.invalidateQueries();
            router.replace("/(auth)/welcome");
          }
        }
      ]
    );
  }
  
  return (
    <Container className="p-6">
      <View className="gap-6">
        {/* Account Section */}
        <View>
          <Text className="text-lg font-semibold text-foreground mb-4">Account</Text>
          <Card className="p-4">
            <Text className="text-muted text-sm mb-1">Name</Text>
            <Text className="text-foreground font-medium mb-4">{session?.user?.name}</Text>
            
            <Text className="text-muted text-sm mb-1">Email</Text>
            <Text className="text-foreground font-medium">{session?.user?.email}</Text>
          </Card>
        </View>
        
        {/* Appearance Section */}
        <View>
          <Text className="text-lg font-semibold text-foreground mb-4">Appearance</Text>
          <Card className="p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground">Theme</Text>
              <ThemeToggle />
            </View>
          </Card>
        </View>
        
        {/* Danger Zone */}
        <View>
          <Text className="text-lg font-semibold mb-4" style={{ color: dangerColor }}>
            Danger Zone
          </Text>
          <Pressable 
            onPress={handleLogout}
            className="border-2 rounded-lg py-3 items-center"
            style={{ borderColor: dangerColor }}
          >
            <Text className="font-semibold" style={{ color: dangerColor }}>Sign Out</Text>
          </Pressable>
        </View>
      </View>
    </Container>
  );
}
```

**8. Root Layout Auth Guard**

```typescript
// apps/native/app/_layout.tsx (add auth guard)
import { useEffect } from "react";
import { useRouter, useSegments, Slot } from "expo-router";
import { authClient } from "@/lib/auth-client";

export default function RootLayout() {
  const { data: session } = authClient.useSession();
  const segments = useSegments();
  const router = useRouter();
  
  useEffect(() => {
    const inAuthGroup = segments[0] === "(auth)";
    
    if (!session?.user && !inAuthGroup) {
      // Redirect to auth if not logged in
      router.replace("/(auth)/welcome");
    } else if (session?.user && inAuthGroup) {
      // Redirect to home if already logged in
      router.replace("/(drawer)");
    }
  }, [session, segments]);
  
  return <Slot />;
}
```

**9. Create Placeholder Screens**

```typescript
// apps/native/app/(drawer)/messages/_layout.tsx
import { Stack } from "expo-router";

export default function MessagesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Messages" }} />
      <Stack.Screen name="send" options={{ title: "Send Message" }} />
    </Stack>
  );
}

// apps/native/app/(drawer)/messages/index.tsx
import { Text, View } from "react-native";
import { Container } from "@/components/container";

export default function Messages() {
  return (
    <Container className="flex-1 items-center justify-center p-6">
      <Text className="text-muted text-center">
        Messages screen coming in Phase 4
      </Text>
    </Container>
  );
}

// apps/native/app/(drawer)/pairing.tsx
import { Text, View } from "react-native";
import { Container } from "@/components/container";

export default function Pairing() {
  return (
    <Container className="flex-1 items-center justify-center p-6">
      <Text className="text-muted text-center">
        Pairing screen coming in Phase 3
      </Text>
    </Container>
  );
}
```

**Mobile Tasks Summary:**
1. ✅ Create `apps/native/app/(auth)/` folder structure
2. ✅ Create `_layout.tsx` for auth stack
3. ✅ Create `welcome.tsx` with gradient and logo
4. ✅ Create `login.tsx` screen
5. ✅ Create `signup.tsx` screen
6. ✅ Update `apps/native/app/_layout.tsx` with auth guard
7. ✅ Update `apps/native/app/(drawer)/index.tsx` (clean home)
8. ✅ Update `apps/native/app/(drawer)/_layout.tsx` (remove tabs, add screens)
9. ✅ Create `apps/native/app/(drawer)/settings.tsx`
10. ✅ Create `apps/native/app/(drawer)/messages/` placeholder
11. ✅ Create `apps/native/app/(drawer)/pairing.tsx` placeholder
12. ✅ Add `expo-linear-gradient` dependency
13. ✅ Update all "BETTER T STACK" to "auxlink"
14. ✅ Test auth flow and navigation

---

#### D. Testing Checklist for Phase 0

**TUI:**
- [ ] Auth screen shows with login/signup tab switcher
- [ ] Tab switching works correctly
- [ ] Login form works and redirects to menu
- [ ] Signup form works and redirects to menu
- [ ] Menu shows all navigation options with shortcuts
- [ ] Logout confirmation appears when pressing Q or selecting logout
- [ ] Logout works and returns to auth screen
- [ ] Colors match auxlink brand (purple #A78BFA)
- [ ] Text icons render correctly (`▶ MSG`, `◆ PAIR`, etc.)
- [ ] "auxlink TUI" branding appears in headers

**Mobile:**
- [ ] Welcome screen shows with gradient background
- [ ] Logo displays correctly
- [ ] Navigation to login works
- [ ] Navigation to signup works
- [ ] Login form works and redirects to home
- [ ] Signup form works and redirects to home
- [ ] Auth guard redirects unauthenticated users to welcome
- [ ] Auth guard redirects authenticated users to home
- [ ] Home dashboard shows quick action cards
- [ ] Drawer navigation shows correct items (Home, Messages, Pairing, Settings)
- [ ] Settings screen displays user info and theme toggle
- [ ] Logout confirmation alert appears
- [ ] Logout works and redirects to welcome screen
- [ ] Colors match auxlink brand (purple #7C3AED)
- [ ] "auxlink" branding appears everywhere (no "BETTER T STACK")
- [ ] Placeholder screens show appropriate "coming soon" messages

---

#### E. Additional Dependencies for Phase 0

**Mobile:**
```json
{
  "dependencies": {
    "expo-linear-gradient": "~13.0.2"
  }
}
```

---

### Phase 0 Summary

**Duration:** Week 0-1 (5-7 days)

**Key Deliverables:**
1. ✅ Auxlink branding applied across apps
2. ✅ TUI: Menu navigation with keyboard shortcuts (M, P, S, Q)
3. ✅ TUI: Unified auth screen with tab switching
4. ✅ TUI: Logout confirmation dialog
5. ✅ TUI: Text icons instead of emojis
6. ✅ Mobile: Welcome screen with gradient and logo
7. ✅ Mobile: Dedicated auth flow (welcome → login/signup)
8. ✅ Mobile: Clean home dashboard with quick actions
9. ✅ Mobile: Settings screen with theme toggle and logout
10. ✅ Mobile: Auth guard protecting authenticated routes
11. ✅ Both: Auxlink branding throughout
12. ✅ Both: Placeholder screens for future features

**Estimated Time:** 5-7 days

**Can run in parallel with:** Early database schema design from Phase 1

---

### Phase 1: Foundation ✅ COMPLETED (Jan 13, 2026)

**Status:** ✅ Complete - All core deliverables implemented and tested

**Deliverables:**
- ✅ Database schema created & migrated (5 tables)
- ✅ Device registration endpoints (tRPC - 6 endpoints)
- ✅ Mobile & TUI device registration flows
- ✅ Device persistence with secure storage

**Implementation Summary:**

**Database Schema (5 Tables):**
- ✅ `device.ts` - User devices with auto-generated names, identity keys (nullable for Phase 1)
- ✅ `device-pairing.ts` - Many-to-many pairing with soft delete support
- ✅ `pairing-session.ts` - QR code pairing workflow state (5min expiry)
- ✅ `message.ts` - Encrypted message storage with delivery tracking
- ✅ `signal-session.ts` - Signal Protocol Double Ratchet state

**Backend (tRPC Endpoints):**
- ✅ `device.register` - Idempotent device registration with auto-naming
- ✅ `device.list` - List user's devices with optional type filter
- ✅ `device.getPaired` - Get devices paired with specific device
- ✅ `device.updateLastSeen` - Update device online status
- ✅ `device.delete` - Delete device with cascade
- ✅ `device.unpair` - Soft delete pairing relationship
- ✅ `device-name.ts` utility - Auto-generate friendly device names from user agents

**Mobile App:**
- ✅ `expo-secure-store` for encrypted device ID storage
- ✅ `expo-device` for device information
- ✅ `lib/device-storage.ts` - Secure keychain utilities
- ✅ Device registration on authenticated home screen load
- ✅ Silent error handling (non-blocking)

**TUI App:**
- ✅ `lib/device-storage.ts` - File-based storage at `~/.auxlink/device-id`
- ✅ Device registration after authentication
- ✅ System info extraction using Node.js `os` module

**Authentication & CORS:**
- ✅ Better-Auth relaxed for development (`trustedOrigins: ["*"]`)
- ✅ Server CORS allows requests without Origin header (CLI-friendly)

**Testing Completed:**
- ✅ Database schema verified in Drizzle Studio
- ✅ Mobile device registration - auto-generates names correctly
- ✅ TUI device registration - creates config directory
- ✅ Device persistence - updates lastSeenAt on re-launch
- ✅ All tRPC endpoints tested and working
- ✅ Multi-user isolation verified
- ✅ Idempotent registration confirmed

**Key Design Decisions:**
1. Identity keys nullable in Phase 1 (populated in Phase 3)
2. Silent error handling for device registration
3. Idempotent registration via optional deviceId parameter
4. Auto-generated device names for better UX
5. Vanilla tRPC client for imperative calls in useEffect

**Deferred Items (tracked in FOLLOW_UP_ITEMS.md):**
- Identity key generation (Phase 3)
- Rate limiting on registration endpoint
- Automated test suite
- Production readiness hardening

**Tasks:**
1. ✅ Create new schema files in `packages/db/src/schema/`:
   - ✅ `device.ts`
   - ✅ `device-pairing.ts`
   - ✅ `pairing-session.ts`
   - ✅ `message.ts`
   - ✅ `signal-session.ts`
2. ✅ Export schemas from `packages/db/src/schema/index.ts`
3. ✅ Run `bun run db:push` to apply schema changes
4. ✅ Create `packages/api/src/routers/device.ts` with:
   - ✅ `register` mutation (enhanced with optional deviceId for idempotency)
   - ✅ `list` query (with optional deviceType filter)
   - ✅ `getPaired` query
   - ✅ `updateLastSeen` mutation (added beyond original plan)
   - ✅ `delete` mutation (added beyond original plan)
   - ✅ `unpair` mutation (added beyond original plan)
5. ✅ Create `packages/api/src/utils/device-name.ts` for auto-naming
6. ✅ Add device registration to mobile app (auto-register on authenticated screen)
7. ✅ Add device registration to TUI app (auto-register after auth)
8. ✅ Test device registration flow end-to-end

### Phase 2: tRPC Subscriptions (Week 2-3)

**Deliverables:**
- tRPC subscription infrastructure
- Message subscription endpoints
- Test SSE connections from mobile & TUI

**Tasks:**
1. Install subscription dependencies:
   - Mobile: Already has fetch API
   - TUI: `eventsource` package
2. Create `packages/api/src/routers/message.ts` with:
   - `onMessage` subscription (with `lastEventId` support)
   - `send` mutation
   - `list` query
   - `updateStatus` mutation
   - `getPending` query
3. Add EventEmitter for real-time message routing
4. Create helper function `emitMessage()` for server-side events
5. Test SSE subscription from mobile
6. Test SSE subscription from TUI
7. Verify `lastEventId` reconnection logic

### Phase 3: Signal Protocol + QR Pairing (Week 3-4)

**Deliverables:**
- Signal Protocol key generation
- QR code pairing flow (TUI → Mobile)
- Complete pairing with encryption handshake

**Tasks:**
1. Create `packages/crypto/` workspace package
2. Implement Signal Protocol helpers:
   - `generateIdentityKeyPair()`
   - `initializeSession()`
   - `encryptMessage()`
   - `decryptMessage()`
3. Implement QR code renderer for OpenTUI:
   - `generateQRMatrix()`
   - `renderQRForOpenTUI()`
4. Create `packages/api/src/routers/pairing.ts` with:
   - `initiate` mutation (TUI)
   - `complete` mutation (Mobile)
   - `getStatus` query (TUI polling)
5. Build TUI pairing screen:
   - Generate QR code
   - Display with custom renderer
   - Poll for pairing completion
6. Build mobile pairing screen:
   - Camera QR scanner
   - Parse QR payload
   - Complete pairing with handshake
7. Test 1 mobile → 1 TUI pairing
8. Test 1 mobile → multiple TUI pairing
9. Verify Signal session state stored correctly

### Phase 4: E2EE Messaging (Week 4-5)

**Deliverables:**
- Mobile message sending UI
- TUI message inbox UI
- End-to-end encrypted message flow

**Tasks:**
1. Implement local storage:
   - Mobile: expo-sqlite setup
   - TUI: better-sqlite3 setup
2. Build mobile "Send Message" screen:
   - Text input UI
   - Encrypt with Signal Protocol
   - Store locally + POST to server
   - Show success feedback
3. Build mobile "Message List" screen:
   - Display sent messages
   - Show delivery status
   - Pull-to-refresh
4. Build TUI message inbox:
   - Subscribe to messages
   - Decrypt with Signal Protocol
   - Store locally
   - Display in terminal UI
5. Implement delivery receipts:
   - TUI sends receipt on message received
   - Server updates status
   - Mobile shows updated status
6. Test end-to-end flow:
   - Mobile sends encrypted message
   - Server routes to all paired TUIs
   - TUI receives, decrypts, displays
7. Verify message history persists on device restart

### Phase 5: Offline Support & Polish (Week 5-6)

**Deliverables:**
- Offline message queuing
- Mobile app foreground sync
- Error handling & UX improvements

**Tasks:**
1. Implement server message queue:
   - Store messages with status "pending"
   - Yield on subscription reconnect
2. Add mobile foreground sync:
   - Listen to AppState changes
   - Fetch missed messages on foreground
   - Re-establish subscription
3. Handle subscription reconnection:
   - Pass `lastEventId` on reconnect
   - Verify no messages lost
4. Add read receipts:
   - User marks message as read
   - Send receipt to server
   - Update sender's UI
5. Implement error handling:
   - Session corruption → force re-pairing
   - Network errors → retry logic
   - Invalid QR code → user feedback
6. Add loading states:
   - Message sending spinner
   - Pairing progress indicator
   - Subscription connecting state
7. UI polish:
   - Empty states
   - Error messages
   - Success toasts
8. End-to-end testing:
   - Send 100 messages, verify all received
   - Kill TUI mid-message, verify resumes correctly
   - Background mobile app, verify sync on foreground

### Phase 6: Future Enhancements (Post-MVP)

- [ ] Push notifications (Expo notifications)
- [ ] Link preview generation
- [ ] Desktop system notifications (node-notifier)
- [ ] Message search (full-text search)
- [ ] Message TTL/expiration
- [ ] Bulk device unpairing
- [ ] Device renaming
- [ ] Webhook/service account architecture
- [ ] File attachments
- [ ] Message reactions

---

## 9. Key Decisions Summary

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Real-time transport** | tRPC SSE subscriptions | Simpler setup, auto-reconnection, stays in tRPC ecosystem |
| **QR code rendering** | Custom Unicode renderer | OpenTUI requires custom rendering solution |
| **Pairing model** | 1 mobile → N TUIs | User can send messages to multiple desktops |
| **Message storage** | Hybrid (local + server) | Local for speed/offline, server for sync/backup |
| **Device naming** | Auto-generated | Better UX out-of-box, users can rename later |
| **Message history** | Keep on re-pairing | Users don't lose data if they unpair/re-pair |
| **Session corruption** | Force re-pairing | Safest approach, prevents security vulnerabilities |
| **Mobile background** | Polling on app open | Simpler than background tasks, iOS-friendly |
| **E2EE protocol** | Signal Protocol | Industry-standard, proven security, forward secrecy |

---

## 10. User Flows

### Pairing Flow

1. **User opens TUI** → Logged in → Sees "Press P to pair new device"
2. **Presses P** → TUI generates identity key pair → Calls `pairing.initiate()`
3. **Server** creates pairing session (expires in 5min) → Returns QR payload
4. **TUI** renders QR code using custom Unicode renderer
5. **User opens mobile app** → Taps "Pair Desktop" → Camera opens
6. **User scans QR** → Mobile parses payload → Generates own key pair
7. **Mobile** performs ECDH key agreement → Initializes Signal session
8. **Mobile** calls `pairing.complete()` with encrypted handshake
9. **Server** validates → Creates `devicePairing` record → Emits SSE to TUI
10. **TUI** receives pairing event → Completes Signal session → Shows "Paired with iPhone"

### Message Sending Flow

1. **User opens mobile** → Navigates to "Messages" → Taps "Send"
2. **Types message** → "Check out this repo: https://github.com/..."
3. **Taps send** → Mobile encrypts with Signal Protocol
4. **Mobile** stores locally (SQLite) + POSTs to `message.send()`
5. **Server** stores encrypted message → Emits SSE to all paired TUIs
6. **TUI(s)** receive SSE event → Decrypt with Signal Protocol
7. **TUI** stores locally + displays in inbox
8. **TUI** sends delivery receipt → Server updates status
9. **Mobile** receives delivery notification → Updates UI to "delivered"

### Offline → Online Flow

1. **TUI is offline** when mobile sends 3 messages
2. **Server** stores all 3 messages (status = "pending")
3. **TUI comes online** → Subscribes to `message.onMessage({ lastEventId: "msg-123" })`
4. **Server** yields missed messages (msg-124, msg-125, msg-126) via SSE
5. **TUI** receives all 3 → Decrypts → Stores locally → Displays
6. **TUI** sends bulk delivery receipts
7. **Mobile** sees all 3 marked as "delivered"

### Mobile Background → Foreground Flow

1. **Mobile app backgrounded** → Subscription disconnects
2. **Server** queues 2 new messages (status = "sent")
3. **User opens app** → AppState becomes "active"
4. **Mobile** calls `message.getPending({ since: lastMessageId })`
5. **Server** returns 2 missed messages
6. **Mobile** decrypts → stores locally → updates UI
7. **Mobile** re-establishes subscription for new messages

---

## Security Considerations

### Key Management

- **Private keys never leave device** (mobile: SecureStore, TUI: encrypted file in `~/.auxlink/`)
- **Server never sees plaintext messages** (zero-knowledge architecture)
- **Session state backed up** to server (encrypted with user password - future enhancement)

### Attack Vectors & Mitigations

| Attack | Mitigation |
|--------|-----------|
| MITM during pairing | Encrypted handshake in QR flow, user must be authenticated |
| QR code reuse | 5-minute expiration, one-time use, server validates |
| Message replay | Signal Protocol nonce/counter prevents replay attacks |
| Compromised server | E2EE ensures server can't read message content |
| Device theft | Private keys encrypted at rest, require re-auth after timeout |
| Session corruption | Force re-pairing (safest approach) |

### Compliance

- **GDPR**: User can delete all messages (right to erasure)
- **Future webhooks**: Design allows separate "service account" device type (can bypass E2EE for bots)
- **Multi-device**: Schema supports multiple TUIs per user

---

## Testing Strategy

### Unit Tests

- Signal Protocol encrypt/decrypt
- QR code payload generation/parsing
- Message routing logic
- Device name generation

### Integration Tests

- Complete pairing flow (TUI → Mobile)
- Message send → receive → decrypt
- Offline message queuing
- Subscription reconnection with lastEventId

### Manual Testing Checklist

- [ ] TUI shows QR code after pairing initiation
- [ ] Mobile successfully scans QR code
- [ ] Mobile and TUI establish shared secret
- [ ] Mobile sends encrypted message
- [ ] TUI receives and decrypts message correctly
- [ ] Message shows in TUI inbox immediately (if online)
- [ ] Message delivered after TUI comes online (if offline)
- [ ] Multiple messages preserve order
- [ ] Pairing session expires after 5 minutes
- [ ] 1 mobile can pair with multiple TUIs
- [ ] All paired TUIs receive same message
- [ ] Mobile app sync works on foreground
- [ ] Message history persists on app restart
- [ ] Device names auto-generate correctly

---

## File Locations Reference

### Database Schema
- `packages/db/src/schema/device.ts`
- `packages/db/src/schema/device-pairing.ts`
- `packages/db/src/schema/pairing-session.ts`
- `packages/db/src/schema/message.ts`
- `packages/db/src/schema/signal-session.ts`

### tRPC API
- `packages/api/src/routers/device.ts`
- `packages/api/src/routers/pairing.ts`
- `packages/api/src/routers/message.ts`
- `packages/api/src/utils/device-name.ts`

### Server
- `apps/server/src/index.ts` (add tRPC handler)

### Mobile App
- `apps/native/app/(drawer)/messages/index.tsx` (message list)
- `apps/native/app/(drawer)/messages/send.tsx` (send message)
- `apps/native/app/(drawer)/pairing.tsx` (QR scanner)
- `apps/native/lib/signal-client.ts` (Signal Protocol wrapper)
- `apps/native/lib/message-storage.ts` (SQLite storage)
- `apps/native/utils/trpc.ts` (add SSE subscription link)

### TUI App
- `apps/tui/src/components/messages.tsx` (message inbox)
- `apps/tui/src/components/pairing.tsx` (QR code display)
- `apps/tui/src/lib/signal-client.ts` (Signal Protocol wrapper)
- `apps/tui/src/lib/message-storage.ts` (SQLite storage)
- `apps/tui/src/utils/trpc.ts` (add SSE subscription link)

### Shared Packages
- `packages/crypto/src/signal.ts` (Signal Protocol helpers)
- `packages/crypto/src/qr-renderer.ts` (QR code generation & rendering)

---

## Next Steps

1. **Review this plan** and confirm all requirements are met
2. **Start Phase 1**: Create database schema and device registration
3. **Iterate through phases** with regular testing
4. **Gather feedback** after each phase completion

This plan provides a complete roadmap for building an E2EE mobile-to-desktop messenger with Signal Protocol, QR code pairing, and real-time message delivery using tRPC subscriptions.

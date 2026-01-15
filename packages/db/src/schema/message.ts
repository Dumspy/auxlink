import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { device } from "./device";

export const message = sqliteTable(
  "message",
  {
    id: text("id").primaryKey(), // UUID

    // Routing
    senderDeviceId: text("sender_device_id")
      .notNull()
      .references(() => device.id, { onDelete: "cascade" }),
    recipientDeviceId: text("recipient_device_id")
      .notNull()
      .references(() => device.id, { onDelete: "cascade" }),

    // Encrypted content (RSA-OAEP encrypted)
    encryptedContent: text("encrypted_content").notNull(), // Base64

    // Message metadata (unencrypted for server routing)
    contentType: text("content_type").notNull().default("text"), // "text", "link", "file"

    // Delivery tracking
    status: text("status", {
      enum: ["pending", "sent", "delivered", "read"],
    })
      .notNull()
      .default("pending"),
    sentAt: integer("sent_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
    readAt: integer("read_at", { mode: "timestamp_ms" }),

    // TTL support (for future)
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("message_sender_idx").on(table.senderDeviceId),
    index("message_recipient_idx").on(table.recipientDeviceId),
    index("message_status_idx").on(table.status),
  ]
);

export const messageRelations = relations(message, ({ one }) => ({
  sender: one(device, {
    fields: [message.senderDeviceId],
    references: [device.id],
  }),
  recipient: one(device, {
    fields: [message.recipientDeviceId],
    references: [device.id],
  }),
}));

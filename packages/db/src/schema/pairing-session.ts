import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { device } from "./device";

export const pairingSession = sqliteTable("pairing_session", {
  id: text("id").primaryKey(), // UUID
  tuiDeviceId: text("tui_device_id")
    .notNull()
    .references(() => device.id, { onDelete: "cascade" }),

  // QR code data
  qrCodePayload: text("qr_code_payload").notNull(), // JSON

  // State
  status: text("status", {
    enum: ["pending", "scanned", "completed", "expired"],
  })
    .notNull()
    .default("pending"),

  // Expiry (QR codes expire after 5 minutes)
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
});

export const pairingSessionRelations = relations(pairingSession, ({ one }) => ({
  tuiDevice: one(device, {
    fields: [pairingSession.tuiDeviceId],
    references: [device.id],
  }),
}));

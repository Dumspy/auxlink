import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { device } from "./device";

export const devicePairing = sqliteTable(
  "device_pairing",
  {
    id: text("id").primaryKey(), // UUID
    mobileDeviceId: text("mobile_device_id")
      .notNull()
      .references(() => device.id, { onDelete: "cascade" }),
    tuiDeviceId: text("tui_device_id")
      .notNull()
      .references(() => device.id, { onDelete: "cascade" }),

    pairedAt: integer("paired_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),

    // Keep pairing even if devices disconnect (for message history)
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    uniqueIndex("device_pairing_unique").on(table.mobileDeviceId, table.tuiDeviceId),
    index("device_pairing_mobile_idx").on(table.mobileDeviceId),
    index("device_pairing_tui_idx").on(table.tuiDeviceId),
  ]
);

export const devicePairingRelations = relations(devicePairing, ({ one }) => ({
  mobileDevice: one(device, {
    fields: [devicePairing.mobileDeviceId],
    references: [device.id],
    relationName: "mobilePairings",
  }),
  tuiDevice: one(device, {
    fields: [devicePairing.tuiDeviceId],
    references: [device.id],
    relationName: "tuiPairings",
  }),
}));

import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { device } from "./device";

export const signalSession = sqliteTable(
  "signal_session",
  {
    id: text("id").primaryKey(), // UUID

    // Device pair
    deviceId: text("device_id")
      .notNull()
      .references(() => device.id, { onDelete: "cascade" }),
    remoteDeviceId: text("remote_device_id")
      .notNull()
      .references(() => device.id, { onDelete: "cascade" }),

    // Signal Protocol state (serialized)
    sessionState: text("session_state").notNull(), // Serialized Double Ratchet state

    // Metadata
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("signal_session_unique_pair").on(table.deviceId, table.remoteDeviceId),
  ]
);

export const signalSessionRelations = relations(signalSession, ({ one }) => ({
  device: one(device, {
    fields: [signalSession.deviceId],
    references: [device.id],
  }),
  remoteDevice: one(device, {
    fields: [signalSession.remoteDeviceId],
    references: [device.id],
  }),
}));

import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { devicePairing } from "./device-pairing";

export const device = sqliteTable(
  "device",
  {
    id: text("id").primaryKey(), // UUID
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    deviceType: text("device_type", { enum: ["mobile", "tui"] }).notNull(),

    // Auto-generated name
    name: text("name").notNull(), // e.g. "iPhone (iOS 17.2)", "Ubuntu Desktop"

    // RSA Encryption Key
    publicKey: text("public_key"), // RSA-2048 public key in PEM format

    // Metadata
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("device_user_idx").on(table.userId)]
);

export const deviceRelations = relations(device, ({ one, many }) => ({
  user: one(user, { fields: [device.userId], references: [user.id] }),
  mobilePairings: many(devicePairing, { relationName: "mobilePairings" }),
  tuiPairings: many(devicePairing, { relationName: "tuiPairings" }),
}));

import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const purchases = sqliteTable(
  "purchases",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    profile: text("profile").notNull().default("wenwen"),
    purchaseDate: text("purchase_date").notNull(),
    purchaseTime: text("purchase_time").notNull().default(""),
    purchaseCount: integer("purchase_count").notNull().default(1),
    totalAmount: real("total_amount").notNull(),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_purchases_purchase_date").on(table.purchaseDate),
    index("idx_purchases_profile_purchase_date").on(
      table.profile,
      table.purchaseDate
    ),
  ]
);

export const injections = sqliteTable(
  "injections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    profile: text("profile").notNull().default("wenwen"),
    injectionDate: text("injection_date").notNull(),
    injectionTime: text("injection_time").notNull().default(""),
    doseMg: real("dose_mg"),
    location: text("location").notNull(),
    nextInjectionDate: text("next_injection_date").notNull().default(""),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_injections_injection_date").on(table.injectionDate),
    index("idx_injections_profile_injection_date").on(
      table.profile,
      table.injectionDate
    ),
    index("idx_injections_location").on(table.location),
  ]
);

export const weights = sqliteTable(
  "weights",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    profile: text("profile").notNull().default("wenwen"),
    recordDate: text("record_date").notNull(),
    recordTime: text("record_time").notNull().default(""),
    weightKg: real("weight_kg").notNull(),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_weights_record_date").on(table.recordDate),
    index("idx_weights_profile_record_date").on(
      table.profile,
      table.recordDate
    ),
  ]
);

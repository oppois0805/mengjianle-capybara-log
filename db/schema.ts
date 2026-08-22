import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const purchases = sqliteTable(
  "purchases",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    purchaseDate: text("purchase_date").notNull(),
    purchaseTime: text("purchase_time").notNull().default(""),
    purchaseCount: integer("purchase_count").notNull().default(1),
    totalAmount: real("total_amount").notNull(),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_purchases_purchase_date").on(table.purchaseDate)]
);

export const injections = sqliteTable(
  "injections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    injectionDate: text("injection_date").notNull(),
    injectionTime: text("injection_time").notNull().default(""),
    location: text("location").notNull(),
    nextInjectionDate: text("next_injection_date").notNull().default(""),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_injections_injection_date").on(table.injectionDate),
    index("idx_injections_location").on(table.location),
  ]
);

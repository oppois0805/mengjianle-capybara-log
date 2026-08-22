import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

let schemaReady: Promise<void> | null = null;

function getD1() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return env.DB;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}

async function ensureProfileColumn(
  d1: ReturnType<typeof getD1>,
  table: "purchases" | "injections" | "weights"
) {
  const columns = await d1
    .prepare(`PRAGMA table_info(${table})`)
    .all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "profile")) {
    await d1
      .prepare(
        `ALTER TABLE ${table} ADD COLUMN profile TEXT NOT NULL DEFAULT 'wenwen'`
      )
      .run();
  }
}

export async function ensureDbSchema() {
  if (!schemaReady) {
    const d1 = getD1();
    schemaReady = (async () => {
      await d1.batch([
        d1.prepare(
          `CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile TEXT NOT NULL DEFAULT 'wenwen',
            purchase_date TEXT NOT NULL,
            purchase_time TEXT NOT NULL DEFAULT '',
            purchase_count INTEGER NOT NULL DEFAULT 1,
            total_amount REAL NOT NULL,
            note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`
        ),
        d1.prepare(
          `CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date
            ON purchases (purchase_date)`
        ),
        d1.prepare(
          `CREATE TABLE IF NOT EXISTS injections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile TEXT NOT NULL DEFAULT 'wenwen',
            injection_date TEXT NOT NULL,
            injection_time TEXT NOT NULL DEFAULT '',
            location TEXT NOT NULL,
            next_injection_date TEXT NOT NULL DEFAULT '',
            note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`
        ),
        d1.prepare(
          `CREATE INDEX IF NOT EXISTS idx_injections_injection_date
            ON injections (injection_date)`
        ),
        d1.prepare(
          `CREATE INDEX IF NOT EXISTS idx_injections_location
            ON injections (location)`
        ),
        d1.prepare(
          `CREATE TABLE IF NOT EXISTS weights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile TEXT NOT NULL DEFAULT 'wenwen',
            record_date TEXT NOT NULL,
            record_time TEXT NOT NULL DEFAULT '',
            weight_kg REAL NOT NULL,
            note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`
        ),
        d1.prepare(
          `CREATE INDEX IF NOT EXISTS idx_weights_record_date
            ON weights (record_date)`
        ),
      ]);

      await ensureProfileColumn(d1, "purchases");
      await ensureProfileColumn(d1, "injections");
      await ensureProfileColumn(d1, "weights");

      await d1.batch([
        d1.prepare(
          `CREATE INDEX IF NOT EXISTS idx_purchases_profile_purchase_date
            ON purchases (profile, purchase_date)`
        ),
        d1.prepare(
          `CREATE INDEX IF NOT EXISTS idx_injections_profile_injection_date
            ON injections (profile, injection_date)`
        ),
        d1.prepare(
          `CREATE INDEX IF NOT EXISTS idx_weights_profile_record_date
            ON weights (profile, record_date)`
        ),
        d1.prepare("PRAGMA optimize"),
      ]);
    })();
  }

  await schemaReady;
}

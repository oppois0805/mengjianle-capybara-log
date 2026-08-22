import { and, desc, eq, sql } from "drizzle-orm";
import { ensureDbSchema, getDb } from "../../../db";
import { injections, purchases, weights } from "../../../db/schema";

const locations = new Set([
  "upper_left",
  "upper_right",
  "lower_left",
  "lower_right",
]);
const profiles = new Set(["wenwen", "haohao"]);

function addDays(date: string, days: number) {
  if (!date) return "";
  const value = new Date(`${date}T12:00:00`);
  if (Number.isNaN(value.getTime())) return "";
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function toText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toProfile(value: unknown) {
  const profile = toText(value);
  return profiles.has(profile) ? profile : "";
}

function toDate(value: unknown) {
  const text = toText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = new Date(`${text}T12:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text
    ? ""
    : text;
}

function toTime(value: unknown) {
  const text = toText(value);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : "";
}

function toPositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function toAmount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : -1;
}

function toWeight(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 20 && parsed <= 500
    ? Math.round(parsed * 100) / 100
    : -1;
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "發生未預期的錯誤";
  const detail =
    error instanceof Error && error.cause instanceof Error
      ? error.cause.message
      : "";
  if (`${message}\n${detail}`.includes("no such table")) {
    return "資料表尚未建立，請稍後再試。";
  }
  return message;
}

async function readTrackerData(db: ReturnType<typeof getDb>, profile: string) {
  const [totals] = await db
    .select({
      totalSpent: sql<number>`coalesce(sum(${purchases.totalAmount}), 0)`,
      totalPurchaseCount: sql<number>`coalesce(sum(${purchases.purchaseCount}), 0)`,
      purchaseRecordsCount: sql<number>`count(*)`,
    })
    .from(purchases)
    .where(eq(purchases.profile, profile));

  const purchaseRows = await db
    .select()
    .from(purchases)
    .where(eq(purchases.profile, profile))
    .orderBy(desc(purchases.purchaseDate), desc(purchases.id))
    .limit(80);

  const injectionRows = await db
    .select()
    .from(injections)
    .where(eq(injections.profile, profile))
    .orderBy(desc(injections.injectionDate), desc(injections.id))
    .limit(120);

  const weightRows = await db
    .select()
    .from(weights)
    .where(eq(weights.profile, profile))
    .orderBy(desc(weights.recordDate), desc(weights.recordTime), desc(weights.id))
    .limit(400);

  const [injectionTotals] = await db
    .select({
      injectionRecordsCount: sql<number>`count(*)`,
    })
    .from(injections)
    .where(eq(injections.profile, profile));

  const [weightTotals] = await db
    .select({ weightRecordsCount: sql<number>`count(*)` })
    .from(weights)
    .where(eq(weights.profile, profile));

  const lastInjection = injectionRows[0] ?? null;
  const nextInjectionDate =
    lastInjection?.nextInjectionDate ||
    addDays(lastInjection?.injectionDate ?? "", 7);

  return {
    summary: {
      totalSpent: Number(totals?.totalSpent ?? 0),
      totalPurchaseCount: Number(totals?.totalPurchaseCount ?? 0),
      purchaseRecordsCount: Number(totals?.purchaseRecordsCount ?? 0),
      injectionRecordsCount: Number(injectionTotals?.injectionRecordsCount ?? 0),
      weightRecordsCount: Number(weightTotals?.weightRecordsCount ?? 0),
      latestWeight: weightRows[0] ?? null,
      lastInjection,
      lastLocation: lastInjection?.location ?? null,
      nextInjectionDate: nextInjectionDate || null,
    },
    purchases: purchaseRows,
    injections: injectionRows,
    weights: weightRows,
  };
}

export async function GET(request: Request) {
  try {
    const profile = toProfile(new URL(request.url).searchParams.get("profile"));
    if (!profile) {
      return Response.json({ error: "請先選擇使用者。" }, { status: 400 });
    }
    await ensureDbSchema();
    const db = getDb();
    return Response.json(
      await readTrackerData(db, profile),
      { headers: { "cache-control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const type = toText(payload.type);
    const profile = toProfile(payload.profile);
    if (!profile) {
      return Response.json({ error: "請先選擇使用者。" }, { status: 400 });
    }
    await ensureDbSchema();
    const db = getDb();

    if (type === "purchase") {
      const purchaseDate = toDate(payload.purchaseDate);
      const purchaseTime = toTime(payload.purchaseTime);
      const purchaseCount = toPositiveInteger(payload.purchaseCount);
      const totalAmount = toAmount(payload.totalAmount);

      if (!purchaseDate || !purchaseCount || totalAmount < 0) {
        return Response.json(
          { error: "請確認購買日期、次數與總金額。" },
          { status: 400 }
        );
      }

      const [record] = await db
        .insert(purchases)
        .values({
          profile,
          purchaseDate,
          purchaseTime,
          purchaseCount,
          totalAmount,
          note: toText(payload.note),
        })
        .returning();
      return Response.json(
        { record, data: await readTrackerData(db, profile) },
        { status: 201, headers: { "cache-control": "no-store, max-age=0" } }
      );
    }

    if (type === "injection") {
      const injectionDate = toDate(payload.injectionDate);
      const injectionTime = toTime(payload.injectionTime);
      const location = toText(payload.location);
      const nextInjectionDate =
        toDate(payload.nextInjectionDate) || addDays(injectionDate, 7);

      if (!injectionDate || !locations.has(location)) {
        return Response.json(
          { error: "請確認施打日期與腹部位置。" },
          { status: 400 }
        );
      }

      const [record] = await db
        .insert(injections)
        .values({
          profile,
          injectionDate,
          injectionTime,
          location,
          nextInjectionDate,
          note: toText(payload.note),
        })
        .returning();
      return Response.json(
        { record, data: await readTrackerData(db, profile) },
        { status: 201, headers: { "cache-control": "no-store, max-age=0" } }
      );
    }

    if (type === "weight") {
      const recordDate = toDate(payload.recordDate);
      const recordTime = toTime(payload.recordTime);
      const weightKg = toWeight(payload.weightKg);

      if (!recordDate || weightKg < 0) {
        return Response.json(
          { error: "請確認測量日期與體重，體重需介於 20 至 500 公斤。" },
          { status: 400 }
        );
      }

      const [record] = await db
        .insert(weights)
        .values({
          profile,
          recordDate,
          recordTime,
          weightKg,
          note: toText(payload.note),
        })
        .returning();
      return Response.json(
        { record, data: await readTrackerData(db, profile) },
        { status: 201, headers: { "cache-control": "no-store, max-age=0" } }
      );
    }

    return Response.json({ error: "不支援的紀錄類型。" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "";
    const profile = toProfile(url.searchParams.get("profile"));
    const id = Number(url.searchParams.get("id"));
    if (!profile) {
      return Response.json({ error: "請先選擇使用者。" }, { status: 400 });
    }
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "紀錄編號無效。" }, { status: 400 });
    }

    await ensureDbSchema();
    const db = getDb();
    if (type === "purchase") {
      const [deleted] = await db
        .delete(purchases)
        .where(and(eq(purchases.id, id), eq(purchases.profile, profile)))
        .returning({ id: purchases.id });
      if (!deleted) {
        return Response.json({ error: "找不到要刪除的購買紀錄。" }, { status: 404 });
      }
      return Response.json({
        ok: true,
        deletedId: deleted.id,
        data: await readTrackerData(db, profile),
      });
    }
    if (type === "injection") {
      const [deleted] = await db
        .delete(injections)
        .where(and(eq(injections.id, id), eq(injections.profile, profile)))
        .returning({ id: injections.id });
      if (!deleted) {
        return Response.json({ error: "找不到要刪除的施打紀錄。" }, { status: 404 });
      }
      return Response.json({
        ok: true,
        deletedId: deleted.id,
        data: await readTrackerData(db, profile),
      });
    }
    if (type === "weight") {
      const [deleted] = await db
        .delete(weights)
        .where(and(eq(weights.id, id), eq(weights.profile, profile)))
        .returning({ id: weights.id });
      if (!deleted) {
        return Response.json({ error: "找不到要刪除的體重紀錄。" }, { status: 404 });
      }
      return Response.json({
        ok: true,
        deletedId: deleted.id,
        data: await readTrackerData(db, profile),
      });
    }
    return Response.json({ error: "不支援的紀錄類型。" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

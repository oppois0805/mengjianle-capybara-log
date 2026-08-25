import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    }
  );
}

test("renders the finished tracker shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>猛健樂卡皮巴拉紀錄<\/title>/);
  assert.match(html, /<mounjaro-tracker>/);
  assert.match(html, /\/mounjaro-app\.js/);
  assert.match(html, /mounjaro-app\.(?:css|js)\?v=20260825-trailing-weight-decimal/);
  assert.match(html, /\/og\.png/);
  assert.doesNotMatch(html, /codex-preview|_sites-preview|Starter Project/);
});

test("includes the Angular client and capybara assets", async () => {
  const [client, source, styles, api, schema] = await Promise.all([
    readFile(new URL("../public/mounjaro-app.js", import.meta.url), "utf8"),
    readFile(new URL("../app/angular/main.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/mounjaro-app.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/records/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    access(new URL("../public/capybara-hero.png", import.meta.url)),
    access(new URL("../public/og.png", import.meta.url)),
    access(new URL("../public/capybara-wenwen.png", import.meta.url)),
    access(new URL("../public/capybara-haohao.png", import.meta.url)),
  ]);
  assert.match(client, /mounjaro-tracker/);
  assert.match(client, /\/api\/records/);
  assert.match(source, /猛健樂紀錄/);
  assert.match(source, /下次施打/);
  assert.match(source, /總施打次數/);
  assert.match(source, /快速新增紀錄/);
  assert.match(source, /openEntry\('purchase'\)/);
  assert.match(source, /openEntry\('weight'\)/);
  assert.match(source, /<span>施打<\/span>/);
  assert.match(source, /<span>購買<\/span>/);
  assert.match(source, /<span>體重<\/span>/);
  assert.match(styles, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.quick-entry-button\.is-purchase/);
  assert.match(styles, /\.quick-entry-button\.is-weight/);
  assert.match(styles, /\.entry-view \.page-head[\s\S]*?min-height: 60px/);
  assert.match(source, /施打毫克/);
  assert.match(source, /class="dose-input-wrap"/);
  assert.match(source, /function autoTenths/);
  assert.match(source, /field === "weightKg" \? autoTenths\(value\)/);
  assert.match(source, /setTenthsInput\('doseMg', \$event\)/);
  assert.match(source, /setTenthsInput\('weightKg', \$event\)/);
  assert.match(source, /pattern="\[0-9\]\+\(\[\.\]\[0-9\]\*\)\?" \[value\]="weight\.weightKg"/);
  assert.match(source, /input\.setSelectionRange\(nextStart, nextEnd\)/);
  assert.match(source, /formatDose\(record\.doseMg\)/);
  assert.match(source, /data\.summary\.totalPurchaseCount/);
  assert.match(source, /確認儲存/);
  assert.match(source, /左上腹/);
  assert.match(source, /右下腹/);
  assert.match(source, /今天是誰使用/);
  assert.match(source, /profile=\$\{profile\}/);
  assert.match(source, /native-picker-input/);
  assert.match(source, /pickerDate/);
  assert.match(source, /type EntryTab = "injection" \| "purchase" \| "weight"/);
  assert.match(source, /health-trend-chart/);
  assert.match(source, /setChartRange/);
  assert.match(source, /openEditRecord/);
  assert.match(source, /method: editingId === null \? "POST" : "PATCH"/);
  assert.match(source, /today\.getDay\(\) === 0 \? 6 : today\.getDay\(\) - 1/);
  assert.match(source, /new Date\(year, month \+ 1, 0, 12\)\.getDate\(\)/);
  assert.match(source, /Array\.from\(\{ length: 12 \}/);
  assert.match(source, /class="loading-overlay"/);
  assert.match(source, /Number\.isFinite\(raw\)/);
  assert.match(source, /if \(!validItems\.length\) return ""/);
  assert.match(styles, /\.profile-wenwen \.loading-overlay/);
  assert.match(styles, /\.profile-haohao \.loading-overlay/);
  assert.match(styles, /animation: capybara-loading-spin/);
  assert.match(styles, /transform: translateY\(-50%\)/);
  assert.match(client, /echarts/);
  assert.match(api, /export async function PATCH/);
  assert.match(api, /type === "weight"/);
  assert.match(api, /weightRecordsCount/);
  assert.match(api, /doseMg/);
  assert.match(schema, /export const weights = sqliteTable/);
  assert.match(schema, /doseMg: real\("dose_mg"\)/);
});

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
  assert.match(html, /\/og\.png/);
  assert.doesNotMatch(html, /codex-preview|_sites-preview|Starter Project/);
});

test("includes the Angular client and capybara assets", async () => {
  const [client, source] = await Promise.all([
    readFile(new URL("../public/mounjaro-app.js", import.meta.url), "utf8"),
    readFile(new URL("../app/angular/main.ts", import.meta.url), "utf8"),
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
  assert.match(source, /確認儲存/);
  assert.match(source, /左上腹/);
  assert.match(source, /右下腹/);
  assert.match(source, /今天是誰使用/);
  assert.match(source, /profile=\$\{profile\}/);
  assert.match(source, /native-picker-input/);
  assert.match(source, /pickerDate/);
});

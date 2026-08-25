export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const title = "猛健樂卡皮巴拉紀錄";
  const description = "記錄猛健樂購買時間、次數、金額，以及腹部四象限施打位置。";
  const socialImage = `${origin}/og.png`;
  const assetVersion = "20260825-compact-entry-head";

  const html = `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:type" content="website">
    <meta property="og:locale" content="zh_TW">
    <meta property="og:image" content="${socialImage}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${socialImage}">
    <link rel="stylesheet" href="/mounjaro-app.css?v=${assetVersion}">
  </head>
  <body>
    <main class="page-shell">
      <mounjaro-tracker>
        <section class="tracker-loading" aria-live="polite">
          <div class="loading-card">
            <div class="loading-mascot" aria-hidden="true"></div>
            <p>猛健樂紀錄載入中</p>
          </div>
        </section>
      </mounjaro-tracker>
    </main>
    <script src="/mounjaro-app.js?v=${assetVersion}" defer></script>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "cache-control": "no-cache",
      "content-type": "text/html; charset=utf-8",
    },
  });
}

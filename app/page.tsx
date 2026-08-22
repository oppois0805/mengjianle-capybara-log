import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "猛健樂卡皮巴拉紀錄",
  description: "記錄購買時間、次數、金額與肚子四象限施打位置。",
};

export default function Home() {
  return (
    <main className="page-shell">
      <mounjaro-tracker>
        <section className="tracker-loading" aria-live="polite">
          <div className="loading-card">
            <div className="loading-mascot" aria-hidden="true" />
            <p>猛健樂紀錄載入中</p>
          </div>
        </section>
      </mounjaro-tracker>
      <script src="/mounjaro-app.js" defer />
    </main>
  );
}

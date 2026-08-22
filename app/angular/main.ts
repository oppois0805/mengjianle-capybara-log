import "zone.js";
import "@angular/compiler";
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";

type EntryTab = "injection" | "purchase";
type ViewTab = "entry" | "history";
type LocationKey = "upper_left" | "upper_right" | "lower_left" | "lower_right";

interface PurchaseRecord {
  id: number;
  purchaseDate: string;
  purchaseTime: string;
  purchaseCount: number;
  totalAmount: number;
  note: string;
}

interface InjectionRecord {
  id: number;
  injectionDate: string;
  injectionTime: string;
  location: LocationKey;
  nextInjectionDate: string;
  note: string;
}

interface TrackerData {
  summary: {
    totalSpent: number;
    totalPurchaseCount: number;
    purchaseRecordsCount: number;
    lastInjection: InjectionRecord | null;
    lastLocation: LocationKey | null;
    nextInjectionDate: string | null;
  };
  purchases: PurchaseRecord[];
  injections: InjectionRecord[];
}

const locationLabels: Record<LocationKey, string> = {
  upper_left: "左上腹",
  upper_right: "右上腹",
  lower_left: "左下腹",
  lower_right: "右下腹",
};

const emptyData: TrackerData = {
  summary: {
    totalSpent: 0,
    totalPurchaseCount: 0,
    purchaseRecordsCount: 0,
    lastInjection: null,
    lastLocation: null,
    nextInjectionDate: null,
  },
  purchases: [],
  injections: [],
};

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function currentTime() {
  const value = new Date();
  return `${String(value.getHours()).padStart(2, "0")}:${String(
    value.getMinutes()
  ).padStart(2, "0")}`;
}

function addDays(date: string, days: number) {
  if (!date) return "";
  const value = new Date(`${date}T12:00:00`);
  if (Number.isNaN(value.getTime())) return "";
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

@Component({
  selector: "mounjaro-tracker",
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="app-frame" [class.is-busy]="loading">
      <header class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Capybara Dose Log</p>
          <h1>猛健樂卡皮巴拉紀錄</h1>
          <p class="hero-line">購買、施打、花費和位置，讓卡皮巴拉陪你輕鬆記好。</p>
        </div>
        <figure class="hero-art">
          <img src="/capybara-hero.png" alt="可愛卡皮巴拉拿著個人紀錄本" />
        </figure>
      </header>

      <section class="notice-grid" aria-label="首頁重點提醒">
        <article class="notice-card notice-money">
          <span>累計花費</span>
          <strong>{{ currency(data.summary.totalSpent) }}</strong>
          <small>{{ data.summary.purchaseRecordsCount }} 筆購買，合計 {{ data.summary.totalPurchaseCount }} 次</small>
        </article>
        <article class="notice-card notice-next">
          <span>下次施打日期</span>
          <strong>{{ data.summary.nextInjectionDate || "尚未設定" }}</strong>
          <small>日期可在每次施打時調整</small>
        </article>
        <article class="notice-card notice-place">
          <span>上次施打位置</span>
          <strong>{{ placeLabel(data.summary.lastLocation) }}</strong>
          <small>{{ data.summary.lastInjection?.injectionDate || "尚無紀錄" }}</small>
        </article>
      </section>

      <nav class="mobile-switch" aria-label="主要功能">
        <button type="button" [class.is-active]="activeView === 'entry'" (click)="activeView = 'entry'">
          新增
        </button>
        <button type="button" [class.is-active]="activeView === 'history'" (click)="activeView = 'history'">
          查詢
        </button>
      </nav>

      <div class="content-grid">
        <section class="panel entry-panel" [class.mobile-hidden]="activeView !== 'entry'">
          <div class="panel-head">
            <div>
              <span class="section-kicker">New Record</span>
              <h2>新增紀錄</h2>
            </div>
            <div class="segmented" aria-label="紀錄類型">
              <button type="button" [class.is-active]="activeEntry === 'injection'" (click)="activeEntry = 'injection'">
                施打
              </button>
              <button type="button" [class.is-active]="activeEntry === 'purchase'" (click)="activeEntry = 'purchase'">
                購買
              </button>
            </div>
          </div>

          <form class="record-form" *ngIf="activeEntry === 'injection'" (submit)="saveInjection($event)">
            <div class="field-row">
              <label>
                <span>施打日期</span>
                <input type="date" [value]="injection.injectionDate" (input)="setInjection('injectionDate', valueFrom($event))" required />
              </label>
              <label>
                <span>時間</span>
                <input type="time" [value]="injection.injectionTime" (input)="setInjection('injectionTime', valueFrom($event))" />
              </label>
            </div>

            <fieldset class="quadrant-field">
              <legend>這次打哪裡？</legend>
              <div class="belly-map" role="radiogroup" aria-label="腹部四象限位置">
                <button
                  *ngFor="let option of locationOptions"
                  type="button"
                  class="quadrant"
                  [class.upper_left]="option.key === 'upper_left'"
                  [class.upper_right]="option.key === 'upper_right'"
                  [class.lower_left]="option.key === 'lower_left'"
                  [class.lower_right]="option.key === 'lower_right'"
                  [class.is-selected]="injection.location === option.key"
                  (click)="setInjection('location', option.key)"
                  role="radio"
                  [attr.aria-checked]="injection.location === option.key"
                >
                  <span>{{ option.label }}</span>
                </button>
                <div class="belly-center" aria-hidden="true"></div>
              </div>
            </fieldset>

            <label>
              <span>下次施打日期</span>
              <input type="date" [value]="injection.nextInjectionDate" (input)="setInjection('nextInjectionDate', valueFrom($event))" />
            </label>

            <label>
              <span>備註</span>
              <textarea rows="3" [value]="injection.note" (input)="setInjection('note', valueFrom($event))" placeholder="例如：劑量、感受或其他提醒"></textarea>
            </label>

            <button class="primary-action" type="submit" [disabled]="saving === 'injection'">
              {{ saving === 'injection' ? '儲存中...' : '儲存施打紀錄' }}
            </button>
          </form>

          <form class="record-form" *ngIf="activeEntry === 'purchase'" (submit)="savePurchase($event)">
            <div class="field-row">
              <label>
                <span>購買日期</span>
                <input type="date" [value]="purchase.purchaseDate" (input)="setPurchase('purchaseDate', valueFrom($event))" required />
              </label>
              <label>
                <span>購買時間</span>
                <input type="time" [value]="purchase.purchaseTime" (input)="setPurchase('purchaseTime', valueFrom($event))" />
              </label>
            </div>

            <div class="field-row">
              <label>
                <span>購買次數</span>
                <input type="number" min="1" step="1" inputmode="numeric" [value]="purchase.purchaseCount" (input)="setPurchase('purchaseCount', valueFrom($event))" required />
              </label>
              <label>
                <span>總金額（元）</span>
                <input type="number" min="0" step="1" inputmode="decimal" [value]="purchase.totalAmount" (input)="setPurchase('totalAmount', valueFrom($event))" required />
              </label>
            </div>

            <label>
              <span>備註</span>
              <textarea rows="3" [value]="purchase.note" (input)="setPurchase('note', valueFrom($event))" placeholder="例如：購買地點或品項"></textarea>
            </label>

            <button class="primary-action" type="submit" [disabled]="saving === 'purchase'">
              {{ saving === 'purchase' ? '儲存中...' : '儲存購買紀錄' }}
            </button>
          </form>

          <p class="status-line" *ngIf="message" [class.is-error]="messageTone === 'error'" aria-live="polite">
            {{ message }}
          </p>
        </section>

        <section class="panel history-panel" [class.mobile-hidden]="activeView !== 'history'">
          <div class="panel-head">
            <div>
              <span class="section-kicker">History</span>
              <h2>歷史紀錄</h2>
            </div>
            <button class="ghost-button" type="button" (click)="load()">重新整理</button>
          </div>

          <div class="filter-bar">
            <label>
              <span>施打位置</span>
              <select [value]="filterLocation" (change)="filterLocation = valueFrom($event)">
                <option value="all">全部位置</option>
                <option *ngFor="let option of locationOptions" [value]="option.key">{{ option.label }}</option>
              </select>
            </label>
            <label>
              <span>日期</span>
              <input type="date" [value]="filterDate" (input)="filterDate = valueFrom($event)" />
            </label>
          </div>

          <div class="history-block">
            <div class="history-title">
              <h3>施打紀錄</h3>
              <span>{{ filteredInjections.length }} 筆</span>
            </div>
            <article class="record-card empty-card" *ngIf="!filteredInjections.length">目前沒有符合條件的施打紀錄。</article>
            <article class="record-card" *ngFor="let record of filteredInjections">
              <div>
                <strong>{{ record.injectionDate }}</strong>
                <small>{{ record.injectionTime || '--:--' }} · {{ placeLabel(record.location) }}</small>
                <p *ngIf="record.note">{{ record.note }}</p>
              </div>
              <button class="icon-delete" type="button" aria-label="刪除施打紀錄" title="刪除" (click)="deleteRecord('injection', record.id)">×</button>
            </article>
          </div>

          <div class="history-block">
            <div class="history-title">
              <h3>購買紀錄</h3>
              <span>{{ filteredPurchases.length }} 筆</span>
            </div>
            <article class="record-card empty-card" *ngIf="!filteredPurchases.length">目前沒有符合條件的購買紀錄。</article>
            <article class="record-card" *ngFor="let record of filteredPurchases">
              <div>
                <strong>{{ record.purchaseDate }}</strong>
                <small>{{ record.purchaseTime || '--:--' }} · {{ record.purchaseCount }} 次</small>
                <p>{{ currency(record.totalAmount) }}{{ record.note ? ' · ' + record.note : '' }}</p>
              </div>
              <button class="icon-delete" type="button" aria-label="刪除購買紀錄" title="刪除" (click)="deleteRecord('purchase', record.id)">×</button>
            </article>
          </div>
        </section>
      </div>

      <p class="medical-note">僅供個人紀錄；施打方式與日期請依醫師或藥師指示。</p>
    </section>
  `,
})
class TrackerAppComponent {
  readonly locationOptions = [
    { key: "upper_left" as const, label: locationLabels.upper_left },
    { key: "upper_right" as const, label: locationLabels.upper_right },
    { key: "lower_left" as const, label: locationLabels.lower_left },
    { key: "lower_right" as const, label: locationLabels.lower_right },
  ];

  data: TrackerData = emptyData;
  activeEntry: EntryTab = "injection";
  activeView: ViewTab = "entry";
  filterLocation = "all";
  filterDate = "";
  loading = true;
  saving: EntryTab | "" = "";
  message = "";
  messageTone: "success" | "error" = "success";

  purchase = this.newPurchase();
  injection = this.newInjection();

  ngOnInit() {
    void this.load();
  }

  get filteredInjections() {
    return this.data.injections.filter((record) => {
      const sameLocation = this.filterLocation === "all" || record.location === this.filterLocation;
      const sameDate = !this.filterDate || record.injectionDate === this.filterDate;
      return sameLocation && sameDate;
    });
  }

  get filteredPurchases() {
    return this.data.purchases.filter(
      (record) => !this.filterDate || record.purchaseDate === this.filterDate
    );
  }

  valueFrom(event: Event) {
    return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }

  placeLabel(location: LocationKey | null | undefined) {
    return location ? locationLabels[location] : "尚未設定";
  }

  currency(value: number) {
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  setPurchase(field: keyof typeof this.purchase, value: string) {
    this.purchase = { ...this.purchase, [field]: value };
  }

  setInjection(field: keyof typeof this.injection, value: string) {
    const next = {
      ...this.injection,
      [field]: field === "location" ? (value as LocationKey) : value,
    };
    if (field === "injectionDate") next.nextInjectionDate = addDays(value, 7);
    this.injection = next;
  }

  async load() {
    this.loading = true;
    try {
      const response = await fetch("/api/records");
      const payload = (await response.json()) as TrackerData & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "讀取紀錄失敗");
      this.data = payload as TrackerData;
    } catch (error) {
      this.showMessage(error instanceof Error ? error.message : "讀取紀錄失敗", "error");
    } finally {
      this.loading = false;
    }
  }

  async savePurchase(event: Event) {
    event.preventDefault();
    const saved = await this.save("purchase", {
      type: "purchase",
      ...this.purchase,
      purchaseCount: Number(this.purchase.purchaseCount),
      totalAmount: Number(this.purchase.totalAmount),
    });
    if (saved) this.purchase = this.newPurchase();
  }

  async saveInjection(event: Event) {
    event.preventDefault();
    const saved = await this.save("injection", { type: "injection", ...this.injection });
    if (saved) this.injection = this.newInjection();
  }

  async save(type: EntryTab, body: Record<string, unknown>) {
    this.saving = type;
    try {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        error?: string;
      } & Record<string, unknown>;
      if (!response.ok) throw new Error(payload.error || "儲存失敗");
      await this.load();
      this.showMessage("已儲存紀錄", "success");
      return true;
    } catch (error) {
      this.showMessage(error instanceof Error ? error.message : "儲存失敗", "error");
      return false;
    } finally {
      this.saving = "";
    }
  }

  async deleteRecord(type: EntryTab, id: number) {
    if (!window.confirm("確定要刪除這筆紀錄嗎？")) return;
    try {
      const response = await fetch(`/api/records?type=${type}&id=${id}`, { method: "DELETE" });
      const payload = (await response.json()) as {
        error?: string;
      } & Record<string, unknown>;
      if (!response.ok) throw new Error(payload.error || "刪除失敗");
      await this.load();
      this.showMessage("已刪除紀錄", "success");
    } catch (error) {
      this.showMessage(error instanceof Error ? error.message : "刪除失敗", "error");
    }
  }

  showMessage(message: string, tone: "success" | "error") {
    this.message = message;
    this.messageTone = tone;
  }

  private newPurchase() {
    return {
      purchaseDate: localDate(),
      purchaseTime: currentTime(),
      purchaseCount: "1",
      totalAmount: "",
      note: "",
    };
  }

  private newInjection() {
    const date = localDate();
    return {
      injectionDate: date,
      injectionTime: currentTime(),
      location: "upper_left" as LocationKey,
      nextInjectionDate: addDays(date, 7),
      note: "",
    };
  }
}

bootstrapApplication(TrackerAppComponent).catch((error) => console.error(error));

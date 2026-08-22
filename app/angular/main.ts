import "zone.js";
import "@angular/compiler";
import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, OnDestroy, inject } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

type EntryTab = "injection" | "purchase" | "weight";
type ViewTab = "home" | "entry" | "history";
type ChartRange = "week" | "month" | "year";
type LocationKey = "upper_left" | "upper_right" | "lower_left" | "lower_right";
type ProfileKey = "wenwen" | "haohao";

interface ChartBucket {
  key: string;
  label: string;
  fullLabel: string;
  startDate: string;
  endDate: string;
}

interface PurchaseRecord {
  id: number;
  profile: ProfileKey;
  purchaseDate: string;
  purchaseTime: string;
  purchaseCount: number;
  totalAmount: number;
  note: string;
}

interface InjectionRecord {
  id: number;
  profile: ProfileKey;
  injectionDate: string;
  injectionTime: string;
  location: LocationKey;
  nextInjectionDate: string;
  note: string;
}

interface WeightRecord {
  id: number;
  profile: ProfileKey;
  recordDate: string;
  recordTime: string;
  weightKg: number;
  note: string;
}

type EditableRecord = PurchaseRecord | InjectionRecord | WeightRecord;

interface TrackerData {
  summary: {
    totalSpent: number;
    totalPurchaseCount: number;
    purchaseRecordsCount: number;
    injectionRecordsCount: number;
    weightRecordsCount: number;
    latestWeight: WeightRecord | null;
    lastInjection: InjectionRecord | null;
    lastLocation: LocationKey | null;
    nextInjectionDate: string | null;
  };
  purchases: PurchaseRecord[];
  injections: InjectionRecord[];
  weights: WeightRecord[];
}

const locationLabels: Record<LocationKey, string> = {
  upper_left: "左上腹",
  upper_right: "右上腹",
  lower_left: "左下腹",
  lower_right: "右下腹",
};

const locationCycle: Record<LocationKey, LocationKey> = {
  upper_left: "upper_right",
  upper_right: "lower_right",
  lower_right: "lower_left",
  lower_left: "upper_left",
};

const profileOptions = [
  {
    key: "wenwen" as const,
    name: "文文",
    avatar: "/capybara-wenwen.png",
    caption: "粉紅小天地",
  },
  {
    key: "haohao" as const,
    name: "豪豪",
    avatar: "/capybara-haohao.png",
    caption: "藍色小天地",
  },
];

const emptyData: TrackerData = {
  summary: {
    totalSpent: 0,
    totalPurchaseCount: 0,
    purchaseRecordsCount: 0,
    injectionRecordsCount: 0,
    weightRecordsCount: 0,
    latestWeight: null,
    lastInjection: null,
    lastLocation: null,
    nextInjectionDate: null,
  },
  purchases: [],
  injections: [],
  weights: [],
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

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate()
  ).padStart(2, "0")}`;
}

@Component({
  selector: "mounjaro-tracker",
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="profile-picker" *ngIf="!selectedProfile">
      <main class="profile-picker-shell">
        <span class="profile-kicker">猛健樂紀錄</span>
        <h1>今天是誰使用？</h1>
        <div class="profile-options" aria-label="選擇使用者">
          <button
            *ngFor="let profile of profiles"
            class="profile-choice"
            [class.is-wenwen]="profile.key === 'wenwen'"
            [class.is-haohao]="profile.key === 'haohao'"
            type="button"
            (click)="selectProfile(profile.key)"
          >
            <img [src]="profile.avatar" alt="" />
            <strong>{{ profile.name }}</strong>
            <span>{{ profile.caption }}</span>
          </button>
        </div>
      </main>
    </section>

    <section
      class="tracker-app"
      *ngIf="selectedProfile"
      [class.is-entry-mode]="activeView === 'entry'"
      [class.profile-wenwen]="selectedProfile === 'wenwen'"
      [class.profile-haohao]="selectedProfile === 'haohao'"
    >
      <div
        class="loading-overlay"
        *ngIf="loading"
        role="status"
        aria-live="polite"
        aria-label="正在讀取資料"
      >
        <div class="loading-capybara">
          <img class="loading-capybara-head" [src]="currentProfile.avatar" alt="" />
          <strong>讀取{{ currentProfile.name }}的紀錄中</strong>
        </div>
      </div>
      <aside class="side-nav" aria-label="桌面導覽">
        <button class="brand-block profile-switch" type="button" (click)="showProfilePicker()" [attr.aria-label]="'切換使用者，目前是' + currentProfile.name">
          <img [src]="currentProfile.avatar" alt="" class="brand-avatar" />
          <div>
            <strong>{{ currentProfile.name }}的紀錄</strong>
            <span>Capybara Log</span>
          </div>
        </button>

        <nav class="side-links">
          <button type="button" [class.is-active]="activeView === 'home'" (click)="setView('home')">
            <span class="nav-symbol home-symbol" aria-hidden="true"></span>
            首頁
          </button>
          <button type="button" [class.is-active]="activeView === 'entry'" (click)="setView('entry')">
            <span class="nav-symbol add-symbol" aria-hidden="true"></span>
            新增紀錄
          </button>
          <button type="button" [class.is-active]="activeView === 'history'" (click)="setView('history')">
            <span class="nav-symbol history-symbol" aria-hidden="true"></span>
            歷史
          </button>
        </nav>

        <p class="side-note">你的每週小紀錄，安穩留在資料庫中。</p>
      </aside>

      <main class="workspace">
        <header class="mobile-topbar">
          <button class="mobile-brand profile-switch" type="button" (click)="showProfilePicker()" [attr.aria-label]="'切換使用者，目前是' + currentProfile.name">
            <img [src]="currentProfile.avatar" alt="" class="brand-avatar" />
            <strong>{{ currentProfile.name }}的紀錄</strong>
          </button>
        </header>

        <p
          class="toast"
          *ngIf="message"
          [class.is-error]="messageTone === 'error'"
          aria-live="polite"
        >
          {{ message }}
        </p>

        <section class="view home-view" *ngIf="activeView === 'home'">
          <section class="due-band" aria-label="下次施打提醒">
            <div class="due-copy">
              <span class="calendar-mark" aria-hidden="true"></span>
              <div>
                <span>下次施打</span>
                <strong>{{ formatDate(data.summary.nextInjectionDate) }}</strong>
                <small>{{ dueCaption }}</small>
              </div>
            </div>
            <button class="coral-action due-action" type="button" (click)="openInjection()">
              <span aria-hidden="true">💉</span> 記錄施打
            </button>
          </section>

          <section class="stat-grid" aria-label="紀錄摘要">
            <article class="stat-item">
              <span>累計花費</span>
              <strong>{{ currency(data.summary.totalSpent) }}</strong>
              <small>{{ data.summary.totalPurchaseCount }} 次購買</small>
            </article>
            <article class="stat-item">
              <span>上次位置</span>
              <strong>{{ placeLabel(data.summary.lastLocation) }}</strong>
              <small>{{ formatDate(data.summary.lastInjection?.injectionDate) }}</small>
            </article>
            <article class="stat-item weight-stat">
              <span>目前體重</span>
              <strong>{{ data.summary.latestWeight ? formatWeight(data.summary.latestWeight.weightKg) : '尚未記錄' }}</strong>
              <small>{{ data.summary.latestWeight ? formatDate(data.summary.latestWeight.recordDate) : '新增第一筆體重' }}</small>
            </article>
            <article class="stat-item">
              <span>總施打次數</span>
              <strong>{{ data.summary.injectionRecordsCount }}</strong>
              <small>筆施打紀錄</small>
            </article>
          </section>

          <section class="trend-panel section-frame" aria-labelledby="trend-title">
            <div class="trend-panel-head">
              <div>
                <h2 id="trend-title">體重與施打趨勢</h2>
                <p>{{ chartRangeCaption }}</p>
              </div>
              <div class="chart-range-control" aria-label="圖表期間">
                <button type="button" [class.is-active]="chartRange === 'week'" [attr.aria-pressed]="chartRange === 'week'" (click)="setChartRange('week')">週</button>
                <button type="button" [class.is-active]="chartRange === 'month'" [attr.aria-pressed]="chartRange === 'month'" (click)="setChartRange('month')">月</button>
                <button type="button" [class.is-active]="chartRange === 'year'" [attr.aria-pressed]="chartRange === 'year'" (click)="setChartRange('year')">年</button>
              </div>
            </div>
            <div class="trend-legend" aria-hidden="true">
              <span><i class="weight-line-key"></i>體重 kg</span>
              <span><i class="injection-bar-key"></i>施打時間</span>
            </div>
            <div
              id="health-trend-chart"
              class="health-trend-chart"
              role="img"
              [attr.aria-label]="chartAccessibleSummary"
            ></div>
            <div class="chart-empty" *ngIf="!hasChartData">
              <strong>還沒有這段期間的趨勢資料</strong>
              <p>新增體重或施打紀錄後，折線與直條會顯示在這裡。</p>
            </div>
          </section>

          <div class="home-grid">
            <section class="history-preview section-frame">
              <div class="section-head">
                <div>
                  <h2>最近紀錄</h2>
                </div>
                <button class="text-action" type="button" (click)="setView('history')">查看全部</button>
              </div>

              <div class="empty-state" *ngIf="!recentInjections.length">
                <strong>還沒有施打紀錄</strong>
                <p>完成第一次記錄後，最近使用的位置會顯示在這裡。</p>
              </div>

              <div class="recent-list" *ngIf="recentInjections.length">
                <div class="recent-table-head" aria-hidden="true">
                  <span></span><span>日期</span><span>時間</span><span>施打部位</span><span>備註</span>
                </div>
                <article class="recent-row" *ngFor="let record of recentInjections; let first = first">
                  <span class="timeline-dot" [class.is-current]="first" aria-hidden="true">✓</span>
                  <strong class="row-date">{{ formatDate(record.injectionDate) }}</strong>
                  <small class="row-time">{{ record.injectionTime || '--:--' }}</small>
                  <span class="row-location">{{ placeLabel(record.location) }}</span>
                  <span class="row-note">{{ record.note || '—' }}</span>
                  <button
                    class="row-chevron"
                    type="button"
                    [attr.aria-label]="'查看 ' + formatDate(record.injectionDate) + ' 的施打紀錄'"
                    (click)="openHistoryRecord(record.id)"
                  >›</button>
                </article>
              </div>
            </section>

            <section class="rotation-panel section-frame">
              <div class="section-head">
                <div>
                  <h2>施打部位輪替</h2>
                </div>
              </div>

              <div class="rotation-legend">
                <span><i class="legend-dot last-dot"></i>上次施打</span>
                <span><i class="legend-dot next-dot"></i>輪替提示</span>
              </div>

              <div class="belly-map compact-map" role="group" aria-label="腹部四象限輪替紀錄">
                <button
                  *ngFor="let option of locationOptions"
                  type="button"
                  class="quadrant"
                  [class.upper_left]="option.key === 'upper_left'"
                  [class.upper_right]="option.key === 'upper_right'"
                  [class.lower_left]="option.key === 'lower_left'"
                  [class.lower_right]="option.key === 'lower_right'"
                  [class.is-last]="data.summary.lastLocation === option.key"
                  [class.is-suggested]="suggestedLocation === option.key"
                  (click)="openInjection(option.key)"
                  [attr.aria-label]="option.label + '，開始記錄施打'"
                >
                  <span>{{ option.label }}</span>
                  <i class="quadrant-status" *ngIf="data.summary.lastLocation === option.key">✓</i>
                  <i class="suggested-ring" *ngIf="suggestedLocation === option.key"></i>
                </button>
                <div class="belly-center" aria-hidden="true"></div>
              </div>
              <p class="rotation-help">點選任一位置即可開始記錄；左右方向以你面向鏡子時為準。</p>
            </section>
          </div>
        </section>

        <section class="view entry-view" *ngIf="activeView === 'entry'">
          <div class="page-head">
            <button class="entry-close" type="button" [attr.aria-label]="isEditing ? '返回歷史紀錄' : '返回首頁'" (click)="closeEntry()">‹</button>
            <div>
              <h1>{{ entryTitle }}</h1>
            </div>
          </div>

          <section class="record-sheet">
            <div class="record-tabs is-three" aria-label="紀錄類型" *ngIf="!isEditing">
              <button type="button" [class.is-active]="activeEntry === 'injection'" (click)="switchEntry('injection')">
                施打紀錄
              </button>
              <button type="button" [class.is-active]="activeEntry === 'purchase'" (click)="switchEntry('purchase')">
                購買紀錄
              </button>
              <button type="button" [class.is-active]="activeEntry === 'weight'" (click)="switchEntry('weight')">
                體重紀錄
              </button>
            </div>

            <div class="edit-context" *ngIf="isEditing">
              <span class="edit-context-icon" aria-hidden="true">✎</span>
              <div>
                <strong>編輯{{ entryTypeLabel }}紀錄</strong>
                <small>儲存後會同步更新歷史紀錄、首頁統計與趨勢圖。</small>
              </div>
            </div>

            <form class="record-form" *ngIf="activeEntry === 'injection'" (submit)="saveInjection($event)">
              <div class="step-head injection-step-head">
                <h2 class="sr-only">記錄施打</h2>
                <div class="stepper" aria-label="施打紀錄步驟">
                  <span [class.is-active]="injectionStep >= 1">1</span>
                  <i></i>
                  <span [class.is-active]="injectionStep >= 2">2</span>
                </div>
              </div>

              <div class="step-panel" *ngIf="injectionStep === 1">
                <div class="field-row date-time-row">
                  <label>
                    <span>施打日期</span>
                    <span class="native-picker">
                      <span class="native-picker-value" aria-hidden="true">{{ pickerDate(injection.injectionDate) }}</span>
                      <span class="native-picker-icon is-date" aria-hidden="true"></span>
                      <input class="native-picker-input" type="date" [value]="injection.injectionDate" (input)="setInjection('injectionDate', valueFrom($event))" required />
                    </span>
                  </label>
                  <label>
                    <span>施打時間</span>
                    <span class="native-picker">
                      <span class="native-picker-value" aria-hidden="true">{{ injection.injectionTime || '--:--' }}</span>
                      <span class="native-picker-icon is-time" aria-hidden="true"></span>
                      <input class="native-picker-input" type="time" [value]="injection.injectionTime" (input)="setInjection('injectionTime', valueFrom($event))" />
                    </span>
                  </label>
                </div>

                <label>
                  <span>下次施打日期</span>
                  <span class="native-picker">
                    <span class="native-picker-value" aria-hidden="true">{{ pickerDate(injection.nextInjectionDate) }}</span>
                    <span class="native-picker-icon is-date" aria-hidden="true"></span>
                    <input class="native-picker-input" type="date" [value]="injection.nextInjectionDate" (input)="setInjection('nextInjectionDate', valueFrom($event))" />
                  </span>
                  <small class="field-help">預設為施打日期後 7 天，可自行調整。</small>
                </label>

                <button class="coral-action full-action" type="button" (click)="nextInjectionStep()">下一步：選擇位置</button>
              </div>

              <div class="step-panel" *ngIf="injectionStep === 2">
                <div class="record-summary">
                  <span>{{ formatDateLong(injection.injectionDate) }}</span>
                  <span>{{ injection.injectionTime || '--:--' }}</span>
                </div>

                <fieldset class="quadrant-field">
                  <legend>選擇施打部位</legend>
                  <p class="orientation-note">請依照鏡像方向選擇</p>
                  <div class="belly-map selection-map" role="radiogroup" aria-label="腹部四象限位置">
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
                      <i class="quadrant-status" *ngIf="injection.location === option.key">✓</i>
                    </button>
                    <div class="belly-center" aria-hidden="true"></div>
                  </div>
                </fieldset>

                <label>
                  <span>備註（選填）</span>
                  <textarea rows="3" maxlength="100" [value]="injection.note" (input)="setInjection('note', valueFrom($event))" placeholder="例如：劑量、感受或其他提醒"></textarea>
                </label>

                <div class="form-actions">
                  <button class="secondary-action" type="button" (click)="injectionStep = 1">上一步</button>
                  <button class="coral-action" type="submit" [disabled]="saving === 'injection'">
                    {{ saving === 'injection' ? '儲存中...' : (isEditing ? '儲存修改' : '確認儲存') }}
                  </button>
                </div>
              </div>
            </form>

            <form class="record-form purchase-form" *ngIf="activeEntry === 'purchase'" (submit)="savePurchase($event)">
              <div class="step-head">
                <h2>記錄購買</h2>
              </div>
              <div class="field-row date-time-row">
                <label>
                  <span>購買日期</span>
                  <span class="native-picker">
                    <span class="native-picker-value" aria-hidden="true">{{ pickerDate(purchase.purchaseDate) }}</span>
                    <span class="native-picker-icon is-date" aria-hidden="true"></span>
                    <input class="native-picker-input" type="date" [value]="purchase.purchaseDate" (input)="setPurchase('purchaseDate', valueFrom($event))" required />
                  </span>
                </label>
                <label>
                  <span>購買時間</span>
                  <span class="native-picker">
                    <span class="native-picker-value" aria-hidden="true">{{ purchase.purchaseTime || '--:--' }}</span>
                    <span class="native-picker-icon is-time" aria-hidden="true"></span>
                    <input class="native-picker-input" type="time" [value]="purchase.purchaseTime" (input)="setPurchase('purchaseTime', valueFrom($event))" />
                  </span>
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
                <span>備註（選填）</span>
                <textarea rows="3" maxlength="100" [value]="purchase.note" (input)="setPurchase('note', valueFrom($event))" placeholder="例如：購買地點或品項"></textarea>
              </label>

              <div class="form-actions" *ngIf="isEditing; else createPurchaseAction">
                <button class="secondary-action" type="button" (click)="cancelEdit()">取消</button>
                <button class="coral-action" type="submit" [disabled]="saving === 'purchase'">
                  {{ saving === 'purchase' ? '儲存中...' : '儲存修改' }}
                </button>
              </div>
              <ng-template #createPurchaseAction>
                <button class="coral-action full-action" type="submit" [disabled]="saving === 'purchase'">
                  {{ saving === 'purchase' ? '儲存中...' : '確認儲存' }}
                </button>
              </ng-template>
            </form>

            <form class="record-form weight-form" *ngIf="activeEntry === 'weight'" (submit)="saveWeight($event)">
              <div class="step-head">
                <h2>記錄體重</h2>
              </div>

              <div class="field-row date-time-row">
                <label>
                  <span>測量日期</span>
                  <span class="native-picker">
                    <span class="native-picker-value" aria-hidden="true">{{ pickerDate(weight.recordDate) }}</span>
                    <span class="native-picker-icon is-date" aria-hidden="true"></span>
                    <input class="native-picker-input" type="date" [value]="weight.recordDate" (input)="setWeight('recordDate', valueFrom($event))" required />
                  </span>
                </label>
                <label>
                  <span>測量時間</span>
                  <span class="native-picker">
                    <span class="native-picker-value" aria-hidden="true">{{ weight.recordTime || '--:--' }}</span>
                    <span class="native-picker-icon is-time" aria-hidden="true"></span>
                    <input class="native-picker-input" type="time" [value]="weight.recordTime" (input)="setWeight('recordTime', valueFrom($event))" />
                  </span>
                </label>
              </div>

              <label>
                <span>體重</span>
                <span class="weight-input-wrap">
                  <input type="number" min="20" max="500" step="0.1" inputmode="decimal" [value]="weight.weightKg" (input)="setWeight('weightKg', valueFrom($event))" placeholder="例如：76.5" required />
                  <span aria-hidden="true">kg</span>
                </span>
              </label>

              <div class="previous-weight" *ngIf="data.summary.latestWeight">
                <span>上次紀錄 {{ formatWeight(data.summary.latestWeight.weightKg) }}</span>
                <strong *ngIf="weightDifference !== null">{{ weightDifferenceLabel }}</strong>
              </div>

              <label>
                <span>備註（選填）</span>
                <textarea rows="3" maxlength="100" [value]="weight.note" (input)="setWeight('note', valueFrom($event))" placeholder="例如：空腹、飯後或身體狀況"></textarea>
              </label>

              <div class="form-actions" *ngIf="isEditing; else createWeightAction">
                <button class="secondary-action" type="button" (click)="cancelEdit()">取消</button>
                <button class="coral-action" type="submit" [disabled]="saving === 'weight'">
                  {{ saving === 'weight' ? '儲存中...' : '儲存修改' }}
                </button>
              </div>
              <ng-template #createWeightAction>
                <button class="coral-action full-action" type="submit" [disabled]="saving === 'weight'">
                  {{ saving === 'weight' ? '儲存中...' : '確認儲存' }}
                </button>
              </ng-template>
            </form>
          </section>
        </section>

        <section class="view history-view" *ngIf="activeView === 'history'">
          <div class="page-head history-page-head">
            <div>
              <span class="section-label">History</span>
              <h1>歷史紀錄</h1>
              <p>依日期快速查看並編輯過去的施打、購買或體重資料。</p>
            </div>
            <button class="secondary-action refresh-action" type="button" (click)="load()">↻ 重新整理</button>
          </div>

          <div class="history-toolbar">
            <div class="record-tabs history-tabs is-three" aria-label="歷史紀錄類型">
              <button type="button" [class.is-active]="historyTab === 'injection'" (click)="historyTab = 'injection'">施打</button>
              <button type="button" [class.is-active]="historyTab === 'purchase'" (click)="historyTab = 'purchase'">購買</button>
              <button type="button" [class.is-active]="historyTab === 'weight'" (click)="historyTab = 'weight'">體重</button>
            </div>
            <div class="filters">
              <label *ngIf="historyTab === 'injection'">
                <span>位置</span>
                <select [value]="filterLocation" (change)="filterLocation = valueFrom($event)">
                  <option value="all">全部位置</option>
                  <option *ngFor="let option of locationOptions" [value]="option.key">{{ option.label }}</option>
                </select>
              </label>
              <label class="date-filter">
                <span>日期</span>
                <span class="date-input-wrap native-picker" [class.is-empty]="!filterDate">
                  <span class="native-picker-value" aria-hidden="true">{{ filterDate ? pickerDate(filterDate) : '全部日期' }}</span>
                  <span class="native-picker-icon is-date" aria-hidden="true"></span>
                  <input
                    class="native-picker-input"
                    type="date"
                    [value]="filterDate"
                    (input)="filterDate = valueFrom($event)"
                    aria-label="依日期篩選；未選擇時顯示全部日期"
                  />
                </span>
              </label>
            </div>
          </div>

          <section class="history-table-wrap section-frame" *ngIf="historyTab === 'injection'">
            <div class="table-title"><h2>施打紀錄</h2><span>{{ filteredInjections.length }} 筆</span></div>
            <p class="empty-table" *ngIf="!filteredInjections.length">目前沒有符合條件的施打紀錄。</p>
            <table *ngIf="filteredInjections.length">
              <thead><tr><th>日期</th><th>時間</th><th>施打部位</th><th>備註</th><th><span class="sr-only">操作</span></th></tr></thead>
              <tbody>
                <tr
                  *ngFor="let record of filteredInjections"
                  [attr.data-injection-id]="record.id"
                  [class.is-target-record]="highlightedInjectionId === record.id"
                >
                  <td data-label="日期">{{ record.injectionDate }}</td>
                  <td data-label="時間">{{ record.injectionTime || '--:--' }}</td>
                  <td data-label="施打部位"><span class="location-badge">{{ placeLabel(record.location) }}</span></td>
                  <td data-label="備註">{{ record.note || '—' }}</td>
                  <td class="action-cell">
                    <button class="edit-action" type="button" title="編輯" aria-label="編輯施打紀錄" (click)="openEditRecord('injection', record)">✎</button>
                    <button class="delete-action" type="button" title="刪除" aria-label="刪除施打紀錄" [disabled]="deleting === 'injection-' + record.id" (click)="deleteRecord('injection', record.id)">{{ deleting === 'injection-' + record.id ? '…' : '×' }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section class="history-table-wrap section-frame" *ngIf="historyTab === 'purchase'">
            <div class="table-title"><h2>購買紀錄</h2><span>{{ filteredPurchases.length }} 筆</span></div>
            <p class="empty-table" *ngIf="!filteredPurchases.length">目前沒有符合條件的購買紀錄。</p>
            <table *ngIf="filteredPurchases.length">
              <thead><tr><th>日期</th><th>時間</th><th>次數</th><th>總金額</th><th>備註</th><th><span class="sr-only">操作</span></th></tr></thead>
              <tbody>
                <tr *ngFor="let record of filteredPurchases">
                  <td data-label="日期">{{ record.purchaseDate }}</td>
                  <td data-label="時間">{{ record.purchaseTime || '--:--' }}</td>
                  <td data-label="次數">{{ record.purchaseCount }}</td>
                  <td data-label="總金額">{{ currency(record.totalAmount) }}</td>
                  <td data-label="備註">{{ record.note || '—' }}</td>
                  <td class="action-cell">
                    <button class="edit-action" type="button" title="編輯" aria-label="編輯購買紀錄" (click)="openEditRecord('purchase', record)">✎</button>
                    <button class="delete-action" type="button" title="刪除" aria-label="刪除購買紀錄" [disabled]="deleting === 'purchase-' + record.id" (click)="deleteRecord('purchase', record.id)">{{ deleting === 'purchase-' + record.id ? '…' : '×' }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section class="history-table-wrap section-frame" *ngIf="historyTab === 'weight'">
            <div class="table-title"><h2>體重紀錄</h2><span>{{ filteredWeights.length }} 筆</span></div>
            <p class="empty-table" *ngIf="!filteredWeights.length">目前沒有符合條件的體重紀錄。</p>
            <table *ngIf="filteredWeights.length">
              <thead><tr><th>日期</th><th>時間</th><th>體重</th><th>與前次差異</th><th>備註</th><th><span class="sr-only">操作</span></th></tr></thead>
              <tbody>
                <tr *ngFor="let record of filteredWeights">
                  <td data-label="日期">{{ record.recordDate }}</td>
                  <td data-label="時間">{{ record.recordTime || '--:--' }}</td>
                  <td data-label="體重">{{ formatWeight(record.weightKg) }}</td>
                  <td data-label="與前次差異">{{ historyWeightDifference(record) }}</td>
                  <td data-label="備註">{{ record.note || '—' }}</td>
                  <td class="action-cell">
                    <button class="edit-action" type="button" title="編輯" aria-label="編輯體重紀錄" (click)="openEditRecord('weight', record)">✎</button>
                    <button class="delete-action" type="button" title="刪除" aria-label="刪除體重紀錄" [disabled]="deleting === 'weight-' + record.id" (click)="deleteRecord('weight', record.id)">{{ deleting === 'weight-' + record.id ? '…' : '×' }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </section>

        <p class="medical-note">僅供個人紀錄；施打方式、位置與日期請依醫師或藥師指示。</p>
      </main>

      <nav class="bottom-nav" aria-label="主要功能">
        <button type="button" [class.is-active]="activeView === 'home'" (click)="setView('home')">
          <span class="home-symbol" aria-hidden="true"></span>首頁
        </button>
        <button type="button" [class.is-active]="activeView === 'entry'" (click)="setView('entry')">
          <span class="add-symbol" aria-hidden="true"></span>紀錄
        </button>
        <button type="button" [class.is-active]="activeView === 'history'" (click)="setView('history')">
          <span class="history-symbol" aria-hidden="true"></span>歷史
        </button>
      </nav>
    </section>
  `,
})
class TrackerAppComponent implements OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private messageTimer: ReturnType<typeof setTimeout> | null = null;
  private chartRenderTimer: ReturnType<typeof setTimeout> | null = null;
  private chart: ReturnType<typeof echarts.init> | null = null;
  private chartElement: HTMLElement | null = null;
  private chartResizeObserver: ResizeObserver | null = null;
  private loadSequence = 0;
  readonly localToday = localDate();
  readonly profiles = profileOptions;
  readonly locationOptions = [
    { key: "upper_left" as const, label: locationLabels.upper_left },
    { key: "upper_right" as const, label: locationLabels.upper_right },
    { key: "lower_left" as const, label: locationLabels.lower_left },
    { key: "lower_right" as const, label: locationLabels.lower_right },
  ];

  data: TrackerData = emptyData;
  selectedProfile: ProfileKey | null = null;
  activeEntry: EntryTab = "injection";
  historyTab: EntryTab = "injection";
  activeView: ViewTab = "home";
  injectionStep: 1 | 2 = 1;
  filterLocation = "all";
  filterDate = "";
  chartRange: ChartRange = "week";
  loading = false;
  saving: EntryTab | "" = "";
  deleting = "";
  editingType: EntryTab | null = null;
  editingId: number | null = null;
  highlightedInjectionId: number | null = null;
  message = "";
  messageTone: "success" | "error" = "success";
  purchase = this.newPurchase();
  injection = this.newInjection();
  weight = this.newWeight();

  get currentProfile() {
    return (
      this.profiles.find((profile) => profile.key === this.selectedProfile) ??
      this.profiles[0]
    );
  }

  get entryTitle() {
    if (this.isEditing) return `編輯${this.entryTypeLabel}`;
    if (this.activeEntry === "purchase") return "記錄購買";
    if (this.activeEntry === "weight") return "記錄體重";
    return "記錄施打";
  }

  get entryTypeLabel() {
    if (this.activeEntry === "purchase") return "購買";
    if (this.activeEntry === "weight") return "體重";
    return "施打";
  }

  get isEditing() {
    return this.editingType === this.activeEntry && this.editingId !== null;
  }

  selectProfile(profile: ProfileKey) {
    this.selectedProfile = profile;
    this.data = emptyData;
    this.activeView = "home";
    this.activeEntry = "injection";
    this.historyTab = "injection";
    this.injectionStep = 1;
    this.filterLocation = "all";
    this.filterDate = "";
    this.chartRange = "week";
    this.clearEditing();
    this.highlightedInjectionId = null;
    this.purchase = this.newPurchase();
    this.injection = this.newInjection();
    this.weight = this.newWeight();
    this.message = "";
    window.scrollTo({ top: 0 });
    this.refreshUi();
    void this.load();
  }

  showProfilePicker() {
    this.disposeChart();
    this.loadSequence += 1;
    this.selectedProfile = null;
    this.data = emptyData;
    this.loading = false;
    this.saving = "";
    this.deleting = "";
    this.clearEditing();
    this.message = "";
    window.scrollTo({ top: 0 });
    this.refreshUi();
  }

  get recentInjections() {
    return this.data.injections.slice(0, 5);
  }

  get suggestedLocation(): LocationKey | null {
    return this.data.summary.lastLocation
      ? locationCycle[this.data.summary.lastLocation]
      : "upper_left";
  }

  get dueCaption() {
    if (!this.data.summary.nextInjectionDate) return "完成施打紀錄後自動顯示";
    if (this.data.summary.nextInjectionDate === this.localToday) return "今天";
    return "日期可在施打紀錄中調整";
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

  get filteredWeights() {
    return this.data.weights.filter(
      (record) => !this.filterDate || record.recordDate === this.filterDate
    );
  }

  get weightDifference() {
    const latest = this.data.summary.latestWeight;
    const current = Number(this.weight.weightKg);
    if (!latest || !Number.isFinite(current) || !this.weight.weightKg) return null;
    return Math.round((current - latest.weightKg) * 10) / 10;
  }

  get weightDifferenceLabel() {
    const difference = this.weightDifference;
    if (difference === null || difference === 0) return "與上次相同";
    return `${difference > 0 ? "增加" : "下降"} ${Math.abs(difference).toFixed(1)} kg`;
  }

  get chartRangeCaption() {
    const buckets = this.chartBuckets();
    if (this.chartRange === "month") {
      const [year, month] = this.localToday.split("-");
      return `${year}年${Number(month)}月（1日至${buckets.length}日）`;
    }
    if (this.chartRange === "year") {
      return `${this.localToday.slice(0, 4)}年（1月至12月）`;
    }
    return `本週 ${buckets[0].fullLabel}至${buckets[buckets.length - 1].fullLabel}`;
  }

  get hasChartData() {
    const { start, end } = this.chartBounds();
    return (
      this.data.weights.some((record) => this.dateInRange(record.recordDate, start, end)) ||
      this.data.injections.some(
        (record) =>
          Boolean(record.injectionTime) &&
          this.dateInRange(record.injectionDate, start, end)
      )
    );
  }

  get chartAccessibleSummary() {
    const weightCount = this.chartWeightRows().length;
    const injectionCount = this.chartInjectionRows().length;
    return `${this.chartRangeCaption}，${weightCount} 筆體重與 ${injectionCount} 筆有時間的施打紀錄。`;
  }

  valueFrom(event: Event) {
    return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }

  placeLabel(location: LocationKey | null | undefined) {
    return location ? locationLabels[location] : "尚未設定";
  }

  formatDate(date: string | null | undefined) {
    if (!date) return "尚未設定";
    const [, month, day] = date.split("-");
    return `${Number(month)}月${Number(day)}日`;
  }

  formatDateLong(date: string | null | undefined) {
    if (!date) return "尚未設定";
    const [year, month, day] = date.split("-");
    return `${year}年${Number(month)}月${Number(day)}日`;
  }

  pickerDate(date: string | null | undefined) {
    return date ? date.replaceAll("-", "/") : "--/--/--";
  }

  formatWeight(value: number) {
    return `${Number(value).toFixed(1)} kg`;
  }

  historyWeightDifference(record: WeightRecord) {
    const index = this.data.weights.findIndex((item) => item.id === record.id);
    const previous = index >= 0 ? this.data.weights[index + 1] : null;
    if (!previous) return "—";
    const difference = Math.round((record.weightKg - previous.weightKg) * 10) / 10;
    if (difference === 0) return "0.0 kg";
    return `${difference > 0 ? "+" : ""}${difference.toFixed(1)} kg`;
  }

  currency(value: number) {
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  setView(view: ViewTab) {
    this.clearEditing();
    this.activeView = view;
    this.message = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
    this.refreshUi();
  }

  setChartRange(range: ChartRange) {
    this.chartRange = range;
    this.refreshUi();
  }

  switchEntry(type: EntryTab) {
    this.clearEditing();
    this.activeEntry = type;
    this.injectionStep = 1;
    this.message = "";
  }

  openInjection(location?: LocationKey) {
    this.clearEditing();
    this.activeEntry = "injection";
    this.injectionStep = 1;
    if (location) this.injection = { ...this.injection, location };
    this.setView("entry");
  }

  openEditRecord(type: EntryTab, record: EditableRecord) {
    this.editingType = type;
    this.editingId = record.id;
    this.activeEntry = type;
    this.historyTab = type;
    this.injectionStep = 1;
    this.message = "";

    if (type === "injection") {
      const value = record as InjectionRecord;
      this.injection = {
        injectionDate: value.injectionDate,
        injectionTime: value.injectionTime,
        location: value.location,
        nextInjectionDate: value.nextInjectionDate,
        note: value.note,
      };
    } else if (type === "purchase") {
      const value = record as PurchaseRecord;
      this.purchase = {
        purchaseDate: value.purchaseDate,
        purchaseTime: value.purchaseTime,
        purchaseCount: String(value.purchaseCount),
        totalAmount: String(value.totalAmount),
        note: value.note,
      };
    } else {
      const value = record as WeightRecord;
      this.weight = {
        recordDate: value.recordDate,
        recordTime: value.recordTime,
        weightKg: String(value.weightKg),
        note: value.note,
      };
    }

    this.activeView = "entry";
    window.scrollTo({ top: 0, behavior: "smooth" });
    this.refreshUi();
  }

  closeEntry() {
    if (this.isEditing) {
      this.cancelEdit();
      return;
    }
    this.setView("home");
  }

  cancelEdit() {
    const type = this.editingType ?? this.historyTab;
    this.clearEditing();
    this.resetForm(type);
    this.activeView = "history";
    this.historyTab = type;
    this.message = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
    this.refreshUi();
  }

  openHistoryRecord(id: number) {
    this.historyTab = "injection";
    this.filterLocation = "all";
    this.filterDate = "";
    this.highlightedInjectionId = id;
    this.activeView = "history";
    this.message = "";
    this.refreshUi();
    setTimeout(() => {
      document
        .querySelector(`[data-injection-id="${id}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }

  nextInjectionStep() {
    if (!this.injection.injectionDate) {
      this.showMessage("請先選擇施打日期", "error");
      return;
    }
    this.message = "";
    this.injectionStep = 2;
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  setWeight(field: keyof typeof this.weight, value: string) {
    this.weight = { ...this.weight, [field]: value };
  }

  async load() {
    const profile = this.selectedProfile;
    if (!profile) return false;
    const sequence = ++this.loadSequence;
    const loadingStartedAt = Date.now();
    this.loading = true;
    this.refreshUi();
    try {
      const response = await fetch(`/api/records?profile=${profile}`, { cache: "no-store" });
      const payload = (await response.json()) as TrackerData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "讀取紀錄失敗");
      if (this.selectedProfile !== profile) return false;
      this.data = payload;
      if (this.activeView === "home" && this.injectionStep === 1) {
        this.injection = {
          ...this.injection,
          location: this.suggestedLocation || "upper_left",
        };
      }
      return true;
    } catch (error) {
      this.showMessage(error instanceof Error ? error.message : "讀取紀錄失敗", "error");
      return false;
    } finally {
      const remaining = 480 - (Date.now() - loadingStartedAt);
      if (remaining > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
      }
      if (sequence === this.loadSequence) {
        this.loading = false;
        this.refreshUi();
      }
    }
  }

  async savePurchase(event: Event) {
    event.preventDefault();
    const wasEditing = this.isEditing;
    const saved = await this.save("purchase", {
      type: "purchase",
      ...this.purchase,
      purchaseCount: Number(this.purchase.purchaseCount),
      totalAmount: Number(this.purchase.totalAmount),
    });
    if (saved) {
      this.finishSave("purchase", wasEditing);
    }
  }

  async saveInjection(event: Event) {
    event.preventDefault();
    const wasEditing = this.isEditing;
    const saved = await this.save("injection", { type: "injection", ...this.injection });
    if (saved) {
      this.finishSave("injection", wasEditing);
    }
  }

  async saveWeight(event: Event) {
    event.preventDefault();
    const wasEditing = this.isEditing;
    const saved = await this.save("weight", {
      type: "weight",
      ...this.weight,
      weightKg: Number(this.weight.weightKg),
    });
    if (saved) {
      this.finishSave("weight", wasEditing);
    }
  }

  async save(type: EntryTab, body: Record<string, unknown>) {
    const profile = this.selectedProfile;
    if (!profile) {
      this.showMessage("請先選擇使用者。", "error");
      return false;
    }
    const editingId = this.editingType === type ? this.editingId : null;
    this.saving = type;
    this.refreshUi();
    try {
      const response = await fetch("/api/records", {
        method: editingId === null ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, profile, id: editingId }),
      });
      const payload = (await response.json()) as {
        error?: string;
        data?: TrackerData;
      } & Record<string, unknown>;
      if (!response.ok) throw new Error(payload.error || "儲存失敗");
      if (this.selectedProfile !== profile) return false;
      if (payload.data) {
        this.data = payload.data;
        this.loading = false;
        this.refreshUi();
      } else if (!(await this.load())) {
        this.showMessage("紀錄已儲存，但畫面更新失敗，請重新整理。", "error");
        return true;
      }
      this.showMessage(
        editingId === null
          ? "儲存成功，首頁資料已更新。"
          : "修改成功，歷史紀錄與統計已更新。",
        "success"
      );
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "請稍後再試";
      this.showMessage(`儲存失敗：${detail}`, "error");
      return false;
    } finally {
      this.saving = "";
      this.refreshUi();
    }
  }

  private finishSave(type: EntryTab, wasEditing: boolean) {
    this.clearEditing();
    this.resetForm(type);
    this.injectionStep = 1;
    this.activeView = wasEditing ? "history" : "home";
    if (wasEditing) this.historyTab = type;
    window.scrollTo({ top: 0, behavior: "smooth" });
    this.refreshUi();
  }

  private resetForm(type: EntryTab) {
    if (type === "purchase") this.purchase = this.newPurchase();
    if (type === "injection") this.injection = this.newInjection();
    if (type === "weight") this.weight = this.newWeight();
  }

  private clearEditing() {
    this.editingType = null;
    this.editingId = null;
  }

  async deleteRecord(type: EntryTab, id: number) {
    const profile = this.selectedProfile;
    if (!profile) return;
    if (!window.confirm("確定要刪除這筆紀錄嗎？")) return;
    this.deleting = `${type}-${id}`;
    this.refreshUi();
    try {
      const response = await fetch(`/api/records?type=${type}&id=${id}&profile=${profile}`, { method: "DELETE" });
      const payload = (await response.json()) as {
        error?: string;
        data?: TrackerData;
      } & Record<string, unknown>;
      if (!response.ok) throw new Error(payload.error || "刪除失敗");
      if (this.selectedProfile !== profile) return;
      if (payload.data) {
        this.data = payload.data;
        this.loading = false;
        this.refreshUi();
      } else if (!(await this.load())) {
        return;
      }
      this.showMessage("刪除成功，紀錄與統計已更新。", "success");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "請稍後再試";
      this.showMessage(`刪除失敗：${detail}`, "error");
    } finally {
      this.deleting = "";
      this.refreshUi();
    }
  }

  ngOnDestroy() {
    if (this.messageTimer) clearTimeout(this.messageTimer);
    if (this.chartRenderTimer) clearTimeout(this.chartRenderTimer);
    this.disposeChart();
  }

  private chartBounds() {
    const buckets = this.chartBuckets();
    return {
      start: new Date(`${buckets[0].startDate}T00:00:00`).getTime(),
      end: new Date(`${buckets[buckets.length - 1].endDate}T23:59:59`).getTime(),
    };
  }

  private chartBuckets(): ChartBucket[] {
    const today = new Date(`${this.localToday}T12:00:00`);
    const year = today.getFullYear();
    const month = today.getMonth();

    if (this.chartRange === "year") {
      return Array.from({ length: 12 }, (_, index) => {
        const start = new Date(year, index, 1, 12);
        const end = new Date(year, index + 1, 0, 12);
        return {
          key: `${year}-${String(index + 1).padStart(2, "0")}`,
          label: `${index + 1}月`,
          fullLabel: `${year}年${index + 1}月`,
          startDate: dateKey(start),
          endDate: dateKey(end),
        };
      });
    }

    const start =
      this.chartRange === "month"
        ? new Date(year, month, 1, 12)
        : new Date(year, month, today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1), 12);
    const count =
      this.chartRange === "month"
        ? new Date(year, month + 1, 0, 12).getDate()
        : 7;
    const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];

    return Array.from({ length: count }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = dateKey(date);
      const weekday = weekdayLabels[date.getDay()];
      return {
        key,
        label:
          this.chartRange === "week"
            ? `${date.getMonth() + 1}/${date.getDate()}\n${weekday}`
            : `${date.getDate()}日`,
        fullLabel:
          this.chartRange === "week"
            ? `${date.getMonth() + 1}/${date.getDate()}（${weekday}）`
            : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`,
        startDate: key,
        endDate: key,
      };
    });
  }

  private chartBucketKey(date: string) {
    return this.chartRange === "year" ? date.slice(0, 7) : date;
  }

  private dateInRange(date: string, start: number, end: number) {
    const value = new Date(`${date}T12:00:00`).getTime();
    return Number.isFinite(value) && value >= start && value <= end;
  }

  private chartWeightRows() {
    const { start, end } = this.chartBounds();
    return this.data.weights
      .filter((record) => this.dateInRange(record.recordDate, start, end))
      .sort((a, b) =>
        `${a.recordDate}T${a.recordTime}`.localeCompare(`${b.recordDate}T${b.recordTime}`)
      );
  }

  private chartInjectionRows() {
    const { start, end } = this.chartBounds();
    return this.data.injections
      .filter(
        (record) =>
          Boolean(record.injectionTime) &&
          this.dateInRange(record.injectionDate, start, end)
      )
      .sort((a, b) =>
        `${a.injectionDate}T${a.injectionTime}`.localeCompare(
          `${b.injectionDate}T${b.injectionTime}`
        )
      );
  }

  private timeToHours(time: string) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours + minutes / 60;
  }

  private formatChartTime(value: number) {
    const totalMinutes = Math.round(value * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  private scheduleChartRender() {
    if (this.chartRenderTimer) clearTimeout(this.chartRenderTimer);
    if (!this.selectedProfile || this.activeView !== "home") return;
    this.chartRenderTimer = setTimeout(() => this.renderHealthChart(), 20);
  }

  private renderHealthChart() {
    const element = document.getElementById("health-trend-chart");
    if (!element || !this.selectedProfile || this.activeView !== "home") return;

    if (this.chartElement !== element) {
      this.disposeChart();
      this.chartElement = element;
      this.chart = echarts.init(element, undefined, { renderer: "canvas" });
      this.chartResizeObserver = new ResizeObserver(() => this.chart?.resize());
      this.chartResizeObserver.observe(element);
    }

    const styles = getComputedStyle(element);
    const teal = styles.getPropertyValue("--teal").trim() || "#4c918f";
    const coral = styles.getPropertyValue("--coral").trim() || "#f26d59";
    const line = styles.getPropertyValue("--line").trim() || "#dedbd4";
    const muted = styles.getPropertyValue("--muted").trim() || "#716e66";
    const surface = styles.getPropertyValue("--surface").trim() || "#ffffff";
    const ink = styles.getPropertyValue("--ink").trim() || "#282722";
    const buckets = this.chartBuckets();
    const weightRows = this.chartWeightRows();
    const injectionRows = this.chartInjectionRows();
    const weightByBucket = new Map<string, WeightRecord>();
    for (const record of weightRows) {
      weightByBucket.set(this.chartBucketKey(record.recordDate), record);
    }
    const injectionsByBucket = new Map<string, InjectionRecord[]>();
    for (const record of injectionRows) {
      const key = this.chartBucketKey(record.injectionDate);
      const group = injectionsByBucket.get(key) ?? [];
      group.push(record);
      injectionsByBucket.set(key, group);
    }
    const maxInjectionsInBucket = Math.max(
      0,
      ...Array.from(injectionsByBucket.values(), (records) => records.length)
    );
    const injectionSeries = Array.from({ length: maxInjectionsInBucket }, (_, index) => ({
      name: index === 0 ? "施打時間" : `施打時間 ${index + 1}`,
      type: "bar" as const,
      yAxisIndex: 1,
      barMaxWidth: this.chartRange === "year" ? 7 : this.chartRange === "month" ? 10 : 18,
      itemStyle: { color: coral, borderRadius: [3, 3, 0, 0], opacity: 0.72 },
      data: buckets.map((bucket) => {
        const record = injectionsByBucket.get(bucket.key)?.[index];
        return record
          ? {
              value: this.timeToHours(record.injectionTime),
              recordDate: record.injectionDate,
              recordTime: record.injectionTime,
            }
          : null;
      }),
    }));
    const weightSeriesData = buckets.map((bucket) => {
      const record = weightByBucket.get(bucket.key);
      return record
        ? {
            value: record.weightKg,
            recordDate: record.recordDate,
            recordTime: record.recordTime,
          }
        : null;
    });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.chart?.setOption(
      {
        animation: !reduceMotion,
        animationDuration: 380,
        backgroundColor: "transparent",
        grid: { top: 28, right: 54, bottom: this.chartRange === "week" ? 54 : 44, left: 50 },
        tooltip: {
          trigger: "axis",
          backgroundColor: surface,
          borderColor: line,
          borderWidth: 1,
          textStyle: { color: ink, fontSize: 12 },
          formatter: (params: unknown) => {
            const items = Array.isArray(params)
              ? (params as Array<{
                  axisValue: unknown;
                  marker: string;
                  seriesName: string;
                  value: unknown;
                  dataIndex: number;
                  data?: { value?: number; recordDate?: string; recordTime?: string } | number;
                }>)
              : [];
            if (!items.length) return "";
            const validItems: Array<{ item: (typeof items)[number]; raw: number }> = [];
            items.forEach((item) => {
              const raw =
                typeof item.data === "object" && item.data !== null
                  ? Number(item.data.value)
                  : Number(item.value);
              if (Number.isFinite(raw)) validItems.push({ item, raw });
            });
            if (!validItems.length) return "";
            const heading =
              buckets[validItems[0].item.dataIndex]?.fullLabel ??
              String(validItems[0].item.axisValue);
            const rows = validItems.map(({ item, raw }) => {
              const isWeight = item.seriesName === "體重";
              const value = isWeight
                ? `${raw.toFixed(1)} kg`
                : this.formatChartTime(raw);
              const label = isWeight ? "體重" : "施打時間";
              const dateDetail =
                this.chartRange === "year" &&
                typeof item.data === "object" &&
                item.data?.recordDate
                  ? `（${item.data.recordDate.slice(5).replace("-", "/")}）`
                  : "";
              return `${item.marker}${label}${dateDetail}：${value}`;
            });
            return `<strong>${heading}</strong><br>${rows.join("<br>")}`;
          },
        },
        xAxis: {
          type: "category",
          data: buckets.map((bucket) => bucket.label),
          boundaryGap: true,
          axisLine: { lineStyle: { color: line } },
          axisTick: { show: false, alignWithLabel: true },
          splitLine: { show: false },
          axisLabel: {
            color: muted,
            fontSize: 11,
            hideOverlap: true,
            interval:
              this.chartRange === "month"
                ? (index: number) =>
                    index === 0 || index === buckets.length - 1 || (index + 1) % 5 === 0
                : 0,
          },
        },
        yAxis: [
          {
            type: "value",
            name: "kg",
            scale: true,
            min: (value: { min: number }) => Math.floor(value.min - 1),
            max: (value: { max: number }) => Math.ceil(value.max + 1),
            nameTextStyle: { color: muted, fontSize: 11 },
            axisLabel: { color: muted, fontSize: 11 },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { color: line } },
          },
          {
            type: "value",
            name: "施打時間",
            min: 0,
            max: 24,
            interval: 6,
            nameTextStyle: { color: muted, fontSize: 11 },
            axisLabel: {
              color: muted,
              fontSize: 11,
              formatter: (value: number) => `${String(value).padStart(2, "0")}:00`,
            },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
          },
        ],
        series: [
          ...injectionSeries,
          {
            name: "體重",
            type: "line",
            yAxisIndex: 0,
            smooth: 0.25,
            symbol: "circle",
            symbolSize: 7,
            connectNulls: true,
            lineStyle: { color: teal, width: 3 },
            itemStyle: { color: surface, borderColor: teal, borderWidth: 3 },
            data: weightSeriesData,
          },
        ],
      },
      true
    );
  }

  private disposeChart() {
    this.chartResizeObserver?.disconnect();
    this.chartResizeObserver = null;
    this.chart?.dispose();
    this.chart = null;
    this.chartElement = null;
  }

  showMessage(message: string, tone: "success" | "error") {
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.message = message;
    this.messageTone = tone;
    this.refreshUi();
    this.messageTimer = setTimeout(() => {
      this.message = "";
      this.refreshUi();
    }, 3600);
  }

  private refreshUi() {
    setTimeout(() => {
      this.cdr.detectChanges();
      this.scheduleChartRender();
    }, 0);
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
      location: (this?.suggestedLocation || "upper_left") as LocationKey,
      nextInjectionDate: addDays(date, 7),
      note: "",
    };
  }

  private newWeight() {
    return {
      recordDate: localDate(),
      recordTime: currentTime(),
      weightKg: "",
      note: "",
    };
  }
}

bootstrapApplication(TrackerAppComponent).catch((error) => console.error(error));

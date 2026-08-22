/* global echarts, lucide */

const teal = "#4c918f";
const coral = "#f46d5a";
const line = "#d8ddd9";
const muted = "#716e66";

const range = document.body.dataset.range;
const definitions = {
  week: {
    labels: ["8/17 一", "8/18 二", "8/19 三", "8/20 四", "8/21 五", "8/22 六", "8/23 日"],
    weights: [78.2, null, 77.9, null, 77.5, 76.8, null],
    shots: [null, null, null, 20.5, null, 20.7, null],
    interval: 0,
  },
  month: {
    labels: Array.from({ length: 31 }, (_, index) => String(index + 1)),
    weights: Array.from({ length: 31 }, (_, index) => ({ 0: 79.4, 7: 78.8, 14: 78.1, 21: 77.5, 30: 76.8 })[index] ?? null),
    shots: Array.from({ length: 31 }, (_, index) => [1, 8, 15, 22, 29].includes(index) ? 20.5 : null),
    interval: 4,
  },
  year: {
    labels: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
    weights: [null, null, null, null, null, 80.1, 78.9, 76.8, null, null, null, null],
    shots: [null, null, null, null, null, 20.4, 20.6, 20.7, null, null, null, null],
    interval: 0,
  },
};

const data = definitions[range];
const chart = echarts.init(document.getElementById("trend-chart"), null, { renderer: "canvas" });
chart.setOption({
  animation: false,
  grid: { top: 44, right: 58, bottom: 58, left: 52 },
  tooltip: { trigger: "axis" },
  xAxis: {
    type: "category",
    data: data.labels,
    boundaryGap: true,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: line } },
    axisLabel: { color: muted, fontSize: 10, interval: data.interval },
  },
  yAxis: [
    {
      type: "value",
      name: "kg",
      min: 74,
      max: 81,
      interval: 1,
      nameTextStyle: { color: muted },
      axisLabel: { color: muted, fontSize: 10 },
      axisTick: { show: false },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: line } },
    },
    {
      type: "value",
      name: "施打時間",
      min: 0,
      max: 24,
      interval: 6,
      nameTextStyle: { color: muted },
      axisLabel: { color: muted, fontSize: 10, formatter: value => `${String(value).padStart(2, "0")}:00` },
      axisTick: { show: false },
      axisLine: { show: false },
      splitLine: { show: false },
    },
  ],
  series: [
    {
      name: "施打時間",
      type: "bar",
      yAxisIndex: 1,
      barMaxWidth: 15,
      itemStyle: { color: coral, borderRadius: [3, 3, 0, 0], opacity: .72 },
      data: data.shots,
    },
    {
      name: "體重",
      type: "line",
      yAxisIndex: 0,
      smooth: .25,
      connectNulls: true,
      symbol: "circle",
      symbolSize: 7,
      lineStyle: { color: teal, width: 3 },
      itemStyle: { color: "#fff", borderColor: teal, borderWidth: 3 },
      data: data.weights,
    },
  ],
});

window.addEventListener("resize", () => chart.resize());
lucide.createIcons();

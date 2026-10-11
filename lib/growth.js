import { formatMoney, formatNumber } from "./releasePlans";

export const GROWTH_METRICS = [
  { key: "spotify_monthly_listeners", label: "Spotify monthly listeners" },
  { key: "spotify_followers", label: "Spotify followers" },
  { key: "youtube_subscribers", label: "YouTube subscribers" },
  { key: "instagram_followers", label: "Instagram followers" },
  {
    key: "monthly_streams",
    label: "Streams this month",
    hint: "All platforms, from your distributor's report.",
  },
  {
    key: "monthly_earnings",
    label: "Earnings this month",
    hint: "What you were paid for the month.",
    money: true,
  },
];

export const getMetric = (key) => GROWTH_METRICS.find((metric) => metric.key === key);

// Months are stored as the first day ("2026-10-01"); <input type="month">
// uses "2026-10".
export const monthToInput = (month) => month.slice(0, 7);
export const inputToMonth = (value) => `${value}-01`;

export const currentMonthInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export const monthIndex = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return year * 12 + (monthNumber - 1);
};

const indexToMonth = (index) =>
  `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;

export const formatMonth = (month) =>
  new Date(`${month}T00:00:00`).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });

export const formatMonthIndex = (index) => formatMonth(indexToMonth(index));

export const formatCompact = (value) =>
  new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export const formatMetricValue = (metric, value, currency) => {
  if (value === null || value === undefined) {
    return "—";
  }
  return metric.money ? formatMoney(value, currency) : formatNumber(value);
};

// Logged values for one metric, oldest first, skipping months without it.
export const seriesFor = (entries, key) =>
  entries
    .filter((entry) => entry[key] !== null && entry[key] !== undefined)
    .map((entry) => ({ month: entry.month, value: Number(entry[key]) }))
    .sort((a, b) => monthIndex(a.month) - monthIndex(b.month));

export const changeFromPrevious = (series) => {
  if (series.length < 2) {
    return null;
  }
  const previous = series[series.length - 2];
  const latest = series[series.length - 1];
  return {
    previousMonth: previous.month,
    delta: latest.value - previous.value,
    percent: previous.value > 0 ? ((latest.value - previous.value) / previous.value) * 100 : null,
  };
};

// Straight-line projection from the last few logged months.
export const projectGoal = (series, target) => {
  if (series.length === 0) {
    return { state: "no_data" };
  }

  const latest = series[series.length - 1];
  if (latest.value >= target) {
    return { state: "reached" };
  }

  const recent = series.slice(-4);
  if (recent.length < 2) {
    return { state: "need_more_data" };
  }

  const first = recent[0];
  const months = monthIndex(latest.month) - monthIndex(first.month);
  const perMonth = (latest.value - first.value) / months;

  if (perMonth <= 0) {
    return { state: "not_growing" };
  }

  const monthsNeeded = Math.ceil((target - latest.value) / perMonth);

  return {
    state: "projected",
    perMonth,
    projectedIndex: monthIndex(latest.month) + monthsNeeded,
    latest,
  };
};

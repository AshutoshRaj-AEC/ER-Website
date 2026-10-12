// Pure analytics over imported rows. Nothing here talks to the database, so
// the same code runs on real data, demo data and in tests.

import { PERIOD_PRESETS } from "./reportTypes.js";

export const DAILY_METRICS = ["streams", "listeners", "followers", "saves", "playlist_adds"];

export const TIME_FILTERS = [
  { id: "24h", label: "24 hours", days: 1, summaryPreset: "24h" },
  { id: "7d", label: "7 days", days: 7, summaryPreset: "7d" },
  { id: "28d", label: "28 days", days: 28, summaryPreset: "28d" },
  { id: "12m", label: "12 months", days: 365, summaryPreset: "12m" },
  { id: "all", label: "All time", days: null, summaryPreset: "all_time" },
];

// Dates are "YYYY-MM-DD" strings exactly as Spotify reports them, handled in
// UTC so a viewer's time zone never shifts a day.
export const addDays = (iso, days) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const daysBetween = (from, to) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

export const formatDay = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// One combined value per date for the artist (or one song), optionally for a
// single country. When a file only has per-country rows and no worldwide
// rows, worldwide totals are summed from countries; listeners and followers
// are then approximate because one person can appear in several countries.
export const buildDailySeries = (rows, { scope = "artist", songKey = "", country = "" } = {}) => {
  const relevant = rows.filter(
    (row) => row.scope === scope && (scope === "artist" || row.song_key === songKey)
  );

  let chosen;
  let approximate = false;
  if (country) {
    chosen = relevant.filter((row) => row.country === country);
  } else {
    const worldwide = relevant.filter((row) => row.country === "");
    chosen = worldwide.length > 0 ? worldwide : relevant;
    approximate = worldwide.length === 0 && relevant.length > 0;
  }

  const byDate = new Map();
  for (const row of chosen) {
    const entry =
      byDate.get(row.metric_date) ??
      { date: row.metric_date, streams: null, listeners: null, followers: null, saves: null, playlist_adds: null };
    for (const metric of DAILY_METRICS) {
      if (row[metric] !== null && row[metric] !== undefined) {
        entry[metric] = (entry[metric] ?? 0) + Number(row[metric]);
      }
    }
    byDate.set(row.metric_date, entry);
  }

  const points = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  return { points, approximate };
};

// Turn a time filter into a concrete date window, based on the dates that are
// actually in the data. Filters count back from the last day in the data, not
// from today, because CSV exports are never real-time.
export const resolveWindow = (filterId, points) => {
  if (points.length === 0) {
    return { status: "empty", message: "There's no dated data for this selection yet." };
  }

  const first = points[0].date;
  const last = points[points.length - 1].date;
  const filter = TIME_FILTERS.find((entry) => entry.id === filterId) ?? TIME_FILTERS[2];

  if (filter.id === "all") {
    return {
      status: "ok",
      first,
      last,
      start: first,
      end: last,
      previous: null,
      label: `All time: ${formatDay(first)} – ${formatDay(last)}`,
      noPreviousReason: "All-time data has no earlier period to compare with.",
    };
  }

  if (filter.id === "24h") {
    const previousDay = addDays(last, -1);
    return {
      status: "adjusted",
      first,
      last,
      start: last,
      end: last,
      previous: { start: previousDay, end: previousDay },
      label: `Latest day: ${formatDay(last)}`,
      message:
        "Spotify for Artists exports have one row per day, so a 24-hour view isn't possible. Showing the latest full day in your data instead.",
    };
  }

  const start = addDays(last, -(filter.days - 1));
  if (start < first) {
    const available = daysBetween(first, last) + 1;
    return {
      status: "partial",
      first,
      last,
      start: first,
      end: last,
      previous: null,
      label: `${plural(available, "day")} available: ${formatDay(first)} – ${formatDay(last)}`,
      message: `Your data covers ${plural(available, "day")}, fewer than ${filter.label}. Showing every available day instead. Upload an export with an older start date to see the full ${filter.label}.`,
      noPreviousReason: "There's no earlier data to compare with.",
    };
  }

  return {
    status: "ok",
    first,
    last,
    start,
    end: last,
    previous: { start: addDays(start, -filter.days), end: addDays(start, -1) },
    label: `Last ${filter.label}: ${formatDay(start)} – ${formatDay(last)}`,
  };
};

const sumOf = (points, metric) => {
  const values = points.map((point) => point[metric]).filter((value) => value !== null);
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
};

const aggregatePoints = (points, allPoints, start) => {
  const listenerDays = points.filter((point) => point.listeners !== null);
  const followerDays = points.filter((point) => point.followers !== null);
  const ratioDays = points.filter(
    (point) => point.streams !== null && point.listeners !== null && point.listeners > 0
  );

  // Followers are a running total: report the latest value and the change
  // since the day before the window (or since its first day if that's missing).
  let followersChange = null;
  if (followerDays.length > 0) {
    const before = allPoints.filter((point) => point.date < start && point.followers !== null).at(-1);
    const baseline = before?.followers ?? (followerDays.length > 1 ? followerDays[0].followers : null);
    followersChange = baseline === null ? null : followerDays.at(-1).followers - baseline;
  }

  const ratioStreams = ratioDays.reduce((total, point) => total + point.streams, 0);
  const ratioListeners = ratioDays.reduce((total, point) => total + point.listeners, 0);

  return {
    streams: sumOf(points, "streams"),
    saves: sumOf(points, "saves"),
    playlist_adds: sumOf(points, "playlist_adds"),
    listenersAvg: listenerDays.length ? sumOf(listenerDays, "listeners") / listenerDays.length : null,
    listenersPeak: listenerDays.length ? Math.max(...listenerDays.map((point) => point.listeners)) : null,
    followersLatest: followerDays.at(-1)?.followers ?? null,
    followersChange,
    streamsPerListener: ratioListeners > 0 ? ratioStreams / ratioListeners : null,
    daysWithData: points.length,
  };
};

// Totals for the window and, when the previous equivalent window is fully
// covered by data, for that window too.
export const summarizeWindow = (points, window) => {
  const inWindow = points.filter((point) => point.date >= window.start && point.date <= window.end);
  const current = {
    ...aggregatePoints(inWindow, points, window.start),
    expectedDays: daysBetween(window.start, window.end) + 1,
  };

  if (!window.previous) {
    return { current, previous: null, noPreviousReason: window.noPreviousReason ?? "There's no previous period to compare with." };
  }

  const previousPoints = points.filter(
    (point) => point.date >= window.previous.start && point.date <= window.previous.end
  );
  const expected = daysBetween(window.previous.start, window.previous.end) + 1;
  if (previousPoints.length < expected) {
    return {
      current,
      previous: null,
      noPreviousReason: `Your data only has ${previousPoints.length} of the ${expected} days in the previous period (${formatDay(window.previous.start)} – ${formatDay(window.previous.end)}), so there's nothing reliable to compare with.`,
    };
  }

  return { current, previous: aggregatePoints(previousPoints, points, window.previous.start), noPreviousReason: null };
};

// Percentage change, or the reason it can't be calculated.
export const percentChange = (current, previous, noPreviousReason) => {
  if (current === null || current === undefined) {
    return { available: false, reason: "No data for this period." };
  }
  if (previous === null || previous === undefined) {
    return { available: false, reason: noPreviousReason ?? "No data for the previous period." };
  }
  if (previous === 0) {
    return { available: false, reason: "The previous period was zero, so a percentage change can't be calculated." };
  }
  return { available: true, value: ((current - previous) / previous) * 100 };
};

// Reporting periods ----------------------------------------------------------

export const periodKey = (row) => `${row.period_preset}|${row.period_start}|${row.period_end}`;

export const periodLabel = ({ period_preset: preset, period_start: start, period_end: end }) => {
  if (preset === "all_time") return `All time, up to ${formatDay(end)}`;
  if (preset === "custom") return `${formatDay(start)} – ${formatDay(end)}`;
  const name = PERIOD_PRESETS.find((entry) => entry.id === preset)?.label ?? preset;
  return `${name}, ending ${formatDay(end)}`;
};

// Distinct periods available for a report type, latest first.
export const listPeriods = (periodRows, reportType) => {
  const periods = new Map();
  for (const row of periodRows) {
    if (row.report_type === reportType && !periods.has(periodKey(row))) {
      periods.set(periodKey(row), {
        key: periodKey(row),
        period_preset: row.period_preset,
        period_start: row.period_start,
        period_end: row.period_end,
      });
    }
  }
  return [...periods.values()]
    .sort((a, b) => (a.period_end === b.period_end ? 0 : a.period_end < b.period_end ? 1 : -1))
    .map((period) => ({ ...period, label: periodLabel(period) }));
};

// The latest period that matches a time filter, if there is one.
export const matchPeriodToFilter = (periods, filterId) => {
  const preset = TIME_FILTERS.find((entry) => entry.id === filterId)?.summaryPreset;
  return periods.find((period) => period.period_preset === preset) ?? null;
};

// Rows of one report type and period, combined per entity. With no country
// chosen, worldwide rows are used when present, otherwise countries are summed
// (listeners then marked approximate).
export const rowsForPeriod = (periodRows, reportType, period, country = "") => {
  const inPeriod = periodRows.filter(
    (row) => row.report_type === reportType && periodKey(row) === period.key
  );

  let chosen;
  let approximate = false;
  if (country) {
    chosen = inPeriod.filter((row) => row.country === country);
  } else {
    const worldwide = inPeriod.filter((row) => row.country === "");
    chosen = worldwide.length > 0 ? worldwide : inPeriod;
    approximate = worldwide.length === 0 && inPeriod.length > 0;
  }

  const byEntity = new Map();
  for (const row of chosen) {
    const entry = byEntity.get(row.entity_key) ?? {
      key: row.entity_key,
      name: row.entity_name,
      curator: row.playlist_curator ?? null,
      song: row.song_name ?? null,
      release_date: row.release_date ?? null,
      added_date: row.added_date ?? null,
      streams: null,
      listeners: null,
      saves: null,
      playlist_adds: null,
      followers: null,
    };
    for (const metric of ["streams", "listeners", "saves", "playlist_adds", "followers"]) {
      if (row[metric] !== null && row[metric] !== undefined) {
        entry[metric] = (entry[metric] ?? 0) + Number(row[metric]);
      }
    }
    byEntity.set(row.entity_key, entry);
  }

  const rows = [...byEntity.values()].map((entry) => ({
    ...entry,
    streamsPerListener:
      entry.streams !== null && entry.listeners ? entry.streams / entry.listeners : null,
  }));
  return { rows, approximate };
};

// Per-song totals derived from song timelines for a date window, used when no
// songs report matches the selected period.
export const songsFromDaily = (dailyRows, window, country = "") => {
  const songKeys = [...new Set(dailyRows.filter((row) => row.scope === "song").map((row) => row.song_key))];
  return songKeys.map((songKey) => {
    const { points } = buildDailySeries(dailyRows, { scope: "song", songKey, country });
    const inWindow = points.filter((point) => point.date >= window.start && point.date <= window.end);
    const summary = aggregatePoints(inWindow, points, window.start);
    const name = dailyRows.find((row) => row.scope === "song" && row.song_key === songKey)?.song_name ?? songKey;
    return {
      key: songKey,
      name,
      streams: summary.streams,
      listeners: summary.listenersAvg === null ? null : Math.round(summary.listenersAvg),
      listenersAreDailyAverage: true,
      saves: summary.saves,
      playlist_adds: summary.playlist_adds,
      streamsPerListener: summary.streamsPerListener,
      daysWithData: summary.daysWithData,
    };
  }).filter((song) => song.daysWithData > 0);
};

export const availableCountries = (dailyRows, periodRows) =>
  [
    ...new Set([
      ...dailyRows.map((row) => row.country),
      ...periodRows.filter((row) => row.report_type !== "countries_summary").map((row) => row.country),
    ]),
  ]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

// Which metrics have at least one real value (so the UI only shows those).
export const metricsPresent = (rows, metrics) =>
  metrics.filter((metric) => rows.some((row) => row[metric] !== null && row[metric] !== undefined));

// Tables -------------------------------------------------------------------

export const searchRows = (rows, query, fields) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    fields.some((field) => String(row[field] ?? "").toLowerCase().includes(needle))
  );
};

// Sort by a column; empty values always go last, whatever the direction.
export const sortRows = (rows, key, direction = "desc") =>
  [...rows].sort((a, b) => {
    const left = a[key];
    const right = b[key];
    const leftMissing = left === null || left === undefined || left === "";
    const rightMissing = right === null || right === undefined || right === "";
    if (leftMissing && rightMissing) return 0;
    if (leftMissing) return 1;
    if (rightMissing) return -1;
    const order =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
    return direction === "asc" ? order : -order;
  });

export const paginate = (rows, page, pageSize) => {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  return {
    rows: rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    page: safePage,
    pageCount,
    total: rows.length,
  };
};

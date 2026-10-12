import { describe, expect, it } from "vitest";
import {
  addDays,
  buildDailySeries,
  listPeriods,
  matchPeriodToFilter,
  paginate,
  percentChange,
  resolveWindow,
  rowsForPeriod,
  searchRows,
  songsFromDaily,
  sortRows,
  summarizeWindow,
} from "../../lib/insights/analytics.js";

const day = (date, values = {}) => ({
  scope: "artist", song_key: "", country: "", metric_date: date,
  streams: null, listeners: null, followers: null, saves: null, playlist_adds: null,
  ...values,
});

// 60 consecutive days ending 2026-10-31: 10 streams and 4 listeners a day,
// followers growing by 1 a day from 100.
const sixtyDays = Array.from({ length: 60 }, (_, index) =>
  day(addDays("2026-09-02", index), { streams: 10, listeners: 4, followers: 100 + index })
);

describe("resolveWindow", () => {
  const { points } = buildDailySeries(sixtyDays);

  it("counts back from the last day in the data, not today", () => {
    const window = resolveWindow("7d", points);
    expect(window).toMatchObject({ status: "ok", start: "2026-10-25", end: "2026-10-31" });
    expect(window.previous).toEqual({ start: "2026-10-18", end: "2026-10-24" });
  });

  it("explains that 24 hours isn't available from daily data and uses the latest day", () => {
    const window = resolveWindow("24h", points);
    expect(window.status).toBe("adjusted");
    expect(window.start).toBe("2026-10-31");
    expect(window.message).toContain("one row per day");
  });

  it("falls back to all available days when the data is shorter than the filter", () => {
    const window = resolveWindow("12m", points);
    expect(window.status).toBe("partial");
    expect(window.start).toBe("2026-09-02");
    expect(window.message).toContain("60 days");
  });

  it("handles all time and empty data", () => {
    expect(resolveWindow("all", points)).toMatchObject({ start: "2026-09-02", end: "2026-10-31", previous: null });
    expect(resolveWindow("7d", []).status).toBe("empty");
  });
});

describe("summarizeWindow", () => {
  const { points } = buildDailySeries(sixtyDays);

  it("adds streams but averages listeners instead of adding them", () => {
    const { current } = summarizeWindow(points, resolveWindow("7d", points));
    expect(current.streams).toBe(70);
    expect(current.listenersAvg).toBe(4);
    expect(current.streamsPerListener).toBe(2.5);
  });

  it("treats followers as a running total", () => {
    const { current } = summarizeWindow(points, resolveWindow("7d", points));
    expect(current.followersLatest).toBe(159);
    // Change since the day before the window (24 Oct: 152).
    expect(current.followersChange).toBe(7);
  });

  it("compares with a fully covered previous period", () => {
    const summary = summarizeWindow(points, resolveWindow("28d", points));
    expect(summary.previous.streams).toBe(280);
    expect(percentChange(summary.current.streams, summary.previous.streams).value).toBe(0);
  });

  it("refuses to compare when the previous period isn't fully covered", () => {
    const { points: shortPoints } = buildDailySeries(sixtyDays.slice(-40));
    const summary = summarizeWindow(shortPoints, resolveWindow("28d", shortPoints));
    expect(summary.previous).toBeNull();
    expect(summary.noPreviousReason).toContain("12 of the 28 days");
  });

  it("keeps a metric unavailable when it has no values instead of using zero", () => {
    const { points: noListeners } = buildDailySeries([day("2026-10-01", { streams: 5 })]);
    const { current } = summarizeWindow(noListeners, resolveWindow("all", noListeners));
    expect(current.listenersAvg).toBeNull();
    expect(current.streamsPerListener).toBeNull();
    expect(current.saves).toBeNull();
  });
});

describe("percentChange", () => {
  it("is unavailable when the baseline is missing or zero", () => {
    expect(percentChange(10, null).available).toBe(false);
    expect(percentChange(10, 0).available).toBe(false);
    expect(percentChange(10, 0).reason).toContain("zero");
    expect(percentChange(null, 5).available).toBe(false);
    expect(percentChange(15, 10).value).toBe(50);
  });
});

describe("country filtering", () => {
  const rows = [
    day("2026-10-01", { country: "IN", streams: 60, listeners: 30 }),
    day("2026-10-01", { country: "US", streams: 40, listeners: 20 }),
    day("2026-10-02", { country: "IN", streams: 70, listeners: 35 }),
  ];

  it("filters to one country", () => {
    const { points, approximate } = buildDailySeries(rows, { country: "US" });
    expect(points).toEqual([expect.objectContaining({ date: "2026-10-01", streams: 40 })]);
    expect(approximate).toBe(false);
  });

  it("sums countries for a worldwide view only when no worldwide rows exist, and marks it approximate", () => {
    const { points, approximate } = buildDailySeries(rows);
    expect(points[0].streams).toBe(100);
    expect(approximate).toBe(true);
    const withWorldwide = [...rows, day("2026-10-01", { streams: 105, listeners: 48 })];
    const result = buildDailySeries(withWorldwide);
    expect(result.points[0].streams).toBe(105);
    expect(result.approximate).toBe(false);
  });

  it("combines with song filters", () => {
    const songRows = [
      { ...day("2026-10-01", { country: "IN", streams: 9 }), scope: "song", song_key: "a" },
      { ...day("2026-10-01", { country: "IN", streams: 4 }), scope: "song", song_key: "b" },
    ];
    const { points } = buildDailySeries(songRows, { scope: "song", songKey: "b", country: "IN" });
    expect(points[0].streams).toBe(4);
  });
});

describe("reporting periods", () => {
  const periodRow = (preset, start, end, streams, extra = {}) => ({
    report_type: "songs_summary", entity_key: "night drive", entity_name: "Night Drive", country: "",
    period_preset: preset, period_start: start, period_end: end, streams, listeners: null, saves: null,
    playlist_adds: null, followers: null, ...extra,
  });
  const rows = [
    periodRow("28d", "2026-10-01", "2026-10-28", 900),
    periodRow("7d", "2026-10-22", "2026-10-28", 300),
    periodRow("28d", "2026-09-03", "2026-09-30", 700),
  ];

  it("never adds overlapping periods together", () => {
    const periods = listPeriods(rows, "songs_summary");
    expect(periods).toHaveLength(3);
    const latest28 = matchPeriodToFilter(periods, "28d");
    expect(latest28.period_end).toBe("2026-10-28");
    const { rows: songs } = rowsForPeriod(rows, "songs_summary", latest28);
    expect(songs).toHaveLength(1);
    expect(songs[0].streams).toBe(900);
  });

  it("returns null when no period matches the filter", () => {
    expect(matchPeriodToFilter(listPeriods(rows, "songs_summary"), "12m")).toBeNull();
  });

  it("derives song totals from song timelines when there's no matching report", () => {
    const songDays = [
      { ...day("2026-10-27", { streams: 5, listeners: 2 }), scope: "song", song_key: "a", song_name: "A" },
      { ...day("2026-10-28", { streams: 7, listeners: 4 }), scope: "song", song_key: "a", song_name: "A" },
    ];
    const [song] = songsFromDaily(songDays, { start: "2026-10-22", end: "2026-10-28" });
    expect(song).toMatchObject({ name: "A", streams: 12, listeners: 3, listenersAreDailyAverage: true });
  });
});

describe("table helpers", () => {
  const rows = [
    { name: "B song", streams: 5 },
    { name: "a song", streams: null },
    { name: "C song", streams: 50 },
  ];

  it("sorts with empty values last in both directions", () => {
    expect(sortRows(rows, "streams", "desc").map((row) => row.name)).toEqual(["C song", "B song", "a song"]);
    expect(sortRows(rows, "streams", "asc").map((row) => row.name)).toEqual(["B song", "C song", "a song"]);
    expect(sortRows(rows, "name", "asc").map((row) => row.name)).toEqual(["a song", "B song", "C song"]);
  });

  it("searches case-insensitively", () => {
    expect(searchRows(rows, "c SONG", ["name"])).toHaveLength(1);
  });

  it("paginates and clamps the page", () => {
    const many = Array.from({ length: 53 }, (_, i) => ({ i }));
    expect(paginate(many, 3, 25)).toMatchObject({ page: 3, pageCount: 3, total: 53 });
    expect(paginate(many, 3, 25).rows).toHaveLength(3);
    expect(paginate(many, 99, 25).page).toBe(3);
  });
});

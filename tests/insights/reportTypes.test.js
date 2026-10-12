import { describe, expect, it } from "vitest";
import { parseCsvWithHeader } from "../../lib/insights/csv.js";
import { detectReportType, mapColumns, normalizeRecords } from "../../lib/insights/reportTypes.js";
import { detectDateOrder, parseCount, parseDateValue } from "../../lib/insights/values.js";

const load = (csv) => parseCsvWithHeader(csv);

describe("detectReportType", () => {
  it("recognises an audience timeline by its followers column", () => {
    const { typeId, alternatives } = detectReportType(["date", "listeners", "streams", "followers"]);
    expect(typeId).toBe("audience_timeline");
    expect(alternatives).toEqual([]);
  });

  it("offers a song timeline as an alternative when a timeline has no followers", () => {
    const { typeId, alternatives } = detectReportType(["date", "streams", "listeners"]);
    expect(typeId).toBe("audience_timeline");
    expect(alternatives).toContain("song_timeline");
  });

  it("recognises a multi-song timeline by its song column", () => {
    expect(detectReportType(["date", "song", "streams"]).typeId).toBe("song_timeline");
  });

  it("recognises a songs report", () => {
    expect(detectReportType(["song", "listeners", "streams", "saves", "release_date"]).typeId).toBe("songs_summary");
  });

  it("tells a playlists report apart from a songs report with a title column", () => {
    expect(detectReportType(["title", "author", "listeners", "streams", "date_added"]).typeId).toBe("playlists_summary");
    expect(detectReportType(["title", "streams", "listeners"]).typeId).toBe("songs_summary");
  });

  it("recognises a countries report", () => {
    expect(detectReportType(["Country", "Listeners"]).typeId).toBe("countries_summary");
  });

  it("matches headers regardless of case, spacing and punctuation", () => {
    expect(detectReportType(["Date", "Stream Count", "Follower_Count"]).typeId).toBe("audience_timeline");
  });

  it("returns no type for unsupported files", () => {
    expect(detectReportType(["name", "email"]).typeId).toBeNull();
    expect(detectReportType(["date", "views"]).typeId).toBeNull();
  });

  it("lists unsupported metrics separately from unknown columns", () => {
    const { unsupported, ignored } = mapColumns("songs_summary", ["song", "streams", "views", "mystery"]);
    expect(unsupported).toEqual(["views"]);
    expect(ignored).toEqual(["mystery"]);
  });
});

describe("cell parsing", () => {
  it("parses counts with separators and keeps missing values empty", () => {
    expect(parseCount("12,345").value).toBe(12345);
    expect(parseCount("1 234").value).toBe(1234);
    expect(parseCount("1.234.567").value).toBe(1234567);
    expect(parseCount("").value).toBeNull();
    expect(parseCount("-").value).toBeNull();
    expect(parseCount("n/a").value).toBeNull();
  });

  it("rejects negative, fractional and non-numeric counts", () => {
    expect(parseCount("-5").error).toBe(true);
    expect(parseCount("1.5").error).toBe(true);
    expect(parseCount("abc").error).toBe(true);
    expect(parseCount("1e5").error).toBe(true);
  });

  it("detects day/month order from the whole column", () => {
    expect(detectDateOrder(["01/10/2026", "25/10/2026"])).toBe("dmy");
    expect(detectDateOrder(["10/01/2026", "10/25/2026"])).toBe("mdy");
    expect(detectDateOrder(["01/02/2026", "03/04/2026"])).toBe("ambiguous");
    expect(detectDateOrder(["2026-10-01"])).toBe("iso");
    expect(detectDateOrder(["25/01/2026", "01/25/2026"])).toBe("mixed");
  });

  it("parses supported date formats and rejects impossible dates", () => {
    expect(parseDateValue("2026-10-01").value).toBe("2026-10-01");
    expect(parseDateValue("2026-10-01T00:00:00Z")).toEqual({ value: "2026-10-01", hadTime: false, precision: "day" });
    expect(parseDateValue("2026-10-01 14:30").hadTime).toBe(true);
    expect(parseDateValue("25/10/2026", "dmy").value).toBe("2026-10-25");
    expect(parseDateValue("10/25/2026", "mdy").value).toBe("2026-10-25");
    expect(parseDateValue("1 Oct 2026").value).toBe("2026-10-01");
    expect(parseDateValue("October 1, 2026").value).toBe("2026-10-01");
    expect(parseDateValue("2026-02-30").value).toBeNull();
    expect(parseDateValue("not a date").value).toBeNull();
  });
});

describe("normalizeRecords", () => {
  it("normalises an audience timeline and keeps missing metrics empty", () => {
    const { headers, records } = load("date,listeners,streams,followers\n2026-10-01,40,100,500\n2026-10-02,,120,505\n");
    const result = normalizeRecords({ typeId: "audience_timeline", headers, records });
    expect(result.canImport).toBe(true);
    expect(result.daily).toHaveLength(2);
    expect(result.daily[1].listeners).toBeNull();
    expect(result.daily[1].streams).toBe(120);
    expect(result.coverage).toEqual({ start: "2026-10-01", end: "2026-10-02" });
    expect(result.metricsFound).toEqual(["streams", "listeners", "followers"]);
  });

  it("skips invalid dates and rows with no metric values, with messages", () => {
    const { headers, records } = load("date,streams\n2026-10-01,10\nyesterday,5\n2026-10-03,\n");
    const result = normalizeRecords({ typeId: "audience_timeline", headers, records });
    expect(result.daily).toHaveLength(1);
    expect(result.skipped).toBe(2);
    expect(result.issues.map((issue) => issue.line)).toEqual([3, 4]);
  });

  it("flags invalid numbers but keeps the row's other metrics", () => {
    const { headers, records } = load("date,streams,listeners\n2026-10-01,lots,40\n");
    const result = normalizeRecords({ typeId: "audience_timeline", headers, records });
    expect(result.daily[0]).toMatchObject({ streams: null, listeners: 40 });
    expect(result.issues[0].message).toContain("isn't a valid streams count");
  });

  it("blocks ambiguous dates until a date order is chosen", () => {
    const { headers, records } = load("date,streams\n01/02/2026,10\n03/04/2026,12\n");
    const blocked = normalizeRecords({ typeId: "audience_timeline", headers, records });
    expect(blocked.canImport).toBe(false);
    const resolved = normalizeRecords({ typeId: "audience_timeline", headers, records, options: { dateOrder: "dmy" } });
    expect(resolved.canImport).toBe(true);
    expect(resolved.daily.map((row) => row.metric_date)).toEqual(["2026-02-01", "2026-04-03"]);
  });

  it("needs a song name for a single-song timeline", () => {
    const { headers, records } = load("date,streams\n2026-10-01,10\n");
    expect(normalizeRecords({ typeId: "song_timeline", headers, records }).canImport).toBe(false);
    const result = normalizeRecords({ typeId: "song_timeline", headers, records, options: { songName: "  Night  Drive " } });
    expect(result.daily[0]).toMatchObject({ scope: "song", song_key: "night drive", song_name: "Night  Drive" });
  });

  it("needs a reporting period for summary reports and computes it", () => {
    const { headers, records } = load("song,streams,listeners\nNight Drive,900,400\n");
    expect(normalizeRecords({ typeId: "songs_summary", headers, records }).canImport).toBe(false);
    const result = normalizeRecords({
      typeId: "songs_summary",
      headers,
      records,
      options: { period: { preset: "28d", end: "2026-10-28" } },
    });
    expect(result.period[0]).toMatchObject({
      entity_key: "night drive",
      period_preset: "28d",
      period_start: "2026-10-01",
      period_end: "2026-10-28",
      streams: 900,
    });
    const allTime = normalizeRecords({
      typeId: "songs_summary",
      headers,
      records,
      options: { period: { preset: "all_time", end: "2026-10-28" } },
    });
    expect(allTime.period[0].period_start).toBe("-infinity");
    expect(allTime.coverage.start).toBeNull();
  });

  it("keeps playlist names, curators and associated songs exactly as given", () => {
    const { headers, records } = load("title,author,listeners,streams,date_added\nLate Night,Spotify,120,300,2026-09-01\nLate Night,Someone Else,5,9,\n");
    const result = normalizeRecords({
      typeId: "playlists_summary",
      headers,
      records,
      options: { period: { preset: "28d", end: "2026-10-28" } },
    });
    expect(result.period).toHaveLength(2);
    expect(result.period[0]).toMatchObject({ entity_name: "Late Night", playlist_curator: "Spotify", song_name: null, added_date: "2026-09-01" });
    // Same name, different curator: two different playlists.
    expect(new Set(result.period.map((row) => row.entity_key)).size).toBe(2);
  });

  it("reports duplicate rows for the same day", () => {
    const { headers, records } = load("date,streams\n2026-10-01,10\n2026-10-01,12\n");
    const result = normalizeRecords({ typeId: "audience_timeline", headers, records });
    expect(result.duplicates).toBe(1);
    expect(result.issues.some((issue) => issue.message.includes("Only the last one"))).toBe(true);
  });

  it("keeps year-only and year-month release dates with their precision", () => {
    const { headers, records } = load("song,streams,release_date\nOld Song,10,2023\nMid Song,5,2024-05\nNew Song,7,2026-03-01\nNo Date,3,n/a\n");
    const result = normalizeRecords({
      typeId: "songs_summary",
      headers,
      records,
      options: { period: { preset: "7d", end: "2026-10-11" } },
    });
    expect(result.period.map((row) => [row.release_date, row.release_precision])).toEqual([
      ["2023-01-01", "year"],
      ["2024-05-01", "month"],
      ["2026-03-01", "day"],
      [null, null],
    ]);
    expect(result.issues).toEqual([]);
  });

  it("treats n/a in optional date columns as unknown without warnings", () => {
    const { headers, records } = load("title,author,listeners,streams,date_added\nAlgorithmic Mix,Spotify,10,20,n/a\n");
    const result = normalizeRecords({
      typeId: "playlists_summary",
      headers,
      records,
      options: { period: { preset: "7d", end: "2026-10-11" } },
    });
    expect(result.period[0].added_date).toBeNull();
    expect(result.issues).toEqual([]);
  });

  it("doesn't accept a bare year as a daily timeline date", () => {
    const { headers, records } = load("date,streams\n2026,10\n");
    expect(normalizeRecords({ typeId: "audience_timeline", headers, records }).daily).toHaveLength(0);
  });

  it("normalises country codes and keeps country as a dimension", () => {
    const { headers, records } = load("date,country,streams\n2026-10-01,in,10\n2026-10-01,US,5\n");
    const result = normalizeRecords({ typeId: "audience_timeline", headers, records });
    expect(result.daily.map((row) => row.country)).toEqual(["IN", "US"]);
  });
});

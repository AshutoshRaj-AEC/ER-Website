// Demo data for exploring Insights before uploading anything. It's generated
// in the browser, shown with a "Demo data" banner, and never saved, so it can
// never mix with an artist's real imports.

import { addDays } from "./analytics.js";

// Small seeded random generator so the demo looks the same on every visit.
const createRandom = (seed) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const DEMO_SONGS = [
  { name: "Midnight Signals (Demo)", weight: 0.32, released: "2025-11-14" },
  { name: "City of Echoes (Demo)", weight: 0.24, released: "2026-02-06" },
  { name: "Paper Crowns (Demo)", weight: 0.18, released: "2025-06-20" },
  { name: "Slow Burn Avenue (Demo)", weight: 0.14, released: "2026-07-03" },
  { name: "Static Hearts (Demo)", weight: 0.12, released: "2025-03-01" },
];

const DEMO_PLAYLISTS = [
  { name: "Demo Indie Discoveries", curator: "Demo Curator A", share: 0.18 },
  { name: "Demo Late Night Drive", curator: "Demo Curator B", share: 0.11 },
  { name: "Demo Fresh Finds", curator: "Spotify (demo)", share: 0.09 },
  { name: "Demo Study Beats", curator: "Demo Curator C", share: 0.05 },
  { name: "Demo Gym Mix", curator: "Demo Curator D", share: 0.03 },
];

const DEMO_COUNTRIES = [
  ["IN", 0.46], ["US", 0.14], ["GB", 0.08], ["CA", 0.06], ["AE", 0.05],
  ["AU", 0.04], ["DE", 0.04], ["NP", 0.03],
];

export const createDemoData = (endDate) => {
  const random = createRandom(42);
  const days = 400;
  const start = addDays(endDate, -(days - 1));
  const daily = [];
  let followers = 1800;

  for (let index = 0; index < days; index += 1) {
    const date = addDays(start, index);
    const trend = 220 + index * 2.4;
    const weekly = new Date(`${date}T00:00:00Z`).getUTCDay() >= 5 ? 1.18 : 1;
    const streams = Math.round(trend * weekly * (0.85 + random() * 0.3));
    const listeners = Math.round(streams / (1.6 + random() * 0.4));
    followers += Math.round(2 + random() * 6 + index / 80);

    daily.push({
      scope: "artist", song_key: "", song_name: null, country: "", metric_date: date,
      streams, listeners, followers, saves: null, playlist_adds: null, import_id: "demo",
    });

    // Song timelines for the last 90 days.
    if (index >= days - 90) {
      for (const song of DEMO_SONGS) {
        if (date < song.released) continue;
        const songStreams = Math.round(streams * song.weight * (0.8 + random() * 0.4));
        daily.push({
          scope: "song",
          song_key: song.name.toLowerCase(),
          song_name: song.name,
          country: "",
          metric_date: date,
          streams: songStreams,
          listeners: Math.round(songStreams / (1.4 + random() * 0.5)),
          followers: null,
          saves: Math.round(songStreams * (0.03 + random() * 0.02)),
          playlist_adds: Math.round(songStreams * (0.01 + random() * 0.01)),
          import_id: "demo",
        });
      }
    }
  }

  const period = [];
  const presets = [
    { preset: "7d", days: 7 },
    { preset: "28d", days: 28 },
    { preset: "12m", days: 365 },
  ];

  for (const { preset, days: length } of presets) {
    const periodStart = addDays(endDate, -(length - 1));
    const total = daily
      .filter((row) => row.scope === "artist" && row.metric_date >= periodStart)
      .reduce((sum, row) => sum + row.streams, 0);

    for (const song of DEMO_SONGS) {
      const songStreams = Math.round(total * song.weight);
      period.push({
        report_type: "songs_summary",
        entity_key: song.name.toLowerCase(),
        entity_name: song.name,
        release_date: song.released,
        country: "",
        period_preset: preset,
        period_start: periodStart,
        period_end: endDate,
        streams: songStreams,
        listeners: Math.round(songStreams / 1.9),
        saves: Math.round(songStreams * 0.04),
        playlist_adds: Math.round(songStreams * 0.015),
        import_id: "demo",
      });
    }

    for (const playlist of DEMO_PLAYLISTS) {
      const playlistStreams = Math.round(total * playlist.share);
      period.push({
        report_type: "playlists_summary",
        entity_key: playlist.name.toLowerCase(),
        entity_name: playlist.name,
        playlist_curator: playlist.curator,
        country: "",
        period_preset: preset,
        period_start: periodStart,
        period_end: endDate,
        streams: playlistStreams,
        listeners: Math.round(playlistStreams / 1.5),
        import_id: "demo",
      });
    }

    const listeners = Math.round(total / 1.8);
    for (const [country, share] of DEMO_COUNTRIES) {
      period.push({
        report_type: "countries_summary",
        entity_key: country.toLowerCase(),
        entity_name: country,
        country: "",
        period_preset: preset,
        period_start: periodStart,
        period_end: endDate,
        listeners: Math.round(listeners * share),
        import_id: "demo",
      });
    }
  }

  const imports = [
    { id: "demo-1", report_type: "audience_timeline", file_name: "demo-audience-timeline.csv", status: "completed", created_at: `${endDate}T09:00:00Z`, coverage_start: start, coverage_end: endDate, imported_count: days, new_count: days, replaced_count: 0, skipped_count: 0 },
  ];

  return { daily, period, imports };
};

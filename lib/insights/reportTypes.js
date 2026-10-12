// Supported Spotify for Artists CSV exports, how their columns map onto our
// fields, and how rows are validated and normalised.
//
// Spotify has changed its export columns over time and labels differ between
// pages, so each report lists the header names it accepts for every field.
// Detection is based on which fields a file's columns provide, never on the
// file name.

import { parseCount, parseDateValue, detectDateOrder } from "./values.js";

export const METRICS = {
  streams: {
    label: "Streams",
    definition: "Plays of 30 seconds or more.",
    additive: true,
  },
  listeners: {
    label: "Listeners",
    definition: "Unique people who streamed. The same person can listen on many days, so daily listeners can't be added together.",
    additive: false,
  },
  followers: {
    label: "Followers",
    definition: "Total followers on that day. This is a running total, not a daily count.",
    cumulative: true,
  },
  saves: {
    label: "Saves",
    definition: "Times a track was saved to a listener's library.",
    additive: true,
  },
  playlist_adds: {
    label: "Playlist adds",
    definition: "Times a track was added to a listener's playlist.",
    additive: true,
  },
};

const ALIASES = {
  date: ["date", "day", "report date", "stream date"],
  song: ["song", "song name", "song title", "track", "track name", "track title"],
  song_or_title: ["song", "song name", "song title", "track", "track name", "track title", "title", "name"],
  playlist: ["playlist", "playlist name", "playlist title", "title", "name"],
  curator: ["author", "curator", "owner", "playlist owner", "made by", "creator"],
  streams: ["streams", "stream count", "total streams", "plays"],
  listeners: ["listeners", "listener count", "unique listeners"],
  followers: ["followers", "follower count"],
  saves: ["saves", "save count"],
  playlist_adds: ["playlist adds", "playlist additions", "added to playlists", "playlists adds"],
  release_date: ["release date", "released", "release"],
  added_date: ["date added", "added", "added date", "added on"],
  country: ["country", "country name", "country code", "market"],
};

// Columns we recognise but don't analyse; they're listed in the preview.
const KNOWN_UNSUPPORTED = [
  "views", "canvas views", "skips", "skip rate", "impressions", "intent rate",
  "city", "region", "age", "gender", "playlist reach", "source", "segment",
  "conversion rate", "active audience", "programmed audience",
];

export const REPORT_TYPES = {
  audience_timeline: {
    label: "Audience timeline",
    description: "Daily streams, listeners and followers for your whole artist profile.",
    where: "Spotify for Artists → Audience → Timeline → Download (CSV).",
    kind: "daily",
    fields: { date: ALIASES.date, streams: ALIASES.streams, listeners: ALIASES.listeners, followers: ALIASES.followers, country: ALIASES.country },
    required: ["date"],
    requireOneOf: ["streams", "listeners", "followers"],
    forbidden: ["song", "playlist"],
  },
  song_timeline: {
    label: "Song timeline",
    description: "Daily streams and listeners for one song (or several songs if the file has a song column).",
    where: "Spotify for Artists → Music → open a song → Download (CSV).",
    kind: "daily",
    fields: {
      date: ALIASES.date, song: ALIASES.song, streams: ALIASES.streams, listeners: ALIASES.listeners,
      saves: ALIASES.saves, playlist_adds: ALIASES.playlist_adds, country: ALIASES.country,
    },
    required: ["date"],
    requireOneOf: ["streams", "listeners", "saves", "playlist_adds"],
    forbidden: ["followers", "playlist"],
  },
  songs_summary: {
    label: "Songs report",
    description: "Totals per song for one reporting period (e.g. last 28 days).",
    where: "Spotify for Artists → Music → Songs → pick a period → Download (CSV).",
    kind: "period",
    fields: {
      song: ALIASES.song_or_title, streams: ALIASES.streams, listeners: ALIASES.listeners, saves: ALIASES.saves,
      playlist_adds: ALIASES.playlist_adds, release_date: ALIASES.release_date, country: ALIASES.country,
    },
    required: ["song"],
    requireOneOf: ["streams", "listeners", "saves", "playlist_adds"],
    forbidden: ["date", "curator", "added_date", "followers"],
  },
  playlists_summary: {
    label: "Playlists report",
    description: "Streams and listeners from each playlist your music is on, for one reporting period.",
    where: "Spotify for Artists → Music → Playlists → pick a period → Download (CSV).",
    kind: "period",
    fields: {
      playlist: ALIASES.playlist, curator: ALIASES.curator, song: ALIASES.song, streams: ALIASES.streams,
      listeners: ALIASES.listeners, added_date: ALIASES.added_date,
    },
    required: ["playlist"],
    requireOneOf: ["streams", "listeners"],
    // A playlist export is recognised by its curator or date-added column, so a
    // songs report with a "title" column isn't mistaken for one.
    requireOneOfSignals: ["curator", "added_date"],
    forbidden: ["date"],
  },
  countries_summary: {
    label: "Countries report",
    description: "Listeners (and streams, if included) per country for one reporting period.",
    where: "Spotify for Artists → Audience → Location → Download (CSV).",
    kind: "period",
    fields: { country: ALIASES.country, listeners: ALIASES.listeners, streams: ALIASES.streams, followers: ALIASES.followers },
    required: ["country"],
    requireOneOf: ["listeners", "streams", "followers"],
    forbidden: ["date", "song", "playlist"],
  },
};

export const PERIOD_PRESETS = [
  { id: "24h", label: "Last 24 hours", days: 1 },
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "28d", label: "Last 28 days", days: 28 },
  { id: "12m", label: "Last 12 months", days: 365 },
  { id: "all_time", label: "All time (since release)", days: null },
  { id: "custom", label: "Custom dates", days: null },
];

export const normalizeHeader = (header) =>
  header
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[_\-./()]+/g, " ")
    .replace(/[^\p{L}\p{N} ]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeKey = (name) =>
  name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

export const normalizeCountry = (value) => {
  const cleaned = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  return /^[a-z]{2}$/i.test(cleaned) ? cleaned.toUpperCase() : cleaned;
};

// Map a report's fields onto the file's headers. First alias match wins and
// each header is used at most once.
export const mapColumns = (typeId, headers) => {
  const type = REPORT_TYPES[typeId];
  const normalized = headers.map((header) => ({ header, key: normalizeHeader(header) }));
  const used = new Set();
  const mapping = {};

  for (const [field, aliases] of Object.entries(type.fields)) {
    for (const alias of aliases) {
      const match = normalized.find((entry) => entry.key === alias && !used.has(entry.header));
      if (match) {
        mapping[field] = match.header;
        used.add(match.header);
        break;
      }
    }
  }

  const unmapped = headers.filter((header) => !used.has(header));
  const unsupported = unmapped.filter((header) => KNOWN_UNSUPPORTED.includes(normalizeHeader(header)));
  const ignored = unmapped.filter((header) => !unsupported.includes(header));

  return { mapping, unsupported, ignored };
};

// Which of our fields does this header set look like, regardless of report?
const fieldsPresent = (headers) => {
  const keys = new Set(headers.map(normalizeHeader));
  return Object.fromEntries(
    Object.entries(ALIASES).map(([field, aliases]) => [field, aliases.some((alias) => keys.has(alias))])
  );
};

const checkType = (typeId, headers) => {
  const type = REPORT_TYPES[typeId];
  const { mapping } = mapColumns(typeId, headers);
  const present = fieldsPresent(headers);
  const problems = [];

  for (const field of type.required) {
    if (!mapping[field]) {
      problems.push(`no ${field.replace("_", " ")} column`);
    }
  }
  if (!type.requireOneOf.some((field) => mapping[field])) {
    problems.push(`none of these columns: ${type.requireOneOf.map((f) => METRICS[f]?.label ?? f).join(", ")}`);
  }
  if (type.requireOneOfSignals && !type.requireOneOfSignals.some((field) => mapping[field])) {
    problems.push("no curator/author or date-added column");
  }
  for (const field of type.forbidden) {
    if (present[field]) {
      problems.push(`has a ${field.replace("_", " ")} column, which this report doesn't have`);
    }
  }

  return { typeId, ok: problems.length === 0, problems, score: Object.keys(mapping).length };
};

// Returns the most likely report type plus any other types the file also fits.
export const detectReportType = (headers) => {
  const results = Object.keys(REPORT_TYPES)
    .map((typeId) => checkType(typeId, headers))
    .sort((a, b) => Number(b.ok) - Number(a.ok) || b.score - a.score);

  const matches = results.filter((result) => result.ok);

  // Without followers or a song column, an audience timeline and a single-song
  // timeline look identical. Prefer audience, but offer the song timeline too.
  return {
    typeId: matches[0]?.typeId ?? null,
    alternatives: matches.slice(1).map((result) => result.typeId),
    results,
  };
};

const MAX_NAME_LENGTH = 300;

const computePeriod = ({ preset, end, start }) => {
  const days = PERIOD_PRESETS.find((p) => p.id === preset)?.days;
  if (preset === "all_time") {
    return { start: "-infinity", end };
  }
  if (preset === "custom") {
    return { start, end };
  }
  const endDate = new Date(`${end}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() - (days - 1));
  return { start: endDate.toISOString().slice(0, 10), end };
};

// Turn parsed CSV records into rows ready to store.
//   options.songName: required for a song timeline without a song column
//   options.period:   { preset, end, start } for period reports
//   options.dateOrder: "dmy" | "mdy" to resolve ambiguous slash dates
export const normalizeRecords = ({ typeId, headers, records, options = {} }) => {
  const type = REPORT_TYPES[typeId];
  const { mapping } = mapColumns(typeId, headers);
  const issues = [];
  const daily = [];
  const period = [];
  let skipped = 0;

  const issue = (level, line, message) => {
    issues.push({ level, line, message });
  };

  const metricFields = ["streams", "listeners", "followers", "saves", "playlist_adds"].filter(
    (field) => mapping[field]
  );

  // Work out the date order once for the whole file.
  const dateColumns = ["date", "release_date", "added_date"].filter((field) => mapping[field]);
  const dateOrders = {};
  for (const field of dateColumns) {
    const detected = detectDateOrder(records.map((record) => record.values[mapping[field]]));
    dateOrders[field] = detected === "ambiguous" ? options.dateOrder ?? "ambiguous" : detected;
    if (dateOrders[field] === "ambiguous") {
      issue(
        field === "date" ? "error" : "warning",
        null,
        `Dates in the "${mapping[field]}" column, like 03/04/2026, could be day/month or month/day. Choose the date format below.`
      );
    }
    if (dateOrders[field] === "mixed") {
      issue("error", null, `The "${mapping[field]}" column mixes day/month and month/day dates.`);
    }
  }

  let fixedSong = null;
  if (typeId === "song_timeline" && !mapping.song) {
    const name = (options.songName ?? "").trim();
    if (!name) {
      issue("error", null, "This song timeline doesn't say which song it's for. Enter the song name below.");
    } else {
      fixedSong = { key: normalizeKey(name), name: name.slice(0, MAX_NAME_LENGTH) };
    }
  }

  let periodRange = null;
  if (type.kind === "period") {
    const preset = options.period?.preset;
    const end = options.period?.end;
    if (!preset || !end || (preset === "custom" && !options.period?.start)) {
      issue("error", null, "Spotify's summary exports don't include dates. Choose the reporting period you exported below.");
    } else {
      periodRange = computePeriod(options.period);
      if (preset === "custom" && periodRange.start > periodRange.end) {
        issue("error", null, "The period's start date is after its end date.");
        periodRange = null;
      }
    }
  }

  const blocking = issues.some((entry) => entry.level === "error");
  const coverage = { start: null, end: null };

  for (const record of records) {
    const cell = (field) => (mapping[field] ? record.values[mapping[field]] ?? "" : "");

    const metrics = {};
    let rowHasInvalid = false;
    for (const field of metricFields) {
      const raw = cell(field);
      const parsed = parseCount(raw);
      if (parsed.error) {
        rowHasInvalid = true;
        issue("warning", record.line, `"${raw}" isn't a valid ${METRICS[field].label.toLowerCase()} count, so it was left empty.`);
        metrics[field] = null;
      } else {
        metrics[field] = parsed.value;
      }
    }

    if (metricFields.every((field) => metrics[field] === null)) {
      skipped += 1;
      if (!rowHasInvalid) {
        issue("warning", record.line, "This row has no metric values and was skipped.");
      }
      continue;
    }

    const country = mapping.country ? normalizeCountry(cell("country")) : "";
    if (mapping.country && !country) {
      skipped += 1;
      issue("warning", record.line, "This row has no country and was skipped.");
      continue;
    }

    if (type.kind === "daily") {
      if (blocking) {
        continue;
      }
      const date = parseDateValue(cell("date"), dateOrders.date);
      if (!date.value) {
        skipped += 1;
        issue("warning", record.line, `"${cell("date")}" isn't a valid date. This row was skipped.`);
        continue;
      }
      if (date.hadTime) {
        issue("warning", record.line, "This row includes a time of day. Insights works with daily data, so only the date is used.");
      }

      let song = { key: "", name: null };
      if (typeId === "song_timeline") {
        if (mapping.song) {
          const name = cell("song").trim();
          if (!name) {
            skipped += 1;
            issue("warning", record.line, "This row has no song name and was skipped.");
            continue;
          }
          song = { key: normalizeKey(name), name: name.slice(0, MAX_NAME_LENGTH) };
        } else {
          song = fixedSong;
        }
      }

      if (!coverage.start || date.value < coverage.start) coverage.start = date.value;
      if (!coverage.end || date.value > coverage.end) coverage.end = date.value;

      daily.push({
        scope: typeId === "song_timeline" ? "song" : "artist",
        song_key: song.key,
        song_name: song.name,
        country,
        metric_date: date.value,
        streams: metrics.streams ?? null,
        listeners: metrics.listeners ?? null,
        followers: metrics.followers ?? null,
        saves: metrics.saves ?? null,
        playlist_adds: metrics.playlist_adds ?? null,
        source_row: record.line,
      });
      continue;
    }

    // Period reports
    if (blocking || !periodRange) {
      continue;
    }

    let entityName;
    let entityKey;
    let extra = {};

    if (typeId === "songs_summary") {
      entityName = cell("song").trim();
      if (!entityName) {
        skipped += 1;
        issue("warning", record.line, "This row has no song name and was skipped.");
        continue;
      }
      entityKey = normalizeKey(entityName);
      if (mapping.release_date && cell("release_date")) {
        const release = parseDateValue(cell("release_date"), dateOrders.release_date);
        if (release.value) {
          extra.release_date = release.value;
        } else {
          issue("warning", record.line, `"${cell("release_date")}" isn't a valid release date, so it was left empty.`);
        }
      }
    } else if (typeId === "playlists_summary") {
      entityName = cell("playlist").trim();
      if (!entityName) {
        skipped += 1;
        issue("warning", record.line, "This row has no playlist name and was skipped.");
        continue;
      }
      const curator = mapping.curator ? cell("curator").trim() : "";
      const songName = mapping.song ? cell("song").trim() : "";
      // Playlists can share a name, so the curator and song are part of the key.
      entityKey = [normalizeKey(entityName), normalizeKey(curator), normalizeKey(songName)].join("|");
      extra = {
        playlist_curator: curator ? curator.slice(0, MAX_NAME_LENGTH) : null,
        song_name: songName ? songName.slice(0, MAX_NAME_LENGTH) : null,
      };
      if (mapping.added_date && cell("added_date")) {
        const added = parseDateValue(cell("added_date"), dateOrders.added_date);
        if (added.value) {
          extra.added_date = added.value;
        } else {
          issue("warning", record.line, `"${cell("added_date")}" isn't a valid date-added value, so it was left empty.`);
        }
      }
    } else {
      entityName = country;
      entityKey = normalizeKey(country);
    }

    if (entityName.length > MAX_NAME_LENGTH) {
      issue("warning", record.line, "A name longer than 300 characters was shortened.");
    }

    period.push({
      report_type: typeId,
      entity_key: entityKey.slice(0, 700),
      entity_name: entityName.slice(0, MAX_NAME_LENGTH),
      playlist_curator: extra.playlist_curator ?? null,
      song_name: extra.song_name ?? null,
      release_date: extra.release_date ?? null,
      added_date: extra.added_date ?? null,
      country: typeId === "countries_summary" ? "" : country,
      period_preset: options.period.preset,
      period_start: periodRange.start,
      period_end: periodRange.end,
      streams: metrics.streams ?? null,
      listeners: metrics.listeners ?? null,
      saves: metrics.saves ?? null,
      playlist_adds: metrics.playlist_adds ?? null,
      followers: metrics.followers ?? null,
      source_row: record.line,
    });
  }

  if (type.kind === "period" && periodRange) {
    coverage.start = periodRange.start === "-infinity" ? null : periodRange.start;
    coverage.end = periodRange.end;
  }

  // Report repeated keys within this file (the last row is kept on import).
  const seen = new Map();
  const rows = type.kind === "daily" ? daily : period;
  let duplicates = 0;
  for (const row of rows) {
    const key =
      type.kind === "daily"
        ? [row.scope, row.song_key, row.country, row.metric_date].join("|")
        : [row.entity_key, row.country].join("|");
    if (seen.has(key)) {
      duplicates += 1;
    }
    seen.set(key, row.source_row);
  }
  if (duplicates > 0) {
    issues.push({
      level: "warning",
      line: null,
      message: `${duplicates} row${duplicates === 1 ? " repeats" : "s repeat"} an earlier row for the same ${type.kind === "daily" ? "day" : "item"}. Only the last one will be used.`,
    });
  }

  const metricsFound = metricFields.filter((field) => rows.some((row) => row[field] !== null));

  return {
    daily,
    period,
    issues,
    skipped,
    coverage,
    mapping,
    metricsFound,
    duplicates,
    canImport: !issues.some((entry) => entry.level === "error") && rows.length > 0,
  };
};

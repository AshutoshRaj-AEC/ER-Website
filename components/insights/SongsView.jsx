import { useEffect, useMemo, useState } from "react";
import { fieldClass } from "../AutoSaveField";
import BarList from "./BarList";
import DataTable from "./DataTable";
import TrendChart from "./TrendChart";
import { Callout, Section } from "./shared";
import {
  buildDailySeries,
  formatReleaseDate,
  listPeriods,
  matchPeriodToFilter,
  metricsPresent,
  resolveWindow,
  rowsForPeriod,
  songsFromDaily,
  sortRows,
} from "../../lib/insights/analytics";
import { METRICS, normalizeKey } from "../../lib/insights/reportTypes";
import { formatCount, formatRatio } from "../../lib/insights/format";

const TIMELINE_SOURCE = "timeline";

// Which songs data to show: an imported Songs report period, or totals built
// from song timelines for the selected time filter.
const useSongSource = (data, filters, periodOverride) => {
  const periods = useMemo(() => listPeriods(data.period, "songs_summary"), [data.period]);
  const hasTimelines = data.daily.some((row) => row.scope === "song");
  const artistOrSongPoints = useMemo(() => {
    const songDates = [...new Set(data.daily.filter((row) => row.scope === "song").map((row) => row.metric_date))].sort();
    return songDates.map((date) => ({ date }));
  }, [data.daily]);
  const range = resolveWindow(filters.timeFilter, artistOrSongPoints);

  const options = [
    ...periods.map((period) => ({ key: period.key, label: `Songs report: ${period.label}`, period })),
    ...(hasTimelines && range.status !== "empty"
      ? [{ key: TIMELINE_SOURCE, label: `Song timelines: ${range.label}` }]
      : []),
  ];

  const matched = matchPeriodToFilter(periods, filters.timeFilter);
  const selected =
    options.find((option) => option.key === periodOverride) ??
    (matched ? options.find((option) => option.key === matched.key) : null) ??
    options.find((option) => option.key === TIMELINE_SOURCE) ??
    options[0] ??
    null;

  let rows = [];
  let approximate = false;
  if (selected?.period) {
    const result = rowsForPeriod(data.period, "songs_summary", selected.period, filters.country);
    rows = result.rows;
    approximate = result.approximate;
  } else if (selected?.key === TIMELINE_SOURCE) {
    rows = songsFromDaily(data.daily, range, filters.country);
  }

  return { options, selected, rows, approximate, range, matchedFilter: Boolean(matched) };
};

const SongDetail = ({ songKey, data, filters, source, onBack }) => {
  const song = source.rows.find((row) => row.key === songKey);
  const name =
    song?.name ??
    data.daily.find((row) => row.song_key === songKey)?.song_name ??
    data.period.find((row) => row.entity_key === songKey)?.entity_name ??
    songKey;

  const series = useMemo(
    () => buildDailySeries(data.daily, { scope: "song", songKey, country: filters.country }),
    [data.daily, songKey, filters.country]
  );
  const range = resolveWindow(filters.timeFilter, series.points);
  const trendMetrics = ["streams", "listeners", "saves", "playlist_adds"].filter((metric) =>
    series.points.some((point) => point[metric] !== null)
  );
  const [trendMetric, setTrendMetric] = useState(trendMetrics[0] ?? "streams");
  useEffect(() => {
    if (trendMetrics.length && !trendMetrics.includes(trendMetric)) setTrendMetric(trendMetrics[0]);
  }, [trendMetrics, trendMetric]);

  // This song in every imported Songs report period.
  const history = listPeriods(data.period, "songs_summary")
    .map((period) => {
      const row = rowsForPeriod(data.period, "songs_summary", period, filters.country).rows.find((entry) => entry.key === songKey);
      return row ? { ...row, key: period.key, periodLabel: period.label } : null;
    })
    .filter(Boolean);

  const playlistRows = data.period.filter((row) => row.report_type === "playlists_summary");
  const playlistsHaveSongs = playlistRows.some((row) => row.song_name);
  const latestPlaylistPeriod = listPeriods(data.period, "playlists_summary")[0];
  const songPlaylists = latestPlaylistPeriod
    ? rowsForPeriod(data.period, "playlists_summary", latestPlaylistPeriod).rows.filter(
        (row) => row.song && normalizeKey(row.song) === songKey
      )
    : [];

  const countryTotals = new Map();
  if (range.status !== "empty") {
    for (const row of data.daily) {
      if (row.scope === "song" && row.song_key === songKey && row.country && row.streams !== null && row.metric_date >= range.start && row.metric_date <= range.end) {
        countryTotals.set(row.country, (countryTotals.get(row.country) ?? 0) + row.streams);
      }
    }
  }

  const stat = (label, value, definition) => (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4" title={definition}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-300 hover:text-orange-200">
        ← All songs
      </button>
      <div>
        <h2 className="font-['Space_Grotesk'] text-3xl font-bold uppercase tracking-[0.06em] text-white">{name}</h2>
        {song?.release_date ? <p className="mt-1 text-sm text-stone-400">Released {formatReleaseDate(song.release_date, song.release_precision)}</p> : null}
      </div>

      {song ? (
        <Section title="Totals" aside={<p className="text-xs text-stone-500">{source.selected.label}</p>}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {song.streams !== null ? stat("Streams", formatCount(song.streams), METRICS.streams.definition) : null}
            {song.listeners !== null ? stat(song.listenersAreDailyAverage ? "Avg daily listeners" : "Listeners", formatCount(song.listeners), METRICS.listeners.definition) : null}
            {song.streamsPerListener !== null ? stat("Streams per listener", formatRatio(song.streamsPerListener)) : null}
            {song.saves !== null ? stat("Saves", formatCount(song.saves), METRICS.saves.definition) : null}
            {song.playlist_adds !== null ? stat("Playlist adds", formatCount(song.playlist_adds), METRICS.playlist_adds.definition) : null}
          </div>
        </Section>
      ) : (
        <Callout tone="info">This song isn't in {source.selected?.label ?? "the selected data"}.</Callout>
      )}

      <Section
        title="Daily trend"
        aside={
          trendMetrics.length > 1 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Metric to chart">
              {trendMetrics.map((metric) => (
                <button
                  key={metric}
                  type="button"
                  aria-pressed={trendMetric === metric}
                  onClick={() => setTrendMetric(metric)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    trendMetric === metric ? "border-orange-400 bg-orange-500 text-white" : "border-white/15 text-stone-300 hover:border-orange-300"
                  }`}
                >
                  {METRICS[metric].label}
                </button>
              ))}
            </div>
          ) : null
        }
      >
        {range.status === "empty" ? (
          <p className="text-sm text-stone-500">
            No daily data for this song{filters.country ? ` in ${filters.country}` : ""}. Import its song timeline from
            Spotify for Artists (Music → open the song → Download) to see a trend.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-stone-300">{range.label}</p>
            {range.message ? <div className="mb-3"><Callout tone="warning">{range.message}</Callout></div> : null}
            <TrendChart
              points={series.points.filter((point) => point.date >= range.start && point.date <= range.end).map((point) => ({ date: point.date, value: point[trendMetric] }))}
              metricLabel={METRICS[trendMetric].label}
              formatValue={formatCount}
            />
          </>
        )}
      </Section>

      {history.length > 1 ? (
        <Section title="Across your Songs reports">
          <BarList
            items={history.map((entry) => ({ key: entry.key, label: entry.periodLabel, value: entry.streams }))}
            valueLabel="Streams in each imported report period"
          />
          <p className="mt-4 text-xs text-stone-500">Each bar is one imported report period. Periods can overlap, so they aren't added together.</p>
        </Section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Playlists">
          {!playlistsHaveSongs ? (
            <p className="text-sm text-stone-500">
              Your Playlists report doesn't say which song each playlist features, so playlists can't be linked to
              individual songs.
            </p>
          ) : songPlaylists.length ? (
            <BarList
              items={sortRows(songPlaylists, "streams").map((row) => ({ key: row.key, label: row.name, sublabel: row.curator, value: row.streams }))}
              valueLabel="Streams from playlists featuring this song"
            />
          ) : (
            <p className="text-sm text-stone-500">No playlists in your latest Playlists report feature this song.</p>
          )}
        </Section>

        <Section title="Countries">
          {countryTotals.size ? (
            <BarList
              items={[...countryTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([country, value]) => ({ key: country, label: country, value }))}
              valueLabel="Streams by country for this song"
            />
          ) : (
            <p className="text-sm text-stone-500">Your imports don't have country data for this song.</p>
          )}
        </Section>
      </div>
    </div>
  );
};

const SongsView = ({ data, filters, periodOverride, onPeriodOverride, selectedSongKey, onSelectSong }) => {
  const source = useSongSource(data, filters, periodOverride);

  if (selectedSongKey) {
    return (
      <SongDetail
        songKey={selectedSongKey}
        data={data}
        filters={filters}
        source={source}
        onBack={() => onSelectSong(null)}
      />
    );
  }

  if (source.options.length === 0) {
    return (
      <Callout tone="info">
        No song data yet. Import a Songs report (Spotify for Artists → Music → Songs → Download) or a song timeline to
        compare your songs.
      </Callout>
    );
  }

  const isTimeline = source.selected?.key === TIMELINE_SOURCE;
  const present = metricsPresent(source.rows, ["streams", "listeners", "saves", "playlist_adds"]);
  const hasRelease = source.rows.some((row) => row.release_date);

  const columns = [
    { key: "name", label: "Song", format: (row) => row.name },
    ...(present.includes("streams") ? [{ key: "streams", label: "Streams", numeric: true, definition: METRICS.streams.definition, format: (row) => formatCount(row.streams) }] : []),
    ...(present.includes("listeners")
      ? [{ key: "listeners", label: isTimeline ? "Avg daily listeners" : "Listeners", numeric: true, definition: METRICS.listeners.definition, format: (row) => formatCount(row.listeners) }]
      : []),
    ...(present.includes("streams") && present.includes("listeners") && !isTimeline
      ? [{ key: "streamsPerListener", label: "Streams / listener", numeric: true, format: (row) => formatRatio(row.streamsPerListener), exportValue: (row) => (row.streamsPerListener === null ? null : Number(row.streamsPerListener.toFixed(2))) }]
      : []),
    ...(present.includes("saves") ? [{ key: "saves", label: "Saves", numeric: true, definition: METRICS.saves.definition, format: (row) => formatCount(row.saves) }] : []),
    ...(present.includes("playlist_adds") ? [{ key: "playlist_adds", label: "Playlist adds", numeric: true, definition: METRICS.playlist_adds.definition, format: (row) => formatCount(row.playlist_adds) }] : []),
    ...(hasRelease
      ? [{
          key: "release_date",
          label: "Released",
          format: (row) => formatReleaseDate(row.release_date, row.release_precision),
          exportValue: (row) => (row.release_precision === "year" ? row.release_date?.slice(0, 4) : row.release_precision === "month" ? row.release_date?.slice(0, 7) : row.release_date),
        }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <label className="block lg:w-[28rem]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-400">Data source</span>
          <select
            value={source.selected?.key ?? ""}
            onChange={(event) => onPeriodOverride(event.target.value)}
            className={`${fieldClass} mt-2`}
          >
            {source.options.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {!source.matchedFilter && !periodOverride && source.selected?.period ? (
          <p className="text-xs text-amber-200 lg:max-w-sm">
            None of your Songs reports covers the selected time filter, so the closest available report is shown.
          </p>
        ) : null}
      </div>

      {source.approximate ? (
        <Callout tone="warning">Worldwide totals are summed from countries; listeners may count some people twice.</Callout>
      ) : null}

      {present.includes("streams") ? (
        <Section title="Song comparison">
          <BarList
            items={sortRows(source.rows, "streams").slice(0, 10).map((row) => ({ key: row.key, label: row.name, value: row.streams }))}
            valueLabel="Streams per song"
            onSelect={onSelectSong}
          />
        </Section>
      ) : null}

      <Section title="All songs" aside={<p className="text-xs text-stone-500">{source.rows.length} songs</p>}>
        <DataTable
          columns={columns}
          rows={source.rows}
          searchFields={["name"]}
          searchPlaceholder="Search songs"
          defaultSort={{ key: present[0] ?? "name", direction: present[0] ? "desc" : "asc" }}
          onRowClick={(row) => onSelectSong(row.key)}
          exportName={`songs ${source.selected?.label ?? ""}${filters.country ? ` ${filters.country}` : ""}`}
          caption="Songs"
          emptyText="No songs match your search."
        />
        {isTimeline ? (
          <p className="mt-3 text-xs text-stone-500">
            Built from your song timeline uploads. Listeners are a daily average because daily listeners can't be added up.
          </p>
        ) : null}
      </Section>
    </div>
  );
};

export default SongsView;

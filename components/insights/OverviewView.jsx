import { useEffect, useMemo, useState } from "react";
import BarList from "./BarList";
import TrendChart from "./TrendChart";
import { Callout, MetricCard, PeriodMismatch, Section } from "./shared";
import {
  buildDailySeries,
  listPeriods,
  matchPeriodToFilter,
  percentChange,
  resolveWindow,
  rowsForPeriod,
  songsFromDaily,
  sortRows,
  summarizeWindow,
} from "../../lib/insights/analytics";
import { METRICS } from "../../lib/insights/reportTypes";
import { formatCount, formatRatio } from "../../lib/insights/format";

const TREND_METRICS = ["streams", "listeners", "followers", "saves", "playlist_adds"];

const OverviewView = ({ data, filters, onPickPeriod, onOpenSong, onOpenView, onImport }) => {
  const { timeFilter, country, songKey } = filters;

  const series = useMemo(
    () => buildDailySeries(data.daily, songKey ? { scope: "song", songKey, country } : { scope: "artist", country }),
    [data.daily, songKey, country]
  );
  const range = useMemo(() => resolveWindow(timeFilter, series.points), [timeFilter, series]);
  const summary = useMemo(
    () => (range.status === "empty" ? null : summarizeWindow(series.points, range)),
    [series, range]
  );

  const trendMetrics = TREND_METRICS.filter((metric) => series.points.some((point) => point[metric] !== null));
  const [trendMetric, setTrendMetric] = useState("streams");
  useEffect(() => {
    if (trendMetrics.length && !trendMetrics.includes(trendMetric)) {
      setTrendMetric(trendMetrics[0]);
    }
  }, [trendMetrics, trendMetric]);

  const windowPoints = range.status === "empty"
    ? []
    : series.points
        .filter((point) => point.date >= range.start && point.date <= range.end)
        .map((point) => ({ date: point.date, value: point[trendMetric] }));

  // Songs: the report for the selected period, otherwise totals from song timelines.
  const songPeriods = listPeriods(data.period, "songs_summary");
  const songPeriod = matchPeriodToFilter(songPeriods, timeFilter);
  const hasSongTimelines = data.daily.some((row) => row.scope === "song");
  let songs = null;
  let songsSource = null;
  if (songPeriod) {
    songs = rowsForPeriod(data.period, "songs_summary", songPeriod, country).rows;
    songsSource = `From your Songs report: ${songPeriod.label}`;
  } else if (hasSongTimelines && range.status !== "empty") {
    songs = songsFromDaily(data.daily, range, country);
    songsSource = `From your song timelines: ${range.label}`;
  }

  const playlistPeriods = listPeriods(data.period, "playlists_summary");
  const playlistPeriod = matchPeriodToFilter(playlistPeriods, timeFilter);
  const playlists = playlistPeriod ? rowsForPeriod(data.period, "playlists_summary", playlistPeriod).rows : null;

  const countryPeriods = listPeriods(data.period, "countries_summary");
  const countryPeriod = matchPeriodToFilter(countryPeriods, timeFilter);
  let countries = null;
  let countriesSource = null;
  if (countryPeriod) {
    const rows = rowsForPeriod(data.period, "countries_summary", countryPeriod).rows;
    const metric = rows.some((row) => row.listeners !== null) ? "listeners" : "streams";
    const total = rows.reduce((sum, row) => sum + (row[metric] ?? 0), 0);
    countries = {
      metric,
      items: sortRows(rows, metric).map((row) => ({
        key: row.key,
        label: row.name,
        value: row[metric],
        share: total > 0 && row[metric] !== null ? (row[metric] / total) * 100 : undefined,
      })),
    };
    countriesSource = `From your Countries report: ${countryPeriod.label}. Shares are of the countries listed in that report.`;
  } else if (range.status !== "empty" && data.daily.some((row) => row.country)) {
    const totals = new Map();
    for (const row of data.daily) {
      const matchesScope = songKey ? row.scope === "song" && row.song_key === songKey : row.scope === "artist";
      if (row.country && matchesScope && row.metric_date >= range.start && row.metric_date <= range.end && row.streams !== null) {
        totals.set(row.country, (totals.get(row.country) ?? 0) + row.streams);
      }
    }
    const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
    countries = {
      metric: "streams",
      items: [...totals.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ key: name, label: name, value, share: total > 0 ? (value / total) * 100 : undefined })),
    };
    countriesSource = `Streams by country from your daily data: ${range.label}.`;
  }

  const current = summary?.current;
  const previous = summary?.previous;
  const change = (key) => percentChange(current?.[key], previous?.[key], summary?.noPreviousReason);
  const has = (metric) => series.points.some((point) => point[metric] !== null);

  const cards = [];
  if (current && has("streams")) {
    cards.push({ key: "streams", label: "Streams", value: formatCount(current.streams), change: change("streams"), definition: METRICS.streams.definition, detail: `${current.daysWithData} of ${current.expectedDays} days have data` });
  }
  if (current && has("listeners")) {
    cards.push({ key: "listeners", label: "Avg daily listeners", value: formatCount(current.listenersAvg), change: change("listenersAvg"), definition: METRICS.listeners.definition, detail: current.listenersPeak !== null ? `Peak ${formatCount(current.listenersPeak)} on one day` : null });
  }
  if (current && has("streams") && has("listeners")) {
    cards.push({ key: "spl", label: "Streams per listener", value: formatRatio(current.streamsPerListener), change: change("streamsPerListener"), definition: "Daily streams divided by daily listeners, averaged over the period.", detail: "Daily average" });
  }
  if (current && has("followers")) {
    cards.push({
      key: "followers",
      label: "Followers",
      value: formatCount(current.followersLatest),
      definition: METRICS.followers.definition,
      detail: current.followersChange === null ? "Running total" : `${current.followersChange >= 0 ? "+" : ""}${formatCount(current.followersChange)} in this period · running total`,
    });
  }
  if (current && has("saves")) {
    cards.push({ key: "saves", label: "Saves", value: formatCount(current.saves), change: change("saves"), definition: METRICS.saves.definition });
  }
  if (current && has("playlist_adds")) {
    cards.push({ key: "adds", label: "Playlist adds", value: formatCount(current.playlist_adds), change: change("playlist_adds"), definition: METRICS.playlist_adds.definition });
  }

  const selectedSongName = songKey
    ? data.daily.find((row) => row.song_key === songKey)?.song_name ??
      data.period.find((row) => row.entity_key === songKey)?.entity_name ??
      songKey
    : null;

  return (
    <div className="space-y-6">
      {range.status === "empty" ? (
        <Callout tone="info">
          {songKey
            ? `There's no daily data for "${selectedSongName}"${country ? ` in ${country}` : ""}. Import this song's timeline from Spotify for Artists to see its trend.`
            : country
              ? `There's no daily data for ${country}. Daily totals and trends come from an audience timeline export.`
              : "Daily totals and trends come from an audience timeline export. Import one to see streams, listeners and followers over time."}{" "}
          {!songKey && !country ? (
            <button type="button" onClick={onImport} className="font-semibold underline underline-offset-4">
              Import a CSV
            </button>
          ) : null}
        </Callout>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-stone-200">
              {selectedSongName ? `${selectedSongName} · ` : ""}
              {range.label}
              {country ? ` · ${country}` : ""}
            </p>
            {series.approximate ? (
              <p className="text-xs text-amber-200">
                Worldwide totals summed from countries; listeners and followers may count some people twice.
              </p>
            ) : null}
          </div>
          {range.message ? <Callout tone="warning">{range.message}</Callout> : null}

          {cards.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map(({ key, ...card }) => (
                <MetricCard key={key} {...card} />
              ))}
            </div>
          ) : null}

          <Section
            title="Daily trend"
            aside={
              <div className="flex flex-wrap gap-2" role="group" aria-label="Metric to chart">
                {trendMetrics.map((metric) => (
                  <button
                    key={metric}
                    type="button"
                    aria-pressed={trendMetric === metric}
                    onClick={() => setTrendMetric(metric)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      trendMetric === metric
                        ? "border-orange-400 bg-orange-500 text-white"
                        : "border-white/15 text-stone-300 hover:border-orange-300 hover:text-orange-200"
                    }`}
                  >
                    {METRICS[metric].label}
                  </button>
                ))}
              </div>
            }
          >
            <TrendChart points={windowPoints} metricLabel={METRICS[trendMetric].label} formatValue={formatCount} />
            <p className="mt-3 text-xs text-stone-500">
              {METRICS[trendMetric].definition} Dates are as reported in your Spotify for Artists export. Data is
              imported from CSV files, not live from Spotify.
            </p>
          </Section>
        </>
      )}

      {songKey ? null : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section
            title="Top songs"
            aside={
              songs?.length ? (
                <button type="button" onClick={() => onOpenView("songs")} className="text-xs font-semibold uppercase tracking-[0.15em] text-orange-300 hover:text-orange-200">
                  All songs →
                </button>
              ) : null
            }
          >
            {songs ? (
              <>
                <BarList
                  items={sortRows(songs, "streams").slice(0, 5).map((song) => ({ key: song.key, label: song.name, value: song.streams }))}
                  valueLabel="Streams per song"
                  onSelect={onOpenSong}
                  emptyText="These songs have no stream counts for this period."
                />
                <p className="mt-4 text-xs text-stone-500">{songsSource}</p>
              </>
            ) : (
              <PeriodMismatch reportLabel="Songs report" timeFilter={timeFilter} periods={songPeriods} onPickPeriod={(period) => onPickPeriod(period, "songs_summary")} />
            )}
          </Section>

          <Section
            title="Playlist performance"
            aside={
              playlists?.length ? (
                <button type="button" onClick={() => onOpenView("playlists")} className="text-xs font-semibold uppercase tracking-[0.15em] text-orange-300 hover:text-orange-200">
                  All playlists →
                </button>
              ) : null
            }
          >
            {playlists ? (
              <>
                <BarList
                  items={sortRows(playlists, "streams").slice(0, 5).map((playlist) => ({ key: playlist.key, label: playlist.name, sublabel: playlist.curator, value: playlist.streams }))}
                  valueLabel="Streams from each playlist"
                  emptyText="These playlists have no stream counts."
                />
                <p className="mt-4 text-xs text-stone-500">
                  Streams of your music that came from each playlist ({playlistPeriod.label}), not the playlist's total plays.
                </p>
              </>
            ) : (
              <PeriodMismatch reportLabel="Playlists report" timeFilter={timeFilter} periods={playlistPeriods} onPickPeriod={(period) => onPickPeriod(period, "playlists_summary")} />
            )}
          </Section>
        </div>
      )}

      {countries || countryPeriods.length ? (
        <Section title="Countries">
          {countries ? (
            <>
              <BarList
                items={countries.items.slice(0, 10)}
                valueLabel={`${METRICS[countries.metric].label} by country`}
                emptyText="No country values for this period."
              />
              <p className="mt-4 text-xs text-stone-500">{countriesSource}</p>
            </>
          ) : (
            <PeriodMismatch reportLabel="Countries report" timeFilter={timeFilter} periods={countryPeriods} onPickPeriod={(period) => onPickPeriod(period, "countries_summary")} />
          )}
        </Section>
      ) : null}
    </div>
  );
};

export default OverviewView;

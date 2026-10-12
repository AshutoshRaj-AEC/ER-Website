import { useCallback, useEffect, useMemo, useState } from "react";
import { fieldClass } from "../AutoSaveField";
import { LoadingText } from "../PageShell";
import ImportHistory from "./ImportHistory";
import ImportPanel from "./ImportPanel";
import OverviewView from "./OverviewView";
import PlaylistsView from "./PlaylistsView";
import SongsView from "./SongsView";
import { Callout, filterForPreset } from "./shared";
import { addDays, availableCountries, formatDay, TIME_FILTERS } from "../../lib/insights/analytics";
import { loadInsights } from "../../lib/insights/api";
import { createDemoData } from "../../lib/insights/demoData";
import { formatTimestamp } from "../../lib/insights/format";

const VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "songs", label: "Songs" },
  { id: "playlists", label: "Playlists" },
  { id: "imports", label: "Imports" },
];

const primaryButton =
  "rounded-full bg-orange-500 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-orange-400";
const secondaryButton =
  "rounded-full border border-white/15 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-stone-200 transition hover:border-orange-300 hover:text-orange-200";

const pill = (active) =>
  `rounded-full border px-4 py-2 text-xs font-semibold transition ${
    active ? "border-orange-400 bg-orange-500 text-white" : "border-white/15 text-stone-300 hover:border-orange-300 hover:text-orange-200"
  }`;

const EmptyState = ({ onImport, onDemo }) => (
  <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-orange-500/10 via-white/5 to-transparent p-6 sm:p-10">
    <h2 className="font-['Space_Grotesk'] text-2xl font-bold uppercase tracking-[0.06em] text-white">
      Bring in your Spotify for Artists data
    </h2>
    <p className="mt-3 max-w-2xl leading-7 text-stone-300">
      Insights reads the CSV reports you download from Spotify for Artists and turns them into charts, rankings and
      comparisons. Your data stays private to your account.
    </p>
    <ol className="mt-8 grid gap-4 md:grid-cols-3">
      {[
        ["Download", "In Spotify for Artists, open Audience, Music → Songs or Music → Playlists and download the CSV."],
        ["Upload", "Drop the file here. You'll see exactly how it was read before anything is saved."],
        ["Understand", "Track streams, listeners and followers, compare songs and see which playlists work for you."],
      ].map(([title, text], index) => (
        <li key={title} className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-300">Step {index + 1}</p>
          <p className="mt-2 font-semibold text-white">{title}</p>
          <p className="mt-2 text-sm leading-6 text-stone-400">{text}</p>
        </li>
      ))}
    </ol>
    <div className="mt-8 flex flex-wrap gap-3">
      <button type="button" onClick={onImport} className={primaryButton}>
        Upload your first CSV
      </button>
      <button type="button" onClick={onDemo} className={secondaryButton}>
        Explore with demo data
      </button>
    </div>
  </div>
);

const InsightsTab = ({ userId }) => {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [demo, setDemo] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [view, setView] = useState("overview");
  const [timeFilter, setTimeFilter] = useState("28d");
  const [country, setCountry] = useState("");
  const [songKey, setSongKey] = useState("");
  const [songsPeriod, setSongsPeriod] = useState("");
  const [playlistsPeriod, setPlaylistsPeriod] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadError("");
    loadInsights(userId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load your insights. Refresh the page to try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  const reload = useCallback(() => setReloadKey((current) => current + 1), []);

  const demoData = useMemo(() => (demo ? createDemoData(addDays(new Date().toISOString().slice(0, 10), -1)) : null), [demo]);
  const active = demo ? demoData : data;

  const countries = useMemo(() => (active ? availableCountries(active.daily, active.period) : []), [active]);
  const songs = useMemo(() => {
    if (!active) return [];
    const names = new Map();
    for (const row of active.daily) if (row.scope === "song") names.set(row.song_key, row.song_name);
    for (const row of active.period) if (row.report_type === "songs_summary") names.set(row.entity_key, row.entity_name);
    return [...names.entries()].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [active]);

  // Drop filters that no longer apply (e.g. after deleting an import).
  useEffect(() => {
    if (country && !countries.includes(country)) setCountry("");
    if (songKey && !songs.some((song) => song.key === songKey)) setSongKey("");
  }, [countries, songs, country, songKey]);

  if (loadError) {
    return <Callout tone="warning">{loadError}</Callout>;
  }
  if (!data) {
    return <LoadingText />;
  }

  const completedImports = data.imports.filter((entry) => entry.status === "completed");
  const isFirstTime = !demo && completedImports.length === 0;
  const lastImport = completedImports[0];
  const dailyDates = active.daily.filter((row) => row.scope === "artist").map((row) => row.metric_date);
  const dailyRange = dailyDates.length ? [dailyDates.reduce((a, b) => (a < b ? a : b)), dailyDates.reduce((a, b) => (a > b ? a : b))] : null;

  const filters = { timeFilter, country, songKey };

  const openSong = (key) => {
    setSongKey(key ?? "");
    setView("songs");
  };

  const pickPeriod = (period, reportType) => {
    const filter = filterForPreset(period.period_preset);
    if (filter && period.period_preset !== "custom") {
      setTimeFilter(filter.id);
      setSongsPeriod("");
      setPlaylistsPeriod("");
      return;
    }
    if (reportType === "playlists_summary") {
      setPlaylistsPeriod(period.key);
      setView("playlists");
    } else {
      setSongsPeriod(period.key);
      setView("songs");
    }
  };

  const importPanel = (
    <ImportPanel
      userId={userId}
      data={data}
      onImported={reload}
      onClose={() => setShowImport(false)}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.45em] text-orange-300">EklautA Insights</p>
          <h2 className="mt-3 font-['Space_Grotesk'] text-3xl font-bold uppercase tracking-[0.06em] text-white sm:text-4xl">
            Spotify Insights
          </h2>
          <p className="mt-2 text-stone-300">Understand your music. Track your growth.</p>
          <p className="mt-3 text-xs text-stone-500">
            {demo
              ? "Showing demo data"
              : lastImport
                ? `Last import ${formatTimestamp(lastImport.created_at)}`
                : "No imports yet"}
            {dailyRange ? ` · Daily data ${formatDay(dailyRange[0])} – ${formatDay(dailyRange[1])}` : ""}
            {" · Imported from CSV, not live from Spotify"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {demo ? (
            <button type="button" onClick={() => setDemo(false)} className={secondaryButton}>
              Exit demo
            </button>
          ) : (
            <>
              <button type="button" onClick={() => setShowImport((current) => !current)} className={primaryButton}>
                {showImport ? "Hide upload" : "Upload CSV"}
              </button>
              {!isFirstTime ? (
                <button type="button" onClick={() => setDemo(true)} className={secondaryButton}>
                  Demo
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {demo ? (
        <div className="rounded-2xl border-2 border-dashed border-sky-300/50 bg-sky-300/10 px-5 py-4 text-sm text-sky-100" role="status">
          <p className="font-semibold uppercase tracking-[0.2em]">Demo data</p>
          <p className="mt-1">
            Made-up numbers to show what Insights can do. They aren't your Spotify stats, they're never saved, and
            they're never mixed with your real imports.
          </p>
        </div>
      ) : null}

      {!demo && showImport ? importPanel : null}

      {isFirstTime ? (
        showImport ? null : <EmptyState onImport={() => setShowImport(true)} onDemo={() => setDemo(true)} />
      ) : (
        <>
          <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Time period">
              {TIME_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={timeFilter === filter.id}
                  onClick={() => {
                    setTimeFilter(filter.id);
                    setSongsPeriod("");
                    setPlaylistsPeriod("");
                  }}
                  className={pill(timeFilter === filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {songs.length ? (
                <label className="block">
                  <span className="sr-only">Song</span>
                  <select value={songKey} onChange={(event) => setSongKey(event.target.value)} className={fieldClass}>
                    <option value="">All songs</option>
                    {songs.map((song) => (
                      <option key={song.key} value={song.key}>
                        {song.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {countries.length ? (
                <label className="block">
                  <span className="sr-only">Country</span>
                  <select value={country} onChange={(event) => setCountry(event.target.value)} className={fieldClass}>
                    <option value="">All countries</option>
                    {countries.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-white/10 sm:gap-2" role="tablist" aria-label="Insights views">
            {VIEWS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={view === option.id}
                onClick={() => {
                  setView(option.id);
                  if (option.id === "songs" && view === "songs") setSongKey("");
                }}
                className={`whitespace-nowrap border-b-2 px-2.5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] transition sm:px-4 sm:text-xs sm:tracking-[0.25em] ${
                  view === option.id ? "border-orange-400 text-white" : "border-transparent text-stone-400 hover:text-orange-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {view === "overview" ? (
            <OverviewView
              data={active}
              filters={filters}
              onPickPeriod={pickPeriod}
              onOpenSong={openSong}
              onOpenView={setView}
              onImport={() => setShowImport(true)}
            />
          ) : null}
          {view === "songs" ? (
            <SongsView
              data={active}
              filters={filters}
              periodOverride={songsPeriod}
              onPeriodOverride={setSongsPeriod}
              selectedSongKey={songKey}
              onSelectSong={(key) => setSongKey(key ?? "")}
            />
          ) : null}
          {view === "playlists" ? (
            <PlaylistsView
              data={active}
              filters={filters}
              periodOverride={playlistsPeriod}
              onPeriodOverride={setPlaylistsPeriod}
            />
          ) : null}
          {view === "imports" ? <ImportHistory data={active} demo={demo} onChanged={reload} /> : null}
        </>
      )}
    </div>
  );
};

export default InsightsTab;

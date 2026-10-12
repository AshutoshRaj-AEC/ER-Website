import { useMemo } from "react";
import { fieldClass } from "../AutoSaveField";
import BarList from "./BarList";
import DataTable from "./DataTable";
import { Callout, Section } from "./shared";
import {
  formatDay,
  listPeriods,
  matchPeriodToFilter,
  metricsPresent,
  percentChange,
  rowsForPeriod,
  sortRows,
} from "../../lib/insights/analytics";
import { METRICS } from "../../lib/insights/reportTypes";
import { formatCount, formatPercent, formatRatio } from "../../lib/insights/format";

const PlaylistsView = ({ data, filters, periodOverride, onPeriodOverride }) => {
  const periods = useMemo(() => listPeriods(data.period, "playlists_summary"), [data.period]);

  if (periods.length === 0) {
    return (
      <Callout tone="info">
        No playlist data yet. Import a Playlists report (Spotify for Artists → Music → Playlists → Download) to see
        which playlists bring you streams.
      </Callout>
    );
  }

  const matched = matchPeriodToFilter(periods, filters.timeFilter);
  const selected = periods.find((period) => period.key === periodOverride) ?? matched ?? periods[0];

  // The previous report of the same length (e.g. the 28 days before), if imported.
  const previousPeriod = periods.find(
    (period) => period.period_preset === selected.period_preset && period.period_end < selected.period_end && selected.period_preset !== "custom"
  );
  const previousByKey = previousPeriod
    ? new Map(rowsForPeriod(data.period, "playlists_summary", previousPeriod).rows.map((row) => [row.key, row]))
    : null;

  const rows = rowsForPeriod(data.period, "playlists_summary", selected).rows.map((row) => {
    const before = previousByKey?.get(row.key);
    const change = previousByKey ? percentChange(row.streams, before?.streams ?? null, "Not in the previous report.") : null;
    return {
      ...row,
      previousStreams: before?.streams ?? null,
      changePercent: change?.available ? change.value : null,
      changeReason: change && !change.available ? change.reason : null,
    };
  });

  const present = metricsPresent(rows, ["streams", "listeners"]);
  const hasSongs = rows.some((row) => row.song);
  const hasCurators = rows.some((row) => row.curator);
  const hasAdded = rows.some((row) => row.added_date);

  const columns = [
    { key: "name", label: "Playlist", format: (row) => row.name },
    ...(hasCurators ? [{ key: "curator", label: "Curator", format: (row) => row.curator ?? "—" }] : []),
    ...(hasSongs ? [{ key: "song", label: "Your song", format: (row) => row.song ?? "—" }] : []),
    ...(present.includes("streams") ? [{ key: "streams", label: "Streams", numeric: true, definition: "Streams of your music that came from this playlist.", format: (row) => formatCount(row.streams) }] : []),
    ...(present.includes("listeners") ? [{ key: "listeners", label: "Listeners", numeric: true, definition: METRICS.listeners.definition, format: (row) => formatCount(row.listeners) }] : []),
    ...(present.length === 2
      ? [{ key: "streamsPerListener", label: "Streams / listener", numeric: true, format: (row) => formatRatio(row.streamsPerListener), exportValue: (row) => (row.streamsPerListener === null ? null : Number(row.streamsPerListener.toFixed(2))) }]
      : []),
    ...(previousByKey && present.includes("streams")
      ? [{
          key: "changePercent",
          label: "vs previous report",
          numeric: true,
          format: (row) =>
            row.changePercent === null ? (
              <span className="text-stone-500" title={row.changeReason ?? undefined}>—</span>
            ) : (
              <span className={row.changePercent >= 0 ? "text-emerald-200" : "text-red-300"}>{formatPercent(row.changePercent)}</span>
            ),
          exportLabel: "Change vs previous report (%)",
          exportValue: (row) => (row.changePercent === null ? null : Number(row.changePercent.toFixed(1))),
        }]
      : []),
    ...(hasAdded ? [{ key: "added_date", label: "Added", format: (row) => (row.added_date ? formatDay(row.added_date) : "—") }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <label className="block lg:w-[28rem]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-400">Report period</span>
          <select value={selected.key} onChange={(event) => onPeriodOverride(event.target.value)} className={`${fieldClass} mt-2`}>
            {periods.map((period) => (
              <option key={period.key} value={period.key}>
                {period.label}
              </option>
            ))}
          </select>
        </label>
        {!matched && !periodOverride ? (
          <p className="text-xs text-amber-200 lg:max-w-sm">
            None of your Playlists reports covers the selected time filter, so the latest report is shown.
          </p>
        ) : null}
      </div>

      <Callout tone="info">
        These are streams of <strong>your music</strong> that came from each playlist, not how often the playlist itself
        was played. Spotify's playlist export is a snapshot for one period, so there's no day-by-day trend
        {previousPeriod ? `; the change column compares with your earlier report (${previousPeriod.label})` : "; import the same report for an earlier period to compare"}.
      </Callout>

      {present.includes("streams") ? (
        <Section title="Top playlists">
          <BarList
            items={sortRows(rows, "streams").slice(0, 10).map((row) => ({ key: row.key, label: row.name, sublabel: row.curator, value: row.streams }))}
            valueLabel="Streams from each playlist"
          />
        </Section>
      ) : null}

      <Section title="All playlists" aside={<p className="text-xs text-stone-500">{rows.length} playlists</p>}>
        <DataTable
          columns={columns}
          rows={rows}
          searchFields={["name", "curator", "song"]}
          searchPlaceholder="Search playlists or curators"
          defaultSort={{ key: present[0] ?? "name", direction: present[0] ? "desc" : "asc" }}
          exportName={`playlists ${selected.label}`}
          caption="Playlists"
          emptyText="No playlists match your search."
        />
      </Section>
    </div>
  );
};

export default PlaylistsView;

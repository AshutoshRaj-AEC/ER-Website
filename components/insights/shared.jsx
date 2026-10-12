import { TIME_FILTERS } from "../../lib/insights/analytics";
import { formatPercent } from "../../lib/insights/format";

export const Section = ({ title, aside, children, className = "" }) => (
  <section className={`rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:p-7 ${className}`}>
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="font-['Space_Grotesk'] text-lg font-bold uppercase tracking-[0.08em] text-white">{title}</h2>
      {aside}
    </div>
    {children}
  </section>
);

export const Callout = ({ tone = "info", children }) => {
  const tones = {
    info: "border-sky-300/30 bg-sky-300/10 text-sky-100",
    warning: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  };
  return <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${tones[tone]}`}>{children}</div>;
};

// A metric with its change vs the previous period. When the change can't be
// calculated it says so, with the reason on hover/focus and for screen readers.
export const MetricCard = ({ label, value, detail, change, definition }) => (
  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
    <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-400" title={definition}>
      {label}
    </p>
    <p className="mt-3 text-3xl font-bold text-white">{value}</p>
    {detail ? <p className="mt-1 text-xs text-stone-500">{detail}</p> : null}
    {change ? (
      change.available ? (
        <p
          className={`mt-3 text-sm font-semibold ${change.value > 0 ? "text-emerald-200" : change.value < 0 ? "text-red-300" : "text-stone-400"}`}
        >
          <span aria-hidden="true">{change.value > 0 ? "▲ " : change.value < 0 ? "▼ " : "■ "}</span>
          {formatPercent(change.value)} <span className="font-normal text-stone-500">vs previous period</span>
        </p>
      ) : (
        <p className="mt-3 text-sm text-stone-500" title={change.reason}>
          Change unavailable
          <span className="sr-only">: {change.reason}</span>
          <span className="block text-xs text-stone-600">{change.reason}</span>
        </p>
      )
    ) : null}
  </div>
);

export const filterForPreset = (preset) => TIME_FILTERS.find((filter) => filter.summaryPreset === preset);

// Shown when the selected time filter has no matching imported report.
export const PeriodMismatch = ({ reportLabel, timeFilter, periods, onPickPeriod }) => {
  const filterLabel = TIME_FILTERS.find((filter) => filter.id === timeFilter)?.label;
  return (
    <div className="space-y-3 text-sm text-stone-400">
      <p>
        You haven't imported a {reportLabel} for {filterLabel === "All time" ? "all time" : `the last ${filterLabel}`}.
        Spotify's {reportLabel}s cover one fixed period, so they can't be cut down or combined to fit another.
      </p>
      {periods.length ? (
        <div className="flex flex-wrap gap-2">
          {periods.slice(0, 4).map((period) => (
            <button
              key={period.key}
              type="button"
              onClick={() => onPickPeriod(period)}
              className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-stone-200 transition hover:border-orange-300 hover:text-orange-200"
            >
              Show {period.label}
            </button>
          ))}
        </div>
      ) : (
        <p>Import one to see it here.</p>
      )}
    </div>
  );
};

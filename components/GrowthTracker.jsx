import { useEffect, useRef, useState } from "react";
import GrowthChart from "./GrowthChart";
import { LoadingText, Panel } from "./PageShell";
import { supabase } from "../lib/supabase";
import { CURRENCIES, formatDate, parseDate } from "../lib/releasePlans";
import {
  GROWTH_METRICS,
  changeFromPrevious,
  currentMonthInput,
  formatMetricValue,
  formatMonth,
  formatMonthIndex,
  getMetric,
  inputToMonth,
  monthIndex,
  monthToInput,
  projectGoal,
  seriesFor,
} from "../lib/growth";

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-stone-100 placeholder:text-stone-500 focus:border-orange-300 focus:outline-none";

const labelClass =
  "text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-400";

const primaryButtonClass =
  "rounded-full bg-orange-500 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-orange-400 disabled:opacity-60";

const secondaryButtonClass =
  "rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-stone-300 transition hover:border-orange-300 hover:text-orange-200";

const SectionHeading = ({ children, aside }) => {
  return (
    <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="font-['Space_Grotesk'] text-xl font-bold uppercase tracking-[0.08em] text-white">
        {children}
      </h2>
      {aside}
    </div>
  );
};

const emptyEntryForm = () =>
  Object.fromEntries(GROWTH_METRICS.map((metric) => [metric.key, ""]));

const ProfileSetup = ({ defaultArtistName, onCreate }) => {
  const [artistName, setArtistName] = useState(defaultArtistName);
  const [currency, setCurrency] = useState("INR");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const createError = await onCreate({ artist_name: artistName.trim(), currency });
    setSaving(false);
    if (createError) {
      setError("Couldn't start your tracker. Please try again.");
    }
  };

  return (
    <Panel className="max-w-2xl">
      <form onSubmit={handleSubmit}>
        <SectionHeading>Start tracking your growth</SectionHeading>
        <p className="text-sm leading-6 text-stone-400">
          Once a month, log your listeners, followers, streams and earnings.
          You'll see how you're growing, set goals and find out when you'll
          reach them.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <label className="block">
            <span className={labelClass}>Artist name</span>
            <input
              required
              maxLength={200}
              value={artistName}
              onChange={(event) => setArtistName(event.target.value)}
              className={`${inputClass} mt-2`}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Earnings currency</span>
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className={`${inputClass} mt-2`}
            >
              {CURRENCIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        <button type="submit" disabled={saving} className={`${primaryButtonClass} mt-6`}>
          {saving ? "Starting…" : "Start tracking"}
        </button>
      </form>
    </Panel>
  );
};

const SummaryTiles = ({ entries, currency }) => {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {GROWTH_METRICS.map((metric) => {
        const series = seriesFor(entries, metric.key);
        const latest = series[series.length - 1];
        const change = changeFromPrevious(series);

        return (
          <div
            key={metric.key}
            className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5"
          >
            <p className={labelClass}>{metric.label}</p>
            {latest ? (
              <>
                <p className="mt-3 text-2xl font-bold text-white">
                  {formatMetricValue(metric, latest.value, currency)}
                </p>
                <p className="mt-1 text-xs text-stone-500">{formatMonth(latest.month)}</p>
                {change ? (
                  <p
                    className={`mt-3 text-sm font-semibold ${change.delta > 0 ? "text-emerald-200" : change.delta < 0 ? "text-red-300" : "text-stone-400"}`}
                  >
                    <span aria-hidden="true">
                      {change.delta > 0 ? "▲ " : change.delta < 0 ? "▼ " : "■ "}
                    </span>
                    {change.delta > 0 ? "Up " : change.delta < 0 ? "Down " : "No change "}
                    {change.percent === null || change.delta === 0
                      ? ""
                      : `${Math.abs(change.percent).toFixed(change.percent < 10 && change.percent > -10 ? 1 : 0)}% `}
                    <span className="font-normal text-stone-500">
                      vs {formatMonth(change.previousMonth)}
                    </span>
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-3 text-sm text-stone-500">Not logged yet</p>
            )}
          </div>
        );
      })}
    </div>
  );
};

const describeProjection = (metric, series, goal, currency) => {
  const projection = projectGoal(series, Number(goal.target));
  const format = (value) => formatMetricValue(metric, value, currency);

  if (projection.state === "no_data") {
    return "Log a month to start tracking this goal.";
  }
  if (projection.state === "reached") {
    return "Goal reached. Time to set a bigger one.";
  }
  if (projection.state === "need_more_data") {
    return "Log another month to see when you'll get there.";
  }
  if (projection.state === "not_growing") {
    return "This hasn't grown over your recent months, so there's no projection yet.";
  }

  const pace = `At your recent pace (about +${format(projection.perMonth)} a month) you'd reach it around ${formatMonthIndex(projection.projectedIndex)}.`;

  if (!goal.target_date) {
    return pace;
  }

  const deadlineIndex = monthIndex(goal.target_date);
  if (projection.projectedIndex <= deadlineIndex) {
    return `${pace} You're on track for your deadline.`;
  }

  const monthsLeft = deadlineIndex - monthIndex(projection.latest.month);
  if (monthsLeft <= 0) {
    return `${pace} The deadline has passed. Set a new date to keep tracking.`;
  }

  const needed = (Number(goal.target) - projection.latest.value) / monthsLeft;
  return `${pace} To hit your deadline you'd need about +${format(needed)} a month.`;
};

const Goals = ({ entries, goals, currency, readOnly, onSave, onRemove }) => {
  const [metricKey, setMetricKey] = useState(GROWTH_METRICS[0].key);
  const [target, setTarget] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const saved = await onSave({
      metric: metricKey,
      target: Number(target),
      target_date: targetDate || null,
    });
    setSaving(false);
    if (saved) {
      setTarget("");
      setTargetDate("");
    }
  };

  const editGoal = (goal) => {
    setMetricKey(goal.metric);
    setTarget(String(Number(goal.target)));
    setTargetDate(goal.target_date ?? "");
  };

  return (
    <Panel>
      <SectionHeading>Goals</SectionHeading>

      {goals.length === 0 ? (
        <p className="text-sm text-stone-500">
          {readOnly ? "No goals set yet." : "No goals yet. Set one below."}
        </p>
      ) : (
        <ul className="space-y-4">
          {goals.map((goal) => {
            const metric = getMetric(goal.metric);
            const series = seriesFor(entries, goal.metric);
            const latest = series[series.length - 1];
            const progress = latest
              ? Math.min(100, (latest.value / Number(goal.target)) * 100)
              : 0;

            return (
              <li
                key={goal.metric}
                className="rounded-2xl border border-white/10 bg-black/30 p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-semibold text-white">
                    {formatMetricValue(metric, Number(goal.target), currency)}{" "}
                    <span className="font-normal text-stone-400">{metric.label.toLowerCase()}</span>
                  </p>
                  {goal.target_date ? (
                    <p className="text-xs text-stone-500">
                      by {formatDate(parseDate(goal.target_date))}
                    </p>
                  ) : null}
                </div>
                <div
                  className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"
                  role="img"
                  aria-label={`${Math.round(progress)}% of the goal reached`}
                >
                  <div
                    className="h-full rounded-full bg-orange-400"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-stone-400">
                  {latest
                    ? `${formatMetricValue(metric, latest.value, currency)} now · ${Math.round(progress)}%`
                    : "Nothing logged yet"}
                </p>
                <p className="mt-3 text-sm leading-6 text-stone-300">
                  {describeProjection(metric, series, goal, currency)}
                </p>
                {readOnly ? null : (
                  <div className="mt-4 flex gap-3">
                    <button type="button" onClick={() => editGoal(goal)} className={secondaryButtonClass}>
                      Change
                    </button>
                    <button type="button" onClick={() => onRemove(goal.metric)} className={secondaryButtonClass}>
                      Remove
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {readOnly ? null : (
        <form onSubmit={handleSubmit} className="mt-8 border-t border-white/10 pt-6">
          <p className={labelClass}>Set a goal</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <label className="block">
              <span className="sr-only">Metric</span>
              <select
                value={metricKey}
                onChange={(event) => setMetricKey(event.target.value)}
                className={inputClass}
              >
                {GROWTH_METRICS.map((metric) => (
                  <option key={metric.key} value={metric.key}>
                    {metric.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Target</span>
              <input
                required
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                placeholder="Target"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="sr-only">By date (optional)</span>
              <input
                type="date"
                title="By date (optional)"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
                className={`${inputClass} [color-scheme:dark]`}
              />
            </label>
            <button type="submit" disabled={saving} className={primaryButtonClass}>
              Save goal
            </button>
          </div>
          <p className="mt-2 text-xs text-stone-500">
            The date is optional. Setting a goal for a number that already has
            one replaces it.
          </p>
        </form>
      )}
    </Panel>
  );
};

const LogMonthForm = ({ entries, onSave, formRef, month, onMonthChange }) => {
  const [values, setValues] = useState(emptyEntryForm);
  const [saving, setSaving] = useState(false);

  // Load the logged values when the artist picks a month they've logged before.
  useEffect(() => {
    const existing = entries.find((entry) => monthToInput(entry.month) === month);
    setValues(
      existing
        ? Object.fromEntries(
            GROWTH_METRICS.map((metric) => [
              metric.key,
              existing[metric.key] === null ? "" : String(Number(existing[metric.key])),
            ])
          )
        : emptyEntryForm()
    );
  }, [month, entries]);

  const isUpdate = entries.some((entry) => monthToInput(entry.month) === month);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    await onSave(
      inputToMonth(month),
      Object.fromEntries(
        GROWTH_METRICS.map((metric) => [
          metric.key,
          values[metric.key] === "" ? null : Number(values[metric.key]),
        ])
      )
    );
    setSaving(false);
  };

  return (
    <Panel>
      <form onSubmit={handleSubmit} ref={formRef}>
        <SectionHeading
          aside={
            <p className="text-sm text-stone-400">
              Leave anything you don't track blank.
            </p>
          }
        >
          Log a month
        </SectionHeading>
        <label className="block max-w-xs">
          <span className={labelClass}>Month</span>
          <input
            required
            type="month"
            max={currentMonthInput()}
            value={month}
            onChange={(event) => onMonthChange(event.target.value)}
            className={`${inputClass} mt-2 [color-scheme:dark]`}
          />
        </label>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {GROWTH_METRICS.map((metric) => (
            <label key={metric.key} className="block">
              <span className={labelClass}>{metric.label}</span>
              <input
                type="number"
                min="0"
                step={metric.money ? "0.01" : "1"}
                inputMode={metric.money ? "decimal" : "numeric"}
                value={values[metric.key]}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [metric.key]: event.target.value }))
                }
                className={`${inputClass} mt-2`}
              />
              {metric.hint ? (
                <span className="mt-2 block text-xs text-stone-500">{metric.hint}</span>
              ) : null}
            </label>
          ))}
        </div>
        <button type="submit" disabled={saving} className={`${primaryButtonClass} mt-6`}>
          {saving ? "Saving…" : isUpdate ? "Update this month" : "Save this month"}
        </button>
      </form>
    </Panel>
  );
};

const HistoryTable = ({ entries, currency, readOnly, onEdit, onDelete }) => {
  const sorted = [...entries].sort((a, b) => monthIndex(b.month) - monthIndex(a.month));

  return (
    <Panel>
      <SectionHeading>History</SectionHeading>
      {sorted.length === 0 ? (
        <p className="text-sm text-stone-500">No months logged yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th scope="col" className={`${labelClass} py-3 pr-4`}>
                  Month
                </th>
                {GROWTH_METRICS.map((metric) => (
                  <th key={metric.key} scope="col" className={`${labelClass} py-3 pr-4 text-right`}>
                    {metric.label}
                  </th>
                ))}
                {readOnly ? null : (
                  <th scope="col" className="py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry) => (
                <tr key={entry.id} className="border-b border-white/5">
                  <th scope="row" className="whitespace-nowrap py-3 pr-4 font-semibold text-stone-100">
                    {formatMonth(entry.month)}
                  </th>
                  {GROWTH_METRICS.map((metric) => (
                    <td key={metric.key} className="whitespace-nowrap py-3 pr-4 text-right tabular-nums text-stone-300">
                      {formatMetricValue(
                        metric,
                        entry[metric.key] === null ? null : Number(entry[metric.key]),
                        currency
                      )}
                    </td>
                  ))}
                  {readOnly ? null : (
                    <td className="whitespace-nowrap py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onEdit(entry.month)}
                        className="text-xs font-semibold uppercase tracking-[0.15em] text-orange-300 hover:text-orange-200"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(entry)}
                        className="ml-4 text-xs font-semibold uppercase tracking-[0.15em] text-stone-500 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
};

const GrowthTracker = ({ userId, readOnly = false, defaultArtistName = "" }) => {
  const [profile, setProfile] = useState(undefined);
  const [entries, setEntries] = useState([]);
  const [goals, setGoals] = useState([]);
  const [chartMetric, setChartMetric] = useState(GROWTH_METRICS[0].key);
  const [formMonth, setFormMonth] = useState(currentMonthInput);
  const [message, setMessage] = useState({ text: "", error: false });
  const [loadError, setLoadError] = useState("");
  const formRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [profileResult, entriesResult, goalsResult] = await Promise.all([
        supabase.from("growth_profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("growth_entries").select("*").eq("user_id", userId).order("month"),
        supabase.from("growth_goals").select("*").eq("user_id", userId),
      ]);

      if (cancelled) {
        return;
      }

      if (profileResult.error || entriesResult.error || goalsResult.error) {
        setLoadError("Couldn't load the growth tracker. Refresh to try again.");
        return;
      }

      setProfile(profileResult.data);
      setEntries(entriesResult.data);
      setGoals(goalsResult.data);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const report = (error, successText) => {
    if (error) {
      console.error(error);
    }
    setMessage(
      error
        ? { text: "Couldn't save that change. Please try again.", error: true }
        : { text: successText, error: false }
    );
  };

  const createProfile = async (fields) => {
    const { data, error } = await supabase
      .from("growth_profiles")
      .insert(fields)
      .select()
      .single();
    if (!error) {
      setProfile(data);
    }
    return error;
  };

  const updateProfile = async (changes) => {
    const { data, error } = await supabase
      .from("growth_profiles")
      .update(changes)
      .eq("user_id", userId)
      .select()
      .single();
    report(error, "Settings saved");
    if (!error) {
      setProfile(data);
    }
  };

  const saveEntry = async (month, values) => {
    const { data, error } = await supabase
      .from("growth_entries")
      .upsert({ user_id: userId, month, ...values }, { onConflict: "user_id,month" })
      .select()
      .single();

    report(error, `Saved ${formatMonth(month)}`);
    if (!error) {
      setEntries((current) => [...current.filter((entry) => entry.month !== month), data]);
    }
  };

  const deleteEntry = async (entry) => {
    if (!window.confirm(`Delete everything logged for ${formatMonth(entry.month)}?`)) {
      return;
    }
    const { error } = await supabase.from("growth_entries").delete().eq("id", entry.id);
    report(error, `Deleted ${formatMonth(entry.month)}`);
    if (!error) {
      setEntries((current) => current.filter((item) => item.id !== entry.id));
    }
  };

  const saveGoal = async (goal) => {
    const { data, error } = await supabase
      .from("growth_goals")
      .upsert({ user_id: userId, ...goal }, { onConflict: "user_id,metric" })
      .select()
      .single();

    report(error, "Goal saved");
    if (!error) {
      setGoals((current) => [...current.filter((item) => item.metric !== goal.metric), data]);
      setChartMetric(goal.metric);
    }
    return !error;
  };

  const removeGoal = async (metricKey) => {
    const { error } = await supabase
      .from("growth_goals")
      .delete()
      .eq("user_id", userId)
      .eq("metric", metricKey);
    report(error, "Goal removed");
    if (!error) {
      setGoals((current) => current.filter((goal) => goal.metric !== metricKey));
    }
  };

  const editMonth = (month) => {
    setFormMonth(monthToInput(month));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loadError) {
    return <p className="text-red-300">{loadError}</p>;
  }

  if (profile === undefined) {
    return <LoadingText />;
  }

  if (!profile) {
    return readOnly ? (
      <p className="text-stone-400">This artist hasn't started tracking their growth yet.</p>
    ) : (
      <ProfileSetup defaultArtistName={defaultArtistName} onCreate={createProfile} />
    );
  }

  const metric = getMetric(chartMetric);
  const chartSeries = seriesFor(entries, chartMetric);
  const chartGoal = goals.find((goal) => goal.metric === chartMetric);
  const formatChartValue = (value) => formatMetricValue(metric, value, profile.currency);

  return (
    <div className="space-y-6">
      {message.text ? (
        <p
          className={`text-sm ${message.error ? "text-red-300" : "text-stone-500"}`}
          aria-live="polite"
        >
          {message.text}
        </p>
      ) : null}

      <SummaryTiles entries={entries} currency={profile.currency} />

      <Panel>
        <SectionHeading>Trend</SectionHeading>
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Choose what to chart">
          {GROWTH_METRICS.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={chartMetric === option.key}
              onClick={() => setChartMetric(option.key)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                chartMetric === option.key
                  ? "border-orange-400 bg-orange-500 text-white"
                  : "border-white/15 text-stone-300 hover:border-orange-300 hover:text-orange-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mb-2 text-sm font-semibold text-stone-200">{metric.label}</p>
        {chartSeries.length === 0 ? (
          <p className="py-16 text-center text-sm text-stone-500">
            {readOnly
              ? "Nothing logged for this yet."
              : "Log a month below to start your chart."}
          </p>
        ) : (
          <>
            <GrowthChart
              series={chartSeries}
              goal={chartGoal ? Number(chartGoal.target) : null}
              label={metric.label}
              formatValue={formatChartValue}
            />
            {chartSeries.length === 1 ? (
              <p className="mt-2 text-xs text-stone-500">
                Log another month to see a trend line.
              </p>
            ) : null}
          </>
        )}
      </Panel>

      <Goals
        entries={entries}
        goals={goals}
        currency={profile.currency}
        readOnly={readOnly}
        onSave={saveGoal}
        onRemove={removeGoal}
      />

      {readOnly ? null : (
        <LogMonthForm
          entries={entries}
          onSave={saveEntry}
          formRef={formRef}
          month={formMonth}
          onMonthChange={setFormMonth}
        />
      )}

      <HistoryTable
        entries={entries}
        currency={profile.currency}
        readOnly={readOnly}
        onEdit={editMonth}
        onDelete={deleteEntry}
      />

      {readOnly ? null : (
        <Panel>
          <SectionHeading>Tracker settings</SectionHeading>
          <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <label className="block">
              <span className={labelClass}>Artist name</span>
              <input
                required
                maxLength={200}
                defaultValue={profile.artist_name}
                onBlur={(event) => {
                  const artistName = event.target.value.trim();
                  if (artistName && artistName !== profile.artist_name) {
                    updateProfile({ artist_name: artistName });
                  }
                }}
                className={`${inputClass} mt-2`}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Earnings currency</span>
              <select
                value={profile.currency}
                onChange={(event) => updateProfile({ currency: event.target.value })}
                className={`${inputClass} mt-2`}
              >
                {CURRENCIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Panel>
      )}
    </div>
  );
};

export default GrowthTracker;

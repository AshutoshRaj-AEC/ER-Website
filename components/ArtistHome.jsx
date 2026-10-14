import { useEffect, useState } from "react";
import { LoadingText, Panel } from "./PageShell";
import StatusBadge from "./StatusBadge";
import { supabase } from "../lib/supabase";
import { formatMoney } from "../lib/releasePlans";
import { buildNextActions, daysUntil, nextRelease, planReadiness, planTasks } from "../lib/commandCenter";
import { GROWTH_METRICS, formatMetricValue, formatMonth, getMetric, seriesFor } from "../lib/growth";
import { getStatusLabel } from "../lib/songVault";

const PLAN_SELECT =
  "id, title, artist_name, release_date, submission_id, currency, submission:submissions(status, track_title), budget_items(planned_amount, actual_amount), checklist_completions(task_key), release_plan_tasks(id, title, due_date, done_at, source, channel)";

const todayString = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};

const formatShort = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

const relativeDays = (days) =>
  days === 0 ? "today" : days === 1 ? "tomorrow" : days === -1 ? "yesterday" : days > 0 ? `in ${days} days` : `${-days} days ago`;

const Card = ({ title, action, children, className = "" }) => (
  <Panel className={className}>
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="font-['Space_Grotesk'] text-lg font-bold uppercase tracking-[0.08em] text-white">{title}</h2>
      {action}
    </div>
    {children}
  </Panel>
);

const LinkAction = ({ href, children }) => (
  <a href={href} className="text-xs font-semibold uppercase tracking-[0.15em] text-orange-300 hover:text-orange-200">
    {children} →
  </a>
);

const ArtistHome = ({ userId, onSelectTab }) => {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const results = await Promise.all([
        supabase
          .from("submissions")
          .select("id, track_title, artist_name, status, artist_message, submitted_at, release_date")
          .eq("user_id", userId)
          .order("submitted_at", { ascending: false }),
        supabase.from("release_plans").select(PLAN_SELECT).eq("user_id", userId),
        supabase.from("growth_profiles").select("user_id, currency").eq("user_id", userId).maybeSingle(),
        supabase.from("growth_entries").select("*").eq("user_id", userId).order("month"),
        supabase.from("growth_goals").select("*").eq("user_id", userId),
        supabase.from("songs").select("id, title, status, updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(20),
        supabase
          .from("insights_imports")
          .select("created_at")
          .eq("user_id", userId)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      if (cancelled) return;
      if (results.some((result) => result.error)) {
        setLoadError("Couldn't load your home page. Refresh to try again.");
        return;
      }

      const [submissions, plans, profile, entries, goals, songs, imports] = results.map((result) => result.data);
      setData({ submissions, plans, growth: { profile, entries, goals }, songs, lastInsightsImport: imports[0]?.created_at ?? null });
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loadError) return <p className="text-red-300">{loadError}</p>;
  if (!data) return <LoadingText />;

  const today = todayString();
  const actions = buildNextActions({ today, ...data });
  const upcoming = nextRelease(data.plans, today);
  const readiness = upcoming ? planReadiness(upcoming, today) : null;
  const feedback = data.submissions.filter((submission) => submission.artist_message || submission.status === "changes_requested").slice(0, 4);
  const deadlines = data.plans
    .flatMap((plan) => planTasks(plan, today).map((task) => ({ ...task, plan })))
    .filter((task) => !task.done && !task.labelStep && task.due && daysUntil(today, task.due) <= 14 && daysUntil(today, task.due) >= -7)
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 6);
  const recentSongs = data.songs.slice(0, 3);
  const isNew =
    data.submissions.length === 0 && data.plans.length === 0 && !data.growth.profile && data.songs.length === 0;

  if (isNew) {
    return (
      <Panel className="bg-gradient-to-br from-orange-500/10 via-white/5 to-transparent">
        <h2 className="font-['Space_Grotesk'] text-2xl font-bold uppercase tracking-[0.06em] text-white">Welcome to your workspace</h2>
        <p className="mt-3 max-w-2xl leading-7 text-stone-300">
          Everything for your music in one place. Start with whichever fits where you are:
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Submit a finished track", href: "/submit" },
            { label: "Plan your next release", tab: "plans" },
            { label: "Save a song idea", tab: "vault" },
            { label: "Track your growth", tab: "growth" },
          ].map((item) =>
            item.href ? (
              <a key={item.label} href={item.href} className="rounded-2xl border border-white/10 bg-black/30 p-4 font-semibold text-white transition hover:border-orange-300">
                {item.label} →
              </a>
            ) : (
              <button key={item.label} type="button" onClick={() => onSelectTab(item.tab)} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-left font-semibold text-white transition hover:border-orange-300">
                {item.label} →
              </button>
            )
          )}
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="next-actions">
        <h2 id="next-actions" className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-orange-300">
          Your next 3 actions
        </h2>
        {actions.length ? (
          <ol className="grid gap-4 md:grid-cols-3">
            {actions.map((action, index) => (
              <li key={action.key} className="flex flex-col rounded-[1.5rem] border border-orange-400/30 bg-orange-500/10 p-5">
                <p className="text-xs font-semibold text-orange-200">{index + 1}</p>
                <p className="mt-1 font-semibold text-white">{action.title}</p>
                <p className="mt-2 flex-1 text-sm leading-6 text-stone-300">{action.detail}</p>
                <a
                  href={action.href}
                  className="mt-4 self-start rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-orange-400"
                >
                  {action.cta}
                </a>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 text-sm text-stone-300">
            You're all caught up. Nothing in your releases, submissions or growth needs attention right now.
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Next release" action={upcoming ? <LinkAction href={`/dashboard?plan=${upcoming.id}`}>Open plan</LinkAction> : null}>
          {upcoming ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-['Space_Grotesk'] text-2xl font-bold text-white">{upcoming.title}</p>
                  <p className="mt-1 text-sm text-stone-400">
                    {upcoming.release_date
                      ? `${formatShort(upcoming.release_date)} · ${relativeDays(readiness.daysToRelease)}`
                      : "No release date yet"}
                  </p>
                </div>
                {upcoming.submission ? <StatusBadge status={upcoming.submission.status} /> : (
                  <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Not submitted</span>
                )}
              </div>
              <div>
                <div className="flex justify-between text-xs text-stone-400">
                  <span>Release readiness</span>
                  <span>{readiness.tasksDone} of {readiness.tasksTotal} tasks</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${readiness.percent}% of tasks done`}>
                  <div className="h-full rounded-full bg-orange-400" style={{ width: `${readiness.percent}%` }} />
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-stone-500">Budget planned</dt>
                  <dd className="font-semibold text-white">{formatMoney(readiness.budgetPlanned, upcoming.currency)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500">Spent so far</dt>
                  <dd className="font-semibold text-white">{formatMoney(readiness.budgetSpent, upcoming.currency)}</dd>
                </div>
              </dl>
              {readiness.overdue.length ? (
                <p className="text-sm text-red-300">
                  {readiness.overdue.length} overdue task{readiness.overdue.length === 1 ? "" : "s"}.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-stone-400">
              No upcoming release planned.{" "}
              <button type="button" onClick={() => onSelectTab("plans")} className="font-semibold text-orange-300 underline-offset-4 hover:underline">
                Start a release plan
              </button>
            </p>
          )}
        </Card>

        <Card title="Label feedback" action={<LinkAction href="/submit">Submissions</LinkAction>}>
          {feedback.length ? (
            <ul className="space-y-3">
              {feedback.map((submission) => (
                <li key={submission.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-white">{submission.track_title}</p>
                    <StatusBadge status={submission.status} />
                  </div>
                  {submission.artist_message ? (
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-stone-300">{submission.artist_message}</p>
                  ) : null}
                  {submission.status === "changes_requested" ? (
                    <a href={`/submit?edit=${submission.id}`} className="mt-3 inline-flex text-xs font-semibold uppercase tracking-[0.15em] text-orange-300 hover:text-orange-200">
                      Fix and resubmit →
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-400">
              {data.submissions.length ? "No messages from the label yet." : "Submit a track and the label's feedback will appear here."}
            </p>
          )}
        </Card>

        <Card title="Upcoming deadlines">
          {deadlines.length ? (
            <ul className="divide-y divide-white/5">
              {deadlines.map((task) => {
                const days = daysUntil(today, task.due);
                return (
                  <li key={`${task.plan.id}:${task.id}`} className="flex items-start justify-between gap-4 py-3">
                    <a href={`/dashboard?plan=${task.plan.id}`} className="min-w-0 hover:text-orange-200">
                      <span className="block text-sm text-stone-100">{task.title}</span>
                      <span className="block text-xs text-stone-500">{task.plan.title}</span>
                    </a>
                    <span className={`shrink-0 text-xs font-semibold ${days < 0 ? "text-red-300" : days <= 2 ? "text-amber-200" : "text-stone-400"}`}>
                      {days < 0 ? `Overdue · ${formatShort(task.due)}` : `${formatShort(task.due)} · ${relativeDays(days)}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-stone-400">Nothing due in the next two weeks.</p>
          )}
        </Card>

        <Card title="Growth" action={<button type="button" onClick={() => onSelectTab("growth")} className="text-xs font-semibold uppercase tracking-[0.15em] text-orange-300 hover:text-orange-200">Open →</button>}>
          {data.growth.profile ? (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-3">
                {GROWTH_METRICS.slice(0, 4).map((metric) => {
                  const series = seriesFor(data.growth.entries, metric.key);
                  const latest = series.at(-1);
                  return (
                    <div key={metric.key} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <dt className="text-xs text-stone-500">{metric.label}</dt>
                      <dd className="mt-1 font-semibold text-white">
                        {latest ? formatMetricValue(metric, latest.value, data.growth.profile.currency) : "—"}
                      </dd>
                      {latest ? <dd className="text-[11px] text-stone-500">{formatMonth(latest.month)}</dd> : null}
                    </div>
                  );
                })}
              </dl>
              {data.growth.goals.length ? (
                <ul className="space-y-2">
                  {data.growth.goals.slice(0, 3).map((goal) => {
                    const metric = getMetric(goal.metric);
                    const latest = seriesFor(data.growth.entries, goal.metric).at(-1);
                    const percent = latest ? Math.min(100, (latest.value / Number(goal.target)) * 100) : 0;
                    return (
                      <li key={goal.metric}>
                        <div className="flex justify-between gap-3 text-xs text-stone-400">
                          <span>{metric.label}: goal {formatMetricValue(metric, Number(goal.target), data.growth.profile.currency)}</span>
                          <span>{Math.round(percent)}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-orange-400" style={{ width: `${percent}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-stone-500">No goals yet. Set one in the Growth tab.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-stone-400">Start tracking your monthly numbers to see your growth here.</p>
          )}
        </Card>
      </div>

      <Card title="Song Vault" action={<button type="button" onClick={() => onSelectTab("vault")} className="text-xs font-semibold uppercase tracking-[0.15em] text-orange-300 hover:text-orange-200">Open →</button>}>
        {recentSongs.length ? (
          <ul className="grid gap-3 sm:grid-cols-3">
            {recentSongs.map((song) => (
              <li key={song.id}>
                <a href={`/dashboard?tab=vault&song=${song.id}`} className="block rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-orange-300/60">
                  <p className="truncate font-semibold text-white">{song.title}</p>
                  <p className="mt-1 text-xs text-stone-400">
                    {getStatusLabel(song.status)} · updated {relativeDays(daysUntil(today, song.updated_at.slice(0, 10)))}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-400">Save lyrics, hooks and voice notes for songs in progress.</p>
        )}
      </Card>
    </div>
  );
};

export default ArtistHome;

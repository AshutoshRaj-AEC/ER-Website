import { useEffect, useState } from "react";
import { LoadingText, Panel } from "./PageShell";
import StatusBadge from "./StatusBadge";
import { supabase } from "../lib/supabase";
import {
  BUDGET_CATEGORIES,
  CHECKLIST_TASKS,
  CURRENCIES,
  addDays,
  countDoneTasks,
  earningsPerStream,
  formatDate,
  formatMoney,
  formatNumber,
  isTaskDone,
  parseDate,
  streamsToBreakEven,
  sumBudget,
} from "../lib/releasePlans";

const PLAN_SELECT = "*, submission:submissions(id, status, track_title)";

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-stone-100 placeholder:text-stone-500 focus:border-orange-300 focus:outline-none disabled:opacity-60";

const labelClass =
  "text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-400";

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

// Keeps a local draft and saves when the field loses focus.
const AutoSaveInput = ({ value, onSave, ...props }) => {
  const [draft, setDraft] = useState(String(value ?? ""));

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  return (
    <input
      {...props}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => {
        if (event.target.checkValidity() && draft !== String(value ?? "")) {
          onSave(draft);
        }
      }}
      className={`${inputClass} ${props.className ?? ""}`}
    />
  );
};

const toAmount = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const PlanSettings = ({ plan, readOnly, linkableSubmissions, onSave }) => {
  return (
    <Panel>
      <SectionHeading>Release</SectionHeading>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className={labelClass}>Release title</span>
          <AutoSaveInput
            required
            maxLength={200}
            disabled={readOnly}
            value={plan.title}
            onSave={(title) => onSave({ title: title.trim() })}
            className="mt-2"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Artist name</span>
          <AutoSaveInput
            required
            maxLength={200}
            disabled={readOnly}
            value={plan.artist_name}
            onSave={(artistName) => onSave({ artist_name: artistName.trim() })}
            className="mt-2"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Release date</span>
          <AutoSaveInput
            type="date"
            disabled={readOnly}
            value={plan.release_date}
            onSave={(releaseDate) => onSave({ release_date: releaseDate || null })}
            className="mt-2 [color-scheme:dark]"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Currency</span>
          <select
            disabled={readOnly}
            value={plan.currency}
            onChange={(event) => onSave({ currency: event.target.value })}
            className={`${inputClass} mt-2`}
          >
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6">
        {readOnly ? (
          plan.submission ? (
            <p className="flex flex-wrap items-center gap-3 text-sm text-stone-300">
              Linked submission: {plan.submission.track_title}
              <StatusBadge status={plan.submission.status} />
            </p>
          ) : (
            <p className="text-sm text-stone-500">Not linked to a submission yet.</p>
          )
        ) : (
          <label className="block max-w-xl">
            <span className={labelClass}>Linked submission</span>
            <select
              value={plan.submission_id ?? ""}
              onChange={(event) =>
                onSave({ submission_id: event.target.value || null })
              }
              className={`${inputClass} mt-2`}
            >
              <option value="">Not submitted yet</option>
              {linkableSubmissions.map((submission) => (
                <option key={submission.id} value={submission.id}>
                  {submission.track_title}
                </option>
              ))}
            </select>
            <span className="mt-2 block text-xs leading-5 text-stone-500">
              Linking your submission ticks the label steps in the checklist
              automatically.
            </span>
          </label>
        )}
      </div>
    </Panel>
  );
};

const BudgetPlanner = ({ items, currency, readOnly, onAdd, onUpdate, onDelete }) => {
  const totals = sumBudget(items);
  const remaining = totals.planned - totals.actual;
  const spentPercent =
    totals.planned > 0 ? Math.min(100, (totals.actual / totals.planned) * 100) : 0;
  const overspent = remaining < 0;

  return (
    <Panel>
      <SectionHeading
        aside={
          <p className="text-sm text-stone-400">
            Plan what each part of the release will cost, then log what you
            actually spend.
          </p>
        }
      >
        Budget
      </SectionHeading>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className={labelClass}>Planned</p>
          <p className="mt-2 font-['Space_Grotesk'] text-2xl font-bold text-white">
            {formatMoney(totals.planned, currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className={labelClass}>Spent</p>
          <p className="mt-2 font-['Space_Grotesk'] text-2xl font-bold text-white">
            {formatMoney(totals.actual, currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className={labelClass}>{overspent ? "Over budget" : "Left to spend"}</p>
          <p
            className={`mt-2 font-['Space_Grotesk'] text-2xl font-bold ${overspent ? "text-red-300" : "text-emerald-200"}`}
          >
            {formatMoney(Math.abs(remaining), currency)}
          </p>
        </div>
      </div>

      {totals.planned > 0 ? (
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"
          role="img"
          aria-label={`${Math.round(spentPercent)}% of the planned budget spent`}
        >
          <div
            className={`h-full rounded-full ${overspent ? "bg-red-400" : "bg-orange-400"}`}
            style={{ width: `${spentPercent}%` }}
          />
        </div>
      ) : null}

      <div className="mt-8 space-y-4">
        <div className="hidden gap-3 px-1 sm:grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_8rem_8rem_2.5rem]">
          <span className={labelClass}>Category</span>
          <span className={labelClass}>What for</span>
          <span className={labelClass}>Planned</span>
          <span className={labelClass}>Spent</span>
          <span />
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-stone-500">
            {readOnly ? "No budget items yet." : "Add your first cost below."}
          </p>
        ) : null}

        {items.map((item) => (
          <div
            key={item.id}
            className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_8rem_8rem_2.5rem] sm:border-0 sm:bg-transparent sm:p-0"
          >
            <select
              aria-label="Category"
              disabled={readOnly}
              value={item.category}
              onChange={(event) => onUpdate(item.id, { category: event.target.value })}
              className={inputClass}
            >
              {BUDGET_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            <AutoSaveInput
              aria-label="What for"
              placeholder="e.g. Mix by Studio X"
              maxLength={300}
              disabled={readOnly}
              value={item.description}
              onSave={(description) => onUpdate(item.id, { description: description.trim() })}
            />
            <label className="block">
              <span className={`${labelClass} sm:hidden`}>Planned</span>
              <AutoSaveInput
                aria-label="Planned amount"
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                disabled={readOnly}
                value={Number(item.planned_amount)}
                onSave={(amount) => onUpdate(item.id, { planned_amount: toAmount(amount) })}
                className="mt-1 sm:mt-0"
              />
            </label>
            <label className="block">
              <span className={`${labelClass} sm:hidden`}>Spent</span>
              <AutoSaveInput
                aria-label="Amount spent"
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                disabled={readOnly}
                value={Number(item.actual_amount)}
                onSave={(amount) => onUpdate(item.id, { actual_amount: toAmount(amount) })}
                className="mt-1 sm:mt-0"
              />
            </label>
            {readOnly ? (
              <span />
            ) : (
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                aria-label="Remove this cost"
                className="h-12 rounded-2xl border border-white/10 text-stone-400 transition hover:border-red-300 hover:text-red-200"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {readOnly ? null : (
        <button
          type="button"
          onClick={onAdd}
          className="mt-6 rounded-full border border-white/15 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-stone-200 transition hover:border-orange-300 hover:text-orange-200"
        >
          + Add a cost
        </button>
      )}
    </Panel>
  );
};

const BreakEven = ({ plan, totals, readOnly, onSave }) => {
  const [whatIfStreams, setWhatIfStreams] = useState("");
  const perStream = earningsPerStream(
    plan.payout_per_1000_streams,
    plan.artist_share_percent
  );
  const plannedStreams = streamsToBreakEven(totals.planned, perStream);
  const spentStreams = streamsToBreakEven(totals.actual, perStream);
  const whatIfEarnings = (Number(whatIfStreams) || 0) * perStream;
  const recoveredPercent =
    totals.planned > 0 ? (whatIfEarnings / totals.planned) * 100 : null;

  return (
    <Panel>
      <SectionHeading>Break-even</SectionHeading>
      <p className="max-w-2xl text-sm leading-6 text-stone-400">
        Enter what you earn per 1,000 streams. It varies a lot by platform and
        country, so use the figure from your own distributor statements. If
        you split earnings with a distributor or label, set your share.
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>
            Payout per 1,000 streams ({plan.currency})
          </span>
          <AutoSaveInput
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="From your distributor statements"
            disabled={readOnly}
            value={plan.payout_per_1000_streams ?? ""}
            onSave={(rate) =>
              onSave({ payout_per_1000_streams: rate === "" ? null : toAmount(rate) })
            }
            className="mt-2"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Your share of earnings (%)</span>
          <AutoSaveInput
            type="number"
            min="0"
            max="100"
            step="1"
            inputMode="decimal"
            disabled={readOnly}
            value={Number(plan.artist_share_percent)}
            onSave={(share) =>
              onSave({ artist_share_percent: Math.min(100, toAmount(share)) })
            }
            className="mt-2"
          />
        </label>
      </div>

      {perStream > 0 ? (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className={labelClass}>Streams to cover the planned budget</p>
              <p className="mt-2 font-['Space_Grotesk'] text-2xl font-bold text-white">
                {plannedStreams === null || totals.planned === 0
                  ? "—"
                  : formatNumber(plannedStreams)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className={labelClass}>Streams to cover what you've spent</p>
              <p className="mt-2 font-['Space_Grotesk'] text-2xl font-bold text-white">
                {spentStreams === null || totals.actual === 0
                  ? "—"
                  : formatNumber(spentStreams)}
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-4">
            <label className="block max-w-xs">
              <span className={labelClass}>What if it gets this many streams?</span>
              <input
                type="number"
                min="0"
                step="1000"
                inputMode="numeric"
                placeholder="e.g. 100000"
                value={whatIfStreams}
                onChange={(event) => setWhatIfStreams(event.target.value)}
                className={`${inputClass} mt-2`}
              />
            </label>
            {Number(whatIfStreams) > 0 ? (
              <p className="mt-4 text-sm leading-6 text-stone-300">
                You'd earn about{" "}
                <span className="font-semibold text-white">
                  {formatMoney(whatIfEarnings, plan.currency)}
                </span>
                {recoveredPercent === null
                  ? "."
                  : `, which covers ${Math.round(recoveredPercent)}% of your planned budget.`}
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <p className="mt-6 text-sm text-stone-500">
          Add your payout rate to see how many streams you need.
        </p>
      )}
    </Panel>
  );
};

const Checklist = ({ plan, completions, readOnly, onToggle }) => {
  const completedKeys = new Set(completions.map((entry) => entry.task_key));
  const releaseDate = parseDate(plan.release_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const doneCount = countDoneTasks(completions, plan.submission);

  return (
    <Panel>
      <SectionHeading
        aside={
          <p className="text-sm text-stone-400">
            {doneCount} of {CHECKLIST_TASKS.length} done
          </p>
        }
      >
        Release checklist
      </SectionHeading>
      {releaseDate ? null : (
        <p className="mb-6 text-sm text-stone-500">
          Set a release date to see when each step is due.
        </p>
      )}

      <ul className="space-y-3">
        {CHECKLIST_TASKS.map((task) => {
          const autoDone = Boolean(task.auto?.(plan.submission));
          const done = isTaskDone(task, completedKeys, plan.submission);
          const dueDate = releaseDate ? addDays(releaseDate, task.daysFromRelease) : null;
          const overdue = dueDate && !done && dueDate < today;

          return (
            <li key={task.key}>
              <label
                className={`flex items-start gap-4 rounded-2xl border p-4 ${done ? "border-emerald-300/20 bg-emerald-300/5" : "border-white/10 bg-black/20"}`}
              >
                <input
                  type="checkbox"
                  checked={done}
                  disabled={readOnly || autoDone}
                  onChange={(event) => onToggle(task.key, event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-orange-500"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm ${done ? "text-stone-400 line-through" : "text-stone-100"}`}
                  >
                    {task.label}
                  </span>
                  {task.hint ? (
                    <span className="mt-1 block text-xs text-stone-500">{task.hint}</span>
                  ) : null}
                  {autoDone ? (
                    <span className="mt-1 block text-xs text-emerald-200/80">
                      Done automatically from the label's review.
                    </span>
                  ) : null}
                </span>
                {dueDate ? (
                  <span
                    className={`shrink-0 text-xs ${overdue ? "font-semibold text-red-300" : "text-stone-500"}`}
                  >
                    {overdue ? "Overdue · " : ""}
                    {formatDate(dueDate)}
                  </span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
};

const PlanDetail = ({ planId, readOnly = false, onBack, onDeleted }) => {
  const [plan, setPlan] = useState(null);
  const [items, setItems] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [linkableSubmissions, setLinkableSubmissions] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [planResult, itemsResult, completionsResult] = await Promise.all([
        supabase.from("release_plans").select(PLAN_SELECT).eq("id", planId).maybeSingle(),
        supabase
          .from("budget_items")
          .select("*")
          .eq("plan_id", planId)
          .order("created_at"),
        supabase.from("checklist_completions").select("task_key").eq("plan_id", planId),
      ]);

      if (cancelled) {
        return;
      }

      if (planResult.error || itemsResult.error || completionsResult.error) {
        setLoadError("Couldn't load this plan. Refresh to try again.");
        return;
      }

      if (!planResult.data) {
        setLoadError("This plan doesn't exist or you don't have access to it.");
        return;
      }

      setPlan(planResult.data);
      setItems(itemsResult.data);
      setCompletions(completionsResult.data);

      if (!readOnly) {
        // The artist's own submissions that aren't linked to another plan.
        const { data: submissions } = await supabase
          .from("submissions")
          .select("id, track_title, release_plans(id)")
          .eq("user_id", planResult.data.user_id)
          .order("created_at", { ascending: false });

        if (!cancelled && submissions) {
          setLinkableSubmissions(
            submissions.filter((submission) =>
              submission.release_plans.every((linked) => linked.id === planId)
            )
          );
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [planId, readOnly]);

  const reportSave = (error) => {
    if (error) {
      console.error(error);
    }
    setSaveMessage(error ? "Couldn't save that change. Please try again." : "Saved");
  };

  const savePlan = async (changes) => {
    const { data, error } = await supabase
      .from("release_plans")
      .update(changes)
      .eq("id", planId)
      .select(PLAN_SELECT)
      .single();

    reportSave(error);
    if (!error) {
      setPlan(data);
    }
  };

  const addItem = async () => {
    const { data, error } = await supabase
      .from("budget_items")
      .insert({ plan_id: planId, category: "production" })
      .select()
      .single();

    reportSave(error);
    if (!error) {
      setItems((current) => [...current, data]);
    }
  };

  const updateItem = async (id, changes) => {
    const { data, error } = await supabase
      .from("budget_items")
      .update(changes)
      .eq("id", id)
      .select()
      .single();

    reportSave(error);
    if (!error) {
      setItems((current) => current.map((item) => (item.id === id ? data : item)));
    }
  };

  const deleteItem = async (id) => {
    const { error } = await supabase.from("budget_items").delete().eq("id", id);

    reportSave(error);
    if (!error) {
      setItems((current) => current.filter((item) => item.id !== id));
    }
  };

  const toggleTask = async (taskKey, checked) => {
    const { error } = checked
      ? await supabase
          .from("checklist_completions")
          .insert({ plan_id: planId, task_key: taskKey })
      : await supabase
          .from("checklist_completions")
          .delete()
          .eq("plan_id", planId)
          .eq("task_key", taskKey);

    reportSave(error);
    if (!error) {
      setCompletions((current) =>
        checked
          ? [...current, { task_key: taskKey }]
          : current.filter((entry) => entry.task_key !== taskKey)
      );
    }
  };

  const deletePlan = async () => {
    if (!window.confirm(`Delete the plan for "${plan.title}"? This can't be undone.`)) {
      return;
    }

    const { error } = await supabase.from("release_plans").delete().eq("id", planId);

    if (error) {
      reportSave(error);
      return;
    }

    onDeleted();
  };

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-300 transition hover:text-orange-200"
    >
      ← All plans
    </button>
  );

  if (loadError) {
    return (
      <div className="space-y-6">
        {backButton}
        <p className="text-red-300">{loadError}</p>
      </div>
    );
  }

  if (!plan) {
    return <LoadingText />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {backButton}
        {saveMessage ? (
          <p
            className={`text-sm ${saveMessage === "Saved" ? "text-stone-500" : "text-red-300"}`}
            aria-live="polite"
          >
            {saveMessage}
          </p>
        ) : null}
      </div>

      <div>
        <h2 className="font-['Space_Grotesk'] text-3xl font-bold uppercase tracking-[0.06em] text-white">
          {plan.title}
        </h2>
        <p className="mt-2 text-stone-400">{plan.artist_name}</p>
      </div>

      {readOnly ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-stone-300">
          You're viewing this artist's plan. Only the artist can change it.
        </p>
      ) : null}

      <PlanSettings
        plan={plan}
        readOnly={readOnly}
        linkableSubmissions={linkableSubmissions}
        onSave={savePlan}
      />
      <BudgetPlanner
        items={items}
        currency={plan.currency}
        readOnly={readOnly}
        onAdd={addItem}
        onUpdate={updateItem}
        onDelete={deleteItem}
      />
      <BreakEven
        plan={plan}
        totals={sumBudget(items)}
        readOnly={readOnly}
        onSave={savePlan}
      />
      <Checklist
        plan={plan}
        completions={completions}
        readOnly={readOnly}
        onToggle={toggleTask}
      />

      {readOnly ? null : (
        <button
          type="button"
          onClick={deletePlan}
          className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-500 transition hover:text-red-300"
        >
          Delete this plan
        </button>
      )}
    </div>
  );
};

export default PlanDetail;

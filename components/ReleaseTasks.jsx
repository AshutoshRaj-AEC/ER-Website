import { useMemo, useState } from "react";
import { AutoSaveInput, AutoSaveTextarea, fieldClass } from "./AutoSaveField";
import { Panel } from "./PageShell";
import {
  BUDGET_LEVELS,
  CHANNELS,
  LANGUAGES,
  PHASES,
  generateCampaign,
  suggestBudgetLevel,
} from "../lib/campaign";

const labelClass = "text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-400";
const primaryButton =
  "rounded-full bg-orange-500 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-orange-400 disabled:opacity-50";
const secondaryButton =
  "rounded-full border border-white/15 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-stone-200 transition hover:border-orange-300 hover:text-orange-200";

const CHANNEL_LABELS = Object.fromEntries(CHANNELS.map((channel) => [channel.id, channel.label.split(" (")[0]]));

const todayString = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};

const formatShort = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

const toggleIn = (list, value) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

const CampaignGenerator = ({ plan, items, existingKeys, onAdd, onClose }) => {
  const promoBudget = items
    .filter((item) => ["advertising", "pr_playlists"].includes(item.category))
    .reduce((total, item) => total + Number(item.planned_amount || 0), 0);
  const saved = plan.campaign_settings ?? {};

  const [settings, setSettings] = useState({
    channels: saved.channels ?? ["instagram", "youtube", "whatsapp"],
    languages: saved.languages ?? ["hinglish"],
    budgetLevel: saved.budgetLevel ?? suggestBudgetLevel(promoBudget),
    genre: saved.genre ?? plan.submission?.genre ?? "",
  });
  const [unselected, setUnselected] = useState(() => new Set(existingKeys));
  const [saving, setSaving] = useState(false);

  const tasks = useMemo(
    () => generateCampaign({ releaseDate: plan.release_date, title: plan.title, artistName: plan.artist_name, settings }),
    [plan.release_date, plan.title, plan.artist_name, settings]
  );
  const chosen = tasks.filter((task) => !unselected.has(task.template_key));
  const today = todayString();

  const add = async () => {
    setSaving(true);
    const ok = await onAdd(chosen, settings);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="space-y-6 rounded-[1.5rem] border border-orange-400/30 bg-orange-500/5 p-5">
      <div>
        <p className="font-semibold text-white">Generate a promotion campaign</p>
        <p className="mt-1 text-sm text-stone-400">
          Ready-made tasks for your release, timed from{" "}
          {plan.release_date ? `your release date (${formatShort(plan.release_date)})` : "your release date once you set one"}. Review them below
          and untick anything you don't want. You can edit every task afterwards.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <fieldset>
          <legend className={labelClass}>Channels</legend>
          <div className="mt-2 space-y-2">
            {CHANNELS.map((channel) => (
              <label key={channel.id} className="flex items-center gap-3 text-sm text-stone-200">
                <input
                  type="checkbox"
                  checked={settings.channels.includes(channel.id)}
                  onChange={() => setSettings((current) => ({ ...current, channels: toggleIn(current.channels, channel.id) }))}
                  className="h-4 w-4 accent-orange-500"
                />
                {channel.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-5">
          <fieldset>
            <legend className={labelClass}>Caption languages</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {LANGUAGES.map((language) => (
                <label key={language.id} className="flex items-center gap-2 text-sm text-stone-200">
                  <input
                    type="checkbox"
                    checked={settings.languages.includes(language.id)}
                    onChange={() => setSettings((current) => ({ ...current, languages: toggleIn(current.languages, language.id) }))}
                    className="h-4 w-4 accent-orange-500"
                  />
                  {language.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className={labelClass}>Budget</span>
            <select
              value={settings.budgetLevel}
              onChange={(event) => setSettings((current) => ({ ...current, budgetLevel: event.target.value }))}
              className={`${fieldClass} mt-2`}
            >
              {BUDGET_LEVELS.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.label}
                </option>
              ))}
            </select>
            {promoBudget > 0 ? (
              <span className="mt-1 block text-xs text-stone-500">Suggested from the ₹{Math.round(promoBudget).toLocaleString("en-IN")} of promotion in your budget.</span>
            ) : null}
          </label>
          <label className="block">
            <span className={labelClass}>Genre (for ideas)</span>
            <input
              maxLength={100}
              value={settings.genre}
              placeholder="e.g. Hip-Hop/Rap, Devotional"
              onChange={(event) => setSettings((current) => ({ ...current, genre: event.target.value }))}
              className={`${fieldClass} mt-2`}
            />
          </label>
        </div>
      </div>

      <div>
        <p className={labelClass}>Preview: {chosen.length} of {tasks.length} tasks selected</p>
        <ul className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
          {tasks.map((task) => {
            const already = existingKeys.has(task.template_key);
            const checked = !unselected.has(task.template_key);
            return (
              <li key={task.template_key} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setUnselected((current) => {
                        const next = new Set(current);
                        if (next.has(task.template_key)) next.delete(task.template_key);
                        else next.add(task.template_key);
                        return next;
                      })
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-orange-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">{task.title}</span>
                    <span className="block text-xs text-stone-500">
                      {PHASES[task.phase]} · {CHANNEL_LABELS[task.channel] ?? "Any channel"}
                      {task.due_date ? ` · ${formatShort(task.due_date)}${task.due_date < today ? " (already past)" : ""}` : ""}
                      {already ? " · already in your plan" : ""}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={!chosen.length || saving} onClick={add} className={primaryButton}>
          {saving ? "Adding…" : `Add ${chosen.length} task${chosen.length === 1 ? "" : "s"} to my plan`}
        </button>
        <button type="button" onClick={onClose} className={secondaryButton}>
          Cancel
        </button>
      </div>
    </div>
  );
};

const AddTaskForm = ({ onAdd }) => {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [phase, setPhase] = useState("pre_release");

  const submit = async (event) => {
    event.preventDefault();
    const ok = await onAdd([{ title: title.trim(), due_date: dueDate || null, phase, source: "custom", details: null, channel: null, template_key: null }]);
    if (ok) {
      setTitle("");
      setDueDate("");
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_11rem_auto] sm:items-end">
      <label className="block">
        <span className="sr-only">New task</span>
        <input required maxLength={200} placeholder="Add your own task" value={title} onChange={(event) => setTitle(event.target.value)} className={fieldClass} />
      </label>
      <label className="block">
        <span className="sr-only">Due date</span>
        <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={`${fieldClass} [color-scheme:dark]`} />
      </label>
      <label className="block">
        <span className="sr-only">Phase</span>
        <select value={phase} onChange={(event) => setPhase(event.target.value)} className={fieldClass}>
          {Object.entries(PHASES).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={!title.trim()} className={primaryButton}>
        Add
      </button>
    </form>
  );
};

const TaskRow = ({ task, readOnly, today, onUpdate, onDelete }) => {
  const [open, setOpen] = useState(false);
  const done = Boolean(task.done_at);
  const overdue = task.due_date && !done && task.due_date < today;

  return (
    <li className={`rounded-2xl border p-3 ${done ? "border-emerald-300/20 bg-emerald-300/5" : "border-white/10 bg-black/20"}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          aria-label={`Mark "${task.title}" done`}
          checked={done}
          disabled={readOnly}
          onChange={(event) => onUpdate(task.id, { done_at: event.target.checked ? new Date().toISOString() : null })}
          className="mt-3 h-4 w-4 shrink-0 accent-orange-500"
        />
        <div className="min-w-0 flex-1">
          {readOnly ? (
            <p className={`py-2 text-sm ${done ? "text-stone-400 line-through" : "text-stone-100"}`}>{task.title}</p>
          ) : (
            <AutoSaveInput
              aria-label="Task title"
              required
              maxLength={200}
              value={task.title}
              onSave={(title) => onUpdate(task.id, { title: title.trim() })}
              bare
              className={`w-full rounded-xl border border-transparent bg-transparent px-2 py-2 text-sm transition hover:border-white/10 focus:border-orange-300 focus:bg-black/40 focus:outline-none ${done ? "text-stone-400 line-through" : "text-stone-100"}`}
            />
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 text-xs text-stone-500">
            {task.channel && task.channel !== "general" ? <span>{CHANNEL_LABELS[task.channel] ?? task.channel}</span> : null}
            {task.source === "campaign" ? <span>Campaign</span> : null}
            {task.details || !readOnly ? (
              <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="font-semibold text-orange-300 hover:text-orange-200">
                {open ? "Hide details" : task.details ? "Details & captions" : "Add notes"}
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {readOnly ? (
            <span className={`pt-2 text-xs ${overdue ? "font-semibold text-red-300" : "text-stone-500"}`}>
              {task.due_date ? formatShort(task.due_date) : "No date"}
            </span>
          ) : (
            <AutoSaveInput
              type="date"
              aria-label="Due date"
              value={task.due_date ?? ""}
              onSave={(due) => onUpdate(task.id, { due_date: due || null })}
              bare
              className={`w-36 rounded-xl border border-white/10 bg-black/40 px-2 py-1.5 text-xs [color-scheme:dark] ${overdue ? "text-red-300" : "text-stone-300"}`}
            />
          )}
          {overdue ? <span className="text-[11px] font-semibold text-red-300">Overdue</span> : null}
          {readOnly ? null : (
            <button type="button" onClick={() => onDelete(task)} className="text-[11px] font-semibold uppercase tracking-[0.15em] text-stone-500 hover:text-red-300">
              Delete
            </button>
          )}
        </div>
      </div>
      {open ? (
        readOnly ? (
          <p className="mt-2 whitespace-pre-wrap px-9 text-sm leading-6 text-stone-300">{task.details}</p>
        ) : (
          <AutoSaveTextarea
            aria-label="Task notes"
            rows={5}
            maxLength={2000}
            value={task.details ?? ""}
            onSave={(details) => onUpdate(task.id, { details: details.trim() || null })}
            className="mt-2 text-sm leading-6"
          />
        )
      ) : null}
    </li>
  );
};

const ReleaseTasks = ({ plan, items, tasks, readOnly, onAddTasks, onUpdateTask, onDeleteTask }) => {
  const [generating, setGenerating] = useState(false);
  const today = todayString();
  const existingKeys = useMemo(() => new Set(tasks.map((task) => task.template_key).filter(Boolean)), [tasks]);
  const done = tasks.filter((task) => task.done_at).length;

  const grouped = Object.keys(PHASES)
    .map((phase) => ({
      phase,
      tasks: tasks
        .filter((task) => task.phase === phase)
        .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.title.localeCompare(b.title)),
    }))
    .filter((group) => group.tasks.length);

  return (
    <Panel>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-['Space_Grotesk'] text-xl font-bold uppercase tracking-[0.08em] text-white">Campaign & your tasks</h2>
        {tasks.length ? <p className="text-sm text-stone-400">{done} of {tasks.length} done</p> : null}
      </div>

      {!readOnly ? (
        generating ? (
          <CampaignGenerator plan={plan} items={items} existingKeys={existingKeys} onAdd={onAddTasks} onClose={() => setGenerating(false)} />
        ) : (
          <button type="button" onClick={() => setGenerating(true)} className={primaryButton}>
            {existingKeys.size ? "Add more campaign tasks" : "Generate a promotion campaign"}
          </button>
        )
      ) : null}

      {grouped.length ? (
        <div className="mt-6 space-y-6">
          {grouped.map((group) => (
            <section key={group.phase}>
              <h3 className={labelClass}>{PHASES[group.phase]}</h3>
              <ul className="mt-2 space-y-2">
                {group.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} readOnly={readOnly} today={today} onUpdate={onUpdateTask} onDelete={onDeleteTask} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-stone-500">
          {readOnly ? "No campaign or custom tasks yet." : "Generate a campaign or add your own tasks. They show up on your home page with their due dates."}
        </p>
      )}

      {readOnly ? null : (
        <div className="mt-6 border-t border-white/10 pt-6">
          <AddTaskForm onAdd={onAddTasks} />
        </div>
      )}
    </Panel>
  );
};

export default ReleaseTasks;

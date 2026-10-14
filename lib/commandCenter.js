// Artist home: release readiness and the "next 3 actions", worked out from the
// artist's saved data only. Pure functions so they can be tested.

import { CHECKLIST_TASKS, isTaskDone, sumBudget } from "./releasePlans.js";
import { addDays } from "./insights/analytics.js";

export const daysUntil = (today, iso) =>
  Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);

// Every task for a plan (fixed checklist + campaign/custom) with due dates.
export const planTasks = (plan, today) => {
  const completed = new Set((plan.checklist_completions ?? []).map((entry) => entry.task_key));
  const release = plan.release_date;

  const fixed = CHECKLIST_TASKS.map((task) => ({
    id: `fixed:${task.key}`,
    title: task.label,
    due: release ? addDays(release, task.daysFromRelease) : null,
    done: isTaskDone(task, completed, plan.submission),
    source: "checklist",
    // Label steps tick themselves from the submission's status.
    labelStep: Boolean(task.auto),
  }));

  const extra = (plan.release_plan_tasks ?? []).map((task) => ({
    id: task.id,
    title: task.title,
    due: task.due_date,
    done: Boolean(task.done_at),
    source: task.source,
    channel: task.channel,
  }));

  return [...fixed, ...extra].map((task) => ({
    ...task,
    overdue: Boolean(task.due && !task.done && task.due < today),
  }));
};

// How ready a release is: checklist progress, overdue work, budget, label status.
export const planReadiness = (plan, today) => {
  const tasks = planTasks(plan, today);
  const done = tasks.filter((task) => task.done).length;
  const totals = sumBudget(plan.budget_items ?? []);
  return {
    daysToRelease: plan.release_date ? daysUntil(today, plan.release_date) : null,
    tasksDone: done,
    tasksTotal: tasks.length,
    percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    // Deadlines are the artist's own tasks; label steps only count towards progress.
    overdue: tasks.filter((task) => task.overdue && !task.labelStep),
    nextTasks: tasks
      .filter((task) => !task.done && !task.labelStep && task.due && task.due >= today)
      .sort((a, b) => a.due.localeCompare(b.due))
      .slice(0, 5),
    budgetPlanned: totals.planned,
    budgetSpent: totals.actual,
    submissionStatus: plan.submission?.status ?? null,
  };
};

// The soonest release that hasn't happened yet (or the one with no date).
export const nextRelease = (plans, today) =>
  [...plans]
    .filter((plan) => !plan.release_date || plan.release_date >= today)
    .sort((a, b) => (a.release_date ?? "9999").localeCompare(b.release_date ?? "9999"))[0] ?? null;

const STALE_SONG_DAYS = 14;
const STALE_INSIGHTS_DAYS = 30;

// Up to three concrete next steps, most urgent first. Each refers to real
// saved data; nothing is suggested without a reason in the data.
export const buildNextActions = ({ today, submissions = [], plans = [], growth = {}, songs = [], lastInsightsImport = null }) => {
  const actions = [];
  const push = (priority, action) => actions.push({ priority, ...action });

  for (const submission of submissions.filter((entry) => entry.status === "changes_requested")) {
    push(100, {
      key: `fix:${submission.id}`,
      title: `Fix and resubmit “${submission.track_title}”`,
      detail: submission.artist_message ? `The label asked: ${submission.artist_message}` : "The label asked for changes before approving.",
      href: `/submit?edit=${submission.id}`,
      cta: "Fix now",
    });
  }

  for (const plan of plans) {
    const readiness = planReadiness(plan, today);
    const { overdue } = readiness;
    if (overdue.length && (readiness.daysToRelease === null || readiness.daysToRelease >= -14)) {
      const first = [...overdue].sort((a, b) => a.due.localeCompare(b.due))[0];
      push(90, {
        key: `overdue:${plan.id}`,
        title: `Overdue for “${plan.title}”: ${first.title}`,
        detail: overdue.length > 1 ? `${overdue.length} tasks are overdue for this release.` : "This task's due date has passed.",
        href: `/dashboard?plan=${plan.id}`,
        cta: "Open plan",
      });
    }

    if (readiness.daysToRelease !== null && readiness.daysToRelease >= 0 && readiness.daysToRelease <= 28 && !plan.submission_id) {
      push(85, {
        key: `submit:${plan.id}`,
        title: `Submit “${plan.title}” for review`,
        detail: `It releases in ${readiness.daysToRelease} day${readiness.daysToRelease === 1 ? "" : "s"} and isn't linked to a submission yet.`,
        href: "/submit",
        cta: "Submit",
      });
    }

    const soon = readiness.nextTasks.find((task) => daysUntil(today, task.due) <= 7);
    if (soon) {
      push(70 - daysUntil(today, soon.due), {
        key: `soon:${plan.id}:${soon.id}`,
        title: soon.title,
        detail: `Due ${daysUntil(today, soon.due) === 0 ? "today" : `in ${daysUntil(today, soon.due)} days`} for “${plan.title}”.`,
        href: `/dashboard?plan=${plan.id}`,
        cta: "Open plan",
      });
    }

    if (readiness.daysToRelease !== null && readiness.daysToRelease >= 0 && (plan.budget_items ?? []).length === 0) {
      push(40, {
        key: `budget:${plan.id}`,
        title: `Plan a budget for “${plan.title}”`,
        detail: "Even ₹0 is a plan. Knowing your costs shows how many streams it takes to break even.",
        href: `/dashboard?plan=${plan.id}`,
        cta: "Add costs",
      });
    }
  }

  const plannedSubmissionIds = new Set(plans.map((plan) => plan.submission_id).filter(Boolean));
  for (const submission of submissions.filter((entry) => ["approved", "sent_to_distributor"].includes(entry.status) && !plannedSubmissionIds.has(entry.id))) {
    push(60, {
      key: `plan:${submission.id}`,
      title: `Plan the release of “${submission.track_title}”`,
      detail: "It's approved. Set a budget and checklist so the release gets the push it deserves.",
      href: "/dashboard?tab=plans",
      cta: "Plan it",
    });
  }

  const thisMonth = today.slice(0, 7);
  if (growth.profile) {
    const logged = (growth.entries ?? []).some((entry) => entry.month.slice(0, 7) === thisMonth);
    if (!logged) {
      push(50, {
        key: "growth:log",
        title: "Log this month's numbers",
        detail: "Two minutes in the Growth tab keeps your trends and goal projections accurate.",
        href: "/dashboard?tab=growth",
        cta: "Log numbers",
      });
    }
  }

  for (const song of songs) {
    const idle = daysUntil(song.updated_at.slice(0, 10), today);
    if (["writing", "recording", "mixing"].includes(song.status) && idle >= STALE_SONG_DAYS) {
      push(30, {
        key: `song:${song.id}`,
        title: `Pick “${song.title}” back up`,
        detail: `It's been in ${song.status} for ${idle} days without changes.`,
        href: `/dashboard?tab=vault&song=${song.id}`,
        cta: "Open song",
      });
    }
  }

  if (lastInsightsImport && daysUntil(lastInsightsImport.slice(0, 10), today) >= STALE_INSIGHTS_DAYS) {
    push(20, {
      key: "insights:refresh",
      title: "Upload fresh Spotify for Artists CSVs",
      detail: `Your latest import is ${daysUntil(lastInsightsImport.slice(0, 10), today)} days old.`,
      href: "/dashboard?tab=insights",
      cta: "Upload",
    });
  }

  return actions.sort((a, b) => b.priority - a.priority).slice(0, 3);
};

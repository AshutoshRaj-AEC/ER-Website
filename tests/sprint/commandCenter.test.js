import { describe, expect, it } from "vitest";
import { buildNextActions, nextRelease, planReadiness, planTasks } from "../../lib/commandCenter.js";
import { fillTemplate, REVIEW_TEMPLATES } from "../../lib/reviewTemplates.js";

const TODAY = "2026-10-15";

const plan = (overrides = {}) => ({
  id: "p1",
  title: "Night Drive",
  release_date: "2026-11-01",
  submission_id: null,
  submission: null,
  budget_items: [{ planned_amount: 5000, actual_amount: 1000 }],
  checklist_completions: [],
  release_plan_tasks: [],
  ...overrides,
});

describe("plan tasks and readiness", () => {
  it("dates the fixed checklist from the release date without time-zone drift", () => {
    const tasks = planTasks(plan(), TODAY);
    expect(tasks.find((task) => task.id === "fixed:release_day").due).toBe("2026-11-01");
    expect(tasks.find((task) => task.id === "fixed:master_artwork").due).toBe("2026-09-27");
  });

  it("merges campaign tasks and computes progress, overdue and budget", () => {
    const readiness = planReadiness(
      plan({
        checklist_completions: [{ task_key: "master_artwork" }],
        release_plan_tasks: [
          { id: "t1", title: "Teaser Reel #1", due_date: "2026-10-20", done_at: null, source: "campaign" },
          { id: "t2", title: "Old task", due_date: "2026-10-10", done_at: null, source: "custom" },
        ],
      }),
      TODAY
    );
    expect(readiness.tasksTotal).toBe(12);
    expect(readiness.tasksDone).toBe(1);
    expect(readiness.daysToRelease).toBe(17);
    expect(readiness.overdue.map((task) => task.title)).toContain("Old task");
    expect(readiness.nextTasks[0].due >= TODAY).toBe(true);
    expect(readiness.budgetPlanned).toBe(5000);
  });

  it("picks the soonest upcoming release", () => {
    const plans = [plan({ id: "a", release_date: "2026-12-01" }), plan({ id: "b", release_date: "2026-10-01" }), plan({ id: "c", release_date: "2026-11-01" })];
    expect(nextRelease(plans, TODAY).id).toBe("c");
  });
});

describe("buildNextActions", () => {
  it("puts label corrections first", () => {
    const actions = buildNextActions({
      today: TODAY,
      submissions: [{ id: "s1", track_title: "Night Drive", status: "changes_requested", artist_message: "Fix the cover" }],
      plans: [plan()],
    });
    expect(actions[0]).toMatchObject({ key: "fix:s1", href: "/submit?edit=s1" });
    expect(actions[0].detail).toMatch(/Fix the cover/);
  });

  it("returns at most three actions, all based on real data", () => {
    const actions = buildNextActions({
      today: TODAY,
      submissions: [
        { id: "s1", track_title: "A", status: "changes_requested" },
        { id: "s2", track_title: "B", status: "approved" },
      ],
      plans: [plan({ release_plan_tasks: [{ id: "t", title: "Overdue thing", due_date: "2026-10-01", done_at: null, source: "custom" }] })],
      growth: { profile: { user_id: "u" }, entries: [] },
    });
    expect(actions).toHaveLength(3);
    expect(actions.map((action) => action.key)).toEqual(["fix:s1", "overdue:p1", "submit:p1"]);
  });

  it("doesn't nag about label steps the submit nudge already covers", () => {
    const actions = buildNextActions({ today: TODAY, plans: [plan({ release_date: "2026-10-30" })] });
    expect(actions.some((action) => /Submit the release to EklautA/.test(action.title))).toBe(false);
    expect(actions.find((action) => action.key === "overdue:p1").title).toMatch(/Finish the master/);
  });

  it("suggests nothing when there's nothing to do", () => {
    expect(buildNextActions({ today: TODAY })).toEqual([]);
  });

  it("only nudges to log growth when the tracker is set up and this month is missing", () => {
    expect(buildNextActions({ today: TODAY, growth: { profile: {}, entries: [{ month: "2026-10-01" }] } })).toEqual([]);
    expect(buildNextActions({ today: TODAY, growth: { profile: {}, entries: [] } })[0].key).toBe("growth:log");
    expect(buildNextActions({ today: TODAY, growth: { profile: null } })).toEqual([]);
  });

  it("notices idle songs and stale Insights data", () => {
    const actions = buildNextActions({
      today: TODAY,
      songs: [
        { id: "x", title: "Stuck", status: "mixing", updated_at: "2026-09-01T10:00:00Z" },
        { id: "y", title: "Fresh", status: "mixing", updated_at: "2026-10-14T10:00:00Z" },
        { id: "z", title: "Done", status: "mastered", updated_at: "2026-01-01T10:00:00Z" },
      ],
      lastInsightsImport: "2026-08-01T10:00:00Z",
    });
    expect(actions.map((action) => action.key)).toEqual(["song:x", "insights:refresh"]);
  });
});

describe("review templates", () => {
  it("fills the artist and title", () => {
    const template = REVIEW_TEMPLATES.find((entry) => entry.key === "changes_artwork");
    expect(fillTemplate(template, { artist_name: "Naam Namah", track_title: "Night Drive" })).toMatch(/^Hi Naam Namah, the cover for “Night Drive”/);
  });

  it("only uses statuses the database knows", () => {
    const statuses = new Set(["changes_requested", "approved", "rejected", "sent_to_distributor"]);
    expect(REVIEW_TEMPLATES.every((template) => statuses.has(template.status))).toBe(true);
  });
});

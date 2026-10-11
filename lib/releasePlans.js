export const BUDGET_CATEGORIES = [
  { value: "production", label: "Production & beats" },
  { value: "mixing_mastering", label: "Mixing & mastering" },
  { value: "artwork", label: "Artwork & poster" },
  { value: "music_video", label: "Music video" },
  { value: "advertising", label: "Ads & promotion" },
  { value: "pr_playlists", label: "PR & playlist pitching" },
  { value: "distribution", label: "Distribution fees" },
  { value: "other", label: "Other" },
];

export const CURRENCIES = ["INR", "USD", "EUR", "GBP"];

// daysFromRelease is negative for tasks before release day. `auto` marks a
// task done from the linked submission's status.
export const CHECKLIST_TASKS = [
  {
    key: "master_artwork",
    label: "Finish the master and cover artwork",
    daysFromRelease: -35,
  },
  {
    key: "submit_label",
    label: "Submit the release to EklautA Records",
    daysFromRelease: -28,
    auto: (submission) => Boolean(submission),
  },
  {
    key: "label_approved",
    label: "Label approves the release",
    daysFromRelease: -24,
    auto: (submission) =>
      ["approved", "sent_to_distributor"].includes(submission?.status),
  },
  {
    key: "sent_distributor",
    label: "Release sent to the distributor",
    daysFromRelease: -21,
    auto: (submission) => submission?.status === "sent_to_distributor",
  },
  {
    key: "pitch_spotify",
    label: "Pitch the track to Spotify editorial in Spotify for Artists",
    hint: "Spotify needs at least 7 days before release. Earlier is better.",
    daysFromRelease: -14,
  },
  {
    key: "presave",
    label: "Set up a pre-save link and share it",
    daysFromRelease: -14,
  },
  {
    key: "content_plan",
    label: "Plan release content: reels, shorts and posts",
    daysFromRelease: -10,
  },
  {
    key: "teasers",
    label: "Post teasers and announce the date",
    daysFromRelease: -7,
  },
  {
    key: "release_day",
    label: "Release day: share the links everywhere",
    daysFromRelease: 0,
  },
  {
    key: "week_one",
    label: "Review week-one numbers against your budget",
    daysFromRelease: 7,
  },
];

// Columns needed to show a plan in a list with its totals and progress.
export const PLAN_LIST_SELECT =
  "id, title, artist_name, release_date, currency, created_at, submission:submissions(status, track_title), budget_items(planned_amount, actual_amount), checklist_completions(task_key)";

export const formatMoney = (amount, currency) =>
  new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

export const formatNumber = (value) =>
  new Intl.NumberFormat("en-IN").format(Math.round(value));

export const sumBudget = (items = []) =>
  items.reduce(
    (totals, item) => ({
      planned: totals.planned + (Number(item.planned_amount) || 0),
      actual: totals.actual + (Number(item.actual_amount) || 0),
    }),
    { planned: 0, actual: 0 }
  );

// What the artist keeps per stream, after their distributor/label share.
export const earningsPerStream = (payoutPer1000, sharePercent) =>
  ((Number(payoutPer1000) || 0) / 1000) * ((Number(sharePercent) || 0) / 100);

export const streamsToBreakEven = (amount, perStream) =>
  perStream > 0 ? Math.ceil(amount / perStream) : null;

export const isTaskDone = (task, completedKeys, submission) =>
  completedKeys.has(task.key) || Boolean(task.auto?.(submission));

export const countDoneTasks = (completions = [], submission) => {
  const completedKeys = new Set(completions.map((entry) => entry.task_key));
  return CHECKLIST_TASKS.filter((task) =>
    isTaskDone(task, completedKeys, submission)
  ).length;
};

// Date-only strings ("2026-11-01") are parsed as local dates, not UTC.
export const parseDate = (value) => (value ? new Date(`${value}T00:00:00`) : null);

export const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const formatDate = (date) =>
  date
    ? date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

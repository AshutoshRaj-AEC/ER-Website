# Artist workflow: command center, readiness, campaigns, admin review

Developer notes for the October 2026 product sprint. Everything here builds on
existing tables (submissions, release plans, growth, Song Vault, Insights); no
new analytics store or task manager was added.

## Command center (`/dashboard`, Home tab)

`components/ArtistHome.jsx` reads the artist's own rows through RLS and hands
them to `lib/commandCenter.js`.

- `planTasks(plan, today)` merges the fixed release checklist (dated from the
  release date) with the plan's `release_plan_tasks`. Checklist steps the label
  does (`auto` tasks) are flagged `labelStep` and never count as overdue or as
  deadlines for the artist.
- `buildNextActions(...)` returns at most three actions, highest priority first:

| Priority | Trigger |
| --- | --- |
| 100 | A submission has `changes_requested` |
| 90 | A plan has overdue tasks |
| 85 | Release within 28 days with no linked submission |
| 70 − days | A task is due within 7 days |
| 60 | Approved release without a plan |
| 50 | Growth tracker set up but this month isn't logged |
| 40 | Upcoming plan with no budget |
| 30 | Song idle 14+ days in writing / recording / mixing |
| 20 | Insights data 30+ days old |

Dates are ISO strings; use the UTC-safe `addDays` from `lib/insights/analytics.js`.

## Release readiness (`/submit`)

`lib/readiness.js` → `checkReadiness({ form, audio, poster, rightsConfirmed, today })`.
Checks come in three levels:

- **Required** (block submitting): artist, title, genre, email, songwriters,
  explicit yes/no, audio spec, square cover ≥ 1400 px, rights confirmation.
- **Conditional** (only when relevant): release date not in the past (warns
  under 21 days), ISRC / UPC format and check digit *if the artist entered
  one*, featured artist in the title, lyrics for explicit tracks, language.
- **Recommended** (warnings only): title style, mono audio, very short audio,
  cover under 3000 px, producer credits.

Audio specs come from `lib/audioInfo.js`, which parses only the WAV/FLAC
header in the browser. The checker never fills in or rewrites metadata, never
generates identifiers and says plainly that passing it doesn't guarantee
distributor acceptance.

## Changes requested → resubmit

- Status `changes_requested` (migration `20261012210800`). The admin must
  write a message; the artist gets an email (`notify-artist`).
- The artist opens `/submit?edit=<id>`, fixes fields or replaces files, and
  resubmits. The policy "Artists resubmit after changes are requested" only
  allows `changes_requested → pending` with files in the artist's own folder.
  The trigger `guard_submission_update` blocks changes to label-owned fields,
  resets `submitted_at` and re-arms both emails (`notify-submission` sends a
  "Resubmitted" email).
- Replaced files are deleted by the artist only when no submission references
  them.

## Campaign generator

`lib/campaign.js` → `generateCampaign({ releaseDate, title, artistName, settings })`
builds dated tasks from fixed templates: channels (Instagram, YouTube, WhatsApp,
outreach), caption ideas in English, Hindi and Hinglish, budget level
(organic / small / larger, suggested from the plan's marketing budget) and
genre ideas. No AI service is called. The artist ticks which ideas to add; they
become ordinary `release_plan_tasks` (source `campaign`), max 150 per plan.

## Admin review (`/admin`)

- Filters by status plus "Follow-up due"; sort by waiting time, newest or
  release date. Badges show waiting days (amber > 3, red > 7) and days with the
  artist.
- Review message templates: `lib/reviewTemplates.js`.
- `submission_tracking` (admin only): distributor, reference, sent date,
  follow-up date. Distribution itself stays manual.
- `submission_events`: audit history written by triggers. Artists only see
  submitted / resubmitted / status changes on their own releases.

## Storage clean-up

`admin_cleanup_candidates()` lists (admin only) files of sent or rejected
releases and orphaned files older than 24 hours that no submission
references. The admin previews the exact files and confirms before anything
is deleted; nothing runs automatically.

## Tests

`tests/sprint/*.test.js` (Vitest). Database rules were checked with rolled-back
SQL test blocks against the live project.

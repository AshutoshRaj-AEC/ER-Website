# EklautA Insights (Spotify for Artists CSV analytics)

Signed-in artists upload CSV reports exported from Spotify for Artists and see
charts, rankings and comparisons at `/dashboard?tab=insights`. Everything comes
from imported files; nothing is fetched from Spotify, and the UI says so.

## Supported reports

Reports are detected from their **columns**, never the file name. Header
matching ignores case, spacing and punctuation, and each field accepts several
header names (see `ALIASES` in `lib/insights/reportTypes.js`).

| Report | Where in Spotify for Artists | Required | Optional | Stored as |
|---|---|---|---|---|
| Audience timeline | Audience → Timeline → Download | `date` + one of streams / listeners / followers | country | daily, artist-wide |
| Song timeline | Music → a song → Download | `date` + one of streams / listeners / saves / playlist adds | song (else the artist names the song), country | daily, per song |
| Songs report | Music → Songs → Download | `song` (or `title`) + a metric | release date, saves, playlist adds, country | per period |
| Playlists report | Music → Playlists → Download | playlist (`title`) + streams or listeners + curator/author or date added | song | per period |
| Countries report | Audience → Location → Download | `country` + listeners / streams / followers | | per period |

Recognised but unsupported columns (views, skips, city, age…) are listed in the
preview and ignored. Unknown columns are listed too.

When columns fit more than one report (a timeline without followers or a song
column could be either timeline), the preview asks the artist to choose.

Summary reports contain no dates, so the artist picks the period they exported
(Last 24 hours / 7 days / 28 days / 12 months / All time / custom) and its last
day. All-time periods are stored with `period_start = '-infinity'`.

## Parsing and validation (`lib/insights/csv.js`, `values.js`)

- RFC 4180: quoted fields, embedded commas/newlines, `""` escapes, BOM, CRLF,
  comma/semicolon/tab delimiters, UTF-8 (and UTF-16 with a BOM).
- Limits: 5 MB per file (also enforced by the storage bucket), 50,000 data rows
  (also enforced by `insights_commit_import`).
- Rows with the wrong number of values are skipped and reported by line.
- Counts accept `12,345`, `12 345`, `1.234.567`. Empty, `-`, `n/a` mean
  **missing** (stored as NULL, shown as "—"), never zero. Negative, fractional
  or non-numeric counts are flagged and left empty.
- Dates: ISO (`2026-10-01`, optional time; times are dropped with a warning),
  `d/m/Y` or `m/d/Y` (order detected from the whole column; ambiguous files ask
  the artist), `1 Oct 2026`, `Oct 1, 2026`. Impossible dates are rejected.
- CSV contents are only ever treated as text. Exports prefix values starting
  with `= + - @` with `'` so spreadsheets don't run them as formulas.

## Data model (`supabase/migrations/20261012193149_create_insights.sql`)

- `insights_imports`: one row per upload (type, status completed/failed, file
  name, size, SHA-256, private storage path, coverage, period, column mapping,
  issues, new/replaced/skipped counts).
- `insights_daily_metrics`: key `(user, scope, song_key, country, metric_date)`.
- `insights_period_metrics`: key `(user, report type, entity, country, period
  preset, period start, period end)`.
- Every metric row keeps `import_id` and `source_row` (line in the original
  file); the original CSV is kept in the private `insights-imports` bucket.
- All tables and files are owner-only via row-level security. Admins have no
  access.

### Deduplication rules

- One row per day (or per entity per exact period). Re-uploading the same
  day/period **replaces** values instead of adding them; the newer upload wins
  for the metrics it contains, and metrics it lacks keep their earlier values.
- Repeated keys inside one file: the last row wins (the preview warns).
- Different periods (e.g. a 7-day and a 28-day Songs report) are stored side by
  side and are **never summed**; each view uses exactly one period.
- Identical files are detected by SHA-256 and flagged before import.
- `insights_commit_import` runs as the caller (security invoker), so RLS checks
  every write, and the whole import is one transaction.
- Deleting an upload removes the rows it currently supplies. Days it had
  replaced don't come back unless the older file is re-uploaded.

## Analytics rules (`lib/insights/analytics.js`)

- Time filters count back from the **last date in the data**, not today.
- 24 hours: exports are daily, so the latest full day is shown, with a note.
- If data is shorter than the filter, all available days are shown with a note.
- Comparison with the previous equivalent period only when that period is fully
  covered; otherwise "Change unavailable" with the reason. A zero baseline is
  also unavailable.
- Streams, saves and playlist adds add up over days. Listeners don't (same
  person, many days): shown as average daily listeners and peak. Followers are a
  running total: latest value plus change in the period.
- Country: per-country rows are a dimension. With no country selected, worldwide
  rows are used; if a file only has per-country rows they're summed and marked
  approximate.
- Summary sections use the report whose period matches the filter; if none
  matches, the UI says so and offers the imported periods instead.

## Demo mode

`lib/insights/demoData.js` generates labelled sample data in the browser. It's
shown under a "Demo data" banner, never saved, and never mixed with real rows.

## Tests

```bash
npm test
```

Unit tests (`tests/insights/`) cover parsing, detection and mapping, malformed
input, date filtering, aggregation, overlaps within a file, country filtering
and CSV export.

Database authorization and deduplication are tested by
`supabase/tests/insights_security.sql` (run it in the Supabase SQL editor; it
rolls itself back and prints a report). It also checks that artists can still
submit tracks and admins can still review submissions.

## Known limitations

- Monthly listeners, demographics and hourly data aren't in these exports, so
  they aren't shown.
- Column names are based on Spotify's documented exports. If Spotify renames a
  column, add the new header to `ALIASES` (and a test).
- Summary report periods are entered by the artist because the files don't
  contain them.
- Playlists can only be linked to songs when the export has a song column.

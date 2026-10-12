-- EklautA Insights: Spotify for Artists CSV analytics. Owner-only; admins
-- have no access.

-- Import batches ------------------------------------------------------------

create table public.insights_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  report_type text not null check (report_type in (
    'audience_timeline', 'song_timeline', 'songs_summary', 'playlists_summary', 'countries_summary'
  )),
  status text not null check (status in ('completed', 'failed')),

  file_name text not null check (char_length(file_name) between 1 and 255),
  file_size_bytes integer not null check (file_size_bytes between 0 and 5242880),
  file_sha256 text check (file_sha256 ~ '^[0-9a-f]{64}$'),
  storage_path text check (char_length(storage_path) <= 500),

  row_count integer not null default 0 check (row_count >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  new_count integer not null default 0 check (new_count >= 0),
  replaced_count integer not null default 0 check (replaced_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),

  -- Timelines: first/last dated row. Summaries: the reporting period chosen
  -- by the artist (Spotify's summary exports don't contain dates).
  coverage_start date,
  coverage_end date,
  period_preset text check (period_preset in ('24h', '7d', '28d', '12m', 'all_time', 'custom')),
  song_name text check (char_length(song_name) <= 300),

  column_mapping jsonb not null default '{}'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  error_message text check (char_length(error_message) <= 2000)
);

create index insights_imports_user_id_idx on public.insights_imports (user_id, created_at desc);
create index insights_imports_sha_idx on public.insights_imports (user_id, file_sha256);

alter table public.insights_imports enable row level security;

create policy "Artists read their own imports"
  on public.insights_imports for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Artists create their own imports"
  on public.insights_imports for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Artists update their own imports"
  on public.insights_imports for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Artists delete their own imports"
  on public.insights_imports for delete to authenticated
  using (user_id = (select auth.uid()));

-- Dated observations (audience timeline, per-song timeline) -----------------
-- One row per artist/song/country/day: re-uploading a day replaces it.

create table public.insights_daily_metrics (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  import_id uuid not null references public.insights_imports (id) on delete cascade,
  scope text not null check (scope in ('artist', 'song')),
  song_key text not null default '' check (char_length(song_key) <= 300),
  song_name text check (char_length(song_name) <= 300),
  country text not null default '' check (char_length(country) <= 100),
  metric_date date not null,

  streams bigint check (streams >= 0),
  listeners bigint check (listeners >= 0),
  followers bigint check (followers >= 0),
  saves bigint check (saves >= 0),
  playlist_adds bigint check (playlist_adds >= 0),

  source_row integer check (source_row >= 1),
  primary key (user_id, scope, song_key, country, metric_date),
  check ((scope = 'artist') = (song_key = ''))
);

create index insights_daily_metrics_import_idx on public.insights_daily_metrics (import_id);

alter table public.insights_daily_metrics enable row level security;

create policy "Artists read their own daily metrics"
  on public.insights_daily_metrics for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Artists add their own daily metrics"
  on public.insights_daily_metrics for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.insights_imports i
      where i.id = import_id and i.user_id = (select auth.uid())
    )
  );

create policy "Artists update their own daily metrics"
  on public.insights_daily_metrics for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.insights_imports i
      where i.id = import_id and i.user_id = (select auth.uid())
    )
  );

create policy "Artists delete their own daily metrics"
  on public.insights_daily_metrics for delete to authenticated
  using (user_id = (select auth.uid()));

-- Reporting-period totals (songs, playlists, countries) ---------------------
-- One row per entity per exact period. Different periods are never summed.
-- All-time reports use period_start = '-infinity'.

create table public.insights_period_metrics (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  import_id uuid not null references public.insights_imports (id) on delete cascade,
  report_type text not null check (report_type in ('songs_summary', 'playlists_summary', 'countries_summary')),

  entity_key text not null check (char_length(entity_key) between 1 and 700),
  entity_name text not null check (char_length(entity_name) between 1 and 300),
  playlist_curator text check (char_length(playlist_curator) <= 300),
  song_name text check (char_length(song_name) <= 300),
  release_date date,
  added_date date,
  country text not null default '' check (char_length(country) <= 100),

  period_preset text not null check (period_preset in ('24h', '7d', '28d', '12m', 'all_time', 'custom')),
  period_start date not null,
  period_end date not null,

  streams bigint check (streams >= 0),
  listeners bigint check (listeners >= 0),
  saves bigint check (saves >= 0),
  playlist_adds bigint check (playlist_adds >= 0),
  followers bigint check (followers >= 0),

  source_row integer check (source_row >= 1),
  primary key (user_id, report_type, entity_key, country, period_preset, period_start, period_end),
  check (period_start <= period_end)
);

create index insights_period_metrics_import_idx on public.insights_period_metrics (import_id);

alter table public.insights_period_metrics enable row level security;

create policy "Artists read their own period metrics"
  on public.insights_period_metrics for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Artists add their own period metrics"
  on public.insights_period_metrics for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.insights_imports i
      where i.id = import_id and i.user_id = (select auth.uid())
    )
  );

create policy "Artists update their own period metrics"
  on public.insights_period_metrics for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.insights_imports i
      where i.id = import_id and i.user_id = (select auth.uid())
    )
  );

create policy "Artists delete their own period metrics"
  on public.insights_period_metrics for delete to authenticated
  using (user_id = (select auth.uid()));

-- Atomic import ---------------------------------------------------------------
-- Runs as the caller (security invoker), so every insert/update is checked by
-- the row-level security policies above. A newer upload replaces the values
-- it contains for the same day/period; metrics it doesn't contain are kept.

create or replace function public.insights_commit_import(
  p_import jsonb,
  p_daily jsonb default '[]'::jsonb,
  p_period jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_import_id uuid := (p_import->>'id')::uuid;
  v_daily_new integer := 0;
  v_daily_replaced integer := 0;
  v_period_new integer := 0;
  v_period_replaced integer := 0;
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in to import data' using errcode = '42501';
  end if;

  if jsonb_typeof(p_daily) <> 'array' or jsonb_typeof(p_period) <> 'array' then
    raise exception 'Invalid import payload' using errcode = '22023';
  end if;

  if jsonb_array_length(p_daily) + jsonb_array_length(p_period) > 50000 then
    raise exception 'Too many rows: imports are limited to 50,000 rows' using errcode = '22023';
  end if;

  insert into public.insights_imports (
    id, user_id, report_type, status, file_name, file_size_bytes, file_sha256, storage_path,
    row_count, skipped_count, coverage_start, coverage_end, period_preset, song_name,
    column_mapping, issues
  )
  values (
    v_import_id,
    auth.uid(),
    p_import->>'report_type',
    'completed',
    p_import->>'file_name',
    (p_import->>'file_size_bytes')::integer,
    p_import->>'file_sha256',
    p_import->>'storage_path',
    coalesce((p_import->>'row_count')::integer, 0),
    coalesce((p_import->>'skipped_count')::integer, 0),
    (p_import->>'coverage_start')::date,
    (p_import->>'coverage_end')::date,
    p_import->>'period_preset',
    p_import->>'song_name',
    coalesce(p_import->'column_mapping', '{}'::jsonb),
    coalesce(p_import->'issues', '[]'::jsonb)
  );

  with incoming as (
    -- If a file repeats a key, the last row wins.
    select distinct on (x.scope, coalesce(x.song_key, ''), coalesce(x.country, ''), x.metric_date) x.*
    from jsonb_to_recordset(p_daily) as x(
      scope text, song_key text, song_name text, country text, metric_date date,
      streams bigint, listeners bigint, followers bigint, saves bigint, playlist_adds bigint,
      source_row integer
    )
    order by x.scope, coalesce(x.song_key, ''), coalesce(x.country, ''), x.metric_date, x.source_row desc
  ),
  upserted as (
    insert into public.insights_daily_metrics as t (
      user_id, import_id, scope, song_key, song_name, country, metric_date,
      streams, listeners, followers, saves, playlist_adds, source_row
    )
    select
      auth.uid(), v_import_id, i.scope, coalesce(i.song_key, ''), i.song_name, coalesce(i.country, ''),
      i.metric_date, i.streams, i.listeners, i.followers, i.saves, i.playlist_adds, i.source_row
    from incoming i
    on conflict (user_id, scope, song_key, country, metric_date) do update set
      import_id = excluded.import_id,
      song_name = coalesce(excluded.song_name, t.song_name),
      streams = coalesce(excluded.streams, t.streams),
      listeners = coalesce(excluded.listeners, t.listeners),
      followers = coalesce(excluded.followers, t.followers),
      saves = coalesce(excluded.saves, t.saves),
      playlist_adds = coalesce(excluded.playlist_adds, t.playlist_adds),
      source_row = excluded.source_row
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted)
  into v_daily_new, v_daily_replaced
  from upserted;

  with incoming as (
    select distinct on (
      x.report_type, x.entity_key, coalesce(x.country, ''), x.period_preset, x.period_start, x.period_end
    ) x.*
    from jsonb_to_recordset(p_period) as x(
      report_type text, entity_key text, entity_name text, playlist_curator text, song_name text,
      release_date date, added_date date, country text, period_preset text, period_start date,
      period_end date, streams bigint, listeners bigint, saves bigint, playlist_adds bigint,
      followers bigint, source_row integer
    )
    order by x.report_type, x.entity_key, coalesce(x.country, ''), x.period_preset, x.period_start,
      x.period_end, x.source_row desc
  ),
  upserted as (
    insert into public.insights_period_metrics as t (
      user_id, import_id, report_type, entity_key, entity_name, playlist_curator, song_name,
      release_date, added_date, country, period_preset, period_start, period_end,
      streams, listeners, saves, playlist_adds, followers, source_row
    )
    select
      auth.uid(), v_import_id, i.report_type, i.entity_key, i.entity_name, i.playlist_curator,
      i.song_name, i.release_date, i.added_date, coalesce(i.country, ''), i.period_preset,
      i.period_start, i.period_end, i.streams, i.listeners, i.saves, i.playlist_adds, i.followers,
      i.source_row
    from incoming i
    on conflict (user_id, report_type, entity_key, country, period_preset, period_start, period_end)
    do update set
      import_id = excluded.import_id,
      entity_name = excluded.entity_name,
      playlist_curator = coalesce(excluded.playlist_curator, t.playlist_curator),
      song_name = coalesce(excluded.song_name, t.song_name),
      release_date = coalesce(excluded.release_date, t.release_date),
      added_date = coalesce(excluded.added_date, t.added_date),
      streams = coalesce(excluded.streams, t.streams),
      listeners = coalesce(excluded.listeners, t.listeners),
      saves = coalesce(excluded.saves, t.saves),
      playlist_adds = coalesce(excluded.playlist_adds, t.playlist_adds),
      followers = coalesce(excluded.followers, t.followers),
      source_row = excluded.source_row
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted)
  into v_period_new, v_period_replaced
  from upserted;

  update public.insights_imports
  set
    new_count = v_daily_new + v_period_new,
    replaced_count = v_daily_replaced + v_period_replaced,
    imported_count = v_daily_new + v_period_new + v_daily_replaced + v_period_replaced
  where id = v_import_id;

  return jsonb_build_object(
    'import_id', v_import_id,
    'new_count', v_daily_new + v_period_new,
    'replaced_count', v_daily_replaced + v_period_replaced
  );
end;
$$;

revoke execute on function public.insights_commit_import(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.insights_commit_import(jsonb, jsonb, jsonb) to authenticated;

-- Original CSV files (private provenance) -----------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('insights-imports', 'insights-imports', false, 5242880, array['text/csv']);

create policy "Artists upload their own insight files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'insights-imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Artists read their own insight files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'insights-imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Artists delete their own insight files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'insights-imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

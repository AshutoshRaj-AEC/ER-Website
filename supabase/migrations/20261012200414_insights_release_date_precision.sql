-- Spotify exports some release dates as a year ("2023") or year-month only.
-- Store them as the first day of that year/month plus how precise they are,
-- so the UI can show "2023" instead of inventing 1 January.

alter table public.insights_period_metrics
  add column release_precision text check (release_precision in ('day', 'month', 'year'));

update public.insights_period_metrics
set release_precision = 'day'
where release_date is not null and release_precision is null;

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
      release_date date, release_precision text, added_date date, country text, period_preset text,
      period_start date, period_end date, streams bigint, listeners bigint, saves bigint,
      playlist_adds bigint, followers bigint, source_row integer
    )
    order by x.report_type, x.entity_key, coalesce(x.country, ''), x.period_preset, x.period_start,
      x.period_end, x.source_row desc
  ),
  upserted as (
    insert into public.insights_period_metrics as t (
      user_id, import_id, report_type, entity_key, entity_name, playlist_curator, song_name,
      release_date, release_precision, added_date, country, period_preset, period_start, period_end,
      streams, listeners, saves, playlist_adds, followers, source_row
    )
    select
      auth.uid(), v_import_id, i.report_type, i.entity_key, i.entity_name, i.playlist_curator,
      i.song_name, i.release_date,
      case when i.release_date is null then null else coalesce(i.release_precision, 'day') end,
      i.added_date, coalesce(i.country, ''), i.period_preset,
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
      release_precision = case
        when excluded.release_date is not null then excluded.release_precision
        else t.release_precision
      end,
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

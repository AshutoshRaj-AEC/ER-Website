-- Backend authorization and deduplication checks for EklautA Insights, plus
-- regression checks for the existing submission workflow.
--
-- Run against the project database (e.g. in the Supabase SQL editor). It
-- creates throwaway users and data, then raises an exception at the end so
-- everything is rolled back. The exception message is the test report; every
-- line should read as expected.

do $test$
declare
  a1 constant uuid := '11111111-1111-1111-1111-111111111111';
  a2 constant uuid := '22222222-2222-2222-2222-222222222222';
  adm constant uuid := '33333333-3333-3333-3333-333333333333';
  imp1 constant uuid := 'c1111111-1111-4111-8111-111111111111';
  imp2 constant uuid := 'c2222222-2222-4222-8222-222222222222';
  imp3 constant uuid := 'c3333333-3333-4333-8333-333333333333';
  sub1 constant uuid := 'd1111111-1111-4111-8111-111111111111';
  res jsonb;
  out text := '';
  n bigint;
  ok boolean;
begin
  insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at) values
    ('00000000-0000-0000-0000-000000000000', a1, 'authenticated', 'authenticated', 'artist1@test.local', now()),
    ('00000000-0000-0000-0000-000000000000', a2, 'authenticated', 'authenticated', 'artist2@test.local', now()),
    ('00000000-0000-0000-0000-000000000000', adm, 'authenticated', 'authenticated', 'admin-test@test.local', now());
  insert into public.admins (email) values ('admin-test@test.local');

  -- Keep the test from calling the email functions.
  alter table public.submissions disable trigger submissions_notify_new;
  alter table public.submissions disable trigger submissions_notify_artist;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true);

  -- Insights: first import, with a duplicate row for 3 Oct (last row wins).
  res := public.insights_commit_import(
    jsonb_build_object('id', imp1, 'report_type', 'audience_timeline', 'file_name', 'a.csv', 'file_size_bytes', 100, 'row_count', 4),
    '[{"scope":"artist","metric_date":"2026-10-01","streams":100,"listeners":40,"followers":500,"source_row":2},
      {"scope":"artist","metric_date":"2026-10-02","streams":120,"listeners":45,"followers":505,"source_row":3},
      {"scope":"artist","metric_date":"2026-10-03","streams":1,"listeners":1,"followers":1,"source_row":4},
      {"scope":"artist","metric_date":"2026-10-03","streams":130,"listeners":50,"followers":510,"source_row":5}]'::jsonb);
  out := out || E'\n[insights] first import new=' || (res->>'new_count') || ' replaced=' || (res->>'replaced_count') || ' (expect 3/0)';
  select streams into n from public.insights_daily_metrics where metric_date = '2026-10-03';
  out := out || E'\n[insights] duplicate row in one file, last wins: ' || n || ' (expect 130)';

  -- Overlapping second import revises 2 Oct and has no followers column.
  res := public.insights_commit_import(
    jsonb_build_object('id', imp2, 'report_type', 'audience_timeline', 'file_name', 'b.csv', 'file_size_bytes', 100, 'row_count', 3),
    '[{"scope":"artist","metric_date":"2026-10-02","streams":125,"listeners":46,"source_row":2},
      {"scope":"artist","metric_date":"2026-10-03","streams":130,"listeners":50,"source_row":3},
      {"scope":"artist","metric_date":"2026-10-04","streams":140,"listeners":52,"source_row":4}]'::jsonb);
  out := out || E'\n[insights] overlapping import new=' || (res->>'new_count') || ' replaced=' || (res->>'replaced_count') || ' (expect 1/2)';
  select sum(streams) into n from public.insights_daily_metrics where scope = 'artist';
  out := out || E'\n[insights] total streams after overlap: ' || n || ' (expect 495, no double count)';
  select followers into n from public.insights_daily_metrics where metric_date = '2026-10-02';
  out := out || E'\n[insights] metric absent from newer file is kept: ' || n || ' (expect 505)';

  res := public.insights_commit_import(
    jsonb_build_object('id', imp3, 'report_type', 'songs_summary', 'file_name', 's.csv', 'file_size_bytes', 100, 'row_count', 2, 'period_preset', '28d'),
    '[]'::jsonb,
    '[{"report_type":"songs_summary","entity_key":"night drive","entity_name":"Night Drive","period_preset":"28d","period_start":"2026-09-07","period_end":"2026-10-04","streams":900,"source_row":2},
      {"report_type":"songs_summary","entity_key":"night drive","entity_name":"Night Drive","period_preset":"7d","period_start":"2026-09-28","period_end":"2026-10-04","streams":300,"source_row":3}]'::jsonb);
  select count(*) into n from public.insights_period_metrics;
  out := out || E'\n[insights] different periods stored separately: ' || n || ' (expect 2)';

  -- Submissions regression: artist can still submit.
  begin
    insert into public.submissions (id, artist_name, track_title, genre, contact_email, audio_path, poster_path)
    values (sub1, 'A', 'T', 'G', 'a@b.c', a1 || '/' || sub1 || '/a.wav', a1 || '/' || sub1 || '/p.png');
    out := out || E'\n[submissions] artist submits own track: allowed';
  exception when others then out := out || E'\n[submissions] artist submits own track: BLOCKED (bad) ' || sqlerrm; end;

  -- Artist 2: complete isolation.
  perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role', 'authenticated')::text, true);
  select (select count(*) from public.insights_imports)
       + (select count(*) from public.insights_daily_metrics)
       + (select count(*) from public.insights_period_metrics) into n;
  out := out || E'\n[insights] other artist sees rows: ' || n || ' (expect 0)';
  begin
    insert into public.insights_daily_metrics (import_id, scope, metric_date, streams) values (imp1, 'artist', '2026-10-05', 999);
    out := out || E'\n[insights] other artist writes into artist1 import: ALLOWED (bad)';
  exception when others then out := out || E'\n[insights] other artist writes into artist1 import: blocked'; end;
  update public.insights_daily_metrics set streams = 0;
  get diagnostics n = row_count;
  out := out || E'\n[insights] other artist edits artist1 metrics: rows=' || n || ' (expect 0)';
  delete from public.insights_imports;
  get diagnostics n = row_count;
  out := out || E'\n[insights] other artist deletes artist1 imports: rows=' || n || ' (expect 0)';
  begin
    perform public.insights_commit_import(
      jsonb_build_object('id', imp1, 'report_type', 'audience_timeline', 'file_name', 'x.csv', 'file_size_bytes', 1),
      '[]'::jsonb);
    out := out || E'\n[insights] other artist reuses artist1 import id: ALLOWED (bad)';
  exception when others then out := out || E'\n[insights] other artist reuses artist1 import id: blocked'; end;
  select count(*) into n from public.submissions where id = sub1;
  out := out || E'\n[submissions] other artist sees artist1 submission: ' || n || ' (expect 0)';
  select count(*) into n from storage.objects where bucket_id = 'insights-imports';
  out := out || E'\n[insights] other artist sees stored CSV files: ' || n || ' (expect 0)';

  -- Admin: no access to insights, but still reviews submissions.
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  select (select count(*) from public.insights_imports) + (select count(*) from public.insights_daily_metrics) into n;
  out := out || E'\n[insights] admin sees rows: ' || n || ' (expect 0)';
  select public.is_admin() into ok;
  select count(*) into n from public.submissions where id = sub1;
  out := out || E'\n[submissions] admin is_admin=' || ok || ', sees artist submission: ' || n || ' (expect true, 1)';

  -- No user.
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  begin
    perform public.insights_commit_import(jsonb_build_object('id', gen_random_uuid(), 'report_type', 'audience_timeline', 'file_name', 'x.csv', 'file_size_bytes', 1));
    out := out || E'\n[insights] commit without a signed-in user: ALLOWED (bad)';
  exception when others then out := out || E'\n[insights] commit without a signed-in user: blocked'; end;

  -- Deleting an import removes exactly the data it currently supplies.
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true);
  delete from public.insights_imports where id = imp2;
  select count(*) into n from public.insights_daily_metrics;
  out := out || E'\n[insights] days left after deleting the overlapping import: ' || n || ' (expect 1)';

  raise exception 'TEST RESULTS (rolled back):%', out;
end
$test$;

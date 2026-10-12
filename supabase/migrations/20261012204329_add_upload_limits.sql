-- Per-artist upload limits, so one account can't fill the shared 1 GB of
-- storage or flood the label with submissions. Enforced in the database, so
-- they apply however the API is called.

create or replace function public.upload_limits()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'max_pending_submissions', 3,
    'max_submissions_per_day', 5,
    'bytes', jsonb_build_object(
      'submissions', 300 * 1024 * 1024,
      'song-vault', 200 * 1024 * 1024,
      'insights-imports', 50 * 1024 * 1024
    )
  );
$$;

-- Bytes the signed-in artist already stores in a bucket. Security definer so
-- it can total sizes; it only ever counts the caller's own folder.
create or replace function public.storage_bytes_used(p_bucket text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
  from storage.objects o
  where o.bucket_id = p_bucket
    and (storage.foldername(o.name))[1] = auth.uid()::text;
$$;

revoke execute on function public.storage_bytes_used(text) from public, anon;
grant execute on function public.storage_bytes_used(text) to authenticated;

-- Restrictive: applies on top of each bucket's own upload policy.
create policy "Per-artist storage limits"
  on storage.objects as restrictive for insert to authenticated
  with check (
    bucket_id not in ('submissions', 'song-vault', 'insights-imports')
    or public.storage_bytes_used(bucket_id)
       < (public.upload_limits()->'bytes'->>bucket_id)::bigint
  );

-- Submission count limits.
create or replace function public.enforce_submission_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limits jsonb := public.upload_limits();
begin
  if (
    select count(*) from public.submissions
    where user_id = new.user_id and status = 'pending'
  ) >= (v_limits->>'max_pending_submissions')::integer then
    raise exception 'You already have % submissions waiting for review. Please wait for the label to review them before sending more.',
      v_limits->>'max_pending_submissions'
      using errcode = 'P0001', hint = 'submission_limit';
  end if;

  if (
    select count(*) from public.submissions
    where user_id = new.user_id and created_at > now() - interval '24 hours'
  ) >= (v_limits->>'max_submissions_per_day')::integer then
    raise exception 'You can submit up to % tracks a day. Please try again tomorrow.',
      v_limits->>'max_submissions_per_day'
      using errcode = 'P0001', hint = 'submission_limit';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_submission_limits() from public, anon, authenticated;

create trigger submissions_enforce_limits
  before insert on public.submissions
  for each row execute function public.enforce_submission_limits();

-- What the signed-in artist has used, so the site can warn before uploading.
create or replace function public.my_upload_usage()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'pending_submissions', (
      select count(*) from public.submissions where user_id = auth.uid() and status = 'pending'
    ),
    'submissions_today', (
      select count(*) from public.submissions
      where user_id = auth.uid() and created_at > now() - interval '24 hours'
    ),
    'bytes', jsonb_build_object(
      'submissions', public.storage_bytes_used('submissions'),
      'song-vault', public.storage_bytes_used('song-vault'),
      'insights-imports', public.storage_bytes_used('insights-imports')
    ),
    'limits', public.upload_limits()
  );
$$;

revoke execute on function public.my_upload_usage() from public, anon;
grant execute on function public.my_upload_usage() to authenticated;

-- Admins can also free the space used by rejected releases.
drop policy "Admins delete files of distributed submissions" on storage.objects;

create policy "Admins delete files of distributed or rejected submissions"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'submissions'
    and (select public.is_admin())
    and exists (
      select 1 from public.submissions s
      where s.status in ('sent_to_distributor', 'rejected')
        and storage.objects.name in (s.audio_path, s.poster_path)
    )
  );

-- Tidy-up: helper functions used only inside policies and triggers don't
-- need to be callable by logged-out visitors.
revoke execute on function public.owns_song(uuid) from public, anon;
revoke execute on function public.touch_song() from public, anon, authenticated;
revoke execute on function public.record_song_status() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

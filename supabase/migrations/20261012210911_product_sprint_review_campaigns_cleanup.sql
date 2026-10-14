-- ===========================================================================
-- 1. Waiting time: when the artist last (re)submitted.
-- ===========================================================================
alter table public.submissions add column submitted_at timestamptz not null default now();
update public.submissions set submitted_at = created_at;

-- ===========================================================================
-- 2. Distribution tracking (admin-only).
-- ===========================================================================
create table public.submission_tracking (
  submission_id uuid primary key references public.submissions (id) on delete cascade,
  distributor text check (char_length(distributor) <= 120),
  distribution_reference text check (char_length(distribution_reference) <= 200),
  sent_on date,
  follow_up_on date,
  updated_at timestamptz not null default now()
);

alter table public.submission_tracking enable row level security;

create policy "Admins read submission tracking" on public.submission_tracking
  for select to authenticated using ((select public.is_admin()));
create policy "Admins add submission tracking" on public.submission_tracking
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins update submission tracking" on public.submission_tracking
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete submission tracking" on public.submission_tracking
  for delete to authenticated using ((select public.is_admin()));

create trigger submission_tracking_set_updated_at
  before update on public.submission_tracking
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 3. Audit history, written only by triggers.
-- ===========================================================================
create table public.submission_events (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  actor_id uuid,
  actor_role text not null check (actor_role in ('artist', 'admin', 'system')),
  event text not null check (event in (
    'submitted', 'resubmitted', 'status_changed', 'message_updated', 'files_removed', 'tracking_updated'
  )),
  from_status public.submission_status,
  to_status public.submission_status,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index submission_events_submission_idx on public.submission_events (submission_id, created_at);

alter table public.submission_events enable row level security;

-- Admins see everything; artists see the status history of their own
-- submissions (not admin-only tracking changes).
create policy "Admins read all submission events, artists read their own status history"
  on public.submission_events for select to authenticated
  using (
    (select public.is_admin())
    or (
      event in ('submitted', 'resubmitted', 'status_changed')
      and exists (
        select 1 from public.submissions s
        where s.id = submission_id and s.user_id = (select auth.uid())
      )
    )
  );

create or replace function public.current_actor_role(p_owner uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then 'system'
    when public.is_admin() then 'admin'
    when auth.uid() = p_owner then 'artist'
    else 'system'
  end;
$$;

revoke execute on function public.current_actor_role(uuid) from public, anon, authenticated;

create or replace function public.log_submission_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_actor_role(new.user_id);
begin
  if tg_op = 'INSERT' then
    insert into public.submission_events (submission_id, actor_id, actor_role, event, to_status)
    values (new.id, auth.uid(), v_role, 'submitted', new.status);
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.submission_events (submission_id, actor_id, actor_role, event, from_status, to_status, details)
    values (
      new.id, auth.uid(), v_role,
      case when old.status = 'changes_requested' and new.status = 'pending' then 'resubmitted' else 'status_changed' end,
      old.status, new.status,
      case when new.artist_message is not null then jsonb_build_object('message', new.artist_message) else '{}'::jsonb end
    );
  elsif old.artist_message is distinct from new.artist_message then
    insert into public.submission_events (submission_id, actor_id, actor_role, event, details)
    values (new.id, auth.uid(), v_role, 'message_updated', jsonb_build_object('message', new.artist_message));
  end if;

  if old.files_removed_at is null and new.files_removed_at is not null then
    insert into public.submission_events (submission_id, actor_id, actor_role, event, details)
    values (new.id, auth.uid(), v_role, 'files_removed', jsonb_build_object('bytes', new.files_removed_bytes));
  end if;

  return new;
end;
$$;

revoke execute on function public.log_submission_event() from public, anon, authenticated;

create trigger submissions_log_events
  after insert or update on public.submissions
  for each row execute function public.log_submission_event();

create or replace function public.log_tracking_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.submission_events (submission_id, actor_id, actor_role, event, details)
  values (
    new.submission_id, auth.uid(), 'admin', 'tracking_updated',
    jsonb_strip_nulls(jsonb_build_object(
      'distributor', new.distributor,
      'reference', new.distribution_reference,
      'sent_on', new.sent_on,
      'follow_up_on', new.follow_up_on
    ))
  );
  return new;
end;
$$;

revoke execute on function public.log_tracking_event() from public, anon, authenticated;

create trigger submission_tracking_log_events
  after insert or update on public.submission_tracking
  for each row execute function public.log_tracking_event();

-- ===========================================================================
-- 4. Artist corrections: edit and resubmit after "changes requested".
-- ===========================================================================
create policy "Artists resubmit after changes are requested"
  on public.submissions for update to authenticated
  using (user_id = (select auth.uid()) and status = 'changes_requested')
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and starts_with(audio_path, (select auth.uid())::text || '/' || id::text || '/')
    and starts_with(poster_path, (select auth.uid())::text || '/' || id::text || '/')
  );

-- Artists may only change release details and files; label-owned fields are
-- protected. A resubmission restarts the clock and re-arms both emails.
create or replace function public.guard_submission_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.created_at is distinct from old.created_at
    or new.artist_message is distinct from old.artist_message
    or new.notified_at is distinct from old.notified_at
    or new.artist_notified_status is distinct from old.artist_notified_status
    or new.artist_notified_at is distinct from old.artist_notified_at
    or new.files_removed_at is distinct from old.files_removed_at
    or new.files_removed_bytes is distinct from old.files_removed_bytes
    or new.submitted_at is distinct from old.submitted_at
  then
    raise exception 'You can only update your release details and files.' using errcode = '42501';
  end if;

  if old.status = 'changes_requested' and new.status = 'pending' then
    new.submitted_at := now();
    new.notified_at := null;
    new.artist_notified_status := null;
    new.artist_notified_at := null;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_submission_update() from public, anon, authenticated;

create trigger submissions_guard_update
  before update on public.submissions
  for each row execute function public.guard_submission_update();

-- Email the label when a corrected submission comes back.
create or replace function public.notify_resubmission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://ztzuefhbdqanfutcpjzz.supabase.co/functions/v1/notify-submission',
    body := jsonb_build_object('submission_id', new.id, 'resubmitted', true),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
end;
$$;

revoke execute on function public.notify_resubmission() from public, anon, authenticated;

create trigger submissions_notify_resubmitted
  after update of status on public.submissions
  for each row
  when (old.status = 'changes_requested' and new.status = 'pending')
  execute function public.notify_resubmission();

-- ===========================================================================
-- 5. Storage safety.
-- ===========================================================================
-- Artists can remove their own files that no submission uses (e.g. a file
-- replaced during a resubmission, or a half-finished upload).
create policy "Artists delete their own unused submission files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1 from public.submissions s
      where storage.objects.name in (s.audio_path, s.poster_path)
    )
  );

-- Admins can remove files no submission uses once they're a day old, so an
-- upload that's still in progress is never touched.
create policy "Admins delete orphaned submission files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'submissions'
    and (select public.is_admin())
    and created_at < now() - interval '24 hours'
    and not exists (
      select 1 from public.submissions s
      where storage.objects.name in (s.audio_path, s.poster_path)
    )
  );

-- Every file that could be cleaned up, with the reason, for the admin preview.
create or replace function public.admin_cleanup_candidates()
returns table (
  kind text,
  submission_id uuid,
  track_title text,
  artist_name text,
  status public.submission_status,
  file_name text,
  bytes bigint,
  uploaded_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can view cleanup candidates' using errcode = '42501';
  end if;

  return query
    select 'release'::text, s.id, s.track_title, s.artist_name, s.status, o.name,
      coalesce((o.metadata->>'size')::bigint, 0), o.created_at
    from public.submissions s
    join storage.objects o
      on o.bucket_id = 'submissions' and o.name in (s.audio_path, s.poster_path)
    where s.status in ('sent_to_distributor', 'rejected') and s.files_removed_at is null
    union all
    select 'orphan'::text, null, null, null, null, o.name,
      coalesce((o.metadata->>'size')::bigint, 0), o.created_at
    from storage.objects o
    where o.bucket_id = 'submissions'
      and o.created_at < now() - interval '24 hours'
      and not exists (
        select 1 from public.submissions s where o.name in (s.audio_path, s.poster_path)
      );
end;
$$;

revoke execute on function public.admin_cleanup_candidates() from public, anon;
grant execute on function public.admin_cleanup_candidates() to authenticated;

-- ===========================================================================
-- 6. Editable release tasks (campaign + custom), alongside the fixed checklist.
-- ===========================================================================
alter table public.release_plans add column campaign_settings jsonb;

create table public.release_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.release_plans (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null check (char_length(title) between 1 and 200),
  details text check (char_length(details) <= 2000),
  channel text check (char_length(channel) <= 50),
  phase text not null check (phase in ('pre_release', 'release_week', 'release_day', 'post_release')),
  due_date date,
  done_at timestamptz,
  source text not null default 'custom' check (source in ('campaign', 'custom')),
  template_key text check (char_length(template_key) <= 80)
);

create index release_plan_tasks_plan_idx on public.release_plan_tasks (plan_id, due_date);
create index release_plan_tasks_user_idx on public.release_plan_tasks (user_id);

alter table public.release_plan_tasks enable row level security;

create policy "Artists read their own plan tasks, admins read all"
  on public.release_plan_tasks for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Artists add tasks to their own plans"
  on public.release_plan_tasks for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.release_plans p where p.id = plan_id and p.user_id = (select auth.uid()))
  );

create policy "Artists update their own plan tasks"
  on public.release_plan_tasks for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.release_plans p where p.id = plan_id and p.user_id = (select auth.uid()))
  );

create policy "Artists delete their own plan tasks"
  on public.release_plan_tasks for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger release_plan_tasks_set_updated_at
  before update on public.release_plan_tasks
  for each row execute function public.set_updated_at();

-- A plan can hold at most 150 extra tasks.
create or replace function public.limit_plan_tasks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.release_plan_tasks where plan_id = new.plan_id) >= 150 then
    raise exception 'A release plan can have up to 150 tasks.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.limit_plan_tasks() from public, anon, authenticated;

create trigger release_plan_tasks_limit
  before insert on public.release_plan_tasks
  for each row execute function public.limit_plan_tasks();

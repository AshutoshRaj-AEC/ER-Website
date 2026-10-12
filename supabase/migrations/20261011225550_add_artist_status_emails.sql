-- Admin-only notes, kept out of the artist-readable submissions row -----------

create table public.submission_admin_notes (
  submission_id uuid primary key references public.submissions (id) on delete cascade,
  notes text not null check (char_length(notes) <= 5000),
  updated_at timestamptz not null default now()
);

alter table public.submission_admin_notes enable row level security;

create policy "Admins read submission notes"
  on public.submission_admin_notes for select to authenticated
  using ((select public.is_admin()));

create policy "Admins add submission notes"
  on public.submission_admin_notes for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins update submission notes"
  on public.submission_admin_notes for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete submission notes"
  on public.submission_admin_notes for delete to authenticated
  using ((select public.is_admin()));

create trigger submission_admin_notes_set_updated_at
  before update on public.submission_admin_notes
  for each row execute function public.set_updated_at();

insert into public.submission_admin_notes (submission_id, notes)
select id, admin_notes from public.submissions where admin_notes is not null;

-- Artist-facing message and email tracking --------------------------------

alter table public.submissions
  add column artist_message text check (char_length(artist_message) <= 2000),
  add column artist_notified_status public.submission_status,
  add column artist_notified_at timestamptz;

drop policy "Artists create their own pending submissions" on public.submissions;

create policy "Artists create their own pending submissions"
  on public.submissions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and admin_notes is null
    and notified_at is null
    and artist_message is null
    and artist_notified_status is null
    and artist_notified_at is null
    and starts_with(audio_path, (select auth.uid())::text || '/' || id::text || '/')
    and starts_with(poster_path, (select auth.uid())::text || '/' || id::text || '/')
  );

-- Email the artist when the label moves their submission out of pending.
create or replace function public.notify_artist_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://ztzuefhbdqanfutcpjzz.supabase.co/functions/v1/notify-artist',
    body := jsonb_build_object('submission_id', new.id, 'status', new.status),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
end;
$$;

revoke execute on function public.notify_artist_status() from public, anon, authenticated;

create trigger submissions_notify_artist
  after update of status on public.submissions
  for each row
  when (old.status is distinct from new.status and new.status <> 'pending')
  execute function public.notify_artist_status();

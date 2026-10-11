create extension if not exists pg_net with schema extensions;

-- Admins ------------------------------------------------------------------

create table public.admins (
  email text primary key check (email = lower(email))
);

alter table public.admins enable row level security;
-- No policies: only readable through is_admin().

insert into public.admins (email) values
  ('eklautarecords@gmail.com'),
  ('ashutosh.raj0185@gmail.com');

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.admins a on a.email = lower(u.email)
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Submissions -------------------------------------------------------------

create type public.submission_status as enum (
  'pending',
  'approved',
  'rejected',
  'sent_to_distributor'
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status public.submission_status not null default 'pending',

  artist_name text not null check (char_length(artist_name) between 1 and 200),
  track_title text not null check (char_length(track_title) between 1 and 200),
  genre text not null check (char_length(genre) between 1 and 100),
  release_date date,
  contact_email text not null check (char_length(contact_email) between 3 and 320),

  songwriters text check (char_length(songwriters) <= 1000),
  producers text check (char_length(producers) <= 1000),
  featured_artists text check (char_length(featured_artists) <= 1000),

  language text check (char_length(language) <= 100),
  explicit boolean not null default false,
  lyrics text check (char_length(lyrics) <= 20000),

  isrc text check (isrc ~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$'),
  upc text check (upc ~ '^[0-9]{12,13}$'),

  audio_path text not null,
  poster_path text not null,

  admin_notes text check (char_length(admin_notes) <= 5000),
  notified_at timestamptz
);

create index submissions_user_id_idx on public.submissions (user_id);
create index submissions_created_at_idx on public.submissions (created_at desc);

alter table public.submissions enable row level security;

create policy "Artists create their own pending submissions"
  on public.submissions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and admin_notes is null
    and notified_at is null
    and starts_with(audio_path, (select auth.uid())::text || '/' || id::text || '/')
    and starts_with(poster_path, (select auth.uid())::text || '/' || id::text || '/')
  );

create policy "Artists read their own submissions, admins read all"
  on public.submissions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Admins update submissions"
  on public.submissions for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

-- Email alert: call the notify-submission Edge Function on every new row.
create or replace function public.notify_new_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://ztzuefhbdqanfutcpjzz.supabase.co/functions/v1/notify-submission',
    body := jsonb_build_object('submission_id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
end;
$$;

revoke execute on function public.notify_new_submission() from public, anon, authenticated;

create trigger submissions_notify_new
  after insert on public.submissions
  for each row execute function public.notify_new_submission();

-- Storage -----------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submissions',
  'submissions',
  false,
  52428800, -- 50 MB, the free-plan maximum
  array['audio/wav', 'audio/flac', 'image/jpeg', 'image/png']
);

create policy "Artists upload into their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Artists read their own files, admins read all"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'submissions'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_admin())
    )
  );

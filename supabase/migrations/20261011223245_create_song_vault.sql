-- Song Vault: private to each artist. Admins have no access.

create type public.song_status as enum ('idea', 'writing', 'recording', 'mixing', 'mastered');

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  title text not null check (char_length(title) between 1 and 200),
  status public.song_status not null default 'idea',
  bpm integer check (bpm between 20 and 400),
  musical_key text check (char_length(musical_key) <= 20),
  genre text check (char_length(genre) <= 100),
  collaborators text check (char_length(collaborators) <= 1000),
  reference_tracks text check (char_length(reference_tracks) <= 2000)
);

create index songs_user_id_idx on public.songs (user_id, updated_at desc);

alter table public.songs enable row level security;

create policy "Artists read their own songs"
  on public.songs for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Artists create their own songs"
  on public.songs for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Artists update their own songs"
  on public.songs for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Artists delete their own songs"
  on public.songs for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger songs_set_updated_at
  before update on public.songs
  for each row execute function public.set_updated_at();

-- Helper for child-table policies: does the current user own this song?
create or replace function public.owns_song(target_song_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.songs s
    where s.id = target_song_id and s.user_id = auth.uid()
  );
$$;

-- Status history (written by triggers, never edited) ------------------------

create table public.song_status_history (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status public.song_status not null,
  changed_at timestamptz not null default now()
);

create index song_status_history_song_id_idx on public.song_status_history (song_id);
create index song_status_history_user_id_idx on public.song_status_history (user_id);

alter table public.song_status_history enable row level security;

create policy "Artists read their own song history"
  on public.song_status_history for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Artists record history on their own songs"
  on public.song_status_history for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_song(song_id));

create or replace function public.record_song_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.song_status_history (song_id, user_id, status)
  values (new.id, new.user_id, new.status);
  return new;
end;
$$;

create trigger songs_record_initial_status
  after insert on public.songs
  for each row execute function public.record_song_status();

create trigger songs_record_status_change
  after update of status on public.songs
  for each row
  when (old.status is distinct from new.status)
  execute function public.record_song_status();

-- Bump songs.updated_at when anything is added to a song.
create or replace function public.touch_song()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.songs set updated_at = now() where id = new.song_id;
  return new;
end;
$$;

-- Lyric versions (append-only: never updated or deleted) --------------------

create table public.song_lyric_versions (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  label text check (char_length(label) <= 120),
  content text not null check (char_length(content) <= 50000)
);

create index song_lyric_versions_song_id_idx on public.song_lyric_versions (song_id, created_at desc);
create index song_lyric_versions_user_id_idx on public.song_lyric_versions (user_id);

alter table public.song_lyric_versions enable row level security;

create policy "Artists read their own lyric versions"
  on public.song_lyric_versions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Artists save lyric versions on their own songs"
  on public.song_lyric_versions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_song(song_id));

create trigger song_lyric_versions_touch_song
  after insert on public.song_lyric_versions
  for each row execute function public.touch_song();

-- Ideas: hooks, verses, concepts, notes -------------------------------------

create table public.song_ideas (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('hook', 'verse', 'concept', 'note')),
  content text not null check (char_length(content) between 1 and 10000)
);

create index song_ideas_song_id_idx on public.song_ideas (song_id, created_at desc);
create index song_ideas_user_id_idx on public.song_ideas (user_id);

alter table public.song_ideas enable row level security;

create policy "Artists read their own ideas"
  on public.song_ideas for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Artists add ideas to their own songs"
  on public.song_ideas for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_song(song_id));

create policy "Artists delete their own ideas"
  on public.song_ideas for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger song_ideas_touch_song
  after insert on public.song_ideas
  for each row execute function public.touch_song();

-- Voice notes and demos -----------------------------------------------------

create table public.song_audio (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('voice_note', 'demo')),
  label text check (char_length(label) <= 120),
  storage_path text not null,
  size_bytes bigint check (size_bytes >= 0)
);

create index song_audio_song_id_idx on public.song_audio (song_id, created_at desc);
create index song_audio_user_id_idx on public.song_audio (user_id);

alter table public.song_audio enable row level security;

create policy "Artists read their own song audio"
  on public.song_audio for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Artists add audio to their own songs"
  on public.song_audio for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.owns_song(song_id)
    and starts_with(storage_path, (select auth.uid())::text || '/' || song_id::text || '/')
  );

create policy "Artists delete their own song audio"
  on public.song_audio for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger song_audio_touch_song
  after insert on public.song_audio
  for each row execute function public.touch_song();

-- Storage -------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'song-vault',
  'song-vault',
  false,
  26214400, -- 25 MB
  array[
    'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac',
    'audio/mpeg', 'audio/wav', 'audio/flac'
  ]
);

create policy "Artists upload to their own vault folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'song-vault'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Artists read their own vault files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'song-vault'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Artists delete their own vault files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'song-vault'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

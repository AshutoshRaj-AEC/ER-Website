-- Growth profile: one per artist account ----------------------------------

create table public.growth_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  artist_name text not null check (char_length(artist_name) between 1 and 200),
  currency text not null default 'INR' check (currency in ('INR', 'USD', 'EUR', 'GBP'))
);

alter table public.growth_profiles enable row level security;

create policy "Artists read their own growth profile, admins read all"
  on public.growth_profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Artists create their own growth profile"
  on public.growth_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Artists update their own growth profile"
  on public.growth_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger growth_profiles_set_updated_at
  before update on public.growth_profiles
  for each row execute function public.set_updated_at();

-- Monthly snapshots -------------------------------------------------------

create table public.growth_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.growth_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  month date not null check (extract(day from month) = 1),

  spotify_monthly_listeners integer check (spotify_monthly_listeners >= 0),
  spotify_followers integer check (spotify_followers >= 0),
  youtube_subscribers integer check (youtube_subscribers >= 0),
  instagram_followers integer check (instagram_followers >= 0),
  monthly_streams bigint check (monthly_streams >= 0),
  monthly_earnings numeric(12, 2) check (monthly_earnings >= 0),

  unique (user_id, month)
);

alter table public.growth_entries enable row level security;

create policy "Artists read their own growth entries, admins read all"
  on public.growth_entries for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Artists log their own growth entries"
  on public.growth_entries for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Artists update their own growth entries"
  on public.growth_entries for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Artists delete their own growth entries"
  on public.growth_entries for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger growth_entries_set_updated_at
  before update on public.growth_entries
  for each row execute function public.set_updated_at();

-- Goals: at most one per metric -------------------------------------------

create table public.growth_goals (
  user_id uuid not null default auth.uid()
    references public.growth_profiles (user_id) on delete cascade,
  metric text not null check (metric in (
    'spotify_monthly_listeners',
    'spotify_followers',
    'youtube_subscribers',
    'instagram_followers',
    'monthly_streams',
    'monthly_earnings'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  target numeric(14, 2) not null check (target > 0),
  target_date date,
  primary key (user_id, metric)
);

alter table public.growth_goals enable row level security;

create policy "Artists read their own goals, admins read all"
  on public.growth_goals for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Artists set their own goals"
  on public.growth_goals for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Artists update their own goals"
  on public.growth_goals for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Artists remove their own goals"
  on public.growth_goals for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger growth_goals_set_updated_at
  before update on public.growth_goals
  for each row execute function public.set_updated_at();

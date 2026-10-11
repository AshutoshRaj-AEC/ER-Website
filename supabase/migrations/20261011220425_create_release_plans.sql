-- Release plans ------------------------------------------------------------

create table public.release_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  submission_id uuid unique references public.submissions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  title text not null check (char_length(title) between 1 and 200),
  artist_name text not null check (char_length(artist_name) between 1 and 200),
  release_date date,

  currency text not null default 'INR' check (currency in ('INR', 'USD', 'EUR', 'GBP')),
  payout_per_1000_streams numeric(12, 2) check (payout_per_1000_streams >= 0),
  artist_share_percent numeric(5, 2) not null default 100
    check (artist_share_percent between 0 and 100)
);

create index release_plans_user_id_idx on public.release_plans (user_id);

alter table public.release_plans enable row level security;

create policy "Artists read their own plans, admins read all"
  on public.release_plans for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Artists create their own plans"
  on public.release_plans for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      submission_id is null
      or exists (
        select 1 from public.submissions s
        where s.id = submission_id and s.user_id = (select auth.uid())
      )
    )
  );

create policy "Artists update their own plans"
  on public.release_plans for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      submission_id is null
      or exists (
        select 1 from public.submissions s
        where s.id = submission_id and s.user_id = (select auth.uid())
      )
    )
  );

create policy "Artists delete their own plans"
  on public.release_plans for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger release_plans_set_updated_at
  before update on public.release_plans
  for each row execute function public.set_updated_at();

-- Budget items -------------------------------------------------------------

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.release_plans (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  category text not null check (category in (
    'production',
    'mixing_mastering',
    'artwork',
    'music_video',
    'advertising',
    'pr_playlists',
    'distribution',
    'other'
  )),
  description text not null default '' check (char_length(description) <= 300),
  planned_amount numeric(12, 2) not null default 0 check (planned_amount >= 0),
  actual_amount numeric(12, 2) not null default 0 check (actual_amount >= 0)
);

create index budget_items_plan_id_idx on public.budget_items (plan_id);
create index budget_items_user_id_idx on public.budget_items (user_id);

alter table public.budget_items enable row level security;

create policy "Artists read their own budget items, admins read all"
  on public.budget_items for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Artists add budget items to their own plans"
  on public.budget_items for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.release_plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
  );

create policy "Artists update their own budget items"
  on public.budget_items for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.release_plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
  );

create policy "Artists delete their own budget items"
  on public.budget_items for delete to authenticated
  using (user_id = (select auth.uid()));

-- Checklist ----------------------------------------------------------------

-- Tasks are defined in the app; a row here means the artist ticked one off.
create table public.checklist_completions (
  plan_id uuid not null references public.release_plans (id) on delete cascade,
  task_key text not null check (char_length(task_key) between 1 and 50),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (plan_id, task_key)
);

create index checklist_completions_user_id_idx on public.checklist_completions (user_id);

alter table public.checklist_completions enable row level security;

create policy "Artists read their own checklist, admins read all"
  on public.checklist_completions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Artists tick tasks on their own plans"
  on public.checklist_completions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.release_plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
  );

create policy "Artists untick their own tasks"
  on public.checklist_completions for delete to authenticated
  using (user_id = (select auth.uid()));

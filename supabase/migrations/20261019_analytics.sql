-- Analytics: user presence (online now) + page views
-- Run this once in Supabase SQL editor or via `supabase db push`

-- ── user_presence ────────────────────────────────────────────────────────────
-- One row per logged-in user; updated every ~60s via heartbeat.
create table if not exists public.user_presence (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  last_seen   timestamptz not null default now(),
  current_page text,
  updated_at  timestamptz not null default now()
);

alter table public.user_presence enable row level security;

create policy "Users upsert own presence"
  on public.user_presence for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_presence_last_seen
  on public.user_presence(last_seen desc);

-- ── page_views ───────────────────────────────────────────────────────────────
-- One row per navigation event (route change in the app).
create table if not exists public.page_views (
  id         bigserial primary key,
  user_id    uuid references auth.users(id) on delete set null,
  page       text not null,
  created_at timestamptz not null default now()
);

alter table public.page_views enable row level security;

create policy "Users insert own page views"
  on public.page_views for insert
  with check (auth.uid() = user_id);

create index if not exists idx_page_views_created_at
  on public.page_views(created_at desc);

create index if not exists idx_page_views_user_id
  on public.page_views(user_id);

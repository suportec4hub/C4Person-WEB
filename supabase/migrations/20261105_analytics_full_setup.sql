-- Analytics full setup (run this if you haven't run the previous migrations)
-- Creates user_presence + page_views with all columns including v2 additions

-- ── user_presence ────────────────────────────────────────────────────────────
create table if not exists public.user_presence (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  last_seen    timestamptz not null default now(),
  current_page text,
  updated_at   timestamptz not null default now()
);

alter table public.user_presence enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'user_presence'
      and policyname = 'Users upsert own presence'
  ) then
    create policy "Users upsert own presence"
      on public.user_presence for all
      using  (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create index if not exists idx_presence_last_seen
  on public.user_presence(last_seen desc);

-- ── page_views ───────────────────────────────────────────────────────────────
create table if not exists public.page_views (
  id           bigserial primary key,
  user_id      uuid references auth.users(id) on delete set null,
  page         text not null,
  session_id   text,
  scroll_depth smallint,
  time_on_page integer,
  created_at   timestamptz not null default now()
);

alter table public.page_views enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'page_views'
      and policyname = 'Users insert own page views'
  ) then
    create policy "Users insert own page views"
      on public.page_views for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

create index if not exists idx_page_views_created_at  on public.page_views(created_at desc);
create index if not exists idx_page_views_user_id     on public.page_views(user_id);
create index if not exists idx_page_views_session_id  on public.page_views(session_id);

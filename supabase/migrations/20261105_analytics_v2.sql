-- Analytics v2: add session_id, scroll_depth, time_on_page to page_views
-- Run in Supabase SQL editor after the previous 20261019_analytics.sql

alter table public.page_views
  add column if not exists session_id  text,
  add column if not exists scroll_depth smallint,
  add column if not exists time_on_page integer;

create index if not exists idx_page_views_session_id
  on public.page_views(session_id);

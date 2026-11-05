-- Funnel events: anonymous visitor tracking (no auth required)
-- Tracks: landing page views, CTA clicks, checkout starts, and completions

create table if not exists public.funnel_events (
  id         bigserial primary key,
  session_id text        not null,
  event      text        not null,  -- 'page_view','cta_click','checkout_start','checkout_complete','checkout_abandon'
  page       text,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

-- No RLS — inserted server-side only via service role key
-- Index for funnel queries
create index if not exists idx_funnel_events_session_id  on public.funnel_events(session_id);
create index if not exists idx_funnel_events_event       on public.funnel_events(event);
create index if not exists idx_funnel_events_created_at  on public.funnel_events(created_at desc);

-- Calendar integrations: stores OAuth tokens for Google Calendar and Microsoft Outlook

create table if not exists public.calendar_integrations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider      text not null,          -- 'google' | 'microsoft'
  access_token  text not null,
  refresh_token text,
  expires_at    timestamptz,
  email         text,                   -- connected account email (display only)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(user_id, provider)
);

alter table public.calendar_integrations enable row level security;

create policy "Users read own integrations"
  on public.calendar_integrations for select
  using (auth.uid() = user_id);

create policy "Users delete own integrations"
  on public.calendar_integrations for delete
  using (auth.uid() = user_id);

-- Service role handles inserts/updates (tokens are server-side only)

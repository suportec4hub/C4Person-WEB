create table if not exists public.calendar_events (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  title        text        not null,
  description  text,
  type         text        not null default 'task',   -- 'task' | 'meeting' | 'reminder'
  event_date   date        not null,
  start_time   time,
  end_time     time,
  all_day      boolean     not null default false,
  remind_min   integer,                               -- minutes before start to notify
  color        text        not null default '#8B5CF6',
  google_event_id text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_calendar_events_user_date
  on public.calendar_events(user_id, event_date);

alter table public.calendar_events enable row level security;

create policy "users manage own calendar events"
  on public.calendar_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

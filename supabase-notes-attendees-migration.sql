-- Add attendees column to notes table (idempotent)
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS attendees text[] DEFAULT '{}';

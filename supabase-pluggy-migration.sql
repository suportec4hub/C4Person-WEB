-- Run in Supabase SQL Editor

-- 1. Add pluggy_item_id to profiles (stores the bank connection per user)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pluggy_item_id TEXT;

-- 2. Add pluggy tracking columns to debts
ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS pluggy_account_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- 3. Unique index so upsert works on Pluggy-synced accounts
CREATE UNIQUE INDEX IF NOT EXISTS debts_pluggy_account_uniq
  ON public.debts (user_id, pluggy_account_id)
  WHERE pluggy_account_id IS NOT NULL;

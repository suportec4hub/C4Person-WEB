-- Run in Supabase SQL Editor
-- Adds pluggy_transaction_id column + unique index to deduplicate synced transactions

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS pluggy_transaction_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_pluggy_tx_uniq
  ON public.transactions (user_id, pluggy_transaction_id)
  WHERE pluggy_transaction_id IS NOT NULL;

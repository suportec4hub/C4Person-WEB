-- ====================================================================
-- C4Person — MIGRAÇÃO COMPLETA
-- Execute no Supabase SQL Editor.
-- Seguro para rodar múltiplas vezes: todos os comandos usam IF NOT EXISTS.
-- ====================================================================

-- ── 1. TABELAS NOVAS ─────────────────────────────────────────────────

-- Dívidas manuais e importadas do Pluggy
CREATE TABLE IF NOT EXISTS public.debts (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT          NOT NULL,
  creditor      TEXT,
  total_amount  NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  paid_amount   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status        TEXT          NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'quitada')),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Pagamentos de dívidas
CREATE TABLE IF NOT EXISTS public.debt_payments (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  debt_id       UUID          NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  user_id       UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date  DATE          NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Contas bancárias sincronizadas via Pluggy
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id                   UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pluggy_account_id    TEXT          NOT NULL,
  name                 TEXT          NOT NULL,
  type                 TEXT          NOT NULL,
  subtype              TEXT,
  balance              NUMERIC(15,2) NOT NULL DEFAULT 0,
  institution_name     TEXT,
  institution_logo_url TEXT,
  credit_limit         NUMERIC(15,2),
  available_credit     NUMERIC(15,2),
  last_synced_at       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Conexões bancárias (items) do Pluggy por usuário
CREATE TABLE IF NOT EXISTS public.pluggy_items (
  id                   UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id              TEXT          NOT NULL,
  institution_name     TEXT,
  institution_logo_url TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── 2. COLUNAS ADICIONAIS ─────────────────────────────────────────────

-- profiles: Pluggy + salário + convite de parceiro
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pluggy_item_id       TEXT,
  ADD COLUMN IF NOT EXISTS pluggy_client_id     TEXT,
  ADD COLUMN IF NOT EXISTS pluggy_client_secret TEXT,
  ADD COLUMN IF NOT EXISTS last_pluggy_sync_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS salary_mode          TEXT    DEFAULT 'full'
                                                CHECK (salary_mode IN ('full', 'split')),
  ADD COLUMN IF NOT EXISTS salary_amount        NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invite_code          TEXT    UNIQUE,
  ADD COLUMN IF NOT EXISTS partner_id           UUID    REFERENCES public.profiles(id) ON DELETE SET NULL;

-- debts: rastreamento Pluggy
ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS pluggy_account_id TEXT,
  ADD COLUMN IF NOT EXISTS source            TEXT NOT NULL DEFAULT 'manual';

-- transactions: rastreamento Pluggy + fonte de pagamento
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS source                TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS payment_source        TEXT[],
  ADD COLUMN IF NOT EXISTS pluggy_transaction_id TEXT;

-- ── 3. ÍNDICES ÚNICOS (evitam duplicatas no sync) ────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_pluggy_uniq
  ON public.bank_accounts (user_id, pluggy_account_id);

CREATE UNIQUE INDEX IF NOT EXISTS pluggy_items_uniq
  ON public.pluggy_items (user_id, item_id);

CREATE UNIQUE INDEX IF NOT EXISTS debts_pluggy_account_uniq
  ON public.debts (user_id, pluggy_account_id)
  WHERE pluggy_account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_pluggy_tx_uniq
  ON public.transactions (user_id, pluggy_transaction_id)
  WHERE pluggy_transaction_id IS NOT NULL;

-- ── 4. GERAR CÓDIGOS DE CONVITE PARA QUEM AINDA NÃO TEM ──────────────

UPDATE public.profiles
SET invite_code = upper(substring(replace(gen_random_uuid()::text, '-', '') for 6))
WHERE invite_code IS NULL;

-- ── 5. HABILITAR RLS NAS NOVAS TABELAS ───────────────────────────────

ALTER TABLE public.debts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pluggy_items  ENABLE ROW LEVEL SECURITY;

-- ── 6. POLÍTICAS RLS ─────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='debts' AND policyname='Users manage own debts') THEN
    CREATE POLICY "Users manage own debts" ON public.debts FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='debt_payments' AND policyname='Users manage own debt payments') THEN
    CREATE POLICY "Users manage own debt payments" ON public.debt_payments FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bank_accounts' AND policyname='Users manage own bank accounts') THEN
    CREATE POLICY "Users manage own bank accounts" ON public.bank_accounts FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pluggy_items' AND policyname='Users manage own pluggy items') THEN
    CREATE POLICY "Users manage own pluggy items" ON public.pluggy_items FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transactions' AND policyname='Partners can view each other transactions') THEN
    CREATE POLICY "Partners can view each other transactions"
      ON public.transactions FOR SELECT
      USING (
        auth.uid() = user_id
        OR auth.uid() IN (
          SELECT partner_id FROM public.profiles
          WHERE id = user_id AND partner_id IS NOT NULL
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transactions' AND policyname='Partners can insert transactions') THEN
    CREATE POLICY "Partners can insert transactions"
      ON public.transactions FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.partner_id = user_id
        )
      );
  END IF;
END $$;

-- ── 7. ÍNDICES DE PERFORMANCE ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS debts_user_id_idx          ON public.debts(user_id);
CREATE INDEX IF NOT EXISTS debt_payments_debt_id_idx  ON public.debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS debt_payments_user_id_idx  ON public.debt_payments(user_id);
CREATE INDEX IF NOT EXISTS bank_accounts_user_id_idx  ON public.bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS pluggy_items_user_id_idx   ON public.pluggy_items(user_id);

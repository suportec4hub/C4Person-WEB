-- Migração: Rastreamento de Dívidas
-- Execute este SQL no Supabase SQL Editor do projeto C4Person

-- 1. Tabela de dívidas
CREATE TABLE IF NOT EXISTS public.debts (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT         NOT NULL,
  creditor     TEXT,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  paid_amount  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status       TEXT         NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'quitada')),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 2. Tabela de pagamentos de dívidas
CREATE TABLE IF NOT EXISTS public.debt_payments (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  debt_id      UUID         NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  user_id      UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date DATE         NOT NULL DEFAULT CURRENT_DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 3. Habilitar RLS
ALTER TABLE public.debts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para debts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'debts' AND policyname = 'Users manage own debts'
  ) THEN
    CREATE POLICY "Users manage own debts"
      ON public.debts FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 5. Políticas RLS para debt_payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'debt_payments' AND policyname = 'Users manage own debt payments'
  ) THEN
    CREATE POLICY "Users manage own debt payments"
      ON public.debt_payments FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 6. Índices
CREATE INDEX IF NOT EXISTS debts_user_id_idx         ON public.debts(user_id);
CREATE INDEX IF NOT EXISTS debt_payments_debt_id_idx ON public.debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS debt_payments_user_id_idx ON public.debt_payments(user_id);

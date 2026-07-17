-- Migração: Melhorias na página de finanças
-- Execute este SQL no Supabase SQL Editor do projeto C4Person

-- 1. Adiciona colunas ao perfil do usuário
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS salary_mode    text    DEFAULT 'full'  CHECK (salary_mode IN ('full', 'split')),
  ADD COLUMN IF NOT EXISTS salary_amount  numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invite_code    text    UNIQUE,
  ADD COLUMN IF NOT EXISTS partner_id     uuid    REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Gera código de convite único para perfis que ainda não têm
UPDATE public.profiles
SET invite_code = upper(substring(replace(gen_random_uuid()::text, '-', '') for 6))
WHERE invite_code IS NULL;

-- 3. Política RLS: parceiro pode ver as transações do outro
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'transactions'
      AND policyname = 'Partners can view each other transactions'
  ) THEN
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

-- 4. Política RLS: parceiro pode inserir transações na conta conjunta
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'transactions'
      AND policyname = 'Partners can insert transactions'
  ) THEN
    CREATE POLICY "Partners can insert transactions"
      ON public.transactions FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.partner_id = user_id
        )
      );
  END IF;
END $$;

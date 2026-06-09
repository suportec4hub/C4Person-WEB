-- Migração: Melhorias nas reuniões gravadas
-- Execute este SQL no Supabase SQL Editor do projeto C4Person

-- 1. Adiciona colunas à tabela notes
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS audio_url        text,
  ADD COLUMN IF NOT EXISTS action_items     text[],
  ADD COLUMN IF NOT EXISTS tags             text[],
  ADD COLUMN IF NOT EXISTS meeting_type     text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer;

-- 2. Cria bucket para armazenar gravações de reuniões (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-recordings', 'meeting-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Política RLS: usuário pode fazer upload apenas na própria pasta
CREATE POLICY "Users upload own recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'meeting-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 4. Política RLS: usuário pode ler apenas os próprios arquivos
CREATE POLICY "Users read own recordings"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'meeting-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 5. Política RLS: usuário pode deletar apenas os próprios arquivos
CREATE POLICY "Users delete own recordings"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'meeting-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

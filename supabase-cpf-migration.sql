-- Add CPF column to profiles table (idempotent)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf text;

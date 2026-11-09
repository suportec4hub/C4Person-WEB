# Guia de Migrations Seguras

## Regras obrigatórias

1. NUNCA use `DROP TABLE` — use `CREATE TABLE IF NOT EXISTS`
2. NUNCA use `TRUNCATE` — apaga todos os dados
3. Para novas colunas: `ALTER TABLE x ADD COLUMN IF NOT EXISTS y type`
4. Para policies: sempre `DROP POLICY IF EXISTS` antes de `CREATE POLICY`
5. Para índices: sempre `CREATE INDEX IF NOT EXISTS`

## Template padrão

```sql
-- Adicionar coluna nova (seguro, não perde dados)
ALTER TABLE public.minha_tabela
  ADD COLUMN IF NOT EXISTS nova_coluna text;

-- Recriar policy (seguro)
DROP POLICY IF EXISTS "nome da policy" ON public.minha_tabela;
CREATE POLICY "nome da policy"
  ON public.minha_tabela
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

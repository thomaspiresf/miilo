-- =====================================================================
--  Campos de brinquedo (material + medidas)
--  Rode no SQL Editor do Supabase. Seguro rodar mais de uma vez.
-- =====================================================================

alter table public.products add column if not exists material   text;
alter table public.products add column if not exists dimensions text;

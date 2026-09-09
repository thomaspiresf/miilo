-- =====================================================================
--  Como o produto aparece na vitrine: cada cor separada ou tudo junto
--  Rode no SQL Editor do Supabase. Seguro rodar mais de uma vez.
-- =====================================================================

alter table public.products
  add column if not exists split_by_color boolean not null default true;

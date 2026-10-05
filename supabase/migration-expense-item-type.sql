-- =====================================================================
--  Tipo do que foi comprado em cada gasto (/admin/gastos): brinquedo,
--  roupa, sacolas ou outros. Opcional (nulo = gasto sem classificação).
--  Rode no SQL Editor do Supabase. Idempotente.
-- =====================================================================

alter table public.expenses
  add column if not exists item_type text
  check (item_type is null or item_type in ('brinquedo', 'roupa', 'sacolas', 'outros'));

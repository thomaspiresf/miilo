-- =====================================================================
--  Gastos lançados automaticamente (ex.: custo mensal da Meta — WhatsApp
--  e anúncios). `source_key` identifica a linha (ex.: "meta_whatsapp:2026-10")
--  pra a sincronização atualizar o valor em vez de duplicar.
--  Rode no SQL Editor do Supabase. Idempotente.
-- =====================================================================
alter table public.expenses add column if not exists source text;
alter table public.expenses add column if not exists source_key text;
create unique index if not exists expenses_source_key_uq on public.expenses (source_key);

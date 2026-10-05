-- =====================================================================
--  Notas/comprovantes anexados aos gastos (/admin/gastos).
--  Bucket PRIVADO (nota fiscal é dado financeiro — só abre por link
--  assinado temporário gerado pelo admin) + coluna com o caminho do arquivo.
--  Rode no SQL Editor do Supabase. Idempotente.
-- =====================================================================

alter table public.expenses add column if not exists receipt_path text;

insert into storage.buckets (id, name, public)
values ('expense-receipts', 'expense-receipts', false)
on conflict (id) do nothing;

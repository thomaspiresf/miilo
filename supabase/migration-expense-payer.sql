-- =====================================================================
--  Quem pagou cada gasto (/admin/gastos): os dois núcleos de sócios ou a
--  própria Miilo (caixa da loja). Nulo = gasto antigo, anterior à coluna.
--  Rode no SQL Editor do Supabase. Idempotente.
-- =====================================================================

alter table public.expenses add column if not exists payer text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'expenses_payer_check') then
    alter table public.expenses
      add constraint expenses_payer_check
      check (payer is null or payer in ('thaisa_thomas', 'bruna_vinicius', 'miilo'));
  end if;
end $$;

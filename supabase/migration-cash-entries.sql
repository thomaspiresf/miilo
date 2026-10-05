-- =====================================================================
--  Movimentações manuais do caixa (/admin/gastos): saldo inicial/ajuste,
--  entradas, retiradas e transferências entre as duas contas da loja:
--  dinheiro (cash) e Mercado Pago (mp). Valor com sinal: + entra, − sai.
--  O saldo = vendas e investimentos (calculados dos pedidos e gastos)
--  + estas movimentações. Rode no SQL Editor do Supabase. Idempotente.
-- =====================================================================
create table if not exists public.cash_entries (
  id uuid primary key default gen_random_uuid(),
  occurred_on date not null default current_date,
  account text not null check (account in ('cash', 'mp')),
  amount numeric(12,2) not null check (amount <> 0),
  kind text not null check (kind in ('entrada', 'saida', 'transferencia', 'ajuste')),
  note text,
  group_id uuid,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists cash_entries_account_idx on public.cash_entries (account, occurred_on desc);
alter table public.cash_entries enable row level security;

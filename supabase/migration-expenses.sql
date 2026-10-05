-- =====================================================================
--  Controle de gastos (/admin/gastos) — registro de gastos reais com
--  data, categoria e valor. Diferente dos "custos fixos mensais" de
--  Precificação (que são só números pro cálculo de preço).
--  Rode no SQL Editor do Supabase. Idempotente.
-- =====================================================================

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  spent_on    date not null default current_date,
  category    text not null check (category in ('mercadoria', 'fixa', 'marketing', 'outros')),
  description text not null,
  amount      numeric(12,2) not null check (amount > 0),
  supplier    text,
  notes       text,
  created_by  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_expenses_spent_on on public.expenses(spent_on desc);

alter table public.expenses enable row level security;
-- só a service_role lê/escreve (o admin usa o admin client); sem policy pública

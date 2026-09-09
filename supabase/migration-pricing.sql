-- =====================================================================
--  Precificação — custo por variação + regras globais de preço
--  Rode no SQL Editor do Supabase. Idempotente.
-- =====================================================================

-- quanto a loja pagou pela unidade (Brás). null = não cadastrado.
alter table public.product_variants
  add column if not exists cost numeric(12,2);

-- regras de precificação (linha única, id = 1)
create table if not exists public.pricing_settings (
  id                        int primary key default 1 check (id = 1),
  tax_percent               numeric(5,2) not null default 4,      -- Simples Nacional
  mp_credit_percent         numeric(5,2) not null default 4.99,
  mp_pix_percent            numeric(5,2) not null default 0.99,
  mp_debit_percent          numeric(5,2) not null default 3.79,
  packaging_cost            numeric(12,2) not null default 0,     -- R$ por pedido
  free_shipping_threshold   numeric(12,2),                        -- null = sem frete grátis
  free_shipping_store_share numeric(5,2) not null default 100,    -- % do frete que a loja banca
  target_margin_percent     numeric(5,2) not null default 45,     -- alvo pro "preço sugerido"
  fixed_costs               jsonb not null default '[]',          -- [{label, amount}] mensais
  updated_at                timestamptz not null default now()
);

insert into public.pricing_settings (id) values (1)
  on conflict (id) do nothing;

alter table public.pricing_settings enable row level security;
-- só a service_role lê/escreve (o app usa o admin client)

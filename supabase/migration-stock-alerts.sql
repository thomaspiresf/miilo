-- =====================================================================
--  "Avise-me quando chegar" — lista de espera por produto/variação
--  Rode no SQL Editor do Supabase. Seguro rodar mais de uma vez.
-- =====================================================================

create table if not exists public.stock_alerts (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  variant_id  uuid references public.product_variants(id) on delete set null,
  email       text not null,
  created_at  timestamptz not null default now(),
  notified_at timestamptz
);

create index if not exists idx_stock_alerts_product
  on public.stock_alerts(product_id) where notified_at is null;

-- evita duplicar o mesmo e-mail esperando a mesma variação
create unique index if not exists uq_stock_alerts_pending
  on public.stock_alerts(product_id, coalesce(variant_id::text, ''), lower(email))
  where notified_at is null;

alter table public.stock_alerts enable row level security;
-- escrita só via service_role (server actions); ninguém lê pelo cliente

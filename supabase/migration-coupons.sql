-- =====================================================================
--  Cupons de desconto (percentual) — checkout online
--  Rode no SQL Editor do Supabase. Seguro rodar mais de uma vez.
-- =====================================================================

create table if not exists public.coupons (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,                  -- sempre gravado em MAIÚSCULAS
  percent_off   numeric(5,2) not null check (percent_off > 0 and percent_off <= 100),
  min_subtotal  numeric(12,2),                         -- null = sem mínimo
  max_uses      int,                                   -- null = ilimitado
  uses_count    int not null default 0,
  expires_at    timestamptz,                           -- null = sem validade
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create unique index if not exists uq_coupons_code_lower on public.coupons (lower(code));

alter table public.coupons enable row level security;
-- leitura/escrita só via service_role (validação no checkout + admin). Sem policy pública.

-- Incremento atômico do contador de usos (chamado quando o pedido é aprovado).
create or replace function public.increment_coupon_use(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.coupons
     set uses_count = uses_count + 1
   where lower(code) = lower(p_code);
$$;

-- Colunas do desconto aplicado no pedido
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount numeric(12,2) not null default 0;

-- =====================================================================
--  miilo — migração: modo de entrega no checkout
--  Rode no SQL Editor (idempotente).
-- =====================================================================

alter table public.orders add column if not exists customer_name  text;
alter table public.orders add column if not exists phone          text;
alter table public.orders add column if not exists delivery_mode  text not null default 'delivery';
--   delivery_mode: 'delivery' (entrega no endereço) | 'pickup' (retirar na loja)

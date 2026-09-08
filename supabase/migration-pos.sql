-- =====================================================================
--  PDV / venda na loja
--  Rode no SQL Editor do Supabase. Seguro rodar mais de uma vez.
-- =====================================================================

-- de onde veio o pedido: 'online' (loja) ou 'pos' (venda presencial no /admin/pdv)
alter table public.orders add column if not exists channel text not null default 'online';

create index if not exists idx_orders_channel on public.orders(channel);

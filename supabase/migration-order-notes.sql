-- Observação livre no pedido (usada na venda na loja: "paga dia 15", etc.)
alter table public.orders add column if not exists notes text;

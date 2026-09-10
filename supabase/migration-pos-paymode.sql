-- Como a venda na loja foi lançada: link | now | cash | later ("a receber" anotado).
-- Null em pedidos online e em vendas antigas.
alter table public.orders add column if not exists pos_pay_mode text;

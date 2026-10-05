-- =====================================================================
--  Pagamento dividido na venda na loja: parte já recebida em dinheiro/
--  maquininha (cash_paid) e o restante pago por link Pix/cartão.
--  O link cobra (total - cash_paid). 0 = pedido sem pagamento parcial.
--  Rode no SQL Editor do Supabase. Idempotente.
-- =====================================================================
alter table public.orders add column if not exists cash_paid numeric(12,2) not null default 0;

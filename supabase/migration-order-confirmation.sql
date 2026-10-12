-- Evita e-mail/aviso de venda em duplicidade quando o webhook do Mercado Pago e a
-- página do pedido aprovam o mesmo pedido ao mesmo tempo: quem gravar primeiro
-- esta data "reivindica" o envio da confirmação.
alter table public.orders add column if not exists confirmation_sent_at timestamptz;

-- pedidos que já estavam pagos não devem disparar nada de novo
update public.orders
   set confirmation_sent_at = coalesce(created_at, now())
 where status in ('paid', 'shipped', 'delivered')
   and confirmation_sent_at is null;

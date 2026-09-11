-- "Recebido" no Painel mostrava o valor da venda (total), não o que o Mercado
-- Pago realmente deposita depois de descontar a taxa dele. Esta migration
-- guarda o valor líquido por pedido, informado pelo próprio MP.
alter table public.orders add column if not exists net_amount numeric(12,2);

create or replace function public.approve_order(
  p_order_id      uuid,
  p_mp_payment_id text default null,
  p_mp_status     text default 'approved',
  p_method        text default null,
  p_net_amount    numeric default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  it  record;
  bal int;
begin
  if not exists (select 1 from public.orders where id = p_order_id and status <> 'paid') then
    return;
  end if;

  update public.orders
     set status = 'paid',
         mp_payment_id = coalesce(p_mp_payment_id, mp_payment_id),
         mp_status = p_mp_status,
         payment_method = coalesce(p_method, payment_method),
         net_amount = coalesce(p_net_amount, net_amount)
   where id = p_order_id;

  if exists (
    select 1 from public.orders
     where id = p_order_id and stock_reserved = true and stock_restored = false
  ) then
    -- estoque já reservado na criação do pedido: só relabela o movimento
    update public.stock_movements
       set reason = 'sale'
     where order_id = p_order_id and reason = 'reservation';
  else
    for it in select variant_id, qty from public.order_items where order_id = p_order_id loop
      if it.variant_id is not null then
        update public.product_variants
           set stock = greatest(0, stock - it.qty)
         where id = it.variant_id
         returning stock into bal;
        insert into public.stock_movements (variant_id, delta, reason, order_id, balance_after)
        values (it.variant_id, -it.qty, 'sale', p_order_id, bal);
      end if;
    end loop;
    update public.orders
       set stock_restored = false
     where id = p_order_id and stock_reserved = true;
  end if;
end;
$$;

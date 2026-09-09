-- =====================================================================
--  Reserva de estoque no checkout
--  Rode no SQL Editor do Supabase. Idempotente — pode rodar de novo.
-- =====================================================================
--
--  Antes: o estoque só baixava quando o pagamento era aprovado. Dois
--  clientes podiam fechar o mesmo último item ao mesmo tempo (oversell).
--
--  Agora: o estoque baixa na CRIAÇÃO do pedido (reserva). Se o cliente não
--  pagar em ~1h, a reserva é devolvida. Ao pagar, a reserva vira venda.
--
--    criar pedido  -> reserve_order_stock()   (movimento "reservation", -qty)
--    pagou         -> approve_order()          (relabela "reservation" -> "sale")
--    não pagou/cancelou -> release_order_stock() (movimento "reservation_release", +qty)
-- =====================================================================

alter table public.orders
  add column if not exists stock_reserved boolean not null default false;

-- ---------------------------------------------------------------------
--  Reserva: baixa o estoque de forma atômica. Se faltar, levanta
--  OUT_OF_STOCK:<produto> e o INSERT inteiro é revertido.
-- ---------------------------------------------------------------------
create or replace function public.reserve_order_stock(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  it  record;
  bal int;
begin
  -- idempotente: só reserva uma vez
  if exists (select 1 from public.orders where id = p_order_id and stock_reserved = true) then
    return;
  end if;

  for it in
    select variant_id, qty, product_name
      from public.order_items
     where order_id = p_order_id
  loop
    if it.variant_id is not null then
      update public.product_variants
         set stock = stock - it.qty
       where id = it.variant_id and stock >= it.qty
       returning stock into bal;

      if not found then
        raise exception 'OUT_OF_STOCK:%', coalesce(it.product_name, 'produto');
      end if;

      insert into public.stock_movements (variant_id, delta, reason, order_id, balance_after)
      values (it.variant_id, -it.qty, 'reservation', p_order_id, bal);
    end if;
  end loop;

  update public.orders set stock_reserved = true where id = p_order_id;
end;
$$;

-- ---------------------------------------------------------------------
--  Devolve o estoque de uma reserva que não virou venda (pedido pending
--  cancelado / falho / expirado). Idempotente via stock_restored.
-- ---------------------------------------------------------------------
create or replace function public.release_order_stock(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  it  record;
  bal int;
begin
  if not exists (
    select 1 from public.orders
     where id = p_order_id
       and stock_reserved = true
       and stock_restored = false
       and status not in ('paid', 'shipped', 'delivered')
  ) then
    return;
  end if;

  update public.orders set stock_restored = true where id = p_order_id;

  for it in select variant_id, qty from public.order_items where order_id = p_order_id loop
    if it.variant_id is not null then
      update public.product_variants
         set stock = stock + it.qty
       where id = it.variant_id
       returning stock into bal;
      insert into public.stock_movements (variant_id, delta, reason, order_id, balance_after)
      values (it.variant_id, it.qty, 'reservation_release', p_order_id, bal);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
--  approve_order: se o pedido já tinha reserva, só converte o histórico
--  (o estoque já está baixado). Senão, baixa agora (caminho legado /
--  pagamento que chegou depois da reserva ter sido devolvida).
-- ---------------------------------------------------------------------
create or replace function public.approve_order(
  p_order_id      uuid,
  p_mp_payment_id text default null,
  p_mp_status     text default 'approved',
  p_method        text default null
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
         payment_method = coalesce(p_method, payment_method)
   where id = p_order_id;

  if exists (
    select 1 from public.orders
     where id = p_order_id and stock_reserved = true and stock_restored = false
  ) then
    -- estoque já reservado: só relabela o movimento
    update public.stock_movements
       set reason = 'sale'
     where order_id = p_order_id and reason = 'reservation';
  else
    -- sem reserva ativa: baixa agora
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
    -- se a reserva tinha sido devolvida, reabre pra um cancelamento futuro poder repor
    update public.orders
       set stock_restored = false
     where id = p_order_id and stock_reserved = true;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
--  Varre pedidos ONLINE pendentes com reserva vencida (> p_minutes):
--  devolve o estoque e cancela. POS não expira sozinho.
-- ---------------------------------------------------------------------
create or replace function public.expire_stale_reservations(p_minutes int default 65)
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select id from public.orders
     where status = 'pending'
       and coalesce(channel, 'online') = 'online'
       and stock_reserved = true
       and stock_restored = false
       and created_at < now() - make_interval(mins => p_minutes)
  loop
    perform public.release_order_stock(r.id);
    update public.orders
       set status = 'cancelled',
           mp_status = coalesce(mp_status, 'expired')
     where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

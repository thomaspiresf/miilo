-- =====================================================================
--  miilo — migração: controle de estoque
--  Rode no SQL Editor (é idempotente, pode rodar de novo sem problema).
-- =====================================================================

-- marca se o estoque de um pedido pago já foi devolvido (evita devolver 2x)
alter table public.orders add column if not exists stock_restored boolean not null default false;

-- histórico de movimentação de estoque
create table if not exists public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  variant_id    uuid references public.product_variants(id) on delete cascade,
  delta         int not null,                 -- +5 reposição, -1 venda, etc.
  reason        text not null,                -- 'sale' | 'restock' | 'adjustment' | 'cancellation'
  note          text,
  order_id      uuid references public.orders(id) on delete set null,
  balance_after int,
  created_at    timestamptz not null default now()
);

create index if not exists idx_stock_movements_variant on public.stock_movements(variant_id);
create index if not exists idx_stock_movements_created on public.stock_movements(created_at desc);

alter table public.stock_movements enable row level security;
drop policy if exists "stock movements admin" on public.stock_movements;
create policy "stock movements admin" on public.stock_movements
  for select to authenticated using (public.is_admin());

-- approve_order agora também registra a venda no histórico
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
end;
$$;

-- devolve o estoque de um pedido pago que foi cancelado (idempotente)
create or replace function public.restock_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  it  record;
  bal int;
begin
  if not exists (
    select 1 from public.orders
    where id = p_order_id and stock_restored = false
      and status in ('paid', 'shipped', 'delivered', 'cancelled')
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
      values (it.variant_id, it.qty, 'cancellation', p_order_id, bal);
    end if;
  end loop;
end;
$$;

-- ajuste manual de estoque (usado pelo painel /admin/estoque)
create or replace function public.adjust_variant_stock(
  p_variant_id uuid,
  p_new_stock  int,
  p_note       text default null
)
returns int language plpgsql security definer set search_path = public as $$
declare
  cur int;
begin
  select stock into cur from public.product_variants where id = p_variant_id for update;
  if cur is null then
    raise exception 'variação % não encontrada', p_variant_id;
  end if;

  update public.product_variants set stock = greatest(0, p_new_stock) where id = p_variant_id;

  insert into public.stock_movements (variant_id, delta, reason, note, balance_after)
  values (p_variant_id, greatest(0, p_new_stock) - cur, 'adjustment', p_note, greatest(0, p_new_stock));

  return greatest(0, p_new_stock);
end;
$$;

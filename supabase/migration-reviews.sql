-- =====================================================================
--  Avaliações de produto — o cliente avalia a compra em "Meus pedidos"
--  Rode no SQL Editor do Supabase. Idempotente.
-- =====================================================================

create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  user_id     uuid references auth.users(id) on delete set null,
  author_name text,
  rating      int not null check (rating between 1 and 5),
  comment     text,
  photos      text[] not null default '{}',   -- paths no bucket product-images
  created_at  timestamptz not null default now()
);

-- uma avaliação por produto por pedido
create unique index if not exists uq_reviews_order_product
  on public.reviews(order_id, product_id) where order_id is not null;
create index if not exists idx_reviews_product on public.reviews(product_id, created_at desc);

alter table public.reviews enable row level security;
drop policy if exists "reviews read" on public.reviews;
create policy "reviews read" on public.reviews
  for select to anon, authenticated using (true);
-- escrita só pela service_role (a server action valida que o pedido é do cliente)

-- ---------------------------------------------------------------------
--  Recalcula rating_avg / rating_count do produto sempre que uma
--  avaliação é criada / editada / apagada.
-- ---------------------------------------------------------------------
create or replace function public.recount_product_rating(p_product_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.products p
     set rating_count = sub.n,
         rating_avg   = sub.avg
    from (
      select count(*)::int as n, round(avg(rating)::numeric, 2) as avg
        from public.reviews where product_id = p_product_id
    ) sub
   where p.id = p_product_id;
$$;

create or replace function public.reviews_recount_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.recount_product_rating(old.product_id);
    return old;
  end if;
  perform public.recount_product_rating(new.product_id);
  if tg_op = 'UPDATE' and old.product_id <> new.product_id then
    perform public.recount_product_rating(old.product_id);
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_recount on public.reviews;
create trigger reviews_recount
  after insert or update or delete on public.reviews
  for each row execute function public.reviews_recount_trg();

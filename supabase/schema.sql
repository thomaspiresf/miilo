-- =====================================================================
--  miilo — schema do banco (Supabase / Postgres)
--  SQL Editor -> New query -> cole tudo -> Run
--  Depois: crie um usuário (login no site) e rode, trocando o e-mail:
--     update public.profiles set role = 'admin'
--     where id = (select id from auth.users where email = 'voce@exemplo.com');
-- =====================================================================

create extension if not exists "pgcrypto";

-- --------- updated_at automático ---------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
--  PROFILES  (1:1 com auth.users)
-- =====================================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  phone      text,
  role       text not null default 'customer',   -- 'customer' | 'admin'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- cria o profile automaticamente quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- helper: o usuário atual é admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- =====================================================================
--  CATÁLOGO
-- =====================================================================
create table if not exists public.categories (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null unique,
  name      text not null,
  kind      text not null,              -- 'roupas' | 'brinquedos'
  parent_id uuid references public.categories(id) on delete set null,
  sort      int not null default 0
);

create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  description      text,
  category_id      uuid not null references public.categories(id),
  brand            text,
  gender           text,                  -- 'menino' | 'menina' | 'unissex'
  age_min_months   int,
  age_max_months   int,
  base_price       numeric(12,2) not null default 0,
  compare_at_price numeric(12,2),         -- preço "de" (riscado) para calcular o desconto
  composition      text,                  -- "100% algodão"
  fit_notes        text,                  -- acordeão "Modelagem"
  care_notes       text,                  -- acordeão "Cuidados"
  rating_avg       numeric(3,2),          -- média das avaliações (null = sem avaliação)
  rating_count     int not null default 0,
  max_installments int not null default 3, -- parcelas sem juros exibidas
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_name on public.products (lower(name));
create index if not exists idx_products_active on public.products(active);

drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();

create table if not exists public.product_variants (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  sku          text,
  size         text,
  color        text,
  color_hex    text,                  -- cor do "swatch" (ex: #89baff)
  price        numeric(12,2) not null,
  stock        int not null default 0,
  weight_grams int not null default 300,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists idx_variants_product on public.product_variants(product_id);

-- Colunas adicionadas depois da 1ª versão (idempotente, para bancos existentes)
alter table public.products        add column if not exists compare_at_price numeric(12,2);
alter table public.products        add column if not exists composition      text;
alter table public.products        add column if not exists fit_notes        text;
alter table public.products        add column if not exists care_notes       text;
alter table public.products        add column if not exists rating_avg       numeric(3,2);
alter table public.products        add column if not exists rating_count     int not null default 0;
alter table public.products        add column if not exists max_installments int not null default 3;
alter table public.product_variants add column if not exists color_hex       text;

create table if not exists public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  storage_path text not null,           -- caminho no bucket OU URL absoluta (seed)
  alt          text,
  sort         int not null default 0
);

create index if not exists idx_images_product on public.product_images(product_id);

-- =====================================================================
--  ENDEREÇOS
-- =====================================================================
create table if not exists public.addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  recipient  text not null,
  cep        text not null,
  street     text not null,
  number     text not null,
  complement text,
  district   text not null,
  city       text not null,
  state      text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_addresses_user on public.addresses(user_id);

-- =====================================================================
--  PEDIDOS
-- =====================================================================
create sequence if not exists public.order_number_seq start 1000;

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  number           text not null unique default ('MI-' || lpad(nextval('public.order_number_seq')::text, 6, '0')),
  user_id          uuid references auth.users(id) on delete set null,
  email            text not null,
  customer_name    text,
  phone            text,
  delivery_mode    text not null default 'delivery',  -- delivery | pickup
  status           text not null default 'pending',  -- pending|paid|failed|cancelled|shipped|delivered
  subtotal         numeric(12,2) not null default 0,
  shipping_cost    numeric(12,2) not null default 0,
  shipping_service text,
  total            numeric(12,2) not null default 0,
  address          jsonb,
  mp_payment_id    text,
  mp_status        text,
  payment_method   text,
  tracking_code    text,
  stock_restored   boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.orders add column if not exists stock_restored boolean not null default false;
alter table public.orders add column if not exists customer_name  text;
alter table public.orders add column if not exists phone          text;
alter table public.orders add column if not exists delivery_mode  text not null default 'delivery';

create index if not exists idx_orders_user on public.orders(user_id);
create index if not exists idx_orders_created on public.orders(created_at desc);

drop trigger if exists trg_orders_updated on public.orders;
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  variant_id    uuid references public.product_variants(id) on delete set null,
  product_name  text not null,
  variant_label text,
  unit_price    numeric(12,2) not null,
  qty           int not null,
  image_url     text
);

create index if not exists idx_order_items_order on public.order_items(order_id);

-- log bruto de notificações do Mercado Pago (auditoria + idempotência)
create table if not exists public.payment_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid references public.orders(id) on delete set null,
  mp_payment_id text,
  type       text,
  status     text,
  raw        jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_payment_events_dedupe
  on public.payment_events (mp_payment_id, status)
  where mp_payment_id is not null;

-- =====================================================================
--  ESTOQUE — histórico de movimentação
-- =====================================================================
create table if not exists public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  variant_id    uuid references public.product_variants(id) on delete cascade,
  delta         int not null,                 -- +5 reposição, -1 venda…
  reason        text not null,                -- sale | restock | adjustment | cancellation
  note          text,
  order_id      uuid references public.orders(id) on delete set null,
  balance_after int,
  created_at    timestamptz not null default now()
);

create index if not exists idx_stock_movements_variant on public.stock_movements(variant_id);
create index if not exists idx_stock_movements_created on public.stock_movements(created_at desc);

-- =====================================================================
--  RPC: confirmar pagamento + baixar estoque (idempotente)
--  Chamada só pelo backend com a chave service_role.
-- =====================================================================
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

-- devolve o estoque de um pedido cancelado (idempotente)
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

-- ajuste manual de estoque (painel /admin/estoque)
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

-- =====================================================================
--  RLS
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images   enable row level security;
alter table public.addresses        enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.payment_events   enable row level security;
alter table public.stock_movements  enable row level security;

-- profiles
drop policy if exists "profile self read" on public.profiles;
create policy "profile self read" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "profile self update" on public.profiles;
create policy "profile self update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- catálogo: leitura pública; escrita só admin
drop policy if exists "categories read" on public.categories;
create policy "categories read" on public.categories
  for select to anon, authenticated using (true);
drop policy if exists "categories admin write" on public.categories;
create policy "categories admin write" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "products read" on public.products;
create policy "products read" on public.products
  for select to anon, authenticated using (active or public.is_admin());
drop policy if exists "products admin write" on public.products;
create policy "products admin write" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "variants read" on public.product_variants;
create policy "variants read" on public.product_variants
  for select to anon, authenticated using (true);
drop policy if exists "variants admin write" on public.product_variants;
create policy "variants admin write" on public.product_variants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "images read" on public.product_images;
create policy "images read" on public.product_images
  for select to anon, authenticated using (true);
drop policy if exists "images admin write" on public.product_images;
create policy "images admin write" on public.product_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- endereços: cada um cuida do seu
drop policy if exists "addresses owner" on public.addresses;
create policy "addresses owner" on public.addresses
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- pedidos: dono lê o próprio, admin lê tudo. Escrita só pelo backend (service_role).
drop policy if exists "orders read" on public.orders;
create policy "orders read" on public.orders
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "orders admin update" on public.orders;
create policy "orders admin update" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "order items read" on public.order_items;
create policy "order items read" on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "payment events admin" on public.payment_events;
create policy "payment events admin" on public.payment_events
  for select to authenticated using (public.is_admin());

drop policy if exists "stock movements admin" on public.stock_movements;
create policy "stock movements admin" on public.stock_movements
  for select to authenticated using (public.is_admin());

-- =====================================================================
--  STORAGE — bucket público das imagens de produto
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "product-images read" on storage.objects;
create policy "product-images read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'product-images');

drop policy if exists "product-images admin write" on storage.objects;
create policy "product-images admin write" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "product-images admin update" on storage.objects;
create policy "product-images admin update" on storage.objects
  for update to authenticated using (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "product-images admin delete" on storage.objects;
create policy "product-images admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());

-- =====================================================================
--  SEED — categorias + produtos de exemplo (mesmos do modo demonstração)
-- =====================================================================
insert into public.categories (slug, name, kind, sort) values
  ('bodies',    'Bodies',    'roupas', 1),
  ('conjuntos', 'Conjuntos', 'roupas', 2),
  ('mijao',     'Mijão',     'roupas', 3),
  ('shorts',    'Shorts',    'roupas', 4),
  ('pelucias',  'Pelúcias',  'brinquedos', 5)
on conflict (slug) do nothing;

-- Produtos + variações + imagens: veja lib/data/seed.ts (modo demonstração).
-- Para popular via SQL, gere os inserts a partir daquele arquivo ou cadastre
-- pelo painel /admin depois de virar admin.

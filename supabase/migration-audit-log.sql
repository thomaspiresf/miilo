-- =====================================================================
--  Log de atividade do admin — registra quem fez cada ação
--  Rode no SQL Editor do Supabase. Idempotente.
-- =====================================================================

create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_email text,
  actor_name  text,
  action      text not null,        -- 'product.create', 'stock.adjust', 'order.status'…
  entity      text,                 -- 'product' | 'order' | 'coupon' | 'category' | 'variant' | 'user'
  entity_id   text,
  summary     text not null,        -- frase legível em pt-BR
  meta        jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_log_created on public.audit_log(created_at desc);
create index if not exists idx_audit_log_actor on public.audit_log(actor_email);
create index if not exists idx_audit_log_action on public.audit_log(action);

alter table public.audit_log enable row level security;
-- só a service_role escreve e lê (o app usa o admin client); sem policy pública

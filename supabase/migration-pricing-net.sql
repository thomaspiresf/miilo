-- Margem líquida: quantos pedidos por mês (estimado) pra ratear o custo fixo.
-- 0 = não definido -> margem líquida não é calculada.
alter table public.pricing_settings
  add column if not exists monthly_orders int not null default 0;

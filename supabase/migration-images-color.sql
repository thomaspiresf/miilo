-- =====================================================================
--  Foto por cor da variação
--  Rode no SQL Editor do Supabase. Seguro rodar mais de uma vez.
-- =====================================================================

-- cor à qual a imagem pertence (ex.: "Rosa"). NULL = vale para todas as cores.
alter table public.product_images add column if not exists color text;

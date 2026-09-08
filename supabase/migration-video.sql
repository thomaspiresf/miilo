-- =====================================================================
--  Vídeo do produto
--  Rode no SQL Editor do Supabase. Seguro rodar mais de uma vez.
-- =====================================================================

-- caminho do arquivo no bucket product-images OU link do YouTube/Vimeo
alter table public.products add column if not exists video_url text;

-- Vídeo do produto: tocar com ou sem áudio.
-- true  = prévia silenciosa (autoplay em loop, cliente pode ativar o som)
-- false = com áudio, o cliente dá play manualmente
alter table public.products
  add column if not exists video_muted boolean not null default true;

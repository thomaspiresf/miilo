-- Áudio do vídeo do produto: 3 modos.
--   'muted'    = sempre mudo, sem botão pra ativar o som (prévia travada)
--   'optional' = começa mudo (autoplay em loop), cliente pode ativar o som
--   'on'       = toca com som quando o cliente dá play
alter table public.products
  add column if not exists video_audio text not null default 'optional'
  check (video_audio in ('muted', 'optional', 'on'));

-- migra o booleano antigo (video_muted), se existir
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'video_muted'
  ) then
    update public.products
      set video_audio = case when video_muted then 'optional' else 'on' end
      where video_url is not null;
    alter table public.products drop column video_muted;
  end if;
end $$;

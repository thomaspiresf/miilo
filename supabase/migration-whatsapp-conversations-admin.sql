-- =====================================================================
--  Painel de conversas do WhatsApp — quem mandou cada resposta (bot ou
--  humano) e quais conversas estão pausadas (admin assumiu o controle).
--  Rode no SQL Editor do Supabase. Idempotente.
-- =====================================================================

alter table public.whatsapp_conversations
  add column if not exists sender text; -- 'bot' | 'human' — null nas mensagens do cliente e em linhas antigas (bot)

create table if not exists public.whatsapp_bot_pauses (
  phone      text primary key,
  paused_at  timestamptz not null default now(),
  paused_by  text
);

alter table public.whatsapp_bot_pauses enable row level security;
-- só a service_role lê/escreve (o admin e o webhook usam o admin client); sem policy pública

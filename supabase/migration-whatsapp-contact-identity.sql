-- =====================================================================
--  Identidade na conversa: nome de exibição do WhatsApp de quem entra em
--  contato (vem no payload do webhook, contacts[0].profile.name) e qual
--  admin respondeu quando é um humano (sender='human').
--  Rode no SQL Editor do Supabase. Idempotente.
-- =====================================================================

alter table public.whatsapp_conversations
  add column if not exists actor_name text; -- nome/e-mail de quem (humano) mandou essa mensagem — só quando sender='human'

create table if not exists public.whatsapp_contacts (
  phone       text primary key,
  name        text, -- nome de exibição do WhatsApp da pessoa (contacts[0].profile.name no webhook)
  updated_at  timestamptz not null default now()
);

alter table public.whatsapp_contacts enable row level security;
-- só a service_role lê/escreve (o admin e o webhook usam o admin client); sem policy pública

-- =====================================================================
--  Memória de conversa do bot de WhatsApp — últimas mensagens por número,
--  pra permitir perguntas de acompanhamento ("e quais foram os itens?").
--  Rode no SQL Editor do Supabase. Idempotente.
-- =====================================================================

create table if not exists public.whatsapp_conversations (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null,        -- número de quem mandou, ex.: '5515991295541'
  role       text not null,        -- 'user' | 'assistant'
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_conv_phone on public.whatsapp_conversations(phone, created_at desc);

alter table public.whatsapp_conversations enable row level security;
-- só a service_role lê/escreve (o webhook usa o admin client); sem policy pública

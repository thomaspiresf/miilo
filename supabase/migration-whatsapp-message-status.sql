-- =====================================================================
--  Status de entrega das mensagens do WhatsApp (enviada/entregue/lida) —
--  guarda o ID que a Meta devolve ao enviar (wamid) pra depois atualizar
--  quando o webhook de status chegar.
--  Rode no SQL Editor do Supabase. Idempotente.
-- =====================================================================

alter table public.whatsapp_conversations
  add column if not exists wamid text,
  add column if not exists status text; -- 'sent' | 'delivered' | 'read' | 'failed' — só faz sentido pra role='assistant'

create index if not exists idx_whatsapp_conv_wamid on public.whatsapp_conversations(wamid) where wamid is not null;

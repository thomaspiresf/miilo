-- =====================================================================
--  migration-security.sql — fecha a escalada de privilégio via RLS
-- =====================================================================
--  Contexto: a política "profile self update" deixava um cliente logado
--  rodar  UPDATE profiles SET role='admin' WHERE id = auth.uid()  e, como
--  is_admin() confiava em profiles.role, isso liberava (via chave anon,
--  falando direto com o Supabase) leitura de todos os pedidos, escrita no
--  catálogo, marcar pedido como pago, etc.
--
--  O app NUNCA usa is_admin(): o acesso ao /admin é decidido pela lista
--  ADMIN_EMAILS (env) e toda escrita sensível passa pela service_role
--  (que ignora RLS). Então:
--    1. is_admin() passa a retornar sempre false  -> nenhuma política RLS
--       baseada nela concede mais nada pela chave anon;
--    2. a política de update de profiles passa a congelar o campo role;
--    3. zera qualquer role que já tenha sido escalado.
--
--  Idempotente — pode rodar de novo sem problema.
-- =====================================================================

-- 1. is_admin() neutralizada (mantida só para não quebrar as políticas
--    que a referenciam; o app não depende dela).
create or replace function public.is_admin()
returns boolean language sql immutable as $$
  select false;
$$;

-- 2. update de profiles não pode mais mudar o role
drop policy if exists "profile self update" on public.profiles;
create policy "profile self update" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- 3. limpa qualquer escalada que já tenha acontecido
update public.profiles set role = 'customer' where role is distinct from 'customer';

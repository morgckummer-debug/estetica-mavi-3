-- ============================================================
-- MAVI — permite o formulário público GRAVAR fichas (nunca ler)
-- Rode no Supabase: SQL Editor > New query > Run
--
-- Com esta regra o site grava usando só a chave pública (anon),
-- sem precisar da chave secreta no servidor. Ler as fichas continua
-- restrito à Marina logada (policies do 0001).
-- ============================================================

drop policy if exists "publico pode inserir fichas" on public.fichas;
create policy "publico pode inserir fichas"
  on public.fichas for insert
  to anon, authenticated
  with check (true);

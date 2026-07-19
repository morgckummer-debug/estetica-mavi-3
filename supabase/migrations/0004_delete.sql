-- ============================================================
-- MAVI — permite a Marina (logada) EXCLUIR fichas
-- Rode no Supabase: SQL Editor > New query > Run
--
-- Só usuários autenticados (a Marina) podem apagar. O público
-- (anon) continua só podendo inserir, nunca ler nem apagar.
-- ============================================================

drop policy if exists "authenticated pode excluir fichas" on public.fichas;
create policy "authenticated pode excluir fichas"
  on public.fichas for delete
  to authenticated
  using (true);

-- ============================================================
-- MAVI — "Excluir definitivamente" um cadastro de cliente não funcionava:
-- a tabela public.clientes tem RLS habilitado com policies de SELECT,
-- INSERT e UPDATE (0012_clientes.sql), mas nunca ganhou uma de DELETE —
-- diferente de fichas (0004_delete.sql), sessões e contratos, que já
-- tinham. Sem policy de DELETE, o comando não dá erro: só afeta 0 linhas,
-- e o app detecta isso e mostra "permissão de excluir clientes ausente"
-- (ver excluirClienteDefinitivamente em src/lib/painel.ts).
-- ============================================================

drop policy if exists "authenticated pode excluir clientes" on public.clientes;
create policy "authenticated pode excluir clientes"
  on public.clientes for delete
  to authenticated
  using (true);

-- ============================================================
-- MAVI — bucket para os backups diários automáticos
-- Rode no Supabase: SQL Editor > New query > Run
--
-- O repositório do site é PÚBLICO no GitHub — por isso os backups não
-- podem ser gravados lá dentro (exporia nome, CPF, telefone e respostas de
-- anamnese de todo mundo). Este bucket privado do Storage guarda o .json
-- gerado todo dia pela rotina .github/workflows/supabase-backup.yml.
-- ============================================================

-- Bucket privado — nunca público, os backups têm dados pessoais das clientes.
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

-- Mesmo padrão de RLS do bucket "contratos" (0018_contrato_pdf.sql): só a
-- Marina/Morgana autenticadas no painel conseguem ler ou apagar um backup
-- pelo navegador. A rotina automática usa a chave secreta (service_role),
-- que ignora RLS, então não precisa de policy nenhuma pra gravar.
drop policy if exists "authenticated pode ler backups" on storage.objects;
create policy "authenticated pode ler backups"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'backups');

drop policy if exists "authenticated pode apagar backups" on storage.objects;
create policy "authenticated pode apagar backups"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'backups');

-- ============================================================
-- MAVI — anexar o PDF do contrato assinado na aba Contratos
-- Rode no Supabase: SQL Editor > New query > Run
--
-- A Marina continua imprimindo o contrato como já fazia (botão "Imprimir
-- contrato" → "Salvar como PDF" no diálogo do navegador). Esta migração só
-- cria onde guardar esse PDF depois: um bucket de Storage privado
-- ("contratos") e a coluna que aponta pra ele.
-- ============================================================

alter table public.contratos
  add column if not exists pdf_path text;

-- Bucket privado — nunca público, os PDFs têm dados pessoais da cliente.
insert into storage.buckets (id, name, public)
values ('contratos', 'contratos', false)
on conflict (id) do nothing;

-- Mesmo padrão de RLS do resto do app: só a Marina (autenticada) lê/grava.
drop policy if exists "authenticated pode ler pdf de contratos" on storage.objects;
create policy "authenticated pode ler pdf de contratos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'contratos');

drop policy if exists "authenticated pode enviar pdf de contratos" on storage.objects;
create policy "authenticated pode enviar pdf de contratos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'contratos');

drop policy if exists "authenticated pode substituir pdf de contratos" on storage.objects;
create policy "authenticated pode substituir pdf de contratos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'contratos')
  with check (bucket_id = 'contratos');

drop policy if exists "authenticated pode apagar pdf de contratos" on storage.objects;
create policy "authenticated pode apagar pdf de contratos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'contratos');

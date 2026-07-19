-- ============================================================
-- MAVI — separa o cadastro de dados pessoais das fichas de serviço
-- Rode no Supabase: SQL Editor > New query > Run
-- ============================================================

-- Libera o novo tipo "cadastro" (ficha de dados pessoais, preenchida uma
-- vez, separada de corporal/facial/laser).
alter table public.fichas
  drop constraint if exists fichas_tipo_check;
alter table public.fichas
  add constraint fichas_tipo_check check (tipo in ('corporal', 'facial', 'laser', 'cadastro'));

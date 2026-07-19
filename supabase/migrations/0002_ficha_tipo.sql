-- ============================================================
-- MAVI — adiciona o tipo da ficha (corporal / facial / laser)
-- Rode no Supabase: SQL Editor > New query > Run
-- (Pode rodar mesmo que a tabela já exista com dados.)
-- ============================================================

alter table public.fichas
  add column if not exists tipo text not null default 'corporal';

-- Só aceita os 3 tipos válidos
alter table public.fichas
  drop constraint if exists fichas_tipo_check;
alter table public.fichas
  add constraint fichas_tipo_check check (tipo in ('corporal', 'facial', 'laser'));

create index if not exists fichas_tipo_idx on public.fichas (tipo);

-- ============================================================
-- MAVI — Pacotes de sessões comprados por item (área/procedimento)
-- Rode no Supabase: SQL Editor > New query > Run
--
-- Guarda quantas sessões a cliente comprou de cada item (ex.: "Axilas": 10),
-- para o painel mostrar o progresso do pacote no histórico de sessões.
-- Chave = nome do item (mesmo texto usado em sessoes.areas), valor = total
-- comprado. Preenchido pela Marina ao registrar a 1ª sessão do item.
-- ============================================================

alter table public.fichas
  add column if not exists pacotes jsonb not null default '{}'::jsonb;

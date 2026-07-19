-- ============================================================
-- MAVI — Arquivar sessões em vez de excluir
-- Rode no Supabase: SQL Editor > New query > Run
--
-- Excluir uma sessão de verdade (DELETE) é irreversível — inclusive
-- quando a sessão já tinha a "assinatura" da cliente (confirmado = true).
-- Trocamos por um arquivamento: a sessão some da lista normal, mas fica
-- guardada e pode ser restaurada depois em "Sessões arquivadas".
-- ============================================================

alter table public.sessoes
  add column if not exists arquivado boolean not null default false;

create index if not exists sessoes_arquivado_idx on public.sessoes (ficha_id, arquivado);

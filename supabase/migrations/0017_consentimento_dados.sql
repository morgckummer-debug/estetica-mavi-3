-- ============================================================
-- MAVI — consentimento específico de tratamento de dados (LGPD)
-- Rode no Supabase: SQL Editor > New query > Run
--
-- Separado do `termo_aceito` (que é sobre a avaliação clínica, não sobre
-- proteção de dados). A cliente passa a marcar os dois: o termo de
-- responsabilidade e, agora, este consentimento específico — exigido pela
-- LGPD (Lei 13.709/2018, Art. 11) por envolver dado sensível de saúde.
-- ============================================================

alter table public.fichas
  add column if not exists consentimento_dados boolean not null default false;

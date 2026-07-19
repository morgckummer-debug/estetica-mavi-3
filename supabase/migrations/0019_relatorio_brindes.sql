-- ============================================================
-- MAVI — Relatório de pacote passa a incluir também o(s) brinde(s) de
-- outro procedimento vinculados a esse pacote (ver 0010_relatorios_pacote.sql
-- e aplicarPacote/enviarRelatorio em HistoricoSessoes.tsx), com o dia em que
-- foram realizados — pra cliente ver tudo junto quando pede o relatório,
-- sem precisar perguntar separado sobre o brinde.
-- ============================================================

alter table public.relatorios_pacote
  add column if not exists brindes jsonb not null default '[]'::jsonb;

create or replace function public.relatorio_pacote_por_token(p_token text)
returns table (
  cliente_nome  text,
  item          text,
  pacote_total  int,
  concluido     boolean,
  sessoes       jsonb,
  brindes       jsonb
)
language sql
security definer
set search_path = public
as $$
  select r.cliente_nome, r.item, r.pacote_total, r.concluido, r.sessoes, r.brindes
  from public.relatorios_pacote r
  where r.token = p_token
  limit 1
$$;

grant execute on function public.relatorio_pacote_por_token(text) to anon, authenticated;

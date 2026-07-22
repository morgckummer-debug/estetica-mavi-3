-- ============================================================
-- MAVI — Confirmação em lote (um link para várias sessões do mesmo dia)
-- Rode no Supabase: SQL Editor > New query > Cole este arquivo > Run
--
-- Uma cliente pode fazer vários procedimentos no mesmo dia (ex.: depilação
-- de axila + abdome + queixo, ou depilação + drenagem). Cada procedimento
-- vira uma sessão diferente, cada uma com seu próprio token. Sem lote, a
-- Marina teria que mandar N links no WhatsApp. Aqui a gente marca as
-- sessões escolhidas com um `lote_token` compartilhado e a cliente confirma
-- todas de uma vez em /confirmar/lote/<token>.
-- ============================================================

alter table public.sessoes
  add column if not exists lote_token text;

create index if not exists sessoes_lote_token_idx
  on public.sessoes (lote_token)
  where lote_token is not null;

-- ------------------------------------------------------------
-- Confirmação pública, sem expor a tabela.
-- SECURITY DEFINER (mesma abordagem de sessao_por_token / confirmar_sessao):
-- só devolvem/alteram as linhas do lote_token informado.
-- ------------------------------------------------------------

create or replace function public.sessoes_por_lote(p_lote_token text)
returns table (
  sessao_id     uuid,
  primeiro_nome text,
  data          date,
  areas         text[],
  observacao    text,
  confirmado    boolean,
  confirmado_em timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    split_part(btrim(f.nome), ' ', 1) as primeiro_nome,
    s.data,
    s.areas,
    s.observacao,
    s.confirmado,
    s.confirmado_em
  from public.sessoes s
  join public.fichas f on f.id = s.ficha_id
  where s.lote_token = p_lote_token
    and coalesce(s.arquivado, false) = false
  order by s.data desc, s.created_at asc
$$;

create or replace function public.confirmar_lote(p_lote_token text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quando timestamptz;
begin
  update public.sessoes
     set confirmado = true,
         confirmado_em = coalesce(confirmado_em, now())
   where lote_token = p_lote_token
     and coalesce(arquivado, false) = false;

  select max(confirmado_em) into v_quando
    from public.sessoes
   where lote_token = p_lote_token;

  return v_quando;
end;
$$;

grant execute on function public.sessoes_por_lote(text) to anon, authenticated;
grant execute on function public.confirmar_lote(text)   to anon, authenticated;

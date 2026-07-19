-- ============================================================
-- MAVI — Histórico de sessões (o "caderninho" digital)
-- Rode no Supabase: SQL Editor > New query > Run
--
-- Cada linha é UMA sessão de atendimento de uma cliente:
--   data + áreas realizadas + observação + confirmação da cliente.
-- A cliente confirma pelo próprio celular, por um link com um token
-- único. A confirmação vale como a "assinatura" do caderno de papel.
-- ============================================================

create table if not exists public.sessoes (
  id            uuid primary key default gen_random_uuid(),
  ficha_id      uuid not null references public.fichas(id) on delete cascade,
  created_at    timestamptz not null default now(),
  -- Dia em que o procedimento foi realizado (a Marina escolhe; padrão hoje).
  data          date not null default current_date,
  -- Áreas realizadas na sessão (axilas, virilha, etc.).
  areas         text[] not null default '{}',
  -- Anotação livre da Marina ("o que foi feito").
  observacao    text,
  -- Token do link público de confirmação. Difícil de adivinhar.
  token         text not null unique default replace(gen_random_uuid()::text, '-', ''),
  -- "Assinatura" digital: a cliente confirmou este atendimento.
  confirmado    boolean not null default false,
  confirmado_em timestamptz
);

create index if not exists sessoes_ficha_idx on public.sessoes (ficha_id, data desc);
create index if not exists sessoes_token_idx on public.sessoes (token);

-- ------------------------------------------------------------
-- Segurança (Row Level Security)
--  - A Marina (logada) gerencia as sessões das fichas.
--  - O público NÃO acessa a tabela direto. A cliente só interage
--    pelo link, através de duas funções controladas (abaixo), que
--    trabalham apenas na linha do token informado.
-- ------------------------------------------------------------
alter table public.sessoes enable row level security;

drop policy if exists "authenticated pode ler sessoes" on public.sessoes;
create policy "authenticated pode ler sessoes"
  on public.sessoes for select
  to authenticated
  using (true);

drop policy if exists "authenticated pode inserir sessoes" on public.sessoes;
create policy "authenticated pode inserir sessoes"
  on public.sessoes for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated pode atualizar sessoes" on public.sessoes;
create policy "authenticated pode atualizar sessoes"
  on public.sessoes for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated pode excluir sessoes" on public.sessoes;
create policy "authenticated pode excluir sessoes"
  on public.sessoes for delete
  to authenticated
  using (true);

-- ------------------------------------------------------------
-- Confirmação pública, sem expor a tabela.
-- SECURITY DEFINER: rodam com permissão elevada, mas SÓ mexem na
-- linha do token. Não vaza nome completo nem dados de saúde: a
-- cliente só vê o primeiro nome, a data e as áreas do atendimento.
-- ------------------------------------------------------------

-- Dados mínimos da sessão, para montar a tela de confirmação.
create or replace function public.sessao_por_token(p_token text)
returns table (
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
    split_part(btrim(f.nome), ' ', 1) as primeiro_nome,
    s.data,
    s.areas,
    s.observacao,
    s.confirmado,
    s.confirmado_em
  from public.sessoes s
  join public.fichas f on f.id = s.ficha_id
  where s.token = p_token
  limit 1
$$;

-- A cliente confirma o atendimento. Idempotente: manter a 1ª data.
create or replace function public.confirmar_sessao(p_token text)
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
   where token = p_token
   returning confirmado_em into v_quando;
  return v_quando;
end;
$$;

-- Só estas duas funções ficam acessíveis ao público (anon).
grant execute on function public.sessao_por_token(text) to anon, authenticated;
grant execute on function public.confirmar_sessao(text) to anon, authenticated;

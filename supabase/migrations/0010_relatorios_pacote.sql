-- ============================================================
-- MAVI — Relatório de pacote para a cliente conferir sozinha
-- Rode no Supabase: SQL Editor > New query > Run
--
-- A Marina escolhe um pacote (de um item já cadastrado) e gera um link
-- público pra mandar por WhatsApp, com a lista de sessões, quando cada
-- uma foi confirmada, e quantas faltam (ou se já completou) — pra fechar
-- qualquer dúvida da cliente sobre a contagem, sem expor a ficha inteira.
--
-- É um retrato (snapshot) tirado no momento do envio, não um cálculo ao
-- vivo: reenviar o mesmo pacote atualiza o mesmo registro (upsert por
-- ficha+item+número do pacote), então o link continua sendo o mesmo,
-- só com os dados renovados.
-- ============================================================

create table if not exists public.relatorios_pacote (
  id             uuid primary key default gen_random_uuid(),
  ficha_id       uuid not null references public.fichas(id) on delete cascade,
  item           text not null,
  pacote_numero  int not null,
  token          text not null unique default replace(gen_random_uuid()::text, '-', ''),
  cliente_nome   text not null,
  pacote_total   int not null,
  concluido      boolean not null default false,
  -- Uma entrada por sessão do pacote no momento do envio:
  -- [{"data": "2026-01-10", "confirmado": true, "confirmado_em": "..."}, ...]
  sessoes        jsonb not null default '[]'::jsonb,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (ficha_id, item, pacote_numero)
);

create index if not exists relatorios_pacote_token_idx on public.relatorios_pacote (token);

alter table public.relatorios_pacote enable row level security;

drop policy if exists "authenticated pode gerenciar relatorios" on public.relatorios_pacote;
create policy "authenticated pode gerenciar relatorios"
  on public.relatorios_pacote for all
  to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- Leitura pública, só pelo token — igual ao padrão de sessao_por_token
-- (0005_sessoes.sql): a tabela nunca fica acessível direto pro público,
-- só por esta função, que devolve apenas o que o relatório já mostra.
-- ------------------------------------------------------------
create or replace function public.relatorio_pacote_por_token(p_token text)
returns table (
  cliente_nome  text,
  item          text,
  pacote_total  int,
  concluido     boolean,
  sessoes       jsonb
)
language sql
security definer
set search_path = public
as $$
  select r.cliente_nome, r.item, r.pacote_total, r.concluido, r.sessoes
  from public.relatorios_pacote r
  where r.token = p_token
  limit 1
$$;

grant execute on function public.relatorio_pacote_por_token(text) to anon, authenticated;

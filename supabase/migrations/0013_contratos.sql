-- ============================================================
-- MAVI — Histórico de contratos gerados
-- Rode no Supabase: SQL Editor > New query > Run
--
-- Até aqui, "Gerar contrato" (painel/contrato/$id) só montava o
-- documento na hora pra imprimir — nada ficava salvo. Esta tabela guarda
-- cada contrato gerado (itens contratados, forma de pagamento, data),
-- pra aparecer na aba "Contratos" da cliente.
-- ============================================================

create table if not exists public.contratos (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references public.clientes(id) on delete cascade,
  created_at     timestamptz not null default now(),
  profissao      text,
  estado_civil   text,
  -- Array de { tipo, descricao, quantidade } — mesmo formato de
  -- ItemContratado em src/data/contrato.ts.
  itens          jsonb not null default '[]'::jsonb,
  forma_pagamento text,
  autoriza_foto  boolean not null default false,
  -- Data que consta no contrato impresso (a Marina pode ajustar; padrão
  -- é o dia da geração).
  data_contrato  date not null default current_date
);

create index if not exists contratos_cliente_idx on public.contratos (cliente_id, created_at desc);

-- ------------------------------------------------------------
-- Segurança (Row Level Security)
-- Só a Marina (autenticada) gera contrato pelo painel — não existe
-- fluxo público aqui, diferente de `fichas`/`sessoes`.
-- ------------------------------------------------------------
alter table public.contratos enable row level security;

drop policy if exists "authenticated pode ler contratos" on public.contratos;
create policy "authenticated pode ler contratos"
  on public.contratos for select
  to authenticated
  using (true);

drop policy if exists "authenticated pode inserir contratos" on public.contratos;
create policy "authenticated pode inserir contratos"
  on public.contratos for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated pode atualizar contratos" on public.contratos;
create policy "authenticated pode atualizar contratos"
  on public.contratos for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated pode excluir contratos" on public.contratos;
create policy "authenticated pode excluir contratos"
  on public.contratos for delete
  to authenticated
  using (true);

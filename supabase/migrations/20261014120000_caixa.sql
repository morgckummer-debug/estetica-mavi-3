-- ============================================================
-- MAVI — Livro caixa
-- Rode no Supabase: SQL Editor > New query > Run
--
-- caixa_lancamentos: cada VENDA (entrada) ou SAÍDA (gasto) lançada. As
-- parcelas do cartão não são gravadas: o painel calcula, a partir da data da
-- venda, do número de parcelas e da taxa da maquininha, quanto cai em cada mês.
-- caixa_config: uma única linha, com as taxas da maquininha usadas para
-- preencher as vendas novas.
--
-- Só a Marina (autenticada) lê e grava. O público não enxerga nada.
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================

create table if not exists public.caixa_lancamentos (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  -- Dia da venda ou do gasto.
  data         date not null,
  tipo         text not null check (tipo in ('entrada', 'saida')),
  descricao    text not null,
  -- Só para saídas (Produtos, Aluguel...). Vendas ficam sem categoria.
  categoria    text,
  -- Valor cobrado da cliente (ou gasto), em reais, antes da taxa.
  valor        numeric(12, 2) not null check (valor > 0),
  forma        text not null check (forma in ('pix', 'debito', 'credito', 'dinheiro')),
  parcelas     int not null default 1 check (parcelas between 1 and 24),
  -- Taxa da maquininha em %, já descontada do que a clínica recebe.
  taxa_pct     numeric(5, 2) not null default 0 check (taxa_pct >= 0 and taxa_pct < 100),
  cliente_id   uuid references public.clientes(id) on delete set null,
  cliente_nome text,
  -- Contrato impresso que originou a venda, quando veio da tela de contrato.
  contrato_id  uuid
);

create index if not exists caixa_lancamentos_data_idx on public.caixa_lancamentos (data);

create table if not exists public.caixa_config (
  id                      int primary key default 1 check (id = 1),
  taxa_debito             numeric(5, 2) not null default 0,
  taxa_credito_a_vista    numeric(5, 2) not null default 0,
  taxa_credito_parcelado  numeric(5, 2) not null default 0
);

insert into public.caixa_config (id) values (1) on conflict (id) do nothing;

alter table public.caixa_lancamentos enable row level security;
alter table public.caixa_config      enable row level security;

grant select, insert, update, delete on public.caixa_lancamentos to authenticated;
grant select, insert, update, delete on public.caixa_config      to authenticated;
grant select, insert, update, delete on public.caixa_lancamentos to service_role;
grant select, insert, update, delete on public.caixa_config      to service_role;

drop policy if exists "authenticated gerencia caixa_lancamentos" on public.caixa_lancamentos;
create policy "authenticated gerencia caixa_lancamentos"
  on public.caixa_lancamentos for all to authenticated using (true) with check (true);

drop policy if exists "authenticated gerencia caixa_config" on public.caixa_config;
create policy "authenticated gerencia caixa_config"
  on public.caixa_config for all to authenticated using (true) with check (true);

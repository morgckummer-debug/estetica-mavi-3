-- ============================================================
-- MAVI — Tabela de preços (procedimentos e pacotes)
-- Rode no Supabase: SQL Editor > New query > Run
--
-- Uma linha por procedimento (o mesmo nome usado nas fichas e nos contratos,
-- ex.: "Drenagem Linfática"): o preço da sessão avulsa e uma lista de pacotes
-- (`pacotes`: [{ "sessoes": 10, "valor": 1200, "rotulo": "opcional" }]).
-- Alimenta o valor sugerido no contrato e na "Nova venda" do Caixa; a Marina
-- sempre pode mudar o valor na hora.
--
-- Só a Marina (autenticada) lê e grava.
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================

create table if not exists public.caixa_precos (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  nome         text not null,
  preco_sessao numeric(12, 2) check (preco_sessao is null or preco_sessao >= 0),
  pacotes      jsonb not null default '[]'::jsonb,
  ordem        int not null default 0
);

alter table public.caixa_precos enable row level security;

grant select, insert, update, delete on public.caixa_precos to authenticated;
grant select, insert, update, delete on public.caixa_precos to service_role;

drop policy if exists "authenticated gerencia caixa_precos" on public.caixa_precos;
create policy "authenticated gerencia caixa_precos"
  on public.caixa_precos for all to authenticated using (true) with check (true);

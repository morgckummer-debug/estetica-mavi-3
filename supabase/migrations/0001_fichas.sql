-- ============================================================
-- MAVI — Fichas de anamnese dos pacientes
-- Rode este script no Supabase: Dashboard > SQL Editor > New query
-- ============================================================

create table if not exists public.fichas (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  nome          text not null,
  telefone      text,
  -- Todas as respostas da anamnese ficam aqui (formato flexível).
  -- Mudar/adicionar perguntas NÃO exige alterar o banco.
  respostas     jsonb not null default '{}'::jsonb,
  -- Alertas de segurança calculados no envio (gestante, próteses, etc.)
  alertas       text[] not null default '{}',
  -- Consentimentos
  termo_aceito  boolean not null default false,
  autoriza_foto boolean not null default false,
  -- Preenchido pela Marina no painel (durante o atendimento)
  medidas       jsonb not null default '{}'::jsonb,
  relatorio     text,
  arquivada     boolean not null default false
);

-- Buscas mais recentes primeiro / por nome
create index if not exists fichas_created_at_idx on public.fichas (created_at desc);
create index if not exists fichas_nome_idx on public.fichas (lower(nome));

-- ------------------------------------------------------------
-- Segurança (Row Level Security)
-- Dados de saúde: ninguém acessa direto pelo navegador.
--  - O formulário público grava por uma função no servidor
--    usando a chave "service_role" (que ignora o RLS).
--  - A Marina, logada, consegue LER e ATUALIZAR as fichas.
-- ------------------------------------------------------------
alter table public.fichas enable row level security;

-- Marina (qualquer usuário autenticado) pode ler as fichas
drop policy if exists "authenticated pode ler fichas" on public.fichas;
create policy "authenticated pode ler fichas"
  on public.fichas for select
  to authenticated
  using (true);

-- Marina pode atualizar (medidas, relatório, arquivar)
drop policy if exists "authenticated pode atualizar fichas" on public.fichas;
create policy "authenticated pode atualizar fichas"
  on public.fichas for update
  to authenticated
  using (true)
  with check (true);

-- OBS: não criamos policy de INSERT para 'anon'/'authenticated'.
-- Os envios do formulário público entram pelo servidor com a
-- chave service_role, que ignora o RLS. Assim o público nunca
-- consegue ler nem gravar direto no banco.

-- ============================================================
-- MAVI — Cadastro de clientes, separado das fichas
-- Rode no Supabase: SQL Editor > New query > Run
--
-- Até aqui, nome/telefone/CPF/endereço da cliente viviam duplicados
-- dentro de `fichas.respostas` — uma cópia por ficha (corporal, facial,
-- laser...) da mesma pessoa. Editar endereço numa ficha não refletia nas
-- outras, e o contrato impresso tinha que "adivinhar" de qual ficha pegar
-- cada pedaço do endereço. Esta tabela vira a fonte única da identidade;
-- `fichas` passa a só guardar a anamnese (saúde/hábitos) por tratamento,
-- ligada à cliente por `cliente_id`.
-- ============================================================

create table if not exists public.clientes (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  nome          text not null,
  telefone      text,
  cpf           text,
  email         text,
  nascimento    text, -- "AAAA-MM-DD", mesmo formato do <input type="date">
  sexo          text,
  profissao     text,
  estado_civil  text,
  cep           text,
  endereco      text,
  numero        text,
  complemento   text,
  cidade        text,
  como_conheceu text,
  autoriza_foto boolean not null default false,
  -- Mesma distinção já usada em `fichas`: `arquivada` é selo manual de
  -- cliente inativa (continua aparecendo); `excluida` esconde das listas
  -- e alimenta a recuperação em "Clientes excluídas".
  arquivada     boolean not null default false,
  excluida      boolean not null default false
);

create index if not exists clientes_created_at_idx on public.clientes (created_at desc);
create index if not exists clientes_nome_idx on public.clientes (lower(nome));
create index if not exists clientes_telefone_idx on public.clientes (telefone);
create index if not exists clientes_cpf_idx on public.clientes (cpf);
create index if not exists clientes_excluida_idx on public.clientes (excluida);

-- ------------------------------------------------------------
-- Segurança (Row Level Security) — mesmo padrão de `fichas`
-- (0001_fichas.sql / 0003_anon_insert.sql): a Marina (autenticada) lê e
-- atualiza; o público NUNCA lê nem grava direto nesta tabela. A criação/
-- atualização de cliente pelo formulário público passa só pela função
-- `encontrar_ou_criar_cliente` (abaixo), que roda com permissão elevada
-- mas só faz essa única coisa controlada.
-- ------------------------------------------------------------
alter table public.clientes enable row level security;

drop policy if exists "authenticated pode ler clientes" on public.clientes;
create policy "authenticated pode ler clientes"
  on public.clientes for select
  to authenticated
  using (true);

drop policy if exists "authenticated pode atualizar clientes" on public.clientes;
create policy "authenticated pode atualizar clientes"
  on public.clientes for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated pode inserir clientes" on public.clientes;
create policy "authenticated pode inserir clientes"
  on public.clientes for insert
  to authenticated
  with check (true);

-- ------------------------------------------------------------
-- `fichas` passa a apontar para a cliente dona da anamnese.
-- Nullable por enquanto: o script de migração de dados preenche o
-- `cliente_id` das fichas já existentes antes de virar `not null`
-- (ver 0013_ficha_cliente_id_not_null.sql).
-- ------------------------------------------------------------
alter table public.fichas
  add column if not exists cliente_id uuid references public.clientes(id);

create index if not exists fichas_cliente_id_idx on public.fichas (cliente_id);

-- ------------------------------------------------------------
-- Acha a cliente pelo telefone ou CPF informado (o mesmo critério que a
-- Marina já usa de olho — "essa cliente já tem cadastro?") ou cria uma
-- nova. SECURITY DEFINER: roda com permissão elevada, mas só executa esta
-- única operação controlada — o `anon` nunca lê/grava a tabela
-- diretamente, só chama esta função (mesmo padrão de
-- `sessao_por_token`/`confirmar_sessao` em 0005_sessoes.sql).
-- ------------------------------------------------------------
create or replace function public.encontrar_ou_criar_cliente(
  p_nome          text,
  p_telefone      text,
  p_cpf           text default null,
  p_email         text default null,
  p_nascimento    text default null,
  p_sexo          text default null,
  p_profissao     text default null,
  p_estado_civil  text default null,
  p_cep           text default null,
  p_endereco      text default null,
  p_numero        text default null,
  p_complemento   text default null,
  p_cidade        text default null,
  p_como_conheceu text default null,
  p_autoriza_foto boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
    from public.clientes
   where excluida = false
     and (
       (p_telefone is not null and p_telefone <> '' and telefone = p_telefone)
       or (p_cpf is not null and p_cpf <> '' and cpf = p_cpf)
     )
   order by created_at desc
   limit 1;

  if v_id is not null then
    -- Cliente já existe: completa só o que estava vazio, sem sobrescrever
    -- o que ela já tinha (o formulário de uma ficha nova pode vir com
    -- menos detalhe do que o cadastro já tem).
    update public.clientes set
      nome          = coalesce(nullif(nome, ''), p_nome),
      cpf           = coalesce(nullif(cpf, ''), p_cpf),
      email         = coalesce(nullif(email, ''), p_email),
      nascimento    = coalesce(nullif(nascimento, ''), p_nascimento),
      sexo          = coalesce(nullif(sexo, ''), p_sexo),
      profissao     = coalesce(nullif(profissao, ''), p_profissao),
      estado_civil  = coalesce(nullif(estado_civil, ''), p_estado_civil),
      cep           = coalesce(nullif(cep, ''), p_cep),
      endereco      = coalesce(nullif(endereco, ''), p_endereco),
      numero        = coalesce(nullif(numero, ''), p_numero),
      complemento   = coalesce(nullif(complemento, ''), p_complemento),
      cidade        = coalesce(nullif(cidade, ''), p_cidade),
      como_conheceu = coalesce(nullif(como_conheceu, ''), p_como_conheceu)
    where id = v_id;
    return v_id;
  end if;

  insert into public.clientes (
    nome, telefone, cpf, email, nascimento, sexo, profissao, estado_civil,
    cep, endereco, numero, complemento, cidade, como_conheceu, autoriza_foto
  ) values (
    p_nome, nullif(p_telefone, ''), nullif(p_cpf, ''), nullif(p_email, ''),
    nullif(p_nascimento, ''), nullif(p_sexo, ''), nullif(p_profissao, ''),
    nullif(p_estado_civil, ''), nullif(p_cep, ''), nullif(p_endereco, ''),
    nullif(p_numero, ''), nullif(p_complemento, ''), nullif(p_cidade, ''),
    nullif(p_como_conheceu, ''), p_autoriza_foto
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.encontrar_ou_criar_cliente(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean
) to anon, authenticated;

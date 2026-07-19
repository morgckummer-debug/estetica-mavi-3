-- ============================================================
-- MAVI — desativa temporariamente a verificação de cliente duplicada
-- Rode no Supabase: SQL Editor > New query > Run
--
-- Enquanto o app está em período de teste (antes de ir pro ar na clínica
-- de verdade), a Marina usa o próprio CPF/celular pra testar várias
-- fichas — e `encontrar_ou_criar_cliente` (0012_clientes.sql) reconhecia
-- isso como "cliente já existe" e só atualizava o cadastro, em vez de
-- criar uma cliente nova, escondendo o teste da lista de clientes.
--
-- Essa migração recria a função com a verificação (telefone/CPF já
-- cadastrado) desligada por uma flag interna — toda ficha nova cria uma
-- cliente nova, mesmo repetindo CPF/celular.
--
-- IMPORTANTE: antes do app ir pro ar na clínica de verdade, rode de novo
-- essa mesma função com `v_verificar_duplicata` voltando pra `true`
-- (senão cada ficha de uma cliente real vira uma cliente duplicada).
-- ============================================================

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
  -- Desativado durante o período de teste (ver comentário acima) — trocar
  -- pra `true` antes de usar com clientes de verdade.
  v_verificar_duplicata constant boolean := false;
begin
  if v_verificar_duplicata then
    select id into v_id
      from public.clientes
     where excluida = false
       and (
         (p_telefone is not null and p_telefone <> '' and telefone = p_telefone)
         or (p_cpf is not null and p_cpf <> '' and cpf = p_cpf)
       )
     order by created_at desc
     limit 1;
  end if;

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

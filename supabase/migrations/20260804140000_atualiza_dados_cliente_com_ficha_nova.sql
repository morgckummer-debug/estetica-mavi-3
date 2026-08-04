-- ============================================================
-- MAVI — ficha nova atualiza os dados da cliente (em vez de só completar)
-- Rode no Supabase: SQL Editor > New query > Run
--
-- `encontrar_ou_criar_cliente` (0012/0015/20260724) só preenchia os campos
-- que estavam vazios quando reconhecia a cliente pelo CPF/telefone — um
-- campo já preenchido (ex.: data de nascimento) nunca era atualizado por
-- uma ficha nova, mesmo que a cliente tivesse mandado um valor diferente
-- (ex.: corrigindo um dado errado). Isso ficou confuso num teste: mandar
-- uma ficha nova com telefone repetido e nascimento diferente não mudava
-- nada no painel, parecendo que o cadastro não tinha chegado.
--
-- Agora é o contrário: o valor novo da ficha, quando vem preenchido,
-- SOBRESCREVE o que já estava salvo. Só mantém o valor antigo quando a
-- ficha nova vem com o campo vazio (não some dado por causa de uma ficha
-- mais simples, ex.: um convite sem endereço).
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
  p_autoriza_foto boolean default false,
  p_bairro        text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_verificar_duplicata constant boolean := true;
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
    -- Cliente já existe: o valor novo (se vier preenchido) sobrescreve o
    -- que ela já tinha — uma ficha nova é sempre a informação mais
    -- recente. Só mantém o valor antigo quando a ficha nova vem vazia
    -- nesse campo.
    update public.clientes set
      nome          = coalesce(nullif(p_nome, ''), nome),
      cpf           = coalesce(nullif(p_cpf, ''), cpf),
      email         = coalesce(nullif(p_email, ''), email),
      nascimento    = coalesce(nullif(p_nascimento, ''), nascimento),
      sexo          = coalesce(nullif(p_sexo, ''), sexo),
      profissao     = coalesce(nullif(p_profissao, ''), profissao),
      estado_civil  = coalesce(nullif(p_estado_civil, ''), estado_civil),
      cep           = coalesce(nullif(p_cep, ''), cep),
      endereco      = coalesce(nullif(p_endereco, ''), endereco),
      numero        = coalesce(nullif(p_numero, ''), numero),
      bairro        = coalesce(nullif(p_bairro, ''), bairro),
      complemento   = coalesce(nullif(p_complemento, ''), complemento),
      cidade        = coalesce(nullif(p_cidade, ''), cidade),
      como_conheceu = coalesce(nullif(p_como_conheceu, ''), como_conheceu)
    where id = v_id;
    return v_id;
  end if;

  insert into public.clientes (
    nome, telefone, cpf, email, nascimento, sexo, profissao, estado_civil,
    cep, endereco, numero, bairro, complemento, cidade, como_conheceu, autoriza_foto
  ) values (
    p_nome, nullif(p_telefone, ''), nullif(p_cpf, ''), nullif(p_email, ''),
    nullif(p_nascimento, ''), nullif(p_sexo, ''), nullif(p_profissao, ''),
    nullif(p_estado_civil, ''), nullif(p_cep, ''), nullif(p_endereco, ''),
    nullif(p_numero, ''), nullif(p_bairro, ''), nullif(p_complemento, ''), nullif(p_cidade, ''),
    nullif(p_como_conheceu, ''), p_autoriza_foto
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.encontrar_ou_criar_cliente(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean,text
) to anon, authenticated;

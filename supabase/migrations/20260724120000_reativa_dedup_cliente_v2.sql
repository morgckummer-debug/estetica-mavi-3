-- ============================================================
-- MAVI — religa a verificação de cliente duplicada (por CPF/telefone)
--
-- A migração 0015 já tinha religado essa checagem quando o app foi pro
-- ar de verdade, mas a migração 20260719154710_...sql (que adicionou
-- bairro/contratos/relatórios) recriou `encontrar_ou_criar_cliente` a
-- partir da versão de teste da 0016 e voltou a deixar
-- `v_verificar_duplicata := false` — sem querer. Resultado: cada ficha
-- nova (ex.: facial depois de depilação) virava um cadastro de cliente
-- duplicado em vez de completar o cadastro já existente.
--
-- Esta migração roda depois daquela (nome > 20260719154710) para que a
-- correção realmente valha.
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
      bairro        = coalesce(nullif(bairro, ''), p_bairro),
      complemento   = coalesce(nullif(complemento, ''), p_complemento),
      cidade        = coalesce(nullif(cidade, ''), p_cidade),
      como_conheceu = coalesce(nullif(como_conheceu, ''), p_como_conheceu)
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

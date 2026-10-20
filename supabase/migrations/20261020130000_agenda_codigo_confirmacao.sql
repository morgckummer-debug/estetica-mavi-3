-- ============================================================
-- MAVI — Agenda online: código de confirmação para procedimentos
--
-- Quem agenda procedimento precisa provar que é a titular do cadastro. O
-- código de 6 dígitos vai para o e-mail JÁ CADASTRADO da cliente (nunca para
-- um e-mail digitado na hora), então quem não tem acesso ao e-mail dela não
-- consegue agendar em nome dela.
--
-- Quem gera o código é o servidor, com a chave de serviço (service_role).
-- Quem confere é esta função, dentro do agendamento. A resposta a quem não
-- tem cadastro, CPF errado ou código errado é a MESMA: codigo_invalido. Assim
-- o agendamento não revela mais quem é paciente.
--
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================

-- 1. Códigos gerados. Só a chave de serviço lê e grava. O código fica guardado
--    como hash, não em texto puro.
create table if not exists public.agenda_codigos (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  hash       text not null,
  expira_em  timestamptz not null,
  tentativas int not null default 0,
  criado_em  timestamptz not null default now()
);

create index if not exists agenda_codigos_cliente_idx on public.agenda_codigos (cliente_id, criado_em desc);

alter table public.agenda_codigos enable row level security;
revoke all on public.agenda_codigos from anon, authenticated;
grant select, insert, update, delete on public.agenda_codigos to service_role;

-- 2. Hash do código, amarrado à cliente (o mesmo código não serve para outra).
create or replace function public.agenda_codigo_hash(p_cliente uuid, p_codigo text)
returns text
language sql
immutable
as $$
  select encode(sha256(convert_to(p_cliente::text || ':' || p_codigo, 'UTF8')), 'hex')
$$;

revoke all on function public.agenda_codigo_hash(uuid, text) from public;

-- 3. Gera o código para a cliente do CPF. Só a chave de serviço executa.
--    Devolve o e-mail e o nome para o servidor mandar a mensagem. Sem cadastro
--    ou sem e-mail, devolve { ok: false } e não cria nada.
create or replace function public.agenda_codigo_gerar(p_cpf text, p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cpf     text := public.agenda_digitos(p_cpf);
  v_cliente public.clientes;
begin
  if char_length(v_cpf) <> 11 or coalesce(p_codigo, '') !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false);
  end if;

  select * into v_cliente
    from public.clientes c
   where not c.excluida
     and public.agenda_digitos(c.cpf) = v_cpf
   order by c.created_at desc
   limit 1;

  if not found or coalesce(btrim(v_cliente.email), '') = '' then
    return jsonb_build_object('ok', false);
  end if;

  -- Cada pedido troca o código anterior: só vale o último enviado.
  delete from public.agenda_codigos where cliente_id = v_cliente.id;

  insert into public.agenda_codigos (cliente_id, hash, expira_em)
  values (v_cliente.id, public.agenda_codigo_hash(v_cliente.id, p_codigo), now() + interval '10 minutes');

  return jsonb_build_object('ok', true, 'email', v_cliente.email, 'nome', v_cliente.nome);
end;
$$;

revoke all on function public.agenda_codigo_gerar(text, text) from public, anon, authenticated;
grant execute on function public.agenda_codigo_gerar(text, text) to service_role;

-- 4. Confere o código da cliente. Devolve o id do código se bate, senão null.
--    Só o último código, dentro do prazo, e até 5 erros (depois disso é preciso
--    pedir outro). Cada erro é contado; no caso de acerto não é gravado nada.
create or replace function public.agenda_codigo_confere(p_cliente uuid, p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c public.agenda_codigos;
begin
  if p_cliente is null then
    return null;
  end if;

  select * into v_c
    from public.agenda_codigos
   where cliente_id = p_cliente
     and expira_em > now()
   order by criado_em desc
   limit 1
   for update;

  if not found or v_c.tentativas >= 5 then
    return null;
  end if;

  if v_c.hash = public.agenda_codigo_hash(p_cliente, coalesce(p_codigo, '')) then
    return v_c.id;
  end if;

  update public.agenda_codigos set tentativas = tentativas + 1 where id = v_c.id;
  return null;
end;
$$;

revoke all on function public.agenda_codigo_confere(uuid, text) from public, anon, authenticated;

-- 5. Agendamento com código. Assinatura nova (com p_codigo), então a antiga sai.
drop function if exists public.agenda_agendar(uuid, timestamptz, text, text, text, text[], text);

create or replace function public.agenda_agendar(
  p_servico_id uuid,
  p_inicio     timestamptz,
  p_nome       text,
  p_telefone   text,
  p_email      text,
  p_areas      text[] default '{}',
  p_cpf        text   default null,
  p_codigo     text   default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg     public.agenda_config;
  v_serv    public.agenda_servicos;
  v_nome    text := btrim(coalesce(p_nome, ''));
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_tel     text := public.agenda_digitos(p_telefone);
  v_cpf     text := public.agenda_digitos(p_cpf);
  v_areas   text[];
  v_cliente uuid;
  v_codigo  uuid;
  v_ag      public.agenda_agendamentos;
begin
  if char_length(v_nome) < 2 or char_length(v_nome) > 120
     or char_length(v_tel) < 10 or char_length(v_tel) > 15
     or (v_email <> '' and (v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200)) then
    return jsonb_build_object('ok', false, 'erro', 'dados_invalidos');
  end if;

  select * into v_cfg from public.agenda_config where id = 1;
  select * into v_serv from public.agenda_servicos where id = p_servico_id and ativo;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'servico_invalido');
  end if;

  -- Só valem áreas da lista do serviço (sem repetir, na ordem escolhida).
  select coalesce(array_agg(t.a order by t.o), '{}')
    into v_areas
    from (
      select u.a, min(u.o) as o
        from unnest(coalesce(p_areas, '{}')) with ordinality as u(a, o)
       where u.a = any (v_serv.areas_opcoes)
       group by u.a
    ) t;

  if cardinality(v_serv.areas_opcoes) > 0 and cardinality(v_areas) = 0 then
    return jsonb_build_object('ok', false, 'erro', 'areas_obrigatorias');
  end if;

  -- A cliente é reconhecida pelo CPF, que não muda quando ela troca de celular.
  if char_length(v_cpf) = 11 then
    select c.id into v_cliente
      from public.clientes c
     where not c.excluida
       and public.agenda_digitos(c.cpf) = v_cpf
     order by c.created_at desc
     limit 1;
  end if;

  if v_serv.tipo = 'procedimento' then
    -- Procedimento: só com o código do e-mail do cadastro. Sem cadastro, CPF
    -- errado ou código errado, a resposta é a mesma.
    v_codigo := public.agenda_codigo_confere(v_cliente, p_codigo);
    if v_codigo is null then
      return jsonb_build_object('ok', false, 'erro', 'codigo_invalido');
    end if;
  elsif v_cliente is null then
    -- Consulta: sem CPF cadastrado, vale o telefone (DDD + número). Se mais de
    -- um cadastro usa o mesmo telefone (ex.: mãe e filha), o mais recente.
    select c.id into v_cliente
      from public.clientes c
     where not c.excluida
       and char_length(public.agenda_digitos(c.telefone)) >= 10
       and right(public.agenda_digitos(c.telefone), 11) = right(v_tel, 11)
     order by c.created_at desc
     limit 1;
  end if;

  if (select count(*)
        from public.agenda_agendamentos a
       where a.status in ('agendado', 'remarcar')
         and a.inicio > now()
         and right(public.agenda_digitos(a.telefone), 11) = right(v_tel, 11)
     ) >= v_cfg.max_futuros_por_telefone then
    return jsonb_build_object('ok', false, 'erro', 'limite_agendamentos');
  end if;

  if not public.agenda_slot_valido(p_servico_id, p_inicio) then
    return jsonb_build_object('ok', false, 'erro', 'horario_indisponivel');
  end if;

  begin
    insert into public.agenda_agendamentos
      (servico_id, servico_nome, cliente_id, nome, telefone, email, areas, inicio, fim, origem)
    values
      (v_serv.id, v_serv.nome, v_cliente, v_nome, v_tel, v_email,
       v_areas, p_inicio,
       p_inicio + make_interval(mins => v_serv.duracao_min), 'online')
    returning * into v_ag;
  exception when exclusion_violation then
    -- Outra cliente pegou o horário no mesmo instante.
    return jsonb_build_object('ok', false, 'erro', 'horario_indisponivel');
  end;

  return jsonb_build_object(
    'ok', true,
    'token', v_ag.token,
    'inicio', v_ag.inicio,
    'fim', v_ag.fim,
    'servico', v_ag.servico_nome,
    'areas', to_jsonb(v_ag.areas),
    'primeiro_nome', split_part(v_ag.nome, ' ', 1)
  );
end;
$$;

revoke all on function public.agenda_agendar(uuid, timestamptz, text, text, text, text[], text, text) from public;
grant execute on function public.agenda_agendar(uuid, timestamptz, text, text, text, text[], text, text) to anon, authenticated;

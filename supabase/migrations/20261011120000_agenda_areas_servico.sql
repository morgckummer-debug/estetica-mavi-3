-- ============================================================
-- MAVI — Agenda MAVI: áreas de cada serviço (ex.: laser → perna, buço...)
-- Rode no Supabase: SQL Editor > New query > Run
--
-- Alguns serviços são feitos por área (depilação a laser: perna, abdômen,
-- buço...). Cada serviço ganha uma lista de áreas possíveis
-- (`areas_opcoes`), que a Marina ajusta na tela "Serviços". Quando o serviço
-- tem áreas:
--   - a página de agendamento online mostra as áreas e a cliente escolhe;
--   - o agendamento online exige ao menos uma área (erro 'areas_obrigatorias');
--   - as áreas escolhidas aparecem no agendamento da Marina.
-- Os agendamentos já guardam `areas` desde o início (agenda_agendamentos.areas).
--
-- Os serviços de laser/depilação já saem com as áreas da ficha de depilação.
--
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================

alter table public.agenda_servicos
  add column if not exists areas_opcoes text[] not null default '{}';

update public.agenda_servicos
   set areas_opcoes = array[
     'Abdômen', 'Axilas', 'Buço', 'Costas', 'Coxa', 'Dedos', 'Glúteos',
     'Linha Alba Infra', 'Linha Alba Supra', 'Mãos', 'Meia-perna', 'Perianal',
     'Pescoço', 'Queixo', 'Rosto', 'Tórax', 'Virilha', 'Virilha completa'
   ]
 where nome ~* '(laser|depila)'
   and cardinality(areas_opcoes) = 0;

-- Serviços disponíveis para agendar (agora com as áreas de cada um).
drop function if exists public.agenda_servicos_publicos();
create function public.agenda_servicos_publicos()
returns table (id uuid, nome text, tipo text, duracao_min int, areas text[])
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.nome, s.tipo, s.duracao_min, s.areas_opcoes
    from public.agenda_servicos s
   where s.ativo
   order by s.ordem, s.nome
$$;

revoke all on function public.agenda_servicos_publicos() from public;
grant execute on function public.agenda_servicos_publicos() to anon, authenticated;

-- Cria o agendamento (confirmação automática). Mesma regra de antes (telefone
-- + CPF para procedimento), mais as áreas.
create or replace function public.agenda_agendar(
  p_servico_id uuid,
  p_inicio     timestamptz,
  p_nome       text,
  p_telefone   text,
  p_email      text,
  p_areas      text[] default '{}',
  p_cpf        text   default null
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

  -- A cliente é reconhecida pelo telefone (DDD + número). Se mais de um
  -- cadastro usa o mesmo telefone (ex.: mãe e filha), vale o que tem o CPF
  -- informado; sem CPF, o mais recente.
  select c.id into v_cliente
    from public.clientes c
   where not c.excluida
     and char_length(public.agenda_digitos(c.telefone)) >= 10
     and right(public.agenda_digitos(c.telefone), 11) = right(v_tel, 11)
   order by (v_cpf <> '' and public.agenda_digitos(c.cpf) = v_cpf) desc,
            c.created_at desc
   limit 1;

  if v_serv.tipo = 'procedimento' then
    -- Cliente nova começa pela consulta de avaliação.
    if v_cliente is null then
      return jsonb_build_object('ok', false, 'erro', 'consulta_primeiro');
    end if;
    -- O CPF digitado precisa ser o do cadastro (cadastro sem CPF não confere).
    if char_length(v_cpf) <> 11
       or not exists (
         select 1 from public.clientes c
          where c.id = v_cliente
            and public.agenda_digitos(c.cpf) = v_cpf
       ) then
      return jsonb_build_object('ok', false, 'erro', 'cpf_nao_confere');
    end if;
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

revoke all on function public.agenda_agendar(uuid, timestamptz, text, text, text, text[], text) from public;
grant execute on function public.agenda_agendar(uuid, timestamptz, text, text, text, text[], text) to anon, authenticated;

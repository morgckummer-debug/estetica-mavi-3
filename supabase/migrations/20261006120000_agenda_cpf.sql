-- ============================================================
-- MAVI — Agenda MAVI: CPF obrigatório para marcar procedimento online
-- Rode no Supabase: SQL Editor > New query > Run
--
-- Procedimentos pela página pública só para quem já tem cadastro. Até aqui
-- a cliente era reconhecida só pelo telefone; agora o CPF digitado também
-- precisa bater com o CPF do cadastro dela. Assim, alguém que souber só o
-- telefone (ou só o nome) de uma cliente não consegue marcar em nome dela.
--
-- - Consulta de avaliação: CPF não é pedido (cliente nova não precisa).
-- - Procedimento: p_cpf obrigatório e igual ao CPF cadastrado (só dígitos).
-- - O CPF digitado NÃO é guardado no agendamento: só é comparado.
-- - Erro novo: 'cpf_nao_confere'.
--
-- A função muda de assinatura (ganha p_cpf). A antiga é removida para não
-- deixar uma porta sem a checagem.
--
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================

drop function if exists public.agenda_agendar(uuid, timestamptz, text, text, text, text[]);

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
       coalesce(p_areas, '{}'), p_inicio,
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
    'primeiro_nome', split_part(v_ag.nome, ' ', 1)
  );
end;
$$;

revoke all on function public.agenda_agendar(uuid, timestamptz, text, text, text, text[], text) from public;
grant execute on function public.agenda_agendar(uuid, timestamptz, text, text, text, text[], text) to anon, authenticated;

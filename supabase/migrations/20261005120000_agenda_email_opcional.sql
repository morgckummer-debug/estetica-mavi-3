-- ============================================================
-- MAVI — Agenda MAVI: e-mail passa a ser opcional no agendamento online
-- Rode no Supabase: SQL Editor > New query > Run
--
-- A cliente agora informa só nome e WhatsApp ao agendar pela página
-- pública. Esta migração troca apenas a regra de validação do e-mail na
-- função agenda_agendar: vazio é aceito; se vier preenchido, continua
-- precisando ser um e-mail válido. Nada mais muda.
--
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================

-- Cria o agendamento (confirmação automática).
create or replace function public.agenda_agendar(
  p_servico_id uuid,
  p_inicio     timestamptz,
  p_nome       text,
  p_telefone   text,
  p_email      text,
  p_areas      text[] default '{}'
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

  -- A cliente é reconhecida pelo telefone (DDD + número).
  select c.id into v_cliente
    from public.clientes c
   where not c.excluida
     and char_length(public.agenda_digitos(c.telefone)) >= 10
     and right(public.agenda_digitos(c.telefone), 11) = right(v_tel, 11)
   order by c.created_at desc
   limit 1;

  -- Cliente nova começa pela consulta de avaliação.
  if v_serv.tipo = 'procedimento' and v_cliente is null then
    return jsonb_build_object('ok', false, 'erro', 'consulta_primeiro');
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

revoke all on function public.agenda_agendar(uuid, timestamptz, text, text, text, text[]) from public;
grant execute on function public.agenda_agendar(uuid, timestamptz, text, text, text, text[]) to anon, authenticated;

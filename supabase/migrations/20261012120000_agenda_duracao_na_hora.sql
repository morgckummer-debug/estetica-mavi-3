-- ============================================================
-- MAVI — Agenda MAVI: a Marina escolhe a duração na hora de agendar
-- Rode no Supabase: SQL Editor > New query > Run
--
-- Um atendimento pode levar mais (ou menos) que a duração padrão do serviço:
-- por exemplo, laser em buço, queixo e perna na mesma sessão. Ao agendar pelo
-- painel, a Marina informa a duração, e a lista de horários livres passa a
-- considerar essa duração (só mostra horários em que o atendimento inteiro
-- cabe, sem bater em outro agendamento ou bloqueio).
--
-- Só muda a função de horários livres: ela ganha o parâmetro opcional
-- p_duracao_min. Sem ele, vale a duração do serviço, como sempre (a página
-- online e o link da cliente não mudam).
--
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================

-- A assinatura muda (ganha p_duracao_min): a antiga sai para não ficar duas
-- versões da função.
drop function if exists public.agenda_horarios_livres(uuid, date, uuid);

create or replace function public.agenda_horarios_livres(
  p_servico_id  uuid,
  p_dia         date,
  p_ignorar_id  uuid default null,
  p_duracao_min int  default null
)
returns table (horario timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cfg    public.agenda_config;
  v_dur    int;
  v_minimo timestamptz;
  v_hoje   date;
begin
  select * into v_cfg from public.agenda_config where id = 1;
  select s.duracao_min into v_dur
    from public.agenda_servicos s
   where s.id = p_servico_id and s.ativo;
  if v_dur is null then
    return;
  end if;

  -- Duração escolhida na hora (5 min a 8 h); sem ela, a do serviço.
  if p_duracao_min is not null then
    if p_duracao_min < 5 or p_duracao_min > 480 then
      return;
    end if;
    v_dur := p_duracao_min;
  end if;

  v_hoje := (now() at time zone 'America/Sao_Paulo')::date;
  if p_dia < v_hoje or p_dia > v_hoje + v_cfg.janela_dias then
    return;
  end if;
  v_minimo := now() + make_interval(hours => v_cfg.antecedencia_horas);

  return query
  select distinct g.ini
    from public.agenda_horarios h
   cross join lateral generate_series(
           (p_dia + h.inicio) at time zone 'America/Sao_Paulo',
           (p_dia + h.fim) at time zone 'America/Sao_Paulo' - make_interval(mins => v_dur),
           make_interval(mins => v_cfg.passo_min)
         ) as g(ini)
   where h.dia_semana = extract(dow from p_dia)
     and g.ini >= v_minimo
     and not exists (
           select 1 from public.agenda_bloqueios b
            where tstzrange(b.inicio, b.fim)
                  && tstzrange(g.ini, g.ini + make_interval(mins => v_dur)))
     and not exists (
           select 1 from public.agenda_agendamentos a
            where a.status in ('agendado', 'remarcar')
              and (p_ignorar_id is null or a.id <> p_ignorar_id)
              and tstzrange(a.inicio, a.fim)
                  && tstzrange(g.ini, g.ini + make_interval(mins => v_dur)))
   order by g.ini;
end;
$$;

revoke all on function public.agenda_horarios_livres(uuid, date, uuid, int) from public;
grant execute on function public.agenda_horarios_livres(uuid, date, uuid, int) to anon, authenticated;

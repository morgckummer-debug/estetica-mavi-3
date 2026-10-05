-- ============================================================
-- MAVI — Agenda MAVI: gravar o horário semanal de uma vez só
-- Rode no Supabase: SQL Editor > New query > Run
--
-- A tela "Regras Gerais" (dentro de Serviços) deixa a Marina mudar os dias
-- e as faixas de atendimento. Esta função troca a semana inteira numa única
-- transação: se qualquer faixa for inválida ou sobrepuser outra, nada muda e
-- a agenda nunca fica sem horário por uma falha no meio do caminho.
--
-- p_faixas: lista de objetos {"dia_semana": 0-6, "inicio": "HH:MM", "fim": "HH:MM"}
-- (dia_semana segue o Postgres: 0 = domingo ... 6 = sábado). Lista vazia =
-- agenda fechada.
--
-- Só a Marina logada pode chamar (as tabelas já são só dela por RLS).
--
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================

create or replace function public.agenda_salvar_horarios(p_faixas jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_faixas is null or jsonb_typeof(p_faixas) <> 'array' then
    raise exception 'faixas_invalidas' using errcode = '22023';
  end if;

  delete from public.agenda_horarios where true;

  insert into public.agenda_horarios (dia_semana, inicio, fim)
  select f.dia_semana, f.inicio, f.fim
    from jsonb_to_recordset(p_faixas)
         as f(dia_semana smallint, inicio time, fim time);

  -- Uma faixa não pode encostar em outra do mesmo dia (fim = início é aceito).
  if exists (
    select 1
      from public.agenda_horarios a
      join public.agenda_horarios b
        on a.dia_semana = b.dia_semana
       and a.id < b.id
       and a.inicio < b.fim
       and b.inicio < a.fim
  ) then
    raise exception 'faixas_sobrepostas' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.agenda_salvar_horarios(jsonb) from public, anon;
grant execute on function public.agenda_salvar_horarios(jsonb) to authenticated;

-- ============================================================
-- MAVI — Agenda MAVI: renomear um serviço atualiza os agendamentos futuros
-- Rode no Supabase: SQL Editor > New query > Run
--
-- Cada agendamento guarda uma cópia do nome do serviço (para o histórico não
-- mudar). Resultado: ao renomear um serviço em "Serviços", a agenda, o link da
-- cliente e as mensagens continuavam mostrando o nome antigo nos horários já
-- marcados.
--
-- Agora, ao renomear, os agendamentos que ainda vão acontecer (agendado ou
-- remarcar) passam a usar o nome novo. Atendidos, cancelados e faltas mantêm
-- o nome da época. Esta migração também corrige os que já estão diferentes.
--
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================

create or replace function public.agenda_servico_renomeado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.nome is distinct from old.nome then
    update public.agenda_agendamentos
       set servico_nome = new.nome
     where servico_id = new.id
       and status in ('agendado', 'remarcar');
  end if;
  return new;
end;
$$;

drop trigger if exists agenda_servico_renomeado on public.agenda_servicos;
create trigger agenda_servico_renomeado
  after update of nome on public.agenda_servicos
  for each row execute function public.agenda_servico_renomeado();

-- Corrige os agendamentos futuros que já ficaram com o nome antigo.
update public.agenda_agendamentos a
   set servico_nome = s.nome
  from public.agenda_servicos s
 where a.servico_id = s.id
   and a.status in ('agendado', 'remarcar')
   and a.servico_nome <> s.nome;

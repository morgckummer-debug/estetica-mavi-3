-- ============================================================
-- MAVI — Agenda MAVI: registro do "link de confirmação enviado"
-- Rode no Supabase: SQL Editor > New query > Run
--
-- A página Lembretes do painel mostra os atendimentos de um dia e deixa a
-- secretária mandar o link de confirmação pelo WhatsApp. Esta coluna guarda
-- QUANDO o link foi enviado, para a outra pessoa da equipe não mandar de novo.
--
-- Se o horário do atendimento muda (a clínica remarca no painel ou a cliente
-- reagenda pelo link), o link antigo fica desatualizado: o gatilho abaixo zera
-- a coluna e o atendimento volta a aparecer como "link ainda não enviado".
--
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================

alter table public.agenda_agendamentos
  add column if not exists lembrete_enviado_em timestamptz;

create or replace function public.agenda_zera_lembrete()
returns trigger
language plpgsql
as $$
begin
  if new.inicio is distinct from old.inicio then
    new.lembrete_enviado_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists agenda_zera_lembrete on public.agenda_agendamentos;
create trigger agenda_zera_lembrete
  before update of inicio on public.agenda_agendamentos
  for each row execute function public.agenda_zera_lembrete();

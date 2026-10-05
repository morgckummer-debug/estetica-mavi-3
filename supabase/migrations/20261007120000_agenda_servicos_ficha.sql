-- ============================================================
-- MAVI — Agenda MAVI: a ficha de cada serviço vira uma coluna
-- Rode no Supabase: SQL Editor > New query > Run
--
-- Até aqui a ficha enviada para a cliente (cadastro, depilação, facial ou
-- corporal) era deduzida pelo NOME do serviço, o que quebrava se a Marina
-- renomeasse um serviço. Agora é uma coluna, ajustável na tela "Serviços" da
-- agenda. Os serviços atuais são preenchidos pela mesma regra de antes.
--
-- Também garante que exista no máximo UMA consulta de avaliação (a porta de
-- entrada da cliente nova na página pública).
--
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================

alter table public.agenda_servicos add column if not exists ficha text;

update public.agenda_servicos
   set ficha = case
     when tipo = 'consulta'                                     then 'cadastro'
     when nome ~* '(laser|depila)'                              then 'laser'
     when nome ~* '(facial|pele|hidragloss)'                    then 'facial'
     else 'corporal'
   end
 where ficha is null;

alter table public.agenda_servicos alter column ficha set default 'corporal';
alter table public.agenda_servicos alter column ficha set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'agenda_servicos_ficha_check'
       and conrelid = 'public.agenda_servicos'::regclass
  ) then
    alter table public.agenda_servicos
      add constraint agenda_servicos_ficha_check
      check (ficha in ('cadastro', 'laser', 'facial', 'corporal')
             and (tipo <> 'consulta' or ficha = 'cadastro'));
  end if;
end
$$;

create unique index if not exists agenda_servicos_uma_consulta
  on public.agenda_servicos (tipo) where tipo = 'consulta';

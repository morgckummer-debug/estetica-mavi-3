-- ============================================================
-- MAVI — Agenda MAVI: cada serviço ganha uma cor
-- Rode no Supabase: SQL Editor > New query > Run
--
-- Cada serviço passa a ter uma cor pastel na agenda, que a Marina escolhe na
-- tela "Serviços". Esta migração cria a coluna `cor` e preenche os serviços
-- atuais com uma cor para cada um (a Marina troca depois, se quiser).
--
-- Cores possíveis: creme, lilas, rosa, pessego, azul, turquesa, menta,
-- amarelo, lavanda, coral.
--
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================

alter table public.agenda_servicos add column if not exists cor text;

update public.agenda_servicos
   set cor = case
     when tipo = 'consulta'                 then 'creme'
     when nome ~* '(laser|depila)'          then 'lilas'
     when nome ~* 'gestante'                then 'pessego'
     when nome ~* 'drenagem'                then 'rosa'
     when nome ~* 'power'                   then 'azul'
     when nome ~* 'hidragloss'              then 'turquesa'
     when nome ~* '(limpeza|pele)'          then 'menta'
     when nome ~* 'corrente'                then 'amarelo'
     when nome ~* 'p[oó]s'                  then 'lavanda'
     when nome ~* 'taping'                  then 'coral'
     else 'lilas'
   end
 where cor is null;

alter table public.agenda_servicos alter column cor set default 'lilas';
alter table public.agenda_servicos alter column cor set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'agenda_servicos_cor_check'
       and conrelid = 'public.agenda_servicos'::regclass
  ) then
    alter table public.agenda_servicos
      add constraint agenda_servicos_cor_check
      check (cor in ('creme', 'lilas', 'rosa', 'pessego', 'azul', 'turquesa',
                     'menta', 'amarelo', 'lavanda', 'coral'));
  end if;
end
$$;

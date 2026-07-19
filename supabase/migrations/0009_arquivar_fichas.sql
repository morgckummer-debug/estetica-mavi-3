-- ============================================================
-- MAVI — Excluir ficha vira soft delete (recuperável)
-- Rode no Supabase: SQL Editor > New query > Run
--
-- Mesmo raciocínio da migração 0008 (sessões): excluir uma ficha de
-- verdade (DELETE) era irreversível. Agora "Excluir" só marca a ficha
-- como excluída — ela some das listas normais, mas fica guardada e pode
-- ser restaurada depois em "Fichas excluídas".
--
-- Column separada de `arquivada` (que já existia): `arquivada` é um
-- marcador manual pra cliente inativa (continua aparecendo, só com um
-- selo); `excluida` é o que esconde a ficha das listas e alimenta a
-- recuperação.
-- ============================================================

alter table public.fichas
  add column if not exists excluida boolean not null default false;

create index if not exists fichas_excluida_idx on public.fichas (excluida);

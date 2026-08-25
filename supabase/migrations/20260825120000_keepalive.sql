-- ============================================================
-- MAVI — keep-alive: impede que o Supabase pause o projeto
--
-- No plano Free, um projeto sem atividade de BANCO por cerca de
-- uma semana é pausado. Enquanto pausado o app não abre, e
-- projeto pausado é o que, lá na frente, corre risco de ser
-- descartado — o plano Free não guarda backup nenhum.
--
-- Um GET na API pode não contar como atividade de banco; um
-- UPDATE conta. Esta migração cria a linha única que a rotina
-- diária (.github/workflows/supabase-keepalive.yml) atualiza
-- todo dia.
--
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================

create table if not exists public.manutencao_keepalive (
  id            smallint    primary key default 1,
  ultima_batida timestamptz not null default now(),
  origem        text,
  total_batidas bigint      not null default 0,
  constraint manutencao_keepalive_linha_unica check (id = 1)
);

insert into public.manutencao_keepalive (id) values (1) on conflict (id) do nothing;

-- A tabela não guarda dado de cliente nenhum: é uma linha com uma
-- data. Mesmo assim fica com RLS ligado, para não destoar do resto.
alter table public.manutencao_keepalive enable row level security;

drop policy if exists authenticated_select_keepalive on public.manutencao_keepalive;

create policy authenticated_select_keepalive
  on public.manutencao_keepalive for select to authenticated using (true);

-- SECURITY DEFINER e liberada para `anon` de propósito: a rotina
-- diária roda com a chave publishable, a mesma que já vai no site.
-- O estrago máximo de um abuso é adiantar o relógio de uma linha —
-- que é justamente o objetivo desta função.
create or replace function public.registrar_keepalive(p_origem text default null)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_agora timestamptz;
begin
  update public.manutencao_keepalive
     set ultima_batida = now(),
         origem        = coalesce(nullif(trim(p_origem), ''), origem),
         total_batidas = total_batidas + 1
   where id = 1
  returning ultima_batida into v_agora;

  if v_agora is null then
    insert into public.manutencao_keepalive (id, origem, total_batidas)
    values (1, nullif(trim(p_origem), ''), 1)
    on conflict (id) do update set ultima_batida = now()
    returning ultima_batida into v_agora;
  end if;

  return v_agora;
end;
$$;

revoke all on function public.registrar_keepalive(text) from public;
grant execute on function public.registrar_keepalive(text) to anon, authenticated;

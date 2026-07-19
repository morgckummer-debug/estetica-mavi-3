create table if not exists public.fichas (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  nome          text not null,
  telefone      text,
  respostas     jsonb not null default '{}'::jsonb,
  alertas       text[] not null default '{}',
  termo_aceito  boolean not null default false,
  autoriza_foto boolean not null default false,
  medidas       jsonb not null default '{}'::jsonb,
  relatorio     text,
  arquivada     boolean not null default false
);

create index if not exists fichas_created_at_idx on public.fichas (created_at desc);
create index if not exists fichas_nome_idx on public.fichas (lower(nome));

alter table public.fichas enable row level security;

drop policy if exists "authenticated pode ler fichas" on public.fichas;
create policy "authenticated pode ler fichas" on public.fichas for select to authenticated using (true);

drop policy if exists "authenticated pode atualizar fichas" on public.fichas;
create policy "authenticated pode atualizar fichas" on public.fichas for update to authenticated using (true) with check (true);

alter table public.fichas add column if not exists tipo text not null default 'corporal';
alter table public.fichas drop constraint if exists fichas_tipo_check;
alter table public.fichas add constraint fichas_tipo_check check (tipo in ('corporal', 'facial', 'laser'));
create index if not exists fichas_tipo_idx on public.fichas (tipo);

drop policy if exists "publico pode inserir fichas" on public.fichas;
create policy "publico pode inserir fichas" on public.fichas for insert to anon, authenticated with check (true);

drop policy if exists "authenticated pode excluir fichas" on public.fichas;
create policy "authenticated pode excluir fichas" on public.fichas for delete to authenticated using (true);

create table if not exists public.sessoes (
  id            uuid primary key default gen_random_uuid(),
  ficha_id      uuid not null references public.fichas(id) on delete cascade,
  created_at    timestamptz not null default now(),
  data          date not null default current_date,
  areas         text[] not null default '{}',
  observacao    text,
  token         text not null unique default replace(gen_random_uuid()::text, '-', ''),
  confirmado    boolean not null default false,
  confirmado_em timestamptz
);
create index if not exists sessoes_ficha_idx on public.sessoes (ficha_id, data desc);
create index if not exists sessoes_token_idx on public.sessoes (token);
alter table public.sessoes enable row level security;

drop policy if exists "authenticated pode ler sessoes" on public.sessoes;
create policy "authenticated pode ler sessoes" on public.sessoes for select to authenticated using (true);
drop policy if exists "authenticated pode inserir sessoes" on public.sessoes;
create policy "authenticated pode inserir sessoes" on public.sessoes for insert to authenticated with check (true);
drop policy if exists "authenticated pode atualizar sessoes" on public.sessoes;
create policy "authenticated pode atualizar sessoes" on public.sessoes for update to authenticated using (true) with check (true);
drop policy if exists "authenticated pode excluir sessoes" on public.sessoes;
create policy "authenticated pode excluir sessoes" on public.sessoes for delete to authenticated using (true);

create or replace function public.sessao_por_token(p_token text)
returns table (primeiro_nome text, data date, areas text[], observacao text, confirmado boolean, confirmado_em timestamptz)
language sql security definer set search_path = public as $$
  select split_part(btrim(f.nome), ' ', 1), s.data, s.areas, s.observacao, s.confirmado, s.confirmado_em
  from public.sessoes s join public.fichas f on f.id = s.ficha_id where s.token = p_token limit 1
$$;

create or replace function public.confirmar_sessao(p_token text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_quando timestamptz;
begin
  update public.sessoes set confirmado = true, confirmado_em = coalesce(confirmado_em, now())
  where token = p_token returning confirmado_em into v_quando;
  return v_quando;
end; $$;

grant execute on function public.sessao_por_token(text) to anon, authenticated;
grant execute on function public.confirmar_sessao(text) to anon, authenticated;

alter table public.fichas add column if not exists pacotes jsonb not null default '{}'::jsonb;

-- Cloud grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fichas TO authenticated;
GRANT INSERT ON public.fichas TO anon;
GRANT ALL ON public.fichas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessoes TO authenticated;
GRANT ALL ON public.sessoes TO service_role;
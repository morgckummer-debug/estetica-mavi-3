
alter table public.sessoes add column if not exists arquivado boolean not null default false;
create index if not exists sessoes_arquivado_idx on public.sessoes (ficha_id, arquivado);

alter table public.fichas add column if not exists excluida boolean not null default false;
create index if not exists fichas_excluida_idx on public.fichas (excluida);

create table if not exists public.relatorios_pacote (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references public.fichas(id) on delete cascade,
  item text not null, pacote_numero int not null,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  cliente_nome text not null, pacote_total int not null,
  concluido boolean not null default false,
  sessoes jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (ficha_id, item, pacote_numero)
);
create index if not exists relatorios_pacote_token_idx on public.relatorios_pacote (token);
alter table public.relatorios_pacote enable row level security;
drop policy if exists "authenticated pode gerenciar relatorios" on public.relatorios_pacote;
create policy "authenticated pode gerenciar relatorios" on public.relatorios_pacote for all to authenticated using (true) with check (true);

create or replace function public.relatorio_pacote_por_token(p_token text)
returns table (cliente_nome text, item text, pacote_total int, concluido boolean, sessoes jsonb)
language sql security definer set search_path = public as $$
  select r.cliente_nome, r.item, r.pacote_total, r.concluido, r.sessoes
  from public.relatorios_pacote r where r.token = p_token limit 1
$$;
grant execute on function public.relatorio_pacote_por_token(text) to anon, authenticated;

alter table public.fichas drop constraint if exists fichas_tipo_check;
alter table public.fichas add constraint fichas_tipo_check check (tipo in ('corporal','facial','laser','cadastro'));

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nome text not null, telefone text, cpf text, email text,
  nascimento text, sexo text, profissao text, estado_civil text,
  cep text, endereco text, numero text, complemento text, cidade text,
  como_conheceu text, autoriza_foto boolean not null default false,
  arquivada boolean not null default false, excluida boolean not null default false
);
create index if not exists clientes_created_at_idx on public.clientes (created_at desc);
create index if not exists clientes_nome_idx on public.clientes (lower(nome));
create index if not exists clientes_telefone_idx on public.clientes (telefone);
create index if not exists clientes_cpf_idx on public.clientes (cpf);
create index if not exists clientes_excluida_idx on public.clientes (excluida);
alter table public.clientes enable row level security;
drop policy if exists "authenticated pode ler clientes" on public.clientes;
create policy "authenticated pode ler clientes" on public.clientes for select to authenticated using (true);
drop policy if exists "authenticated pode atualizar clientes" on public.clientes;
create policy "authenticated pode atualizar clientes" on public.clientes for update to authenticated using (true) with check (true);
drop policy if exists "authenticated pode inserir clientes" on public.clientes;
create policy "authenticated pode inserir clientes" on public.clientes for insert to authenticated with check (true);
alter table public.fichas add column if not exists cliente_id uuid references public.clientes(id);
create index if not exists fichas_cliente_id_idx on public.fichas (cliente_id);

create table if not exists public.contratos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  created_at timestamptz not null default now(),
  profissao text, estado_civil text,
  itens jsonb not null default '[]'::jsonb,
  forma_pagamento text,
  autoriza_foto boolean not null default false,
  data_contrato date not null default current_date
);
create index if not exists contratos_cliente_idx on public.contratos (cliente_id, created_at desc);
alter table public.contratos enable row level security;
drop policy if exists "authenticated pode ler contratos" on public.contratos;
create policy "authenticated pode ler contratos" on public.contratos for select to authenticated using (true);
drop policy if exists "authenticated pode inserir contratos" on public.contratos;
create policy "authenticated pode inserir contratos" on public.contratos for insert to authenticated with check (true);
drop policy if exists "authenticated pode atualizar contratos" on public.contratos;
create policy "authenticated pode atualizar contratos" on public.contratos for update to authenticated using (true) with check (true);
drop policy if exists "authenticated pode excluir contratos" on public.contratos;
create policy "authenticated pode excluir contratos" on public.contratos for delete to authenticated using (true);

alter table public.clientes add column if not exists bairro text;

create or replace function public.encontrar_ou_criar_cliente(
  p_nome text, p_telefone text, p_cpf text default null, p_email text default null,
  p_nascimento text default null, p_sexo text default null, p_profissao text default null,
  p_estado_civil text default null, p_cep text default null, p_endereco text default null,
  p_numero text default null, p_complemento text default null, p_cidade text default null,
  p_como_conheceu text default null, p_autoriza_foto boolean default false, p_bairro text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_verificar_duplicata constant boolean := false;
begin
  if v_verificar_duplicata then
    select id into v_id from public.clientes
    where excluida = false
      and ((p_telefone is not null and p_telefone <> '' and telefone = p_telefone)
        or (p_cpf is not null and p_cpf <> '' and cpf = p_cpf))
    order by created_at desc limit 1;
  end if;
  if v_id is not null then
    update public.clientes set
      nome=coalesce(nullif(nome,''),p_nome), cpf=coalesce(nullif(cpf,''),p_cpf),
      email=coalesce(nullif(email,''),p_email), nascimento=coalesce(nullif(nascimento,''),p_nascimento),
      sexo=coalesce(nullif(sexo,''),p_sexo), profissao=coalesce(nullif(profissao,''),p_profissao),
      estado_civil=coalesce(nullif(estado_civil,''),p_estado_civil),
      cep=coalesce(nullif(cep,''),p_cep), endereco=coalesce(nullif(endereco,''),p_endereco),
      numero=coalesce(nullif(numero,''),p_numero), bairro=coalesce(nullif(bairro,''),p_bairro),
      complemento=coalesce(nullif(complemento,''),p_complemento),
      cidade=coalesce(nullif(cidade,''),p_cidade),
      como_conheceu=coalesce(nullif(como_conheceu,''),p_como_conheceu)
    where id = v_id;
    return v_id;
  end if;
  insert into public.clientes (
    nome, telefone, cpf, email, nascimento, sexo, profissao, estado_civil,
    cep, endereco, numero, bairro, complemento, cidade, como_conheceu, autoriza_foto
  ) values (
    p_nome, nullif(p_telefone,''), nullif(p_cpf,''), nullif(p_email,''),
    nullif(p_nascimento,''), nullif(p_sexo,''), nullif(p_profissao,''),
    nullif(p_estado_civil,''), nullif(p_cep,''), nullif(p_endereco,''),
    nullif(p_numero,''), nullif(p_bairro,''), nullif(p_complemento,''),
    nullif(p_cidade,''), nullif(p_como_conheceu,''), p_autoriza_foto
  ) returning id into v_id;
  return v_id;
end; $$;

grant execute on function public.encontrar_ou_criar_cliente(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean,text
) to anon, authenticated;

alter table public.fichas add column if not exists consentimento_dados boolean not null default false;
alter table public.contratos add column if not exists pdf_path text;

drop policy if exists "authenticated pode ler pdf de contratos" on storage.objects;
create policy "authenticated pode ler pdf de contratos" on storage.objects for select to authenticated using (bucket_id = 'contratos');
drop policy if exists "authenticated pode enviar pdf de contratos" on storage.objects;
create policy "authenticated pode enviar pdf de contratos" on storage.objects for insert to authenticated with check (bucket_id = 'contratos');
drop policy if exists "authenticated pode substituir pdf de contratos" on storage.objects;
create policy "authenticated pode substituir pdf de contratos" on storage.objects for update to authenticated using (bucket_id = 'contratos') with check (bucket_id = 'contratos');
drop policy if exists "authenticated pode apagar pdf de contratos" on storage.objects;
create policy "authenticated pode apagar pdf de contratos" on storage.objects for delete to authenticated using (bucket_id = 'contratos');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatorios_pacote TO authenticated;
GRANT SELECT ON public.relatorios_pacote TO anon;
GRANT ALL ON public.relatorios_pacote TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT ALL ON public.contratos TO service_role;
-- ============================================================
-- MAVI — Agenda MAVI (agendamento online)
-- Rode no Supabase: SQL Editor > New query > Run
--
-- A cliente agenda sozinha pela página pública /agendar, com
-- confirmação automática. A Marina vê tudo na tela Agenda do painel
-- (dia, semana e mês), configura serviços, horários de atendimento e
-- bloqueios.
--
-- Regras principais:
--   - Atende uma pessoa por vez: dois agendamentos ativos nunca se
--     sobrepõem (garantido pelo próprio banco, não só pela tela).
--   - Cliente nova só marca a "Consulta de avaliação" (gratuita). Os
--     procedimentos ficam para quem já tem cadastro em `clientes`.
--   - A cliente cancela/remarca pelo link único (token), sem login.
--     Com menos de 24h de antecedência, só falando com a Marina
--     (mesma regra do contrato) — exceto quando foi a clínica que
--     pediu a remarcação (status 'remarcar').
--
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================

-- ------------------------------------------------------------
-- Configuração geral (linha única)
-- ------------------------------------------------------------
create table if not exists public.agenda_config (
  id                       smallint primary key default 1,
  -- De quanto em quanto tempo começa um horário (09:00, 09:30...).
  passo_min                int not null default 30 check (passo_min between 5 and 240),
  -- Quanto tempo antes a cliente ainda consegue marcar online.
  antecedencia_horas       int not null default 2 check (antecedencia_horas >= 0),
  -- Até quantos dias à frente a agenda online fica aberta.
  janela_dias              int not null default 60 check (janela_dias between 1 and 365),
  -- Prazo para cancelar/remarcar sozinha (contrato: 24h).
  cancelamento_horas       int not null default 24 check (cancelamento_horas >= 0),
  -- Trava contra abuso: agendamentos futuros ativos por telefone.
  max_futuros_por_telefone int not null default 3 check (max_futuros_por_telefone >= 1),
  constraint agenda_config_linha_unica check (id = 1)
);

insert into public.agenda_config (id) values (1) on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Serviços que podem ser agendados e quanto tempo levam.
-- As durações iniciais são só um ponto de partida: a Marina ajusta.
-- ------------------------------------------------------------
create table if not exists public.agenda_servicos (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  nome        text not null,
  -- 'consulta' = porta de entrada da cliente nova; 'procedimento' só
  -- para quem já tem cadastro.
  tipo        text not null default 'procedimento' check (tipo in ('consulta', 'procedimento')),
  duracao_min int not null check (duracao_min between 5 and 480),
  ativo       boolean not null default true,
  ordem       int not null default 0
);

insert into public.agenda_servicos (nome, tipo, duracao_min, ordem)
select v.nome, v.tipo, v.duracao_min, v.ordem
from (values
  ('Consulta de avaliação',                 'consulta',     30, 0),
  ('Depilação a Laser Ácrus',               'procedimento', 30, 1),
  ('Drenagem Linfática — Método MAVI',      'procedimento', 60, 2),
  ('Drenagem Linfática para Gestantes',     'procedimento', 60, 3),
  ('Power Redux',                           'procedimento', 60, 4),
  ('Hidragloss',                            'procedimento', 60, 5),
  ('Limpeza de Pele Profunda',              'procedimento', 60, 6),
  ('Corrente Russa',                        'procedimento', 45, 7),
  ('Pós-Operatório',                        'procedimento', 60, 8),
  ('Taping Pós-Parto',                      'procedimento', 45, 9)
) as v(nome, tipo, duracao_min, ordem)
where not exists (select 1 from public.agenda_servicos);

-- ------------------------------------------------------------
-- Horário de atendimento semanal. Mais de uma faixa por dia permite
-- intervalo (ex.: 08–12 e 14–18). dia_semana segue o Postgres:
-- 0 = domingo ... 6 = sábado.
-- ------------------------------------------------------------
create table if not exists public.agenda_horarios (
  id         uuid primary key default gen_random_uuid(),
  dia_semana smallint not null check (dia_semana between 0 and 6),
  inicio     time not null,
  fim        time not null,
  constraint agenda_horarios_fim_apos_inicio check (fim > inicio)
);

insert into public.agenda_horarios (dia_semana, inicio, fim)
select v.dia_semana, v.inicio, v.fim
from (values
  (1, time '13:00', time '19:00'),
  (2, time '13:00', time '19:00'),
  (3, time '13:00', time '19:00'),
  (4, time '13:00', time '19:00'),
  (5, time '13:00', time '19:00'),
  (6, time '08:00', time '17:00')
) as v(dia_semana, inicio, fim)
where not exists (select 1 from public.agenda_horarios);

-- ------------------------------------------------------------
-- Bloqueios: horário solto, dia inteiro ou período (férias, feriado).
-- ------------------------------------------------------------
create table if not exists public.agenda_bloqueios (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  inicio     timestamptz not null,
  fim        timestamptz not null,
  motivo     text,
  constraint agenda_bloqueios_fim_apos_inicio check (fim > inicio)
);

create index if not exists agenda_bloqueios_inicio_idx on public.agenda_bloqueios (inicio);

-- ------------------------------------------------------------
-- Agendamentos
-- ------------------------------------------------------------
create table if not exists public.agenda_agendamentos (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  servico_id            uuid not null references public.agenda_servicos(id) on delete restrict,
  -- Cópia do nome no momento do agendamento: renomear o serviço depois
  -- não reescreve o histórico.
  servico_nome          text not null,
  -- Preenchido quando o telefone bate com uma cliente já cadastrada.
  cliente_id            uuid references public.clientes(id) on delete set null,
  nome                  text not null,
  telefone              text not null,
  email                 text not null,
  -- Áreas do procedimento (ex.: virilha, axilas), quando se aplica.
  areas                 text[] not null default '{}',
  inicio                timestamptz not null,
  fim                   timestamptz not null,
  -- agendado  = marcado e ativo
  -- remarcar  = a clínica precisou mexer no horário; a cliente deve escolher outro
  -- cancelado = cancelado (por ela ou pela clínica)
  -- concluido = atendimento realizado
  -- faltou    = não compareceu
  status                text not null default 'agendado'
                        check (status in ('agendado', 'remarcar', 'cancelado', 'concluido', 'faltou')),
  -- "Check" de presença: a cliente confirmou pelo link.
  presenca_confirmada_em timestamptz,
  cancelado_em          timestamptz,
  cancelado_por         text check (cancelado_por in ('cliente', 'clinica')),
  observacao            text,
  origem                text not null default 'online' check (origem in ('online', 'painel')),
  -- Link único da cliente (confirmar presença, cancelar, remarcar).
  token                 text not null unique default replace(gen_random_uuid()::text, '-', ''),
  -- Quando o e-mail de confirmação foi enviado.
  email_enviado_em      timestamptz,
  -- Sessão criada a partir deste agendamento, no dia do atendimento.
  sessao_id             uuid references public.sessoes(id) on delete set null,
  constraint agenda_agendamentos_fim_apos_inicio check (fim > inicio),
  -- Uma pessoa atende: dois agendamentos ativos nunca se sobrepõem.
  -- É o que impede duas clientes de pegarem o mesmo horário ao mesmo
  -- tempo, mesmo que a tela mostre o horário livre para as duas.
  constraint agenda_sem_sobreposicao
    exclude using gist (tstzrange(inicio, fim) with &&)
    where (status in ('agendado', 'remarcar'))
);

create index if not exists agenda_agendamentos_inicio_idx on public.agenda_agendamentos (inicio);
create index if not exists agenda_agendamentos_status_idx on public.agenda_agendamentos (status);

-- ------------------------------------------------------------
-- Segurança (Row Level Security) — mesmo padrão do restante do
-- projeto: a Marina (autenticada) gerencia tudo; o público NUNCA lê
-- nem grava direto. A cliente só interage pelas funções abaixo.
-- ------------------------------------------------------------
alter table public.agenda_config       enable row level security;
alter table public.agenda_servicos     enable row level security;
alter table public.agenda_horarios     enable row level security;
alter table public.agenda_bloqueios    enable row level security;
alter table public.agenda_agendamentos enable row level security;

-- Data API: a partir de 30/out/2026 o Supabase não concede mais acesso
-- automático a tabelas novas em public; o grant precisa ser explícito.
grant select, insert, update, delete on public.agenda_config       to authenticated;
grant select, insert, update, delete on public.agenda_servicos     to authenticated;
grant select, insert, update, delete on public.agenda_horarios     to authenticated;
grant select, insert, update, delete on public.agenda_bloqueios    to authenticated;
grant select, insert, update, delete on public.agenda_agendamentos to authenticated;
grant select, insert, update, delete on public.agenda_config       to service_role;
grant select, insert, update, delete on public.agenda_servicos     to service_role;
grant select, insert, update, delete on public.agenda_horarios     to service_role;
grant select, insert, update, delete on public.agenda_bloqueios    to service_role;
grant select, insert, update, delete on public.agenda_agendamentos to service_role;

drop policy if exists "authenticated gerencia agenda_config" on public.agenda_config;
create policy "authenticated gerencia agenda_config"
  on public.agenda_config for all to authenticated using (true) with check (true);

drop policy if exists "authenticated gerencia agenda_servicos" on public.agenda_servicos;
create policy "authenticated gerencia agenda_servicos"
  on public.agenda_servicos for all to authenticated using (true) with check (true);

drop policy if exists "authenticated gerencia agenda_horarios" on public.agenda_horarios;
create policy "authenticated gerencia agenda_horarios"
  on public.agenda_horarios for all to authenticated using (true) with check (true);

drop policy if exists "authenticated gerencia agenda_bloqueios" on public.agenda_bloqueios;
create policy "authenticated gerencia agenda_bloqueios"
  on public.agenda_bloqueios for all to authenticated using (true) with check (true);

drop policy if exists "authenticated gerencia agenda_agendamentos" on public.agenda_agendamentos;
create policy "authenticated gerencia agenda_agendamentos"
  on public.agenda_agendamentos for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- Funções internas
-- ------------------------------------------------------------

-- Só os dígitos do telefone, para comparar "(31) 99999-0000" com
-- "31999990000".
create or replace function public.agenda_digitos(p text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(p, ''), '\D', '', 'g')
$$;

-- Horários livres de um serviço em um dia (hora de Brasília).
-- Respeita: faixas de atendimento, duração do serviço, antecedência
-- mínima, janela máxima, bloqueios e agendamentos ativos.
-- p_ignorar_id: ao remarcar, o próprio agendamento não conta como ocupado.
create or replace function public.agenda_horarios_livres(
  p_servico_id uuid,
  p_dia        date,
  p_ignorar_id uuid default null
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

-- O horário pedido está mesmo livre (e alinhado à grade de horários)?
create or replace function public.agenda_slot_valido(
  p_servico_id uuid,
  p_inicio     timestamptz,
  p_ignorar_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.agenda_horarios_livres(
             p_servico_id,
             (p_inicio at time zone 'America/Sao_Paulo')::date,
             p_ignorar_id) l
     where l.horario = p_inicio
  )
$$;

-- ------------------------------------------------------------
-- Funções públicas (anon) — página /agendar e link da cliente.
-- SECURITY DEFINER: rodam com permissão elevada mas só fazem a coisa
-- controlada descrita. Erros "de negócio" voltam como
-- {"ok": false, "erro": "..."} para a tela mostrar a mensagem certa.
-- ------------------------------------------------------------

-- Serviços disponíveis para agendar.
create or replace function public.agenda_servicos_publicos()
returns table (id uuid, nome text, tipo text, duracao_min int)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.nome, s.tipo, s.duracao_min
    from public.agenda_servicos s
   where s.ativo
   order by s.ordem, s.nome
$$;

-- Dias do intervalo que têm ao menos um horário livre (pinta o
-- calendário). O intervalo é limitado a 92 dias.
create or replace function public.agenda_dias_com_horario(
  p_servico_id uuid,
  p_de         date,
  p_ate        date
)
returns table (dia date)
language sql
stable
security definer
set search_path = public
as $$
  select d::date
    from generate_series(p_de, least(p_ate, p_de + 92), interval '1 day') d
   where exists (select 1 from public.agenda_horarios_livres(p_servico_id, d::date))
   order by 1
$$;

-- Cria o agendamento (confirmação automática).
create or replace function public.agenda_agendar(
  p_servico_id uuid,
  p_inicio     timestamptz,
  p_nome       text,
  p_telefone   text,
  p_email      text,
  p_areas      text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg     public.agenda_config;
  v_serv    public.agenda_servicos;
  v_nome    text := btrim(coalesce(p_nome, ''));
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_tel     text := public.agenda_digitos(p_telefone);
  v_cliente uuid;
  v_ag      public.agenda_agendamentos;
begin
  if char_length(v_nome) < 2 or char_length(v_nome) > 120
     or char_length(v_tel) < 10 or char_length(v_tel) > 15
     or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then
    return jsonb_build_object('ok', false, 'erro', 'dados_invalidos');
  end if;

  select * into v_cfg from public.agenda_config where id = 1;
  select * into v_serv from public.agenda_servicos where id = p_servico_id and ativo;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'servico_invalido');
  end if;

  -- A cliente é reconhecida pelo telefone (DDD + número).
  select c.id into v_cliente
    from public.clientes c
   where not c.excluida
     and char_length(public.agenda_digitos(c.telefone)) >= 10
     and right(public.agenda_digitos(c.telefone), 11) = right(v_tel, 11)
   order by c.created_at desc
   limit 1;

  -- Cliente nova começa pela consulta de avaliação.
  if v_serv.tipo = 'procedimento' and v_cliente is null then
    return jsonb_build_object('ok', false, 'erro', 'consulta_primeiro');
  end if;

  if (select count(*)
        from public.agenda_agendamentos a
       where a.status in ('agendado', 'remarcar')
         and a.inicio > now()
         and right(public.agenda_digitos(a.telefone), 11) = right(v_tel, 11)
     ) >= v_cfg.max_futuros_por_telefone then
    return jsonb_build_object('ok', false, 'erro', 'limite_agendamentos');
  end if;

  if not public.agenda_slot_valido(p_servico_id, p_inicio) then
    return jsonb_build_object('ok', false, 'erro', 'horario_indisponivel');
  end if;

  begin
    insert into public.agenda_agendamentos
      (servico_id, servico_nome, cliente_id, nome, telefone, email, areas, inicio, fim, origem)
    values
      (v_serv.id, v_serv.nome, v_cliente, v_nome, v_tel, v_email,
       coalesce(p_areas, '{}'), p_inicio,
       p_inicio + make_interval(mins => v_serv.duracao_min), 'online')
    returning * into v_ag;
  exception when exclusion_violation then
    -- Outra cliente pegou o horário no mesmo instante.
    return jsonb_build_object('ok', false, 'erro', 'horario_indisponivel');
  end;

  return jsonb_build_object(
    'ok', true,
    'token', v_ag.token,
    'inicio', v_ag.inicio,
    'fim', v_ag.fim,
    'servico', v_ag.servico_nome,
    'primeiro_nome', split_part(v_ag.nome, ' ', 1)
  );
end;
$$;

-- Dados mínimos do agendamento para a página do link da cliente.
-- Só o primeiro nome: o link não vaza o cadastro.
create or replace function public.agendamento_por_token(p_token text)
returns table (
  primeiro_nome      text,
  servico_nome       text,
  servico_id         uuid,
  inicio             timestamptz,
  fim                timestamptz,
  status             text,
  presenca_confirmada_em timestamptz,
  -- true quando a cliente pode cancelar/remarcar sozinha agora.
  pode_alterar       boolean,
  -- true quando falta menos que o prazo (só pelo WhatsApp da Marina).
  fora_do_prazo      boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    split_part(btrim(a.nome), ' ', 1),
    a.servico_nome,
    a.servico_id,
    a.inicio,
    a.fim,
    a.status,
    a.presenca_confirmada_em,
    a.status in ('agendado', 'remarcar') and a.inicio > now()
      and (a.status = 'remarcar'
           or a.inicio - now() >= make_interval(hours => c.cancelamento_horas)),
    a.status = 'agendado' and a.inicio > now()
      and a.inicio - now() < make_interval(hours => c.cancelamento_horas)
  from public.agenda_agendamentos a
  cross join public.agenda_config c
  where a.token = p_token and c.id = 1
  limit 1
$$;

-- "Vou comparecer": o check de presença. Idempotente.
create or replace function public.agenda_confirmar_presenca(p_token text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quando timestamptz;
begin
  update public.agenda_agendamentos
     set presenca_confirmada_em = coalesce(presenca_confirmada_em, now())
   where token = p_token and status = 'agendado' and inicio > now()
   returning presenca_confirmada_em into v_quando;
  return v_quando;
end;
$$;

-- A cliente cancela pelo link, respeitando o prazo do contrato.
create or replace function public.agenda_cancelar(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg public.agenda_config;
  v_ag  public.agenda_agendamentos;
begin
  select * into v_cfg from public.agenda_config where id = 1;
  select * into v_ag from public.agenda_agendamentos where token = p_token for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'nao_encontrado');
  end if;
  if v_ag.status = 'cancelado' then
    return jsonb_build_object('ok', true);
  end if;
  if v_ag.status not in ('agendado', 'remarcar') or v_ag.inicio <= now() then
    return jsonb_build_object('ok', false, 'erro', 'indisponivel');
  end if;
  if v_ag.status = 'agendado'
     and v_ag.inicio - now() < make_interval(hours => v_cfg.cancelamento_horas) then
    return jsonb_build_object('ok', false, 'erro', 'prazo');
  end if;

  update public.agenda_agendamentos
     set status = 'cancelado', cancelado_em = now(), cancelado_por = 'cliente'
   where id = v_ag.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- A cliente escolhe outro horário pelo link. Mesmo prazo do
-- cancelamento; sem prazo quando a clínica pediu a remarcação.
create or replace function public.agenda_remarcar(p_token text, p_novo_inicio timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg  public.agenda_config;
  v_ag   public.agenda_agendamentos;
  v_dur  int;
begin
  select * into v_cfg from public.agenda_config where id = 1;
  select * into v_ag from public.agenda_agendamentos where token = p_token for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'nao_encontrado');
  end if;
  if v_ag.status not in ('agendado', 'remarcar') or v_ag.inicio <= now() then
    return jsonb_build_object('ok', false, 'erro', 'indisponivel');
  end if;
  if v_ag.status = 'agendado'
     and v_ag.inicio - now() < make_interval(hours => v_cfg.cancelamento_horas) then
    return jsonb_build_object('ok', false, 'erro', 'prazo');
  end if;

  select s.duracao_min into v_dur from public.agenda_servicos s where s.id = v_ag.servico_id;
  if not public.agenda_slot_valido(v_ag.servico_id, p_novo_inicio, v_ag.id) then
    return jsonb_build_object('ok', false, 'erro', 'horario_indisponivel');
  end if;

  begin
    update public.agenda_agendamentos
       set inicio = p_novo_inicio,
           fim = p_novo_inicio + make_interval(mins => v_dur),
           status = 'agendado',
           presenca_confirmada_em = null
     where id = v_ag.id;
  exception when exclusion_violation then
    return jsonb_build_object('ok', false, 'erro', 'horario_indisponivel');
  end;

  return jsonb_build_object('ok', true, 'inicio', p_novo_inicio);
end;
$$;

-- Funções internas não ficam expostas; só as públicas abaixo.
revoke all on function public.agenda_digitos(text) from public, anon;
revoke all on function public.agenda_horarios_livres(uuid, date, uuid) from public, anon;
revoke all on function public.agenda_slot_valido(uuid, timestamptz, uuid) from public, anon;
revoke all on function public.agenda_servicos_publicos() from public;
revoke all on function public.agenda_dias_com_horario(uuid, date, date) from public;
revoke all on function public.agenda_agendar(uuid, timestamptz, text, text, text, text[]) from public;
revoke all on function public.agendamento_por_token(text) from public;
revoke all on function public.agenda_confirmar_presenca(text) from public;
revoke all on function public.agenda_cancelar(text) from public;
revoke all on function public.agenda_remarcar(text, timestamptz) from public;

-- A tela precisa dos horários livres de um dia, então esta fica pública
-- (só devolve horários, nenhum dado de cliente).
grant execute on function public.agenda_horarios_livres(uuid, date, uuid) to anon, authenticated;
grant execute on function public.agenda_servicos_publicos() to anon, authenticated;
grant execute on function public.agenda_dias_com_horario(uuid, date, date) to anon, authenticated;
grant execute on function public.agenda_agendar(uuid, timestamptz, text, text, text, text[]) to anon, authenticated;
grant execute on function public.agendamento_por_token(text) to anon, authenticated;
grant execute on function public.agenda_confirmar_presenca(text) to anon, authenticated;
grant execute on function public.agenda_cancelar(text) to anon, authenticated;
grant execute on function public.agenda_remarcar(text, timestamptz) to anon, authenticated;

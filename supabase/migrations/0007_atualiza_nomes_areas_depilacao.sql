-- ============================================================
-- MAVI — Atualiza sessões e pacotes antigos para os nomes de área
-- de depilação corretos (definidos em src/data/anamnese.ts).
-- Rode no Supabase: SQL Editor > New query > Run
--
-- De/para combinado com a Marina:
--   Braço/antebraço      -> Coxa
--   Coxa e/ou canela     -> Meia-perna
--   Glúteos e extras     -> Virilha
--   Rosto                -> Pescoço
--   Seios e/ou abdômen   -> removido (sem equivalente novo)
--   Linha alba           -> removido (sem equivalente novo)
-- ============================================================

-- ------------------------------------------------------------
-- 1) sessoes.areas (text[])
-- Troca os nomes antigos pelos novos, remove os sem equivalente,
-- e desduplica preservando a 1ª ordem de aparição (evita "Coxa"
-- repetido se a sessão já tinha "Coxa" e "Coxa e/ou canela" juntos).
-- ------------------------------------------------------------
update public.sessoes s
set areas = coalesce((
  select array_agg(area order by primeira_ordem)
  from (
    select
      case bruto.a
        when 'Braço/antebraço' then 'Coxa'
        when 'Coxa e/ou canela' then 'Meia-perna'
        when 'Glúteos e extras' then 'Virilha'
        when 'Rosto' then 'Pescoço'
        else bruto.a
      end as area,
      min(ordem) as primeira_ordem
    from unnest(s.areas) with ordinality as bruto(a, ordem)
    where bruto.a not in ('Seios e/ou abdômen', 'Linha alba')
    group by area
  ) unico
), '{}')
where areas && array[
  'Braço/antebraço', 'Coxa e/ou canela', 'Glúteos e extras', 'Rosto',
  'Seios e/ou abdômen', 'Linha alba'
];

-- ------------------------------------------------------------
-- 2) fichas.pacotes (jsonb, chave = nome do item)
-- Renomeia as chaves antigas para as novas, mesclando as sessões
-- compradas (arrays) quando a chave nova já existir na mesma ficha.
-- Chaves sem equivalente novo são só removidas.
-- ------------------------------------------------------------
do $$
declare
  mapa jsonb := '{
    "Braço/antebraço": "Coxa",
    "Coxa e/ou canela": "Meia-perna",
    "Glúteos e extras": "Virilha",
    "Rosto": "Pescoço"
  }'::jsonb;
  r record;
  chave text;
  novo text;
  arr_antigo jsonb;
  arr_novo jsonb;
begin
  for r in
    select id, pacotes from public.fichas
    where pacotes ?| array[
      'Braço/antebraço', 'Coxa e/ou canela', 'Glúteos e extras', 'Rosto',
      'Seios e/ou abdômen', 'Linha alba'
    ]
  loop
    r.pacotes := r.pacotes - 'Seios e/ou abdômen' - 'Linha alba';

    for chave, novo in select * from jsonb_each_text(mapa)
    loop
      if r.pacotes ? chave then
        arr_antigo := case
          when jsonb_typeof(r.pacotes -> chave) = 'array' then r.pacotes -> chave
          else jsonb_build_array(r.pacotes -> chave)
        end;
        arr_novo := case
          when not (r.pacotes ? novo) then '[]'::jsonb
          when jsonb_typeof(r.pacotes -> novo) = 'array' then r.pacotes -> novo
          else jsonb_build_array(r.pacotes -> novo)
        end;
        r.pacotes := (r.pacotes - chave - novo) || jsonb_build_object(novo, arr_novo || arr_antigo);
      end if;
    end loop;

    update public.fichas set pacotes = r.pacotes where id = r.id;
  end loop;
end $$;

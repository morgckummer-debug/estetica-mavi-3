import { useState } from "react";
import { Check, Lock, RotateCw, X } from "lucide-react";
import {
  dataSP,
  diaDaSemana,
  hojeSP,
  horaSP,
  instanteSP,
  rotuloDiaMes,
  rotuloSemanaCurta,
  somarDias,
  STATUS_ATIVOS,
  type Agendamento,
  type AgendaServico,
  type Bloqueio,
  type FaixaHorario,
} from "@/lib/agenda";
import { paletaDe } from "@/lib/agenda-cores";

// Agenda em grade de horas: uma coluna por dia (a semana inteira, ou um dia só)
// e uma linha por hora, do primeiro ao último horário de atendimento da semana.
// Cada atendimento é um bloco na hora certa, com altura proporcional à duração:
// o que está em branco é horário livre (clique para agendar), o listrado é
// horário fechado.

const HORA_PX_SEMANA = 56; // altura de uma hora na semana
const HORA_PX_DIA = 104; // no dia sobra espaço: cabem 3 linhas até no atendimento de 30 min
const PASSO_CLIQUE = 30; // o clique no horário vazio "gruda" de 30 em 30 min
const MIN_COLUNA = 132; // largura mínima de cada dia (a semana rola de lado no celular)

const FECHADO = "repeating-linear-gradient(135deg, #f3edf6 0 4px, #ebe1f1 4px 8px)";
const BLOQUEADO = "repeating-linear-gradient(135deg, #FCE4E8 0 5px, #F8D2D9 5px 10px)";

const minutos = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const hhmm = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

type Bloco = { ag: Agendamento; ini: number; fim: number };
type FaixaBloqueio = { b: Bloqueio; ini: number; fim: number };

type DiaGrade = {
  dia: string;
  faixas: { ini: number; fim: number }[];
  blocos: Bloco[];
  bloqueios: FaixaBloqueio[];
};

// Minutos desde a meia-noite de Brasília do `dia`, limitados ao dia.
function minutosNoDia(iso: string, dia: string): number {
  const base = new Date(instanteSP(dia)).getTime();
  const m = (new Date(iso).getTime() - base) / 60000;
  return Math.max(0, Math.min(1440, m));
}

function montarDia(
  dia: string,
  agendamentos: Agendamento[],
  bloqueios: Bloqueio[],
  faixasSemana: FaixaHorario[],
  mostrarCancelados: boolean,
): DiaGrade {
  const dow = diaDaSemana(dia);
  const faixas = faixasSemana
    .filter((f) => f.dia_semana === dow)
    .map((f) => ({ ini: minutos(f.inicio), fim: minutos(f.fim) }))
    .sort((a, b) => a.ini - b.ini);

  const blocos: Bloco[] = agendamentos
    .filter((ag) => dataSP(ag.inicio) === dia && (mostrarCancelados || ag.status !== "cancelado"))
    .map((ag) => ({
      ag,
      ini: minutosNoDia(ag.inicio, dia),
      fim: Math.max(minutosNoDia(ag.fim, dia), minutosNoDia(ag.inicio, dia) + 15),
    }))
    .sort((a, b) => a.ini - b.ini);

  const inicioDia = new Date(instanteSP(dia)).getTime();
  const fimDia = new Date(instanteSP(somarDias(dia, 1))).getTime();
  const faixasBloq: FaixaBloqueio[] = bloqueios
    .filter((b) => new Date(b.fim).getTime() > inicioDia && new Date(b.inicio).getTime() < fimDia)
    .map((b) => ({ b, ini: minutosNoDia(b.inicio, dia), fim: minutosNoDia(b.fim, dia) }));

  return { dia, faixas, blocos, bloqueios: faixasBloq };
}

export function GradeSemana({
  dias,
  agendamentos,
  bloqueios,
  faixas,
  servicos,
  mostrarCancelados,
  onAbrir,
  onRemoverBloqueio,
  onEscolherDia,
  onAgendarEm,
}: {
  dias: string[];
  agendamentos: Agendamento[];
  bloqueios: Bloqueio[];
  // Horário de atendimento da semana (dia_semana: 0 = domingo ... 6 = sábado).
  faixas: FaixaHorario[];
  // Todos os serviços (inclusive os desativados): é de onde vem a cor de cada atendimento.
  servicos: AgendaServico[];
  mostrarCancelados: boolean;
  onAbrir: (ag: Agendamento) => void;
  onRemoverBloqueio: (b: Bloqueio) => void;
  onEscolherDia?: (dia: string) => void;
  // Clique num horário vazio: agendar nesse dia e hora ("HH:MM").
  onAgendarEm: (dia: string, hora: string) => void;
}) {
  const [passando, setPassando] = useState<{ dia: string; min: number } | null>(null);

  const corPorServico = new Map(servicos.map((s) => [s.id, s.cor]));
  const hoje = hojeSP();
  const agora = minutosNoDia(new Date().toISOString(), hoje);
  const semana = dias.length > 1;
  const HORA_PX = semana ? HORA_PX_SEMANA : HORA_PX_DIA;

  let colunas = dias.map((d) => montarDia(d, agendamentos, bloqueios, faixas, mostrarCancelados));
  // Na semana, dias fechados e sem nada (ex.: domingo) não ocupam espaço.
  if (semana) {
    const comConteudo = colunas.filter(
      (c) => c.faixas.length > 0 || c.blocos.length > 0 || c.bloqueios.length > 0,
    );
    if (comConteudo.length > 0) colunas = comConteudo;
  }

  // Intervalo de horas mostrado: do primeiro ao último horário da semana.
  let ini = 24 * 60;
  let fim = 0;
  for (const c of colunas) {
    for (const f of c.faixas) {
      ini = Math.min(ini, f.ini);
      fim = Math.max(fim, f.fim);
    }
    for (const b of c.blocos) {
      ini = Math.min(ini, b.ini);
      fim = Math.max(fim, b.fim);
    }
  }
  if (fim <= ini) {
    ini = 8 * 60;
    fim = 19 * 60;
  }
  ini = Math.floor(ini / 60) * 60;
  fim = Math.min(24 * 60, Math.max(Math.ceil(fim / 60) * 60, ini + 4 * 60));
  const horas = Array.from({ length: (fim - ini) / 60 }, (_, i) => ini + i * 60);
  const altura = ((fim - ini) / 60) * HORA_PX;
  const y = (min: number) => ((min - ini) / 60) * HORA_PX;

  const passou = (dia: string, min: number) => dia < hoje || (dia === hoje && min < agora);

  const minutoDoClique = (e: React.MouseEvent<HTMLDivElement>): number => {
    const caixa = e.currentTarget.getBoundingClientRect();
    const bruto = ini + ((e.clientY - caixa.top) / HORA_PX) * 60;
    const min = Math.floor(bruto / PASSO_CLIQUE) * PASSO_CLIQUE;
    return Math.max(ini, Math.min(fim - PASSO_CLIQUE, min));
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-painel-border bg-white">
      <div className="flex" style={{ minWidth: 56 + colunas.length * MIN_COLUNA }}>
        {/* Eixo das horas */}
        <div className="w-14 shrink-0 border-r border-painel-border">
          <div className="h-[62px] border-b border-painel-border" />
          {horas.map((h) => (
            <div
              key={h}
              className="pr-2 pt-1 text-right text-[11.5px] text-painel-chip-text"
              style={{ height: HORA_PX }}
            >
              {hhmm(h)}
            </div>
          ))}
        </div>

        {colunas.map((c) => {
          const ehHoje = c.dia === hoje;
          const ativos = c.blocos.filter((b) => STATUS_ATIVOS.includes(b.ag.status)).length;
          const fechadoTodo = c.faixas.length === 0;
          return (
            <div
              key={c.dia}
              className="min-w-0 flex-1 border-r border-painel-border/60 last:border-r-0"
              style={{ minWidth: MIN_COLUNA }}
            >
              <button
                type="button"
                onClick={() => onEscolherDia?.(c.dia)}
                className={`flex h-[62px] w-full flex-col justify-center gap-0.5 border-b border-painel-border px-3 text-left transition-colors ${
                  ehHoje
                    ? "bg-painel-primary text-white"
                    : "bg-painel-badge-bg/60 text-painel-title hover:bg-painel-badge-bg"
                }`}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[.06em] opacity-85">
                  {rotuloSemanaCurta(c.dia)}
                </span>
                <span className="font-display text-[20px] leading-none">{rotuloDiaMes(c.dia)}</span>
                <span className="text-[11.5px] opacity-90">
                  {fechadoTodo && ativos === 0
                    ? "Fechado"
                    : `${ativos} ${ativos === 1 ? "cliente" : "clientes"}`}
                </span>
              </button>

              <div
                className="relative"
                style={{
                  height: altura,
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HORA_PX / 2 - 1}px, #f6eefa ${HORA_PX / 2 - 1}px, #f6eefa ${HORA_PX / 2}px, transparent ${HORA_PX / 2}px, transparent ${HORA_PX - 1}px, #ecdff4 ${HORA_PX - 1}px, #ecdff4 ${HORA_PX}px)`,
                }}
                onMouseMove={(e) => {
                  const min = minutoDoClique(e);
                  setPassando(passou(c.dia, min) ? null : { dia: c.dia, min });
                }}
                onMouseLeave={() => setPassando(null)}
                onClick={(e) => {
                  const min = minutoDoClique(e);
                  if (!passou(c.dia, min)) onAgendarEm(c.dia, hhmm(min));
                }}
              >
                {/* Horário fechado */}
                {(fechadoTodo ? [{ ini, fim }] : fechadosDoDia(c.faixas, ini, fim)).map((f) => (
                  <div
                    key={f.ini}
                    className="pointer-events-none absolute inset-x-0"
                    style={{ top: y(f.ini), height: y(f.fim) - y(f.ini), background: FECHADO }}
                  />
                ))}

                {/* Sugestão do horário sob o mouse */}
                {passando?.dia === c.dia && (
                  <div
                    className="pointer-events-none absolute inset-x-1 flex items-center justify-center rounded-lg border-[1.5px] border-dashed border-painel-primary bg-[#fbf5fd] text-[12px] font-semibold text-painel-primary-deep"
                    style={{
                      top: y(passando.min) + 1,
                      height: (PASSO_CLIQUE / 60) * HORA_PX - 2,
                    }}
                  >
                    + Agendar {hhmm(passando.min)}
                  </div>
                )}

                {/* Bloqueios */}
                {c.bloqueios.map(({ b, ini: bi, fim: bf }) => {
                  const topo = Math.max(bi, ini);
                  const base = Math.min(bf, fim);
                  if (base <= topo) return null;
                  const alto = y(base) - y(topo);
                  return (
                    <div
                      key={b.id}
                      onClick={(e) => e.stopPropagation()}
                      onMouseMove={(e) => e.stopPropagation()}
                      className="absolute inset-x-1 overflow-hidden rounded-lg border border-dashed border-[#D9788E] px-2 py-1 pr-7 text-[#8A3A4C]"
                      style={{ top: y(topo) + 1, height: alto - 2, background: BLOQUEADO }}
                    >
                      <p className="flex items-center gap-1 text-[12.5px] font-semibold leading-tight">
                        <Lock className="h-3 w-3 shrink-0" />
                        {bf - bi >= 1439 ? "Dia bloqueado" : "Bloqueado"}
                      </p>
                      {alto > 48 && b.motivo && (
                        <p className="mt-0.5 text-[11.5px] leading-snug">{b.motivo}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemoverBloqueio(b)}
                        title="Remover bloqueio"
                        className="absolute right-1 top-1 rounded-full p-0.5 text-[#D9788E] transition-colors hover:text-[#8A3A4C]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}

                {/* Atendimentos */}
                {c.blocos.map(({ ag, ini: ai, fim: af }) => {
                  const topo = Math.max(ai, ini);
                  const base = Math.min(af, fim);
                  if (base <= topo) return null;
                  const alto = y(base) - y(topo);
                  const confirmou = ag.status === "agendado" && ag.presenca_confirmada_em;
                  const p = paletaDe(corPorServico.get(ag.servico_id));
                  const alta = semana ? alto >= 44 : true;
                  const hora = `${horaSP(ag.inicio)}–${horaSP(ag.fim)}`;
                  const cancelado = ag.status === "cancelado";
                  const reagendar = ag.status === "remarcar";
                  const faltou = ag.status === "faltou";
                  // A cor é do serviço; a situação aparece em ícone, traço e brilho.
                  const apagado = cancelado
                    ? "opacity-50"
                    : ag.status === "concluido"
                      ? "opacity-60"
                      : "";
                  return (
                    <button
                      key={ag.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAbrir(ag);
                      }}
                      onMouseMove={(e) => e.stopPropagation()}
                      onMouseEnter={() => setPassando(null)}
                      title={`${hora} · ${ag.nome} · ${ag.servico_nome}${ag.areas.length > 0 ? ` (${ag.areas.join(", ")})` : ""}`}
                      className={`absolute inset-x-1 overflow-hidden rounded-lg border-l-4 px-2 py-0.5 text-left text-[#3d2a4c] transition-shadow hover:z-10 hover:shadow-[0_8px_24px_-14px_rgba(120,80,150,0.55)] ${
                        reagendar ? "border-[1.5px] border-l-4 border-dashed" : ""
                      } ${apagado}`}
                      style={{
                        top: y(topo) + 1,
                        height: alto - 2,
                        background: p.fundo,
                        borderColor: p.borda,
                      }}
                    >
                      <span className="flex items-center gap-1 text-[12px] font-semibold leading-tight">
                        {confirmou && (
                          <Check
                            className="h-3.5 w-3.5 shrink-0 text-[#1f6b3a]"
                            strokeWidth={3.5}
                          />
                        )}
                        {reagendar && <RotateCw className="h-3 w-3 shrink-0" />}
                        {faltou && (
                          <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#c0485f]" />
                        )}
                        <span className={`truncate ${cancelado || faltou ? "line-through" : ""}`}>
                          {semana
                            ? alta
                              ? `${hora} · ${ag.nome}`
                              : `${horaSP(ag.inicio)} · ${ag.nome}`
                            : hora}
                        </span>
                      </span>
                      {!semana && (
                        <span
                          className={`block truncate text-[12px] font-semibold leading-tight ${cancelado || faltou ? "line-through" : ""}`}
                        >
                          {ag.nome}
                        </span>
                      )}
                      {alta && (
                        <span className="block truncate text-[11.5px] leading-snug opacity-85">
                          {ag.servico_nome}
                          {ag.areas.length > 0 && ` · ${ag.areas.join(", ")}`}
                          {!ag.cliente_id && " · cliente novo(a)"}
                        </span>
                      )}
                      {alto >= 72 && reagendar && (
                        <span className="block text-[11px] font-semibold">Precisa reagendar</span>
                      )}
                    </button>
                  );
                })}

                {/* Agora */}
                {ehHoje && agora >= ini && agora <= fim && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-painel-primary-deep"
                    style={{ top: y(agora) }}
                  >
                    <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-painel-primary-deep" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Trechos do dia em que a clínica não atende: o que sobra de [ini, fim] fora das faixas.
function fechadosDoDia(
  faixas: { ini: number; fim: number }[],
  ini: number,
  fim: number,
): { ini: number; fim: number }[] {
  const trechos: { ini: number; fim: number }[] = [];
  let cursor = ini;
  for (const f of faixas) {
    if (f.ini > cursor) trechos.push({ ini: cursor, fim: Math.min(f.ini, fim) });
    cursor = Math.max(cursor, f.fim);
  }
  if (cursor < fim) trechos.push({ ini: cursor, fim });
  return trechos.filter((t) => t.fim > t.ini);
}

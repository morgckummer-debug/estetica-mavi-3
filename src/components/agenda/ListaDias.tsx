import { Lock, X } from "lucide-react";
import {
  dataSP,
  hojeSP,
  horaSP,
  instanteSP,
  rotuloDiaMes,
  rotuloSemanaCurta,
  somarDias,
  type Agendamento,
  type Bloqueio,
} from "@/lib/agenda";
import { AgendamentoCard } from "./AgendamentoCard";

type Item =
  | { tipo: "ag"; ordem: number; ag: Agendamento }
  | { tipo: "bloqueio"; ordem: number; b: Bloqueio; inicio: number; fim: number };

// Bloqueios aparecem em todo dia que tocam, recortados para o dia.
function itensDoDia(
  dia: string,
  agendamentos: Agendamento[],
  bloqueios: Bloqueio[],
  mostrarCancelados: boolean,
): Item[] {
  const ini = new Date(instanteSP(dia)).getTime();
  const fim = new Date(instanteSP(somarDias(dia, 1))).getTime();
  const itens: Item[] = [];
  for (const ag of agendamentos) {
    if (dataSP(ag.inicio) !== dia) continue;
    if (ag.status === "cancelado" && !mostrarCancelados) continue;
    itens.push({ tipo: "ag", ordem: new Date(ag.inicio).getTime(), ag });
  }
  for (const b of bloqueios) {
    const bi = new Date(b.inicio).getTime();
    const bf = new Date(b.fim).getTime();
    if (bf <= ini || bi >= fim) continue;
    itens.push({
      tipo: "bloqueio",
      ordem: Math.max(bi, ini),
      b,
      inicio: Math.max(bi, ini),
      fim: Math.min(bf, fim),
    });
  }
  return itens.sort((a, b) => a.ordem - b.ordem);
}

function CartaoBloqueio({
  item,
  dia,
  onRemover,
}: {
  item: Extract<Item, { tipo: "bloqueio" }>;
  dia: string;
  onRemover: (b: Bloqueio) => void;
}) {
  const diaInteiro =
    item.inicio <= new Date(instanteSP(dia)).getTime() &&
    item.fim >= new Date(instanteSP(somarDias(dia, 1))).getTime();
  return (
    <div className="relative rounded-[14px] border border-dashed border-painel-gold/50 bg-painel-gold-soft/25 py-3 pl-4 pr-9">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-painel-gold">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        {diaInteiro ? "Dia bloqueado" : "Bloqueado"}
      </p>
      {!diaInteiro && (
        <p className="mt-0.5 text-[12.5px] font-medium text-painel-gold">
          {horaSP(new Date(item.inicio))}–{horaSP(new Date(item.fim))}
        </p>
      )}
      {item.b.motivo && (
        <p className="mt-0.5 text-[12.5px] text-painel-chip-text">{item.b.motivo}</p>
      )}
      <button
        type="button"
        onClick={() => onRemover(item.b)}
        title="Remover bloqueio"
        className="absolute right-2 top-2 rounded-full p-1 text-painel-gold/70 hover:text-painel-alert-text transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// Visão por dia (um dia, em lista) e por semana (sete dias, em colunas no
// computador e empilhados no celular).
export function ListaDias({
  dias,
  agendamentos,
  bloqueios,
  mostrarCancelados,
  onAbrir,
  onRemoverBloqueio,
  onEscolherDia,
}: {
  dias: string[];
  agendamentos: Agendamento[];
  bloqueios: Bloqueio[];
  mostrarCancelados: boolean;
  onAbrir: (ag: Agendamento) => void;
  onRemoverBloqueio: (b: Bloqueio) => void;
  onEscolherDia?: (dia: string) => void;
}) {
  const hoje = hojeSP();
  const semana = dias.length > 1;

  return (
    <div className={semana ? "grid grid-cols-1 gap-5 md:grid-cols-7 md:gap-2.5" : "space-y-2.5"}>
      {dias.map((dia) => {
        const itens = itensDoDia(dia, agendamentos, bloqueios, mostrarCancelados);
        const ehHoje = dia === hoje;
        return (
          <div key={dia} className="min-w-0">
            {semana && (
              <button
                type="button"
                onClick={() => onEscolherDia?.(dia)}
                className={`mb-2 flex w-full items-baseline gap-2 rounded-xl px-3 py-2 text-left transition-colors md:flex-col md:items-start md:gap-0 ${
                  ehHoje
                    ? "bg-painel-primary text-white"
                    : "bg-painel-badge-bg/60 text-painel-title hover:bg-painel-badge-bg"
                }`}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[.06em] opacity-80">
                  {rotuloSemanaCurta(dia)}
                </span>
                <span className="font-display text-[20px] leading-none">{rotuloDiaMes(dia)}</span>
              </button>
            )}
            <div className="space-y-2">
              {itens.length === 0 && semana && (
                <p className="px-1 text-[12px] text-painel-muted-2">—</p>
              )}
              {itens.map((it) =>
                it.tipo === "ag" ? (
                  <AgendamentoCard key={it.ag.id} ag={it.ag} onAbrir={onAbrir} compacto={semana} />
                ) : (
                  <CartaoBloqueio
                    key={`${it.b.id}-${dia}`}
                    item={it}
                    dia={dia}
                    onRemover={onRemoverBloqueio}
                  />
                ),
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

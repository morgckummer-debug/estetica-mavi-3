import { Lock } from "lucide-react";
import {
  dataSP,
  hojeSP,
  horaSP,
  diasDoMes,
  instanteSP,
  somarDias,
  STATUS_ATIVOS,
  type Agendamento,
  type AgendaServico,
  type Bloqueio,
} from "@/lib/agenda";
import { paletaDe } from "@/lib/agenda-cores";

const SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function VisaoMes({
  mes,
  agendamentos,
  bloqueios,
  servicos,
  onEscolherDia,
}: {
  mes: string;
  agendamentos: Agendamento[];
  bloqueios: Bloqueio[];
  servicos: AgendaServico[];
  onEscolherDia: (dia: string) => void;
}) {
  const corPorServico = new Map(servicos.map((s) => [s.id, s.cor]));
  const hoje = hojeSP();
  const mesAtual = mes.slice(0, 7);

  const ativosPorDia = new Map<string, Agendamento[]>();
  for (const ag of agendamentos) {
    if (!STATUS_ATIVOS.includes(ag.status) && ag.status !== "concluido") continue;
    const d = dataSP(ag.inicio);
    ativosPorDia.set(d, [...(ativosPorDia.get(d) ?? []), ag]);
  }

  const situacaoBloqueio = (dia: string): "inteiro" | "parcial" | null => {
    const ini = new Date(instanteSP(dia)).getTime();
    const fim = new Date(instanteSP(somarDias(dia, 1))).getTime();
    let parcial = false;
    for (const b of bloqueios) {
      const bi = new Date(b.inicio).getTime();
      const bf = new Date(b.fim).getTime();
      if (bf <= ini || bi >= fim) continue;
      if (bi <= ini && bf >= fim) return "inteiro";
      parcial = true;
    }
    return parcial ? "parcial" : null;
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5">
        {SEMANA.map((s) => (
          <div
            key={s}
            className="px-1 text-center text-[11px] font-semibold uppercase tracking-[.06em] text-painel-muted"
          >
            {s}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {diasDoMes(mes).map((dia) => {
          const doMes = dia.slice(0, 7) === mesAtual;
          const lista = ativosPorDia.get(dia) ?? [];
          const bloqueio = situacaoBloqueio(dia);
          const ehHoje = dia === hoje;
          return (
            <button
              key={dia}
              type="button"
              onClick={() => onEscolherDia(dia)}
              className={`flex min-h-[64px] flex-col items-stretch rounded-xl border p-1.5 text-left transition-colors sm:min-h-[96px] sm:p-2 ${
                bloqueio === "inteiro"
                  ? "border-[#D9788E]/50 bg-[#FCE4E8]"
                  : "border-painel-border bg-white hover:border-painel-primary/50"
              } ${doMes ? "" : "opacity-45"}`}
            >
              <span className="flex items-center justify-between">
                <span
                  className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] font-semibold ${
                    ehHoje ? "bg-painel-primary text-white" : "text-painel-title"
                  }`}
                >
                  {Number(dia.slice(8))}
                </span>
                {bloqueio && <Lock className="h-3 w-3 text-[#D9788E]" />}
              </span>
              {lista.length > 0 && (
                <>
                  <span className="mt-1 inline-flex w-fit rounded-full bg-painel-primary px-2 py-0.5 text-[10.5px] font-semibold text-white sm:hidden">
                    {lista.length}
                  </span>
                  <span className="mt-1 hidden space-y-0.5 sm:block">
                    {lista.slice(0, 2).map((ag) => {
                      const p = paletaDe(corPorServico.get(ag.servico_id));
                      return (
                        <span
                          key={ag.id}
                          className="block truncate rounded-md border-l-[3px] px-1.5 py-0.5 text-[11px] text-[#3d2a4c]"
                          style={{ background: p.fundo, borderColor: p.borda }}
                        >
                          {horaSP(ag.inicio)} {ag.nome.split(" ")[0]}
                        </span>
                      );
                    })}
                    {lista.length > 2 && (
                      <span className="block px-1 text-[11px] font-medium text-painel-muted">
                        +{lista.length - 2}
                      </span>
                    )}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

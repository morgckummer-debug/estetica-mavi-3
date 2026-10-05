import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  dataSP,
  diasDoMes,
  hojeSP,
  inicioDaSemana,
  inicioDoMes,
  instanteSP,
  listarAgendamentos,
  listarBloqueios,
  rotuloDiaLongo,
  rotuloMesAno,
  somarDias,
  somarMeses,
  STATUS_ATIVOS,
  type Bloqueio,
} from "@/lib/agenda";

const SEMANA = ["S", "T", "Q", "Q", "S", "S", "D"];

// Calendário do mês para ir direto a um dia da agenda. Mostra um ponto nos
// dias com atendimento e deixa riscados os dias bloqueados (férias, folga).
// A semana que aparece na agenda fica destacada. Busca os próprios dados do
// mês que está à vista, então navegar aqui não mexe na grade.
export function MiniCalendario({
  ancora,
  semanaInteira,
  recarga,
  onEscolher,
}: {
  // Dia em foco na agenda.
  ancora: string;
  // Destaca a semana toda (visão Semana) em vez de só o dia.
  semanaInteira: boolean;
  // Muda quando a agenda recarrega: atualiza os pontinhos também.
  recarga: number;
  onEscolher: (dia: string) => void;
}) {
  const hoje = hojeSP();
  const [mes, setMes] = useState(inicioDoMes(ancora));
  const [comAtendimento, setComAtendimento] = useState<Set<string>>(new Set());
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);

  // Quando a agenda vai para outro mês (botões Anterior/Próximo, Hoje), o
  // calendário acompanha.
  useEffect(() => setMes(inicioDoMes(ancora)), [ancora]);

  const dias = useMemo(() => diasDoMes(mes), [mes]);

  useEffect(() => {
    let ativo = true;
    const de = dias[0];
    const ate = somarDias(dias[dias.length - 1], 1);
    Promise.all([listarAgendamentos(de, ate), listarBloqueios(de, ate)])
      .then(([ags, blqs]) => {
        if (!ativo) return;
        setComAtendimento(
          new Set(ags.filter((a) => STATUS_ATIVOS.includes(a.status)).map((a) => dataSP(a.inicio))),
        );
        setBloqueios(blqs);
      })
      .catch(() => {
        // Enfeite: se falhar, o calendário só fica sem os pontinhos.
        if (!ativo) return;
        setComAtendimento(new Set());
        setBloqueios([]);
      });
    return () => {
      ativo = false;
    };
  }, [dias, recarga]);

  const diaBloqueado = (dia: string): boolean => {
    const ini = new Date(instanteSP(dia)).getTime();
    const fim = new Date(instanteSP(somarDias(dia, 1))).getTime();
    return bloqueios.some(
      (b) => new Date(b.inicio).getTime() <= ini && new Date(b.fim).getTime() >= fim,
    );
  };

  const inicioSemana = inicioDaSemana(ancora);
  const naSemana = (dia: string) =>
    semanaInteira ? dia >= inicioSemana && dia < somarDias(inicioSemana, 7) : dia === ancora;

  return (
    <div className="rounded-2xl border border-painel-border bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMes(somarMeses(mes, -1))}
          aria-label="Mês anterior"
          className="rounded-full p-1.5 text-painel-chip-text transition-colors hover:bg-painel-badge-bg/60"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-display text-[18px] text-painel-title first-letter:uppercase">
          {rotuloMesAno(mes)}
        </p>
        <button
          type="button"
          onClick={() => setMes(somarMeses(mes, 1))}
          aria-label="Próximo mês"
          className="rounded-full p-1.5 text-painel-chip-text transition-colors hover:bg-painel-badge-bg/60"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold text-painel-muted">
        {SEMANA.map((s, i) => (
          <span key={i} className="py-1">
            {s}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {dias.map((d) => {
          const doMes = d.slice(0, 7) === mes.slice(0, 7);
          const ehHoje = d === hoje;
          const foco = naSemana(d);
          const bloqueado = diaBloqueado(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => onEscolher(d)}
              aria-label={rotuloDiaLongo(d)}
              aria-current={ehHoje ? "date" : undefined}
              className={`relative mx-auto flex h-8 w-full max-w-[34px] items-center justify-center rounded-full text-[13px] transition-colors ${
                ehHoje
                  ? "bg-painel-primary font-semibold text-white"
                  : foco
                    ? "bg-painel-badge-bg font-semibold text-painel-title"
                    : doMes
                      ? "text-painel-title hover:bg-painel-badge-bg/60"
                      : "text-painel-muted/50 hover:bg-painel-badge-bg/40"
              } ${bloqueado && !ehHoje ? "line-through decoration-[#D9788E]/70" : ""}`}
            >
              {Number(d.slice(8))}
              {comAtendimento.has(d) && (
                <span
                  className={`absolute bottom-0.5 h-1 w-1 rounded-full ${
                    ehHoje ? "bg-white" : "bg-painel-primary"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-painel-muted">
        <span className="h-1 w-1 rounded-full bg-painel-primary" />
        dia com atendimento
      </p>
    </div>
  );
}

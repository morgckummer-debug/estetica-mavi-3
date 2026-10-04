import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { listarDiasComHorario, listarHorariosLivres } from "@/lib/api/agenda.functions";
import {
  diasDoMes,
  hojeSP,
  horaSP,
  inicioDoMes,
  rotuloDiaLongo,
  rotuloMesAno,
  somarDias,
  somarMeses,
  ultimoDiaDoMes,
} from "@/lib/agenda-datas";

const SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
// A agenda online abre no máximo 60 dias à frente (ver agenda_config).
const JANELA_DIAS = 60;

// Calendário + horários livres de um serviço. A cliente só consegue clicar
// em dias que têm vaga; os horários vêm do banco, já descontando expediente,
// bloqueios e outros agendamentos.
export function EscolherHorario({
  servicoId,
  valor,
  onEscolher,
}: {
  servicoId: string;
  valor: string | null;
  onEscolher: (iso: string | null) => void;
}) {
  const hoje = hojeSP();
  const limite = somarDias(hoje, JANELA_DIAS);
  const [mes, setMes] = useState(inicioDoMes(hoje));
  const [diasLivres, setDiasLivres] = useState<Set<string> | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const [horarios, setHorarios] = useState<string[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Dias com vaga no mês exibido.
  useEffect(() => {
    let ativo = true;
    setDiasLivres(null);
    setErro(null);
    const de = mes < hoje ? hoje : mes;
    const ate = ultimoDiaDoMes(mes);
    if (ate < hoje) {
      setDiasLivres(new Set());
      return;
    }
    listarDiasComHorario({ data: { servicoId, de, ate } })
      .then((d) => ativo && setDiasLivres(new Set(d)))
      .catch(() => {
        if (!ativo) return;
        setDiasLivres(new Set());
        setErro("Não foi possível carregar os dias disponíveis. Tente de novo em instantes.");
      });
    return () => {
      ativo = false;
    };
  }, [servicoId, mes, hoje]);

  // Horários do dia escolhido.
  useEffect(() => {
    if (!dia) {
      setHorarios(null);
      return;
    }
    let ativo = true;
    setHorarios(null);
    listarHorariosLivres({ data: { servicoId, dia } })
      .then((h) => ativo && setHorarios(h))
      .catch(() => {
        if (!ativo) return;
        setHorarios([]);
        setErro("Não foi possível carregar os horários. Tente de novo em instantes.");
      });
    return () => {
      ativo = false;
    };
  }, [servicoId, dia]);

  const semanas = useMemo(() => diasDoMes(mes), [mes]);
  const podeVoltar = mes > inicioDoMes(hoje);
  const podeAvancar = somarMeses(mes, 1) <= limite;

  return (
    <div>
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => podeVoltar && setMes(somarMeses(mes, -1))}
            disabled={!podeVoltar}
            aria-label="Mês anterior"
            className="rounded-full p-2 text-primary transition-colors hover:bg-lavender-soft disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="font-display text-xl text-primary first-letter:uppercase">
            {rotuloMesAno(mes)}
          </p>
          <button
            type="button"
            onClick={() => podeAvancar && setMes(somarMeses(mes, 1))}
            disabled={!podeAvancar}
            aria-label="Próximo mês"
            className="rounded-full p-2 text-primary transition-colors hover:bg-lavender-soft disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-widest text-muted-foreground">
          {SEMANA.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>

        <div className="relative grid grid-cols-7 gap-1">
          {semanas.map((d) => {
            const doMes = d.slice(0, 7) === mes.slice(0, 7);
            const livre = diasLivres?.has(d) ?? false;
            const escolhido = d === dia;
            return (
              <button
                key={d}
                type="button"
                disabled={!doMes || !livre}
                onClick={() => {
                  setDia(d);
                  onEscolher(null);
                }}
                aria-label={rotuloDiaLongo(d)}
                className={`aspect-square rounded-full text-sm transition-colors ${
                  !doMes
                    ? "invisible"
                    : escolhido
                      ? "bg-primary font-semibold text-primary-foreground"
                      : livre
                        ? "bg-lavender-soft font-medium text-primary hover:bg-lavender"
                        : "text-muted-foreground/40"
                }`}
              >
                {Number(d.slice(8))}
              </button>
            );
          })}
          {diasLivres === null && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/70">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {diasLivres && diasLivres.size === 0 && !erro && (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Não há horários livres neste mês. Veja o mês seguinte ou fale com a gente pelo WhatsApp.
          </p>
        )}
      </div>

      {erro && (
        <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {erro}
        </p>
      )}

      {dia && (
        <div className="mt-5">
          <p className="mb-3 text-sm text-muted-foreground first-letter:uppercase">
            Horários em <span className="font-medium text-foreground">{rotuloDiaLongo(dia)}</span>
          </p>
          {horarios === null && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          {horarios && horarios.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Esse dia acabou de ficar sem horários. Escolha outro dia.
            </p>
          )}
          {horarios && horarios.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {horarios.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => onEscolher(h)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    valor === h
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/50"
                  }`}
                >
                  {horaSP(h)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

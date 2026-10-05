import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  diasDoMes,
  hojeSP,
  inicioDoMes,
  rotuloDiaLongo,
  rotuloMesAno,
  rotuloSemanaCurta,
  somarDias,
  somarMeses,
} from "@/lib/agenda";
import { campo } from "./estilos";

const SEMANA = ["S", "T", "Q", "Q", "S", "S", "D"];

// "2026-10-05" → "seg, 05/10/2026" (ou só "05/10/2026" sem o dia da semana)
function rotuloData(ymd: string, semana: boolean): string {
  if (!ymd) return "Escolha a data";
  const [a, m, d] = ymd.split("-");
  return semana ? `${rotuloSemanaCurta(ymd)}, ${d}/${m}/${a}` : `${d}/${m}/${a}`;
}

const LARGURA = 304; // 19rem
const ALTURA = 340; // altura aproximada do painel, para decidir se abre para cima
const MARGEM = 12;

type Posicao = { left: number; top?: number; bottom?: number };

// Escolha de data no visual do painel (substitui o calendário do navegador,
// que fica cinza e destoa do resto). Datas sempre "YYYY-MM-DD", dias antes de
// `min` ficam desabilitados. A semana começa na segunda, como a agenda.
export function SeletorData({
  valor,
  onChange,
  min,
  alinhar = "esquerda",
  semana = true,
  rotulo,
}: {
  valor: string;
  onChange: (ymd: string) => void;
  min?: string;
  alinhar?: "esquerda" | "direita";
  // Mostra o dia da semana no campo (desligue em campos estreitos).
  semana?: boolean;
  // Texto lido por leitores de tela (o rótulo visível fica no formulário).
  rotulo?: string;
}) {
  const hoje = hojeSP();
  const [aberto, setAberto] = useState(false);
  const [mes, setMes] = useState(inicioDoMes(valor || min || hoje));
  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<Posicao>({ left: MARGEM });

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setAberto(false);
      }
    };
    // O painel é fixo na tela: se a janela rolar ou mudar de tamanho, fecha.
    const fechar = () => setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  const dias = useMemo(() => diasDoMes(mes), [mes]);
  const podeVoltar = !min || somarDias(mes, -1) >= inicioDoMes(min);

  // Posiciona o painel junto ao campo, sem sair da tela: abre para cima se
  // faltar espaço embaixo.
  const abrir = () => {
    const r = gatilho.current?.getBoundingClientRect();
    if (r) {
      const largura = Math.min(LARGURA, window.innerWidth - 2 * MARGEM);
      const ideal = alinhar === "direita" ? r.right - largura : r.left;
      const left = Math.max(MARGEM, Math.min(ideal, window.innerWidth - largura - MARGEM));
      const cabeEmbaixo = window.innerHeight - r.bottom >= ALTURA + MARGEM;
      setPos(
        cabeEmbaixo
          ? { left, top: r.bottom + 8 }
          : { left, bottom: window.innerHeight - r.top + 8 },
      );
    }
    setMes(inicioDoMes(valor || min || hoje));
    setAberto((a) => !a);
  };

  const escolher = (dia: string) => {
    onChange(dia);
    setAberto(false);
  };

  const hojeDesabilitado = Boolean(min && hoje < min);

  return (
    <div ref={raiz} className="relative">
      <button
        ref={gatilho}
        type="button"
        onClick={abrir}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={rotulo ? `${rotulo}: ${rotuloData(valor, true)}` : undefined}
        className={`${campo} flex items-center justify-between gap-2 text-left first-letter:uppercase`}
      >
        <span className="whitespace-nowrap first-letter:uppercase">
          {rotuloData(valor, semana)}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-painel-lilac-soft" />
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Escolher data"
          style={pos}
          className="fixed z-[60] w-[19rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/15 bg-painel-hero-bg p-3 shadow-2xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => podeVoltar && setMes(somarMeses(mes, -1))}
              disabled={!podeVoltar}
              aria-label="Mês anterior"
              className="rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-medium text-white first-letter:uppercase">
              {rotuloMesAno(mes)}
            </p>
            <button
              type="button"
              onClick={() => setMes(somarMeses(mes, 1))}
              aria-label="Próximo mês"
              className="rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-white/40">
            {SEMANA.map((s, i) => (
              <span key={i} className="py-1">
                {s}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5">
            {dias.map((d) => {
              const doMes = d.slice(0, 7) === mes.slice(0, 7);
              if (!doMes) return <span key={d} />;
              const passado = Boolean(min && d < min);
              const escolhido = d === valor;
              const ehHoje = d === hoje;
              return (
                <button
                  key={d}
                  type="button"
                  disabled={passado}
                  onClick={() => escolher(d)}
                  aria-label={rotuloDiaLongo(d)}
                  aria-pressed={escolhido}
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors ${
                    escolhido
                      ? "bg-painel-primary font-semibold text-white"
                      : passado
                        ? "text-white/20"
                        : ehHoje
                          ? "font-semibold text-painel-lilac-soft ring-1 ring-painel-lilac-soft/60 hover:bg-white/10"
                          : "text-white/85 hover:bg-white/10"
                  }`}
                >
                  {Number(d.slice(8))}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
            <button
              type="button"
              disabled={hojeDesabilitado}
              onClick={() => escolher(hoje)}
              className="rounded-full px-3 py-1 text-xs font-medium text-painel-lilac-soft transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded-full px-3 py-1 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

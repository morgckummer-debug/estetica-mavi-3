import { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, Plus, Trash2, X } from "lucide-react";
import {
  carregarConfigAgenda,
  listarFaixasHorario,
  salvarConfigAgenda,
  salvarFaixasHorario,
  type AgendaConfig,
  type FaixaHorario,
} from "@/lib/agenda";
import { PainelModal } from "@/components/PainelModal";
import { btnPrimario, btnSecundario, campo, rotulo } from "./estilos";

// Segunda a domingo; o número segue o banco (0 = domingo ... 6 = sábado).
const DIAS: { dia: number; nome: string }[] = [
  { dia: 1, nome: "Segunda-feira" },
  { dia: 2, nome: "Terça-feira" },
  { dia: 3, nome: "Quarta-feira" },
  { dia: 4, nome: "Quinta-feira" },
  { dia: 5, nome: "Sexta-feira" },
  { dia: 6, nome: "Sábado" },
  { dia: 0, nome: "Domingo" },
];

type Faixa = { inicio: string; fim: string };
type Semana = Record<number, Faixa[]>;

// Campos numéricos ficam como texto enquanto ela digita.
type RegrasTexto = Record<keyof AgendaConfig, string>;

const REGRAS: {
  chave: keyof AgendaConfig;
  titulo: string;
  unidade: string;
  ajuda: string;
  min: number;
  max: number;
}[] = [
  {
    chave: "passo_min",
    titulo: "Intervalo entre horários",
    unidade: "minutos",
    ajuda: "De quanto em quanto tempo começa um horário na agenda (9:00, 9:30…).",
    min: 5,
    max: 240,
  },
  {
    chave: "antecedencia_horas",
    titulo: "Antecedência mínima",
    unidade: "horas",
    ajuda: "Quanto tempo antes do horário a cliente ainda consegue marcar online.",
    min: 0,
    max: 720,
  },
  {
    chave: "janela_dias",
    titulo: "Agenda aberta até",
    unidade: "dias à frente",
    ajuda: "Até quantos dias no futuro a cliente consegue marcar.",
    min: 1,
    max: 365,
  },
  {
    chave: "cancelamento_horas",
    titulo: "Prazo para cancelar ou reagendar",
    unidade: "horas antes",
    ajuda:
      "Até quando a cliente muda o horário sozinha pelo link. O contrato prevê 24 horas: só mude se o contrato também mudar.",
    min: 0,
    max: 720,
  },
  {
    chave: "max_futuros_por_telefone",
    titulo: "Máximo de horários futuros por telefone",
    unidade: "horários",
    ajuda: "Trava contra abuso: quantos agendamentos ativos o mesmo WhatsApp pode ter.",
    min: 1,
    max: 50,
  },
];

const semanaVazia = (): Semana => Object.fromEntries(DIAS.map((d) => [d.dia, [] as Faixa[]]));

function paraSemana(faixas: FaixaHorario[]): Semana {
  const s = semanaVazia();
  for (const f of faixas) s[f.dia_semana]?.push({ inicio: f.inicio, fim: f.fim });
  return s;
}

// Confere as faixas de um dia e devolve a mensagem de erro, se houver.
function problemaNoDia(nome: string, faixas: Faixa[]): string | null {
  for (const f of faixas) {
    if (!f.inicio || !f.fim) return `${nome}: preencha o início e o fim de cada faixa.`;
    if (f.fim <= f.inicio) return `${nome}: o fim precisa ser depois do início.`;
  }
  const ordenadas = [...faixas].sort((a, b) => a.inicio.localeCompare(b.inicio));
  for (let i = 1; i < ordenadas.length; i++) {
    if (ordenadas[i].inicio < ordenadas[i - 1].fim) return `${nome}: há faixas se sobrepondo.`;
  }
  return null;
}

// Subjanela de "Serviços": horário de atendimento da semana (dias e faixas,
// com pausa de almoço se quiser) e as regras gerais da agenda online.
// Mudanças valem para os próximos agendamentos; os já marcados não mudam.
export function RegrasGerais({
  onVoltar,
  onFechar,
}: {
  onVoltar: () => void;
  onFechar: () => void;
}) {
  const [semana, setSemana] = useState<Semana | null>(null);
  const [regras, setRegras] = useState<RegrasTexto | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    Promise.all([listarFaixasHorario(), carregarConfigAgenda()])
      .then(([faixas, cfg]) => {
        setSemana(paraSemana(faixas));
        setRegras(
          Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, String(v)])) as RegrasTexto,
        );
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."));
  }, []);

  const mexer = () => setSalvo(false);

  const mudarFaixa = (dia: number, i: number, campos: Partial<Faixa>) => {
    mexer();
    setSemana((s) =>
      s ? { ...s, [dia]: s[dia].map((f, j) => (j === i ? { ...f, ...campos } : f)) } : s,
    );
  };

  const adicionarFaixa = (dia: number) => {
    mexer();
    setSemana((s) => {
      if (!s) return s;
      const ultima = s[dia][s[dia].length - 1];
      // Segunda faixa do dia: começa onde a anterior terminou (+1h de pausa).
      const nova = ultima
        ? { inicio: somarHora(ultima.fim, 1), fim: somarHora(ultima.fim, 5) }
        : { inicio: "09:00", fim: "18:00" };
      return { ...s, [dia]: [...s[dia], nova] };
    });
  };

  const removerFaixa = (dia: number, i: number) => {
    mexer();
    setSemana((s) => (s ? { ...s, [dia]: s[dia].filter((_, j) => j !== i) } : s));
  };

  const salvar = async () => {
    if (!semana || !regras) return;
    setErro(null);

    for (const { dia, nome } of DIAS) {
      const problema = problemaNoDia(nome, semana[dia]);
      if (problema) return setErro(problema);
    }
    const cfg = {} as AgendaConfig;
    for (const r of REGRAS) {
      const n = Number(regras[r.chave]);
      if (!Number.isInteger(n) || n < r.min || n > r.max)
        return setErro(`${r.titulo}: use um número inteiro entre ${r.min} e ${r.max}.`);
      cfg[r.chave] = n;
    }

    const faixas: FaixaHorario[] = DIAS.flatMap(({ dia }) =>
      semana[dia].map((f) => ({ dia_semana: dia, inicio: f.inicio, fim: f.fim })),
    );

    setSalvando(true);
    try {
      await salvarFaixasHorario(faixas);
      await salvarConfigAgenda(cfg);
      setSalvo(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const semAtendimento = semana !== null && DIAS.every(({ dia }) => semana[dia].length === 0);

  return (
    <PainelModal onFechar={onFechar} maxWidth="max-w-xl">
      <div className="mb-1 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onVoltar}
          className="inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Serviços
        </button>
        <button
          type="button"
          onClick={onFechar}
          title="Fechar"
          className="text-white/50 transition-colors hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <h3 className="mb-1 font-medium text-white">Regras gerais</h3>
      <p className="mb-4 text-xs leading-relaxed text-white/60">
        Os dias e horários em que você atende e as regras da agenda online. As mudanças valem para
        os próximos agendamentos; os que já estão marcados não mudam. Férias e feriados: use o botão
        “Férias” ou “Bloquear” da agenda.
      </p>

      {!semana || !regras ? (
        <div className="flex justify-center py-8">
          {erro ? (
            <p className="text-sm text-rose-300">{erro}</p>
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-white/60" />
          )}
        </div>
      ) : (
        <>
          <h4 className="mb-2 text-sm font-medium text-white">Horário de atendimento</h4>
          <ul className="space-y-2">
            {DIAS.map(({ dia, nome }) => {
              const faixas = semana[dia];
              return (
                <li key={dia} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white">{nome}</span>
                    {faixas.length === 0 && (
                      <button
                        type="button"
                        onClick={() => adicionarFaixa(dia)}
                        className="text-xs font-medium text-painel-lilac-soft hover:text-white"
                      >
                        Fechado · abrir
                      </button>
                    )}
                  </div>
                  {faixas.map((f, i) => (
                    <div key={i} className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        aria-label={`${nome}: início`}
                        value={f.inicio}
                        onChange={(e) => mudarFaixa(dia, i, { inicio: e.target.value })}
                        className={`${campo} !w-28 [color-scheme:dark]`}
                      />
                      <span className="text-xs text-white/50">até</span>
                      <input
                        type="time"
                        aria-label={`${nome}: fim`}
                        value={f.fim}
                        onChange={(e) => mudarFaixa(dia, i, { fim: e.target.value })}
                        className={`${campo} !w-28 [color-scheme:dark]`}
                      />
                      <button
                        type="button"
                        title="Remover faixa"
                        onClick={() => removerFaixa(dia, i)}
                        className="text-white/50 hover:text-rose-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {faixas.length > 0 && (
                    <button
                      type="button"
                      onClick={() => adicionarFaixa(dia)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-painel-lilac-soft hover:text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Outra faixa (pausa de almoço)
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {semAtendimento && (
            <p className="mt-2 text-sm text-amber-200">
              ⚠️ Nenhum dia aberto: a agenda online ficará sem horários.
            </p>
          )}

          <h4 className="mb-2 mt-6 text-sm font-medium text-white">Regras da agenda online</h4>
          <div className="space-y-4">
            {REGRAS.map((r) => (
              <div key={r.chave}>
                <label className={rotulo} htmlFor={`regra-${r.chave}`}>
                  {r.titulo}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={`regra-${r.chave}`}
                    type="number"
                    inputMode="numeric"
                    min={r.min}
                    max={r.max}
                    value={regras[r.chave]}
                    onChange={(e) => {
                      mexer();
                      setRegras({ ...regras, [r.chave]: e.target.value });
                    }}
                    className={`${campo} !w-24`}
                  />
                  <span className="text-sm text-white/60">{r.unidade}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-white/50">{r.ajuda}</p>
              </div>
            ))}
          </div>

          {erro && <p className="mt-4 text-sm text-rose-300">{erro}</p>}
          <div className="mt-5 flex items-center gap-3">
            <button type="button" disabled={salvando} onClick={salvar} className={btnPrimario}>
              {salvando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Salvar
            </button>
            <button type="button" onClick={onVoltar} className={btnSecundario}>
              Voltar
            </button>
            {salvo && <span className="text-sm text-emerald-300">Salvo.</span>}
          </div>
        </>
      )}
    </PainelModal>
  );
}

// "13:00" + 1h → "14:00" (trava em 23:59 para caber no dia).
function somarHora(hora: string, horas: number): string {
  const [h, m] = hora.split(":").map(Number);
  const total = Math.min(h * 60 + m + horas * 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, ChevronLeft, ChevronRight, Loader2, Lock } from "lucide-react";
import {
  dataSP,
  diasDoMes,
  excluirBloqueio,
  hojeSP,
  inicioDaSemana,
  inicioDoMes,
  listarAgendamentos,
  listarBloqueios,
  listarServicosAgenda,
  rotuloDiaLongo,
  rotuloDiaMes,
  rotuloMesAno,
  somarDias,
  somarMeses,
  STATUS_ATIVOS,
  type AgendaServico,
  type Agendamento,
  type Bloqueio,
} from "@/lib/agenda";
import { ListaDias } from "@/components/agenda/ListaDias";
import { VisaoMes } from "@/components/agenda/VisaoMes";
import { DetalheAgendamento } from "@/components/agenda/DetalheAgendamento";
import { NovoAgendamento } from "@/components/agenda/NovoAgendamento";
import { BloquearHorario } from "@/components/agenda/BloquearHorario";

export const Route = createFileRoute("/painel/agenda")({
  component: PaginaAgenda,
});

type Visao = "dia" | "semana" | "mes";

const VISOES: { id: Visao; rotulo: string }[] = [
  { id: "dia", rotulo: "Dia" },
  { id: "semana", rotulo: "Semana" },
  { id: "mes", rotulo: "Mês" },
];

// Intervalo [de, ate) carregado para cada visão.
function intervalo(visao: Visao, ancora: string): { de: string; ate: string } {
  if (visao === "dia") return { de: ancora, ate: somarDias(ancora, 1) };
  if (visao === "semana") {
    const de = inicioDaSemana(ancora);
    return { de, ate: somarDias(de, 7) };
  }
  const dias = diasDoMes(ancora);
  return { de: dias[0], ate: somarDias(dias[dias.length - 1], 1) };
}

function rotuloPeriodo(visao: Visao, ancora: string): string {
  if (visao === "dia") return rotuloDiaLongo(ancora);
  if (visao === "mes") return rotuloMesAno(ancora);
  const de = inicioDaSemana(ancora);
  return `${rotuloDiaMes(de)} – ${rotuloDiaMes(somarDias(de, 6))}`;
}

function PaginaAgenda() {
  const [visao, setVisao] = useState<Visao>("semana");
  const [ancora, setAncora] = useState(hojeSP);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [servicos, setServicos] = useState<AgendaServico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mostrarCancelados, setMostrarCancelados] = useState(false);
  const [recarga, setRecarga] = useState(0);

  const [aberto, setAberto] = useState<Agendamento | null>(null);
  const [novo, setNovo] = useState(false);
  const [bloqueando, setBloqueando] = useState(false);

  // No celular a semana não cabe em colunas: abre direto no dia.
  useEffect(() => {
    if (window.innerWidth < 640) setVisao("dia");
  }, []);

  useEffect(() => {
    listarServicosAgenda()
      .then(setServicos)
      .catch(() => setServicos([]));
  }, []);

  const { de, ate } = useMemo(() => intervalo(visao, ancora), [visao, ancora]);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    Promise.all([listarAgendamentos(de, ate), listarBloqueios(de, ate)])
      .then(([ags, blqs]) => {
        if (!ativo) return;
        setAgendamentos(ags);
        setBloqueios(blqs);
        setErro(null);
      })
      .catch((e) => {
        if (!ativo) return;
        setErro(
          /relation .*agenda.* does not exist|does not exist/i.test(String(e?.message))
            ? "Rode a migração 20261004120000_agenda_mavi.sql no Supabase para ativar a agenda."
            : e instanceof Error
              ? e.message
              : "Não foi possível carregar a agenda.",
        );
      })
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [de, ate, recarga]);

  const recarregar = useCallback(() => setRecarga((n) => n + 1), []);

  const avisar = useCallback((mensagem: string) => {
    setAviso(mensagem);
    window.setTimeout(() => setAviso(null), 4000);
  }, []);

  const mover = (direcao: -1 | 1) => {
    if (visao === "dia") setAncora((a) => somarDias(a, direcao));
    else if (visao === "semana") setAncora((a) => somarDias(a, 7 * direcao));
    else setAncora((a) => somarMeses(inicioDoMes(a), direcao));
  };

  const escolherDia = (dia: string) => {
    setAncora(dia);
    setVisao("dia");
  };

  const removerBloqueio = async (b: Bloqueio) => {
    if (!window.confirm("Remover este bloqueio? Os horários voltam a ficar livres.")) return;
    try {
      await excluirBloqueio(b.id);
      avisar("Bloqueio removido.");
      recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível remover o bloqueio.");
    }
  };

  const dias = useMemo(() => {
    if (visao === "dia") return [ancora];
    const inicio = inicioDaSemana(ancora);
    return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
  }, [visao, ancora]);

  const total = agendamentos.filter((a) => STATUS_ATIVOS.includes(a.status)).length;
  const aReagendar = agendamentos.filter((a) => a.status === "remarcar").length;
  const ehHoje = ancora === hojeSP();
  const temItemNoDia =
    bloqueios.length > 0 ||
    agendamentos.some(
      (a) => dataSP(a.inicio) === ancora && (mostrarCancelados || a.status !== "cancelado"),
    );

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-[34px] text-painel-title">Agenda</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBloqueando(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-painel-border bg-white px-4 py-2 text-[13px] font-medium text-painel-chip-text hover:border-painel-primary/40 transition-colors"
          >
            <Lock className="h-3.5 w-3.5" />
            Bloquear
          </button>
          <button
            type="button"
            onClick={() => setNovo(true)}
            disabled={servicos.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-painel-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-painel-primary/90 transition-colors disabled:opacity-40"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            Agendar
          </button>
        </div>
      </div>
      <p className="mb-6 text-sm text-painel-muted">
        {carregando
          ? "Carregando..."
          : `${total} ${total === 1 ? "atendimento" : "atendimentos"} no período`}
        {aReagendar > 0 && (
          <span className="ml-2 rounded-full bg-painel-gold-soft/60 px-2.5 py-0.5 text-[11px] font-semibold text-painel-gold">
            {aReagendar} precisa{aReagendar > 1 ? "m" : ""} reagendar
          </span>
        )}
      </p>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-painel-border bg-white p-1">
          {VISOES.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVisao(v.id)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
                visao === v.id
                  ? "bg-painel-primary text-white"
                  : "text-painel-chip-text hover:text-painel-title"
              }`}
            >
              {v.rotulo}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => mover(-1)}
            title="Anterior"
            className="rounded-full border border-painel-border bg-white p-2 text-painel-chip-text hover:border-painel-primary/40 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setAncora(hojeSP())}
            disabled={ehHoje && visao === "dia"}
            className="rounded-full border border-painel-border bg-white px-3.5 py-1.5 text-[13px] font-medium text-painel-chip-text hover:border-painel-primary/40 transition-colors disabled:opacity-40"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => mover(1)}
            title="Próximo"
            className="rounded-full border border-painel-border bg-white p-2 text-painel-chip-text hover:border-painel-primary/40 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-[26px] text-painel-title first-letter:uppercase">
          {rotuloPeriodo(visao, ancora)}
        </h3>
        <label className="flex items-center gap-2 text-[12.5px] text-painel-muted">
          <input
            type="checkbox"
            checked={mostrarCancelados}
            onChange={(e) => setMostrarCancelados(e.target.checked)}
            className="h-3.5 w-3.5 accent-painel-primary"
          />
          Mostrar cancelados
        </label>
      </div>

      {aviso && (
        <div className="mb-4 rounded-xl border border-painel-green/30 bg-painel-green/10 px-4 py-3 text-sm text-painel-green">
          {aviso}
        </div>
      )}
      {erro && (
        <div className="mb-4 rounded-xl border border-painel-alert-border bg-painel-alert-bg px-4 py-3 text-sm text-painel-alert-text">
          {erro}
        </div>
      )}

      {carregando && agendamentos.length === 0 && bloqueios.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-painel-muted" />
        </div>
      ) : visao === "mes" ? (
        <VisaoMes
          mes={ancora}
          agendamentos={agendamentos}
          bloqueios={bloqueios}
          onEscolherDia={escolherDia}
        />
      ) : (
        <>
          <ListaDias
            dias={dias}
            agendamentos={agendamentos}
            bloqueios={bloqueios}
            mostrarCancelados={mostrarCancelados}
            onAbrir={setAberto}
            onRemoverBloqueio={removerBloqueio}
            onEscolherDia={escolherDia}
          />
          {visao === "dia" && !carregando && !temItemNoDia && (
            <p className="py-12 text-center text-painel-muted">Nenhum atendimento neste dia.</p>
          )}
        </>
      )}

      {aberto && (
        <DetalheAgendamento
          ag={aberto}
          servicos={servicos}
          onFechar={() => setAberto(null)}
          onAlterado={(mensagem) => {
            setAberto(null);
            avisar(mensagem);
            recarregar();
          }}
        />
      )}
      {novo && (
        <NovoAgendamento
          diaInicial={visao === "dia" ? ancora : hojeSP()}
          servicos={servicos}
          onFechar={() => setNovo(false)}
          onCriado={() => {
            setNovo(false);
            avisar("Agendamento criado.");
            recarregar();
          }}
        />
      )}
      {bloqueando && (
        <BloquearHorario
          diaInicial={visao === "dia" ? ancora : hojeSP()}
          servicos={servicos}
          onFechar={() => setBloqueando(false)}
          onConcluido={(mensagem) => {
            setBloqueando(false);
            avisar(mensagem);
            recarregar();
          }}
        />
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, ChevronLeft, ChevronRight, Loader2, Lock, Settings2 } from "lucide-react";
import {
  diasDoMes,
  excluirBloqueio,
  hojeSP,
  inicioDaSemana,
  inicioDoMes,
  listarAgendamentos,
  listarBloqueios,
  listarFaixasHorario,
  listarServicosAgenda,
  listarTodosServicos,
  rotuloDiaLongo,
  rotuloDiaMes,
  rotuloMesAno,
  somarDias,
  somarMeses,
  STATUS_ATIVOS,
  type AgendaServico,
  type Agendamento,
  type Bloqueio,
  type FaixaHorario,
} from "@/lib/agenda";
import { GradeSemana } from "@/components/agenda/GradeSemana";
import { VisaoMes } from "@/components/agenda/VisaoMes";
import { DetalheAgendamento } from "@/components/agenda/DetalheAgendamento";
import { NovoAgendamento } from "@/components/agenda/NovoAgendamento";
import { BloquearHorario } from "@/components/agenda/BloquearHorario";
import { ServicosAgenda } from "@/components/agenda/ServicosAgenda";

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
  // Atualização automática: não pisca o "carregando" nem mexe na tela.
  const silenciosa = useRef(false);

  const [aberto, setAberto] = useState<Agendamento | null>(null);
  // Dia (e hora, se clicou num horário vazio) do novo agendamento.
  const [novo, setNovo] = useState<{ dia: string; hora?: string } | null>(null);
  const [faixas, setFaixas] = useState<FaixaHorario[]>([]);
  // Todos os serviços (inclusive desativados): dão a cor de cada atendimento.
  const [todosServicos, setTodosServicos] = useState<AgendaServico[]>([]);
  const [bloqueando, setBloqueando] = useState<"bloqueio" | "ferias" | null>(null);
  const [editandoServicos, setEditandoServicos] = useState(false);

  // No celular a semana não cabe em colunas: abre direto no dia.
  useEffect(() => {
    if (window.innerWidth < 640) setVisao("dia");
  }, []);

  const carregarServicos = useCallback(() => {
    listarServicosAgenda()
      .then(setServicos)
      .catch(() => setServicos([]));
  }, []);

  useEffect(carregarServicos, [carregarServicos]);

  // Horário de atendimento da semana (vem das "Regras gerais"): recarrega ao
  // fechar a janela de Serviços, que é onde ele muda.
  useEffect(() => {
    if (editandoServicos) return;
    listarFaixasHorario()
      .then(setFaixas)
      .catch(() => setFaixas([]));
    listarTodosServicos()
      .then(setTodosServicos)
      .catch(() => setTodosServicos([]));
  }, [editandoServicos]);

  const { de, ate } = useMemo(() => intervalo(visao, ancora), [visao, ancora]);

  useEffect(() => {
    let ativo = true;
    const quieta = silenciosa.current;
    silenciosa.current = false;
    if (!quieta) setCarregando(true);
    Promise.all([listarAgendamentos(de, ate), listarBloqueios(de, ate)])
      .then(([ags, blqs]) => {
        if (!ativo) return;
        setAgendamentos(ags);
        setBloqueios(blqs);
        // O horário aberto no detalhe acompanha o que mudou (ex.: a cliente cancelou).
        setAberto((atual) => (atual ? (ags.find((a) => a.id === atual.id) ?? atual) : atual));
        setErro(null);
      })
      .catch((e) => {
        if (!ativo || quieta) return;
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

  // A cliente pode cancelar ou remarcar pelo link a qualquer hora: mantém a agenda
  // em dia a cada 60s e ao voltar para a aba.
  useEffect(() => {
    const atualizar = () => {
      if (document.visibilityState !== "visible") return;
      silenciosa.current = true;
      setRecarga((n) => n + 1);
    };
    const timer = window.setInterval(atualizar, 60_000);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, []);

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

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-[34px] text-painel-title">Agenda</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditandoServicos(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-painel-border bg-white px-4 py-2 text-[13px] font-medium text-painel-chip-text hover:border-painel-primary/40 transition-colors"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Serviços
          </button>
          <button
            type="button"
            onClick={() => setBloqueando("bloqueio")}
            className="inline-flex items-center gap-1.5 rounded-full border border-painel-border bg-white px-4 py-2 text-[13px] font-medium text-painel-chip-text hover:border-painel-primary/40 transition-colors"
          >
            <Lock className="h-3.5 w-3.5" />
            Bloquear
          </button>
          <button
            type="button"
            onClick={() => setNovo({ dia: visao === "dia" ? ancora : hojeSP() })}
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
          servicos={todosServicos}
          onEscolherDia={escolherDia}
        />
      ) : (
        <>
          <GradeSemana
            dias={dias}
            agendamentos={agendamentos}
            bloqueios={bloqueios}
            faixas={faixas}
            servicos={todosServicos}
            mostrarCancelados={mostrarCancelados}
            onAbrir={setAberto}
            onRemoverBloqueio={removerBloqueio}
            onEscolherDia={escolherDia}
            onAgendarEm={(dia, hora) => setNovo({ dia, hora })}
          />
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
          diaInicial={novo.dia}
          horaInicial={novo.hora}
          servicos={servicos}
          onFechar={() => setNovo(null)}
          onCriado={() => {
            setNovo(null);
            avisar("Agendamento criado.");
            recarregar();
          }}
        />
      )}
      {editandoServicos && (
        <ServicosAgenda
          onFechar={() => setEditandoServicos(false)}
          onAlterado={carregarServicos}
          onFerias={() => {
            setEditandoServicos(false);
            setBloqueando("ferias");
          }}
        />
      )}
      {bloqueando && (
        <BloquearHorario
          diaInicial={visao === "dia" ? ancora : hojeSP()}
          servicos={servicos}
          ferias={bloqueando === "ferias"}
          onFechar={() => setBloqueando(null)}
          onConcluido={(mensagem) => {
            setBloqueando(null);
            avisar(mensagem);
            recarregar();
          }}
        />
      )}
    </div>
  );
}

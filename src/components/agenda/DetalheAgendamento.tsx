import { useEffect, useState } from "react";
import {
  Bell,
  CalendarClock,
  Check,
  Loader2,
  MessageCircle,
  Pencil,
  Send,
  UserRound,
  X,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  cancelarAgendamento,
  dataSP,
  horaSP,
  marcarStatus,
  rotuloDiaLongo,
  rotuloHorario,
  STATUS_ATIVOS,
  type AgendaServico,
  type Agendamento,
} from "@/lib/agenda";
import { linkWhatsappContato, linkWhatsappFicha, linkWhatsappLembrete } from "@/lib/whatsapp";
import { tipoFichaDoServico } from "@/lib/agenda-ficha";
import { listarFichasDoCliente } from "@/lib/painel";
import { getFicha, nomeCurto } from "@/data/anamnese";
import { PAINEL_URL } from "@/data/services";
import { mascaraTelefone } from "@/lib/mascaras";
import { PainelModal } from "@/components/PainelModal";
import { EtiquetaCadastro, EtiquetaStatus } from "./AgendamentoCard";
import { EditarPainel } from "./EditarPainel";
import { ReagendarPainel } from "./ReagendarPainel";
import { btnPerigo, btnSecundario } from "./estilos";

export function DetalheAgendamento({
  ag,
  servicos,
  pacote,
  onFechar,
  onAlterado,
}: {
  ag: Agendamento;
  servicos: AgendaServico[];
  // "4/10" se a cliente está em pacote nessa área.
  pacote?: string;
  onFechar: () => void;
  onAlterado: (mensagem: string) => void;
}) {
  const [modo, setModo] = useState<"ver" | "reagendar" | "editar">("ver");
  const [trabalhando, setTrabalhando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ativo = STATUS_ATIVOS.includes(ag.status);

  // Ficha certa para o serviço marcado. Se a cliente já é cadastrada e já tem
  // essa ficha (ou o cadastro, no caso da consulta), não precisa mandar de novo.
  const fichaTipo =
    servicos.find((s) => s.id === ag.servico_id)?.ficha ?? tipoFichaDoServico(ag.servico_nome);
  const [jaTemFicha, setJaTemFicha] = useState<boolean | null>(ag.cliente_id ? null : false);
  useEffect(() => {
    if (!ag.cliente_id) {
      setJaTemFicha(false);
      return;
    }
    let vivo = true;
    listarFichasDoCliente(ag.cliente_id)
      .then((fichas) => {
        if (vivo)
          setJaTemFicha(fichaTipo === "cadastro" || fichas.some((f) => f.tipo === fichaTipo));
      })
      .catch(() => vivo && setJaTemFicha(false));
    return () => {
      vivo = false;
    };
  }, [ag.cliente_id, fichaTipo]);

  const executar = async (acao: () => Promise<void>, mensagem: string) => {
    setTrabalhando(true);
    setErro(null);
    try {
      await acao();
      onAlterado(mensagem);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir a ação.");
      setTrabalhando(false);
    }
  };

  const cancelar = () => {
    if (
      !window.confirm(
        `Cancelar o horário de ${ag.nome} em ${rotuloDiaLongo(dataSP(ag.inicio))}, ${rotuloHorario(ag.inicio, ag.fim)}? O horário volta a ficar livre.`,
      )
    )
      return;
    void executar(() => cancelarAgendamento(ag.id), "Agendamento cancelado.");
  };

  return (
    <PainelModal onFechar={onFechar} maxWidth="max-w-md">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="min-w-0">
          <h3 className="font-medium text-white truncate">{ag.nome}</h3>
          <p className="text-sm text-white/60">
            {ag.servico_nome}
            {ag.areas.length > 0 ? ` · ${ag.areas.join(", ")}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onFechar}
          title="Fechar"
          className="text-white/50 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {modo === "editar" ? (
        <EditarPainel
          ag={ag}
          servicos={servicos}
          onConcluido={() => onAlterado("Agendamento atualizado.")}
          onVoltar={() => setModo("ver")}
        />
      ) : modo === "reagendar" ? (
        <ReagendarPainel
          ag={ag}
          servicos={servicos}
          onConcluido={() => onAlterado("Agendamento reagendado.")}
          onVoltar={() => setModo("ver")}
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-sm font-medium text-white first-letter:uppercase">
              {rotuloDiaLongo(dataSP(ag.inicio))}
            </p>
            <p className="text-sm text-painel-lilac-soft">{rotuloHorario(ag.inicio, ag.fim)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <EtiquetaStatus ag={ag} />
              <EtiquetaCadastro ag={ag} />
            </div>
          </div>

          <dl className="space-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-white/50">WhatsApp</dt>
              <dd className="text-white">{mascaraTelefone(ag.telefone)}</dd>
            </div>
            {ag.email && (
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-white/50">E-mail</dt>
                <dd className="break-all text-white">{ag.email}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-white/50">Origem</dt>
              <dd className="text-white">
                {ag.origem === "online" ? "Agendou pelo site" : "Marcado no painel"}
              </dd>
            </div>
            {pacote && (
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-white/50">Pacote</dt>
                <dd className="font-medium text-white">{pacote}</dd>
              </div>
            )}
            {ag.observacao && (
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-white/50">Obs.</dt>
                <dd className="text-white">{ag.observacao}</dd>
              </div>
            )}
          </dl>

          {erro && <p className="text-sm text-rose-300">{erro}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={linkWhatsappContato(ag.telefone)}
              target="whatsapp"
              rel="noreferrer"
              className={btnSecundario}
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
            {ativo && (
              <a
                href={linkWhatsappLembrete({
                  origin: PAINEL_URL,
                  token: ag.token,
                  telefone: ag.telefone,
                  nomeCliente: ag.nome,
                  servico: ag.servico_nome,
                  dia: rotuloDiaLongo(dataSP(ag.inicio)),
                  hora: horaSP(ag.inicio),
                })}
                target="whatsapp"
                rel="noreferrer"
                className={btnSecundario}
              >
                <Bell className="h-4 w-4" />
                Lembrete
              </a>
            )}
            {jaTemFicha === false && (
              <a
                href={linkWhatsappFicha({
                  origin: PAINEL_URL,
                  tipo: fichaTipo,
                  nomeFicha: getFicha(fichaTipo)?.nome ?? fichaTipo,
                  nomeCliente: ag.nome,
                  telefone: ag.telefone,
                })}
                target="whatsapp"
                rel="noreferrer"
                className={btnSecundario}
              >
                <Send className="h-4 w-4" />
                Enviar ficha{" "}
                {fichaTipo === "cadastro" ? "de cadastro" : nomeCurto(fichaTipo).toLowerCase()}
              </a>
            )}
            {jaTemFicha === true && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-painel-green/40 px-4 py-2 text-sm font-medium text-emerald-300">
                <Check className="h-4 w-4" />
                {fichaTipo === "cadastro"
                  ? "Cadastro já feito"
                  : `Ficha ${nomeCurto(fichaTipo).toLowerCase()} já preenchida`}
              </span>
            )}
            {ag.cliente_id && (
              <Link
                to="/painel/cliente/$id"
                params={{ id: ag.cliente_id }}
                className={btnSecundario}
              >
                <UserRound className="h-4 w-4" />
                Ver cadastro
              </Link>
            )}
          </div>

          {ativo && (
            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                disabled={trabalhando}
                onClick={() => setModo("editar")}
                className={btnSecundario}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>
              <button
                type="button"
                disabled={trabalhando}
                onClick={() => setModo("reagendar")}
                className={btnSecundario}
              >
                <CalendarClock className="h-4 w-4" />
                Reagendar
              </button>
              <button
                type="button"
                disabled={trabalhando}
                onClick={() =>
                  executar(() => marcarStatus(ag.id, "concluido"), "Marcada como atendida.")
                }
                className={btnSecundario}
              >
                {trabalhando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Atendida
              </button>
              <button
                type="button"
                disabled={trabalhando}
                onClick={() => executar(() => marcarStatus(ag.id, "faltou"), "Marcada como falta.")}
                className={btnSecundario}
              >
                Faltou
              </button>
              <button type="button" disabled={trabalhando} onClick={cancelar} className={btnPerigo}>
                Cancelar horário
              </button>
            </div>
          )}

          {(ag.status === "concluido" || ag.status === "faltou") && (
            <div className="border-t border-white/10 pt-4">
              <button
                type="button"
                disabled={trabalhando}
                onClick={() =>
                  executar(() => marcarStatus(ag.id, "agendado"), "Voltou para agendado.")
                }
                className={btnSecundario}
              >
                Desfazer
              </button>
            </div>
          )}
        </div>
      )}
    </PainelModal>
  );
}

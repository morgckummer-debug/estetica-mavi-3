import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CheckCircle,
  Loader2,
  MapPin,
  MessageCircle,
  XCircle,
} from "lucide-react";
import {
  cancelarAgendamentoPublico,
  confirmarPresenca,
  obterAgendamentoPublico,
  remarcarAgendamentoPublico,
  type AgendamentoPublico,
  type ErroAgenda,
} from "@/lib/api/agenda.functions";
import { dataSP, horaSP, rotuloDiaLongo } from "@/lib/agenda-datas";
import { ADDRESS, ADDRESS_MAPS_URL, SITE_URL, WHATSAPP_URL } from "@/data/services";
import { EscolherHorario } from "@/components/agenda/publico/EscolherHorario";
import { linkGoogleAgenda } from "@/components/agenda/publico/google-agenda";

export const Route = createFileRoute("/agendamento/$token")({
  head: () => ({
    meta: [
      { title: "Seu agendamento | MAVI Centro de Estética" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/agendamento` }],
  }),
  component: PaginaAgendamento,
});

type Carga = "carregando" | "invalido" | "erro" | "pronta";
type Modo = "ver" | "remarcar" | "cancelar";

const btnPrincipal =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40";
const btnSecundario =
  "inline-flex w-full items-center justify-center gap-2 rounded-full border border-primary/30 bg-card px-7 py-3.5 text-base font-medium text-primary transition-colors hover:bg-lavender-soft disabled:opacity-40";

const MENSAGEM_ERRO: Partial<Record<ErroAgenda, string>> = {
  prazo:
    "Faltam menos de 24 horas para o seu horário, então a alteração precisa ser combinada com a Marina pelo WhatsApp.",
  horario_indisponivel: "Esse horário acabou de ser ocupado. Escolha outro, por favor.",
  indisponivel: "Este horário não pode mais ser alterado.",
  nao_encontrado: "Não encontramos este agendamento.",
};

function PaginaAgendamento() {
  const { token } = useParams({ from: "/agendamento/$token" });
  const [carga, setCarga] = useState<Carga>("carregando");
  const [ag, setAg] = useState<AgendamentoPublico | null>(null);
  const [modo, setModo] = useState<Modo>("ver");
  const [novoInicio, setNovoInicio] = useState<string | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const dados = await obterAgendamentoPublico({ data: { token } });
      if (!dados) {
        setCarga("invalido");
        return;
      }
      setAg(dados);
      setCarga("pronta");
    } catch {
      setCarga("erro");
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Quando a clínica pediu para remarcar, a cliente já cai na escolha do horário.
  useEffect(() => {
    if (ag?.status === "remarcar" && ag.pode_alterar) setModo("remarcar");
  }, [ag?.status, ag?.pode_alterar]);

  const falhou = (e: ErroAgenda) =>
    setErro(MENSAGEM_ERRO[e] ?? "Não foi possível concluir agora. Tente novamente em instantes.");

  const confirmar = async () => {
    setTrabalhando(true);
    setErro(null);
    try {
      await confirmarPresenca({ data: { token } });
      setAviso("Presença confirmada. Esperamos você! 💜");
      await carregar();
    } catch {
      setErro("Não foi possível confirmar agora. Tente novamente em instantes.");
    } finally {
      setTrabalhando(false);
    }
  };

  const cancelar = async () => {
    setTrabalhando(true);
    setErro(null);
    try {
      const r = await cancelarAgendamentoPublico({ data: { token } });
      if (r.ok) {
        setModo("ver");
        setAviso(null);
        await carregar();
      } else {
        falhou(r.erro);
        await carregar();
      }
    } catch {
      setErro("Não foi possível cancelar agora. Tente novamente em instantes.");
    } finally {
      setTrabalhando(false);
    }
  };

  const remarcar = async () => {
    if (!novoInicio) return;
    setTrabalhando(true);
    setErro(null);
    try {
      const r = await remarcarAgendamentoPublico({ data: { token, novoInicio } });
      if (r.ok) {
        setModo("ver");
        setNovoInicio(null);
        setAviso("Horário alterado! Confira os novos dados abaixo. ✨");
        await carregar();
      } else {
        falhou(r.erro);
        if (r.erro === "horario_indisponivel") setNovoInicio(null);
      }
    } catch {
      setErro("Não foi possível reagendar agora. Tente novamente em instantes.");
    } finally {
      setTrabalhando(false);
    }
  };

  const ativo = ag && (ag.status === "agendado" || ag.status === "remarcar");

  return (
    <section className="flex min-h-[70vh] justify-center px-6 py-12 lg:py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        {carga === "carregando" && (
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
        )}

        {carga === "invalido" && (
          <div className="text-center">
            <XCircle className="mx-auto mb-5 h-14 w-14 text-muted-foreground" strokeWidth={1.5} />
            <h1 className="font-display text-3xl text-primary">Link não encontrado</h1>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Este link de agendamento não é válido. Fale com a Marina se precisar. 🌸
            </p>
          </div>
        )}

        {carga === "erro" && (
          <div className="text-center">
            <XCircle className="mx-auto mb-5 h-14 w-14 text-destructive" strokeWidth={1.5} />
            <h1 className="font-display text-3xl text-primary">Algo deu errado</h1>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Não conseguimos carregar seu agendamento agora. Tente abrir o link de novo em
              instantes.
            </p>
          </div>
        )}

        {carga === "pronta" && ag && (
          <>
            <div className="text-center">
              <h1 className="font-display text-4xl leading-tight text-primary">
                Oi, {ag.primeiro_nome}! 🌸
              </h1>
              {ag.status === "cancelado" ? (
                <p className="mt-3 text-muted-foreground">Este horário foi cancelado.</p>
              ) : (
                <p className="mt-3 text-muted-foreground">Este é o seu horário na MAVI.</p>
              )}
            </div>

            {aviso && (
              <p className="mt-5 rounded-xl border border-primary/30 bg-lavender-soft/60 px-4 py-3 text-center text-sm text-primary">
                {aviso}
              </p>
            )}

            <div
              className={`mt-6 rounded-2xl border border-border bg-card p-5 ${
                ag.status === "cancelado" ? "opacity-60" : ""
              }`}
            >
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {ag.servico_nome}
              </p>
              <p
                className={`mt-2 font-display text-2xl first-letter:uppercase text-primary ${
                  ag.status === "cancelado" ? "line-through" : ""
                }`}
              >
                {rotuloDiaLongo(dataSP(ag.inicio))}
              </p>
              <p className="text-lg text-foreground">{horaSP(ag.inicio)}</p>

              {ag.status === "agendado" && ag.presenca_confirmada_em && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-lavender-soft px-3 py-1 text-sm font-medium text-primary">
                  <CheckCircle className="h-4 w-4" />
                  Presença confirmada
                </p>
              )}

              {ativo && (
                <a
                  href={ADDRESS_MAPS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-start gap-2 text-sm text-muted-foreground hover:text-primary"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="whitespace-pre-line">{ADDRESS}</span>
                </a>
              )}
            </div>

            {erro && (
              <p className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {erro}
              </p>
            )}

            {/* A clínica precisou mudar o horário */}
            {ag.status === "remarcar" && modo === "remarcar" && (
              <p className="mt-5 rounded-xl border border-primary/30 bg-lavender-soft/60 px-4 py-3 text-sm leading-relaxed text-foreground">
                Precisamos ajustar o seu horário. Escolha abaixo um novo dia e hora que fiquem bons
                para você. Pedimos desculpas pelo transtorno! 💜
              </p>
            )}

            {/* Ações */}
            {ativo && modo === "ver" && (
              <div className="mt-6 space-y-3">
                {ag.pode_alterar && ag.status === "agendado" && !ag.presenca_confirmada_em && (
                  <button
                    type="button"
                    onClick={confirmar}
                    disabled={trabalhando}
                    className={btnPrincipal}
                  >
                    {trabalhando ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <CheckCircle className="h-5 w-5" />
                    )}
                    Vou comparecer
                  </button>
                )}
                {ag.fora_do_prazo && !ag.presenca_confirmada_em && (
                  <button
                    type="button"
                    onClick={confirmar}
                    disabled={trabalhando}
                    className={btnPrincipal}
                  >
                    {trabalhando ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <CheckCircle className="h-5 w-5" />
                    )}
                    Vou comparecer
                  </button>
                )}
                {ag.pode_alterar && (
                  <>
                    <button
                      type="button"
                      onClick={() => setModo("remarcar")}
                      className={btnSecundario}
                    >
                      <CalendarClock className="h-5 w-5" />
                      Reagendar
                    </button>
                    <button
                      type="button"
                      onClick={() => setModo("cancelar")}
                      className="w-full py-2 text-sm text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
                    >
                      Cancelar horário
                    </button>
                  </>
                )}
                {ag.fora_do_prazo && (
                  <div className="rounded-2xl border border-border bg-muted/60 p-4 text-sm leading-relaxed text-muted-foreground">
                    <p>
                      Faltam menos de 24 horas para o seu horário. Para cancelar ou reagendar, fale
                      com a Marina pelo WhatsApp.
                    </p>
                    <a
                      href={WHATSAPP_URL}
                      target="whatsapp"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 font-medium text-primary hover:underline"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Chamar no WhatsApp
                    </a>
                  </div>
                )}
                {ag.status === "agendado" && (
                  <a
                    href={linkGoogleAgenda({
                      servico: ag.servico_nome,
                      inicio: ag.inicio,
                      fim: ag.fim,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 pt-1 text-sm text-muted-foreground hover:text-primary"
                  >
                    <CalendarPlus className="h-4 w-4" />
                    Adicionar ao Google Agenda
                  </a>
                )}
              </div>
            )}

            {ativo && modo === "cancelar" && (
              <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-center">
                <p className="text-foreground">Tem certeza que deseja cancelar este horário?</p>
                <div className="mt-4 space-y-2.5">
                  <button
                    type="button"
                    onClick={cancelar}
                    disabled={trabalhando}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-destructive px-7 py-3 text-base font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-40"
                  >
                    {trabalhando && <Loader2 className="h-5 w-5 animate-spin" />}
                    Sim, cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setModo("ver")}
                    disabled={trabalhando}
                    className="w-full py-2 text-sm text-muted-foreground hover:text-primary"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}

            {ativo && modo === "remarcar" && ag.pode_alterar && (
              <div className="mt-6">
                <h2 className="mb-4 font-display text-2xl text-primary">Escolha o novo horário</h2>
                <EscolherHorario
                  servicoId={ag.servico_id}
                  valor={novoInicio}
                  onEscolher={setNovoInicio}
                />
                <div className="mt-6 space-y-2.5">
                  <button
                    type="button"
                    onClick={remarcar}
                    disabled={!novoInicio || trabalhando}
                    className={btnPrincipal}
                  >
                    {trabalhando ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <CalendarCheck className="h-5 w-5" />
                    )}
                    Confirmar novo horário
                  </button>
                  {ag.status !== "remarcar" && (
                    <button
                      type="button"
                      onClick={() => {
                        setModo("ver");
                        setNovoInicio(null);
                        setErro(null);
                      }}
                      disabled={trabalhando}
                      className="w-full py-2 text-sm text-muted-foreground hover:text-primary"
                    >
                      Voltar
                    </button>
                  )}
                </div>
              </div>
            )}

            {ag.status === "cancelado" && (
              <div className="mt-6 text-center">
                <a href="/agendar" className={btnSecundario}>
                  Agendar um novo horário
                </a>
              </div>
            )}

            {(ag.status === "concluido" || ag.status === "faltou") && (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Este atendimento já foi registrado. Obrigada! 💜
              </p>
            )}

            {ag.status === "agendado" && !ag.pode_alterar && !ag.fora_do_prazo && (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Este horário já passou.
              </p>
            )}
          </>
        )}
      </motion.div>
    </section>
  );
}

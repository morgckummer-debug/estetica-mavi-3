import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarPlus,
  Check,
  Copy,
  Loader2,
  MapPin,
  MessageCircle,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  agendar,
  listarServicosPublicos,
  type ErroAgenda,
  type ResultadoAgendar,
  type ServicoPublico,
} from "@/lib/api/agenda.functions";
import { dataSP, horaSP, rotuloDiaLongo } from "@/lib/agenda-datas";
import { mascaraTelefone } from "@/lib/mascaras";
import { ADDRESS, ADDRESS_MAPS_URL, WHATSAPP_URL } from "@/data/services";
import { EscolherHorario } from "./EscolherHorario";
import { linkGoogleAgenda } from "./google-agenda";

type Passo = "inicio" | "horario" | "dados" | "pronto";

const campo =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30";
const rotulo = "block text-sm font-medium text-foreground mb-1.5";
const btnPrincipal =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40";

const MENSAGEM_ERRO: Partial<Record<ErroAgenda, string>> = {
  dados_invalidos: "Confira seu nome, WhatsApp (com DDD) e e-mail.",
  limite_agendamentos:
    "Você já tem horários marcados. Para marcar mais um, fale com a gente pelo WhatsApp.",
  servico_invalido: "Esse serviço não está disponível agora. Escolha outro.",
};

function Voltar({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
    >
      <ArrowLeft className="h-4 w-4" />
      Voltar
    </button>
  );
}

export function PaginaAgendar() {
  const [passo, setPasso] = useState<Passo>("inicio");
  const [servicos, setServicos] = useState<ServicoPublico[] | null>(null);
  const [falhaCarga, setFalhaCarga] = useState(false);
  const [jaSouCliente, setJaSouCliente] = useState(false);
  const [servico, setServico] = useState<ServicoPublico | null>(null);
  const [inicio, setInicio] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [isca, setIsca] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [precisaConsulta, setPrecisaConsulta] = useState(false);
  const [resultado, setResultado] = useState<Extract<ResultadoAgendar, { ok: true }> | null>(null);

  useEffect(() => {
    listarServicosPublicos()
      .then(setServicos)
      .catch(() => setFalhaCarga(true));
  }, []);

  const consulta = servicos?.find((s) => s.tipo === "consulta") ?? null;
  const procedimentos = servicos?.filter((s) => s.tipo === "procedimento") ?? [];

  const escolherServico = (s: ServicoPublico) => {
    setServico(s);
    setInicio(null);
    setErro(null);
    setPrecisaConsulta(false);
    setPasso("horario");
  };

  // Sem e-mail, o link do agendamento é a única forma de a cliente cancelar ou
  // reagendar sozinha: ela precisa guardá-lo.
  const linkDoAgendamento = (token: string) => `${window.location.origin}/agendamento/${token}`;

  const copiarLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(linkDoAgendamento(token));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* sem permissão para copiar: o botão do WhatsApp continua disponível */
    }
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!servico || !inicio) return;
    setErro(null);
    setPrecisaConsulta(false);
    setEnviando(true);
    try {
      const r = await agendar({
        data: {
          servicoId: servico.id,
          inicio,
          nome: nome.trim(),
          telefone,
          email: email.trim(),
          website: isca,
        },
      });
      if (r.ok) {
        setResultado(r);
        setPasso("pronto");
      } else if (r.erro === "horario_indisponivel") {
        setErro("Esse horário acabou de ser ocupado. Escolha outro, por favor.");
        setInicio(null);
        setPasso("horario");
      } else if (r.erro === "consulta_primeiro") {
        setPrecisaConsulta(true);
      } else {
        setErro(MENSAGEM_ERRO[r.erro] ?? "Não foi possível agendar agora. Tente novamente.");
      }
    } catch {
      setErro("Não foi possível agendar agora. Tente novamente em instantes.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="px-6 py-12 lg:py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mx-auto w-full max-w-xl"
      >
        {/* ---------- 1. Tipo de atendimento ---------- */}
        {passo === "inicio" && (
          <>
            <div className="mb-8 text-center">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-lavender-soft p-4">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
              </div>
              <h1 className="font-display text-4xl leading-tight text-primary">
                Agende seu horário
              </h1>
              <p className="mt-3 text-muted-foreground">
                Escolha o dia e a hora que ficam melhores para você. A confirmação é na hora.
              </p>
            </div>

            {falhaCarga && (
              <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Não foi possível carregar os serviços agora. Tente de novo em instantes ou fale com
                a gente pelo WhatsApp.
              </p>
            )}
            {!servicos && !falhaCarga && (
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-muted-foreground" />
            )}

            {servicos && !jaSouCliente && (
              <div className="space-y-3">
                {consulta && (
                  <button
                    type="button"
                    onClick={() => escolherServico(consulta)}
                    className="w-full rounded-2xl border border-primary/30 bg-card p-5 text-left transition-shadow hover:shadow-lg"
                  >
                    <span className="inline-block rounded-full bg-lavender-soft px-3 py-1 text-xs font-medium text-primary">
                      Primeira vez na MAVI
                    </span>
                    <p className="mt-2 font-display text-2xl text-primary">
                      Consulta de avaliação gratuita
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Uma conversa de {consulta.duracao_min} minutos para entender o que você
                      precisa e indicar o melhor cuidado.
                    </p>
                  </button>
                )}
                {procedimentos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setJaSouCliente(true)}
                    className="w-full rounded-2xl border border-border bg-card p-5 text-left transition-shadow hover:shadow-lg"
                  >
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                      <UserRound className="h-3.5 w-3.5" />
                      Já sou cliente
                    </span>
                    <p className="mt-2 font-display text-2xl text-primary">
                      Marcar um procedimento
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Para quem já fez a avaliação e quer agendar a próxima sessão.
                    </p>
                  </button>
                )}
              </div>
            )}

            {servicos && jaSouCliente && (
              <>
                <Voltar onClick={() => setJaSouCliente(false)} />
                <p className="mb-3 text-sm text-muted-foreground">Qual procedimento?</p>
                <div className="space-y-2.5">
                  {procedimentos.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => escolherServico(s)}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-left transition-colors hover:border-primary/50"
                    >
                      <span className="font-medium text-foreground">{s.nome}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {s.duracao_min} min
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Prefere falar com a gente?{" "}
              <a
                href={WHATSAPP_URL}
                target="whatsapp"
                rel="noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Chamar no WhatsApp
              </a>
            </p>
          </>
        )}

        {/* ---------- 2. Data e horário ---------- */}
        {passo === "horario" && servico && (
          <>
            <Voltar
              onClick={() => {
                setErro(null);
                setPasso("inicio");
              }}
            />
            <h1 className="font-display text-3xl leading-tight text-primary">Escolha o horário</h1>
            <p className="mb-6 mt-2 text-muted-foreground">
              {servico.nome} · {servico.duracao_min} min
            </p>
            {erro && (
              <p className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {erro}
              </p>
            )}
            <EscolherHorario servicoId={servico.id} valor={inicio} onEscolher={setInicio} />
            <button
              type="button"
              disabled={!inicio}
              onClick={() => {
                setErro(null);
                setPasso("dados");
              }}
              className={`${btnPrincipal} mt-8`}
            >
              Continuar
            </button>
          </>
        )}

        {/* ---------- 3. Dados ---------- */}
        {passo === "dados" && servico && inicio && (
          <>
            <Voltar onClick={() => setPasso("horario")} />
            <h1 className="font-display text-3xl leading-tight text-primary">Quase lá!</h1>
            <div className="mb-6 mt-4 rounded-2xl border border-border bg-card p-4">
              <p className="font-medium text-foreground">{servico.nome}</p>
              <p className="text-sm first-letter:uppercase text-muted-foreground">
                {rotuloDiaLongo(dataSP(inicio))} · {horaSP(inicio)}
              </p>
            </div>

            <form onSubmit={enviar} className="space-y-4">
              <div>
                <label className={rotulo} htmlFor="ag-nome">
                  Seu nome completo
                </label>
                <input
                  id="ag-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                  className={campo}
                />
              </div>
              <div>
                <label className={rotulo} htmlFor="ag-tel">
                  WhatsApp
                </label>
                <input
                  id="ag-tel"
                  value={telefone}
                  onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(31) 90000-0000"
                  className={campo}
                />
              </div>
              <div>
                <label className={rotulo} htmlFor="ag-email">
                  E-mail <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <input
                  id="ag-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={200}
                  autoComplete="email"
                  className={campo}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Se quiser, enviamos a confirmação para o seu e-mail, com o botão para cancelar ou
                  reagendar.
                </p>
              </div>

              {/* Campo-isca: invisível para pessoas, robôs costumam preencher. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="ag-site">Site</label>
                <input
                  id="ag-site"
                  tabIndex={-1}
                  autoComplete="off"
                  value={isca}
                  onChange={(e) => setIsca(e.target.value)}
                />
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                Ao confirmar, você concorda com o uso do seu nome e WhatsApp para agendar e avisar
                sobre o seu horário, conforme a{" "}
                <Link
                  to="/politica-de-privacidade"
                  target="_blank"
                  className="font-medium text-primary underline"
                >
                  política de privacidade
                </Link>
                .
              </p>

              {precisaConsulta && consulta && (
                <div className="rounded-2xl border border-primary/30 bg-lavender-soft/60 p-4 text-sm leading-relaxed text-foreground">
                  <p>
                    Não encontramos seu cadastro. Para marcar procedimentos, o primeiro passo é a{" "}
                    <strong>consulta de avaliação gratuita</strong> — assim a Marina conhece você e
                    indica o melhor cuidado.
                  </p>
                  <button
                    type="button"
                    onClick={() => escolherServico(consulta)}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Agendar consulta de avaliação
                  </button>
                </div>
              )}

              {erro && (
                <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {erro}
                </p>
              )}

              <button type="submit" disabled={enviando} className={btnPrincipal}>
                {enviando ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CalendarCheck className="h-5 w-5" />
                )}
                Confirmar agendamento
              </button>
            </form>
          </>
        )}

        {/* ---------- 4. Confirmação ---------- */}
        {passo === "pronto" && resultado && (
          <div className="text-center">
            <div className="mb-5 flex justify-center">
              <CalendarCheck className="h-16 w-16 text-primary" strokeWidth={1.5} />
            </div>
            <h1 className="font-display text-4xl leading-tight text-primary">
              Você está agendada! ✨
            </h1>
            <p className="mt-3 text-muted-foreground">
              Obrigada, {resultado.primeiro_nome}. Seu horário está reservado.
            </p>
            {resultado.email_enviado && (
              <p className="mt-2 text-sm text-muted-foreground">
                Enviamos a confirmação para o seu e-mail. 💌
              </p>
            )}

            <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-left">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Seu horário</p>
              <p className="mt-2 font-display text-2xl first-letter:uppercase text-primary">
                {rotuloDiaLongo(dataSP(resultado.inicio))}
              </p>
              <p className="text-lg text-foreground">
                {horaSP(resultado.inicio)} · {resultado.servico}
              </p>
              <a
                href={ADDRESS_MAPS_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex items-start gap-2 text-sm text-muted-foreground hover:text-primary"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="whitespace-pre-line">{ADDRESS}</span>
              </a>
            </div>

            <div className="mt-6 space-y-3">
              {resultado.token && (
                <a
                  href={linkGoogleAgenda({
                    servico: resultado.servico,
                    inicio: resultado.inicio,
                    fim: resultado.fim,
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-primary/30 bg-card px-7 py-3.5 text-base font-medium text-primary transition-colors hover:bg-lavender-soft"
                >
                  <CalendarPlus className="h-5 w-5" />
                  Adicionar ao Google Agenda
                </a>
              )}
              {resultado.token && (
                <Link
                  to="/agendamento/$token"
                  params={{ token: resultado.token }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Precisa cancelar ou reagendar? Clique aqui
                </Link>
              )}
            </div>
            {resultado.token && (
              <div className="mt-6 rounded-2xl border border-primary/30 bg-lavender-soft/50 p-5 text-left">
                <p className="font-medium text-primary">Guarde o link do seu agendamento</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  É por ele que você cancela ou muda o horário quando precisar. Salve agora, para
                  não perder:
                </p>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => copiarLink(resultado.token as string)}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/30 bg-card px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-lavender-soft"
                  >
                    {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiado ? "Link copiado!" : "Copiar link"}
                  </button>
                  <a
                    href={`https://wa.me/55${telefone.replace(/\D/g, "")}?text=${encodeURIComponent(
                      `Meu agendamento na MAVI: ${linkDoAgendamento(resultado.token)}`,
                    )}`}
                    target="whatsapp"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/30 bg-card px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-lavender-soft"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Enviar para o meu WhatsApp
                  </a>
                </div>
              </div>
            )}

            <a
              href={WHATSAPP_URL}
              target="whatsapp"
              rel="noreferrer"
              className="mt-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
            >
              <MessageCircle className="h-4 w-4" />
              Dúvidas? Fale com a gente no WhatsApp
            </a>
          </div>
        )}
      </motion.div>
    </section>
  );
}

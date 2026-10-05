import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, Link2, Loader2, RefreshCw, Send } from "lucide-react";
import {
  dataSP,
  hojeSP,
  horaSP,
  listarAgendamentos,
  marcarLembreteEnviado,
  rotuloDiaLongo,
  rotuloDiaMes,
  somarDias,
  type Agendamento,
} from "@/lib/agenda";
import { linkWhatsappLembrete } from "@/lib/whatsapp";
import { PAINEL_URL } from "@/data/services";
import { PainelModal } from "@/components/PainelModal";

export const Route = createFileRoute("/painel/lembretes")({
  component: PaginaLembretes,
});

// A cliente confirma pelo link a qualquer hora: a lista se atualiza sozinha
// para o "Confirmado" aparecer sem ninguém apertar nada.
const ATUALIZAR_A_CADA_MS = 60_000;

const btnNav =
  "rounded-full border border-painel-border bg-white px-3.5 py-1.5 text-[13px] font-medium text-painel-chip-text hover:border-painel-primary/40 transition-colors disabled:opacity-40";

// "hoje às 14:32" / "ontem às 14:32" / "3 out às 14:32".
function quandoEnviado(iso: string): string {
  const dia = dataSP(iso);
  const hoje = hojeSP();
  const hora = horaSP(iso);
  if (dia === hoje) return `hoje às ${hora}`;
  if (dia === somarDias(hoje, -1)) return `ontem às ${hora}`;
  return `${rotuloDiaMes(dia)} às ${hora}`;
}

function rotuloDia(dia: string): string {
  const hoje = hojeSP();
  if (dia === hoje) return "Hoje";
  if (dia === somarDias(hoje, 1)) return "Amanhã";
  return rotuloDiaLongo(dia);
}

function PaginaLembretes() {
  const [dia, setDia] = useState(() => somarDias(hojeSP(), 1));
  const [lista, setLista] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  // Clientes marcadas para o envio em sequência e a fila aberta (se houver).
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [fila, setFila] = useState<Agendamento[] | null>(null);

  useEffect(() => setSelecionadas(new Set()), [dia]);

  const carregar = useCallback(
    async (silencioso: boolean) => {
      if (!silencioso) setCarregando(true);
      try {
        const ags = await listarAgendamentos(dia, somarDias(dia, 1));
        setLista(ags.filter((a) => a.status === "agendado"));
        setErro(null);
      } catch (e) {
        // Na atualização automática, um erro passageiro não apaga a lista da tela.
        if (!silencioso) setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
      } finally {
        setCarregando(false);
      }
    },
    [dia],
  );

  useEffect(() => {
    void carregar(false);
  }, [carregar, recarga]);

  useEffect(() => {
    const atualizar = () => {
      if (document.visibilityState === "visible") void carregar(true);
    };
    const timer = window.setInterval(atualizar, ATUALIZAR_A_CADA_MS);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, [carregar]);

  const marcarEnviado = (ag: Agendamento) => {
    // A aba do WhatsApp abre pelo próprio link; aqui só registra o envio.
    const agora = new Date().toISOString();
    setLista((l) => l.map((a) => (a.id === ag.id ? { ...a, lembrete_enviado_em: agora } : a)));
    marcarLembreteEnviado(ag.id).catch(() => {
      setLista((l) =>
        l.map((a) => (a.id === ag.id ? { ...a, lembrete_enviado_em: ag.lembrete_enviado_em } : a)),
      );
      setErro(
        "Não consegui registrar que o link foi enviado. Confira se a migração 20261013120000_agenda_lembrete_enviado.sql foi rodada no Supabase.",
      );
    });
  };

  const { confirmadas, avisadas, faltam } = useMemo(
    () => ({
      confirmadas: lista.filter((a) => a.presenca_confirmada_em).length,
      avisadas: lista.filter((a) => a.lembrete_enviado_em && !a.presenca_confirmada_em).length,
      faltam: lista.filter((a) => !a.lembrete_enviado_em && !a.presenca_confirmada_em).length,
    }),
    [lista],
  );

  // Quem já confirmou não precisa de link: sai da seleção sozinha.
  const marcadas = useMemo(
    () => lista.filter((a) => selecionadas.has(a.id) && !a.presenca_confirmada_em),
    [lista, selecionadas],
  );
  const semLink = useMemo(
    () => lista.filter((a) => !a.lembrete_enviado_em && !a.presenca_confirmada_em),
    [lista],
  );
  const alternar = (id: string) =>
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(id)) novo.add(id);
      return novo;
    });

  const ehAmanha = dia === somarDias(hojeSP(), 1);

  return (
    <div>
      <h2 className="font-display text-[34px] text-painel-title">Lembretes</h2>
      <p className="mb-6 text-sm text-painel-muted">
        Envie o link de confirmação para as clientes do dia. Quando ela confirma, o “Confirmado”
        aparece aqui sozinho.
      </p>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDia((d) => somarDias(d, -1))}
            title="Dia anterior"
            className="rounded-full border border-painel-border bg-white p-2 text-painel-chip-text hover:border-painel-primary/40 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDia(somarDias(hojeSP(), 1))}
            disabled={ehAmanha}
            className={btnNav}
          >
            Amanhã
          </button>
          <button type="button" onClick={() => setDia(hojeSP())} className={btnNav}>
            Hoje
          </button>
          <button
            type="button"
            onClick={() => setDia((d) => somarDias(d, 1))}
            title="Próximo dia"
            className="rounded-full border border-painel-border bg-white p-2 text-painel-chip-text hover:border-painel-primary/40 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setRecarga((n) => n + 1)}
          disabled={carregando}
          title="Atualizar"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-painel-muted hover:bg-painel-badge-bg/40 hover:text-painel-primary transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mb-4">
        <h3 className="font-display text-[26px] text-painel-title first-letter:uppercase">
          {rotuloDia(dia)}
        </h3>
        {rotuloDia(dia) !== rotuloDiaLongo(dia) && (
          <p className="text-sm text-painel-muted first-letter:uppercase">{rotuloDiaLongo(dia)}</p>
        )}
        {!carregando && lista.length > 0 && (
          <p className="mt-1 text-[12.5px] text-painel-muted">
            {lista.length} {lista.length === 1 ? "atendimento" : "atendimentos"} ·{" "}
            <span className="text-painel-green">{confirmadas} confirmado(s)</span> · {avisadas}{" "}
            aguardando resposta · {faltam} sem link enviado
          </p>
        )}
      </div>

      {erro && (
        <div className="mb-4 rounded-xl border border-painel-alert-border bg-painel-alert-bg px-4 py-3 text-sm text-painel-alert-text">
          {erro}
        </div>
      )}

      {carregando && lista.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-painel-muted" />
        </div>
      ) : lista.length === 0 ? (
        <p className="rounded-[14px] border border-painel-border bg-white px-5 py-8 text-center text-sm text-painel-muted">
          Nenhum atendimento marcado para este dia.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
            <button
              type="button"
              disabled={semLink.length === 0}
              onClick={() => setSelecionadas(new Set(semLink.map((a) => a.id)))}
              className="font-medium text-painel-primary hover:underline disabled:opacity-40 disabled:no-underline"
            >
              Marcar quem ainda não recebeu o link ({semLink.length})
            </button>
            {marcadas.length > 0 && (
              <button
                type="button"
                onClick={() => setSelecionadas(new Set())}
                className="text-painel-muted hover:underline"
              >
                Limpar seleção
              </button>
            )}
          </div>
          <ul className="space-y-2.5 pb-24">
            {lista.map((ag) => (
              <LinhaLembrete
                key={ag.id}
                ag={ag}
                marcada={selecionadas.has(ag.id)}
                onMarcar={() => alternar(ag.id)}
                onEnviado={() => marcarEnviado(ag)}
              />
            ))}
          </ul>
        </>
      )}

      {marcadas.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-painel-border bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 sm:px-6">
            <p className="text-sm text-painel-title">
              {marcadas.length} {marcadas.length === 1 ? "cliente marcada" : "clientes marcadas"}
            </p>
            <button
              type="button"
              onClick={() => setFila(marcadas)}
              className="inline-flex items-center gap-1.5 rounded-full bg-painel-primary px-5 py-2 text-[13px] font-semibold text-white hover:bg-painel-primary/90 transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
              Enviar links
            </button>
          </div>
        </div>
      )}

      {fila && (
        <FilaEnvio
          fila={fila}
          onEnviado={marcarEnviado}
          onFechar={() => {
            setFila(null);
            setSelecionadas(new Set());
          }}
        />
      )}
    </div>
  );
}

function linkDoLembrete(ag: Agendamento): string {
  return linkWhatsappLembrete({
    origin: PAINEL_URL,
    token: ag.token,
    telefone: ag.telefone,
    nomeCliente: ag.nome,
    servico: ag.servico_nome,
    dia: rotuloDiaLongo(dataSP(ag.inicio)),
    hora: horaSP(ag.inicio),
  });
}

// O WhatsApp não deixa o site mandar várias mensagens de uma vez (o navegador
// bloqueia abrir várias abas sozinho). Então a fila mostra uma cliente por vez:
// cada clique abre a conversa já com a mensagem pronta, registra o envio e
// passa para a próxima.
function FilaEnvio({
  fila,
  onEnviado,
  onFechar,
}: {
  fila: Agendamento[];
  onEnviado: (ag: Agendamento) => void;
  onFechar: () => void;
}) {
  const [posicao, setPosicao] = useState(0);
  const ag = fila[posicao];
  const terminou = posicao >= fila.length;

  return (
    <PainelModal onFechar={onFechar} maxWidth="max-w-sm">
      {terminou ? (
        <div className="text-center">
          <p className="mb-1 font-display text-2xl text-white">Pronto! 💜</p>
          <p className="mb-5 text-sm text-white/60">Todas as clientes marcadas foram avisadas.</p>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-full bg-painel-primary px-5 py-2 text-sm font-medium text-white hover:bg-painel-primary/90 transition-colors"
          >
            Fechar
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-[.06em] text-white/50">
            Cliente {posicao + 1} de {fila.length}
          </p>
          <p className="text-lg font-medium text-white">{ag.nome}</p>
          <p className="text-sm text-painel-lilac-soft">
            {horaSP(ag.inicio)} · {ag.servico_nome}
          </p>
          <a
            href={linkDoLembrete(ag)}
            target="whatsapp"
            rel="noreferrer"
            onClick={() => {
              onEnviado(ag);
              setPosicao((n) => n + 1);
            }}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-painel-primary px-5 py-3 text-sm font-semibold text-white hover:bg-painel-primary/90 transition-colors"
          >
            <Link2 className="h-4 w-4" />
            Abrir WhatsApp e enviar link
          </a>
          <p className="mt-2 text-center text-[11.5px] text-white/50">
            Envie a mensagem no WhatsApp e volte para cá para a próxima.
          </p>
          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => setPosicao((n) => n + 1)}
              className="text-white/60 hover:text-white transition-colors"
            >
              Pular esta
            </button>
            <button
              type="button"
              onClick={onFechar}
              className="text-white/60 hover:text-white transition-colors"
            >
              Parar
            </button>
          </div>
        </div>
      )}
    </PainelModal>
  );
}

function LinhaLembrete({
  ag,
  marcada,
  onMarcar,
  onEnviado,
}: {
  ag: Agendamento;
  marcada: boolean;
  onMarcar: () => void;
  onEnviado: () => void;
}) {
  const confirmou = Boolean(ag.presenca_confirmada_em);
  const enviado = Boolean(ag.lembrete_enviado_em);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[14px] border border-painel-border bg-white px-5 py-4">
      {confirmou ? (
        <span className="h-5 w-5 shrink-0" aria-hidden="true" />
      ) : (
        <input
          type="checkbox"
          checked={marcada}
          onChange={onMarcar}
          aria-label={`Marcar ${ag.nome}`}
          className="h-5 w-5 shrink-0 accent-painel-primary"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-painel-primary-deep">
          {horaSP(ag.inicio)}–{horaSP(ag.fim)}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-medium text-painel-title">
          {confirmou && (
            <span className="inline-flex items-center gap-1 rounded-full bg-painel-green/10 px-2.5 py-0.5 text-[11px] font-semibold text-painel-green">
              <Check className="h-3 w-3" />
              Confirmado
            </span>
          )}
          <span className="truncate">{ag.nome}</span>
        </p>
        <p className="text-[12.5px] text-painel-muted-2">
          {ag.servico_nome}
          {ag.areas.length > 0 ? ` · ${ag.areas.join(", ")}` : ""}
        </p>
      </div>

      <div className="flex flex-col items-start gap-1 sm:items-end">
        {!confirmou && (
          <a
            href={linkDoLembrete(ag)}
            target="whatsapp"
            rel="noreferrer"
            onClick={onEnviado}
            className={
              enviado
                ? "inline-flex items-center gap-1.5 rounded-full border border-painel-border bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-painel-chip-text hover:border-painel-primary/40 transition-colors"
                : "inline-flex items-center gap-1.5 rounded-full bg-painel-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-painel-primary/90 transition-colors"
            }
          >
            <Link2 className="h-3.5 w-3.5" />
            {enviado ? "Enviar de novo" : "Link de confirmação"}
          </a>
        )}
        {enviado && (
          <span className="text-[11.5px] text-painel-muted">
            Cliente já avisada · {quandoEnviado(ag.lembrete_enviado_em!)}
          </span>
        )}
        {confirmou && (
          <span className="text-[11.5px] text-painel-muted">
            Confirmou {quandoEnviado(ag.presenca_confirmada_em!)}
          </span>
        )}
      </div>
    </li>
  );
}

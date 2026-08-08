import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  X,
} from "lucide-react";
import {
  FICHAS,
  OPCOES_SESSAO,
  TIPOS,
  rotuloItensSessao,
  nomeCurto,
  type Tipo,
} from "@/data/anamnese";
import {
  listarSessoesDeFichas,
  criarSessao,
  arquivarSessao,
  atualizarSessao,
  atualizarFicha,
  enviarRelatorioPacote,
  atribuirLoteSessoes,
  confirmarSessaoDireto,
  type SessaoAtendimento,
  type PacoteItem,
} from "@/lib/painel";
import {
  linkConfirmacao,
  linkWhatsappConfirmacao,
  linkWhatsappConfirmacaoLote,
  linkWhatsappRelatorio,
} from "@/lib/whatsapp";
import { EnviarFicha } from "@/components/EnviarFicha";
import { PAINEL_URL } from "@/data/services";

const CINCO_MINUTOS_MS = 5 * 60 * 1000;

// Uma opção de procedimento = uma ficha da cliente (depilação, facial...).
// `pacotes` traz, por item, a lista de pacotes comprados em ordem (ex.:
// [{tamanho:10}, {tamanho:10}] = comprou um pacote de 10, completou, e
// comprou mais 10). Aceita também os formatos antigos (um único número, ou
// uma lista de números), salvos antes de existir bônus.
export type Procedimento = {
  id: string;
  tipo: Tipo;
  nome: string;
  pacotes: Record<string, number | number[] | PacoteItem[]>;
};

// Uma linha de bônus de promoção sendo montada num formulário (ainda não
// salva). `tipo` fica separado de `fichaId` porque o dropdown oferece os 3
// tipos de procedimento sempre, mesmo os que a cliente ainda não tem ficha —
// a ficha (se existir) só é resolvida na hora de salvar.
type LinhaBonus = { chave: string; tipo: Tipo | ""; item: string; quantidade: string };

// Normaliza o valor salvo (formato antigo — um número, ou uma lista de
// números — ou já uma lista de pacotes) para sempre trabalhar com uma lista
// de PacoteItem.
function normalizarPacotes(v: number | number[] | PacoteItem[] | undefined): PacoteItem[] {
  if (!Array.isArray(v)) return typeof v === "number" && v > 0 ? [{ tamanho: v }] : [];
  return v
    .map((x) => (typeof x === "number" ? { tamanho: x } : x))
    .filter((p): p is PacoteItem => typeof p?.tamanho === "number" && p.tamanho > 0);
}

// Data de hoje em "YYYY-MM-DD" no fuso local (para o <input type="date">).
function hojeISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

function confirmadaEm(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// Uma linha do histórico compacto: uma sessão dentro do grupo de um item
// (ex.: a 2ª linha do grupo "Axilas"). O número da sessão (1ª, 2ª...) não
// fica salvo aqui — é calculado depois, por segmento (pacote/avulsas), pra
// reiniciar a contagem a cada pacote novo em vez de somar tudo junto.
type LinhaSessao = {
  sessaoId: string;
  data: string;
  observacao: string | null;
  confirmado: boolean;
  confirmado_em: string | null;
  token: string;
};

// Um grupo = um item (área/procedimento) de uma ficha, com suas sessões em
// ordem cronológica. Ex.: "Axilas" agrupa todas as sessões de axila —
// depois divididas em segmentos (pacotes) por segmentarPorPacote().
type GrupoItem = {
  chave: string;
  fichaId: string;
  tipo: Tipo;
  item: string;
  linhas: LinhaSessao[];
  maisRecente: string;
};

// Um pedaço das sessões de um item que pertence a um mesmo pacote comprado
// (ou, quando `pacoteTotal` é undefined, sessões avulsas fora de pacote).
type Segmento = {
  numero: number;
  linhas: LinhaSessao[];
  pacoteTotal?: number;
  bonus?: boolean;
  completo: boolean;
};

// A faixa [inicio, fim) que um pacote ocupa dentro da lista cronológica de
// sessões de um item. `inicio` nunca fica antes de `inicioIndice` (o total
// de sessões que já existiam quando o pacote foi registrado) — é isso que
// impede uma sessão avulsa feita antes de existir o pacote de ser puxada
// pra dentro dele.
type FaixaPacote = { pacote: PacoteItem; numero: number; inicio: number; fim: number };

function faixasDePacotes(pacotes: PacoteItem[]): FaixaPacote[] {
  const faixas: FaixaPacote[] = [];
  let indice = 0;
  pacotes.forEach((p, i) => {
    const inicio = Math.max(indice, p.inicioIndice ?? 0);
    const fim = inicio + p.tamanho;
    faixas.push({ pacote: p, numero: i + 1, inicio, fim });
    indice = fim;
  });
  return faixas;
}

// Há um pacote em andamento (incompleto) para esse total de sessões já
// registradas? Só o último pacote definido pode estar em aberto — os
// anteriores são sempre concluídos antes de um novo poder ser cadastrado.
function temPacoteEmAberto(faixas: FaixaPacote[], totalSessoes: number): boolean {
  return faixas.some((f) => totalSessoes >= f.inicio && totalSessoes < f.fim);
}

// Divide as sessões (já em ordem cronológica) de um item nos pacotes
// comprados, respeitando a faixa de cada um (ver `faixasDePacotes`). Sessões
// que ficam fora de qualquer faixa — antes do 1º pacote, entre dois pacotes,
// ou depois do último — formam segmentos avulsos, sem número de pacote.
function segmentarPorPacote(linhas: LinhaSessao[], pacotes: PacoteItem[]): Segmento[] {
  const segmentos: Segmento[] = [];
  let cursor = 0;
  for (const faixa of faixasDePacotes(pacotes)) {
    // Pacote ainda não alcançado (nem a sessão que marcaria seu início
    // existe) — nem ele, nem nenhum pacote seguinte, tem card ainda.
    if (faixa.inicio > linhas.length) break;
    if (faixa.inicio > cursor) {
      segmentos.push({
        numero: segmentos.length + 1,
        linhas: linhas.slice(cursor, faixa.inicio),
        completo: true,
      });
      cursor = faixa.inicio;
    }
    // Mesmo com 0 sessões feitas ainda (pacote recém-fechado), o card do
    // pacote já deve aparecer — só não teria card se nem tivesse sido
    // alcançado (checado acima).
    const fatia = linhas.slice(cursor, faixa.fim);
    segmentos.push({
      numero: faixa.numero,
      linhas: fatia,
      pacoteTotal: faixa.pacote.tamanho,
      bonus: faixa.pacote.bonus === true,
      completo: fatia.length >= faixa.pacote.tamanho,
    });
    cursor += fatia.length;
  }
  if (cursor < linhas.length) {
    segmentos.push({ numero: segmentos.length + 1, linhas: linhas.slice(cursor), completo: false });
  }
  return segmentos;
}

// Estado (e ações) da edição de sessão, compartilhado entre todas as
// linhas — só uma pode estar em edição por vez.
type EdicaoSessao = {
  sessaoId: string | null;
  data: string;
  observacao: string;
  // Áreas/procedimentos realizados nesta sessão — editável pra corrigir
  // antes de mandar o link de confirmação (ex.: agendou braços + axilas,
  // mas só fez axilas no dia).
  areas: string[];
  opcoesAreas: string[];
  salvando: boolean;
  erro: string | null;
  onData: (v: string) => void;
  onObservacao: (v: string) => void;
  onToggleArea: (a: string) => void;
  onSalvar: () => void;
  onCancelar: () => void;
  onIniciar: (s: { id: string; data: string; observacao: string | null }) => void;
};

// Estado (e ações) do "conferir antes de enviar": quando a sessão junta
// mais de um item (ex.: braços + axilas agendados no mesmo atendimento),
// clicar em WhatsApp abre esta checklist em vez de mandar direto — a Marina
// marca só o que realmente foi feito naquele dia (por algum motivo, a
// cliente pode não ter feito tudo o que estava agendado). O que ficar
// desmarcado vira sessão(ões) pendente(s) separada(s), cada uma com seu
// próprio link, em vez de ser perdido ou empurrado pra dentro do mesmo link.
type EnvioWhatsapp = {
  sessaoId: string | null;
  areasDisponiveis: string[];
  areasMarcadas: string[];
  salvando: boolean;
  erro: string | null;
  onToggleArea: (a: string) => void;
  onConfirmar: () => void;
  onCancelar: () => void;
  onIniciar: (sessaoId: string) => void;
  // Depois de salvar, o link fica aqui pronto pra Marina clicar (não abre
  // sozinho — ver comentário em `linkEnvioPronto`).
  linkPronto: string | null;
  onLinkAberto: () => void;
};

// Marcar uma sessão como confirmada direto pela Marina, sem link — pra
// sessão antiga do caderninho de papel, já assinada pela cliente na clínica.
type MarcarConfirmada = {
  marcandoId: string | null;
  onClicar: (sessaoId: string) => void;
};

// Arquivar uma sessão que a cliente JÁ confirmou (tem "assinatura" digital)
// pede uma segunda confirmação bem mais visível do que o window.confirm
// usado nas outras ações — pra ninguém apagar uma confirmação por engano.
type ArquivarConfirmada = {
  sessaoId: string | null;
  salvando: boolean;
  erro: string | null;
  onConfirmar: () => void;
  onCancelar: () => void;
  onIniciar: (sessaoId: string) => void;
};

// Uma linha de sessão (data + status colorido + ações). Reaproveitada nos
// segmentos de pacote e nas sessões sem item ("Outras sessões"). Vira um
// formulário inline quando está sendo editada (ex.: corrigir a data).
function LinhaSessaoView({
  id,
  texto,
  data,
  observacao,
  confirmado,
  confirmadoEm,
  copiado,
  onCopiar,
  edicao,
  envio,
  arquivar,
  marcarConfirmada,
  escuro,
}: {
  id: string;
  texto: string;
  data: string;
  observacao: string | null;
  confirmado: boolean;
  confirmadoEm: string | null;
  copiado: boolean;
  onCopiar: () => void;
  edicao: EdicaoSessao;
  envio: EnvioWhatsapp;
  arquivar: ArquivarConfirmada;
  marcarConfirmada: MarcarConfirmada;
  // Card do pacote comprado: fundo escuro, então a linha (fora de edição)
  // usa texto bege/lavanda em vez das cores padrão, pensadas pra fundo claro.
  escuro?: boolean;
}) {
  if (arquivar.sessaoId === id) {
    return (
      <li className="rounded-lg border border-painel-alert-border bg-painel-alert-bg p-3">
        <p className="text-xs font-medium text-painel-alert-text mb-1">
          Essa sessão já foi confirmada pela cliente
          {confirmadoEm ? ` em ${confirmadaEm(confirmadoEm)}` : ""}.
        </p>
        <p className="text-[11px] text-painel-alert-text/90 mb-2">
          Arquivar mesmo assim? Ela some da lista, mas nada é apagado — dá pra restaurar depois em
          "Sessões arquivadas".
        </p>
        {arquivar.erro && <p className="text-xs text-painel-alert-text mb-2">{arquivar.erro}</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={arquivar.onConfirmar}
            disabled={arquivar.salvando}
            className="inline-flex items-center gap-1.5 rounded-full bg-painel-alert-text text-white px-3.5 py-1.5 text-xs font-medium hover:opacity-90 transition-colors disabled:opacity-40"
          >
            {arquivar.salvando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
            Sim, arquivar mesmo assim
          </button>
          <button
            type="button"
            onClick={arquivar.onCancelar}
            disabled={arquivar.salvando}
            className="rounded-full border border-painel-border px-3.5 py-1.5 text-xs font-medium text-painel-chip-text hover:border-painel-primary/40 transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
        </div>
      </li>
    );
  }

  if (envio.sessaoId === id) {
    if (envio.linkPronto) {
      return (
        <li className="rounded-lg border border-painel-border bg-painel-badge-bg/50 p-3">
          <p className="text-xs font-medium text-painel-title mb-2">
            Sessão salva! Clique pra abrir o WhatsApp com o link de confirmação.
          </p>
          <a
            href={envio.linkPronto}
            target="whatsapp"
            rel="noreferrer"
            onClick={envio.onLinkAberto}
            className="inline-flex items-center gap-1.5 rounded-full bg-painel-primary text-white px-3.5 py-1.5 text-xs font-medium hover:bg-painel-primary/90 transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Abrir WhatsApp
          </a>
        </li>
      );
    }
    return (
      <li className="rounded-lg border border-painel-border bg-painel-badge-bg/50 p-3">
        <p className="text-xs font-medium text-painel-title mb-1">
          O que foi realizado em {dataBR(data)}?
        </p>
        <p className="text-[11px] text-painel-muted mb-2">
          Esse atendimento tinha mais de um item agendado junto. Marque só o que a cliente realmente
          fez — o link vai refletir isso.
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {envio.areasDisponiveis.map((a) => {
            const sel = envio.areasMarcadas.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => envio.onToggleArea(a)}
                className={[
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  sel
                    ? "bg-painel-primary border-painel-primary text-white font-medium"
                    : "bg-white border-painel-border text-painel-chip-text hover:border-painel-primary/40",
                ].join(" ")}
              >
                {a}
              </button>
            );
          })}
        </div>
        {envio.areasMarcadas.length < envio.areasDisponiveis.length && (
          <p className="text-[11px] text-painel-muted mb-2">
            O que ficar desmarcado vira sessão(ões) pendente(s) separada(s), pra confirmar depois.
          </p>
        )}
        {envio.erro && <p className="text-xs text-painel-alert-text mb-2">{envio.erro}</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={envio.onConfirmar}
            disabled={envio.salvando || envio.areasMarcadas.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-painel-primary text-white px-3.5 py-1.5 text-xs font-medium hover:bg-painel-primary/90 transition-colors disabled:opacity-40"
          >
            {envio.salvando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <MessageCircle className="h-3.5 w-3.5" />
            )}
            Enviar
          </button>
          <button
            type="button"
            onClick={envio.onCancelar}
            disabled={envio.salvando}
            className="rounded-full border border-painel-border px-3.5 py-1.5 text-xs font-medium text-painel-chip-text hover:border-painel-primary/40 transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
        </div>
      </li>
    );
  }

  if (edicao.sessaoId === id) {
    return (
      <li className="rounded-lg border border-painel-border bg-painel-badge-bg/50 p-3">
        <div className="mb-2">
          <label className="block text-xs font-medium text-painel-muted mb-1">Data</label>
          <input
            type="date"
            value={edicao.data}
            onChange={(e) => edicao.onData(e.target.value)}
            className="rounded-lg border border-painel-border bg-painel-bg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-painel-primary/40"
          />
        </div>
        {edicao.opcoesAreas.length > 0 && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-painel-muted mb-1">
              O que foi realizado
            </label>
            <div className="flex flex-wrap gap-1.5">
              {edicao.opcoesAreas.map((a) => {
                const sel = edicao.areas.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => edicao.onToggleArea(a)}
                    className={[
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      sel
                        ? "bg-painel-primary border-painel-primary text-white font-medium"
                        : "bg-white border-painel-border text-painel-chip-text hover:border-painel-primary/40",
                    ].join(" ")}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
            {edicao.areas.length > 1 && (
              <p className="mt-1.5 text-[11px] text-painel-muted">
                Só uma parte foi feita? Desmarque aqui — ao salvar, dá pra criar uma sessão separada
                e pendente pro que ficou de fora, com link de confirmação próprio.
              </p>
            )}
          </div>
        )}
        <div className="mb-3">
          <label className="block text-xs font-medium text-painel-muted mb-1">Observação</label>
          <textarea
            value={edicao.observacao}
            onChange={(e) => edicao.onObservacao(e.target.value)}
            rows={2}
            placeholder="Opcional"
            className="w-full rounded-lg border border-painel-border bg-painel-bg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-painel-primary/40"
          />
        </div>
        {edicao.erro && <p className="text-xs text-painel-alert-text mb-2">{edicao.erro}</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={edicao.onSalvar}
            disabled={edicao.salvando}
            className="inline-flex items-center gap-1.5 rounded-full bg-painel-primary text-white px-3.5 py-1.5 text-xs font-medium hover:bg-painel-primary/90 transition-colors disabled:opacity-40"
          >
            {edicao.salvando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Salvar
          </button>
          <button
            type="button"
            onClick={edicao.onCancelar}
            disabled={edicao.salvando}
            className="rounded-full border border-painel-border px-3.5 py-1.5 text-xs font-medium text-painel-chip-text hover:border-painel-primary/40 transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
        </div>
      </li>
    );
  }

  const corIcone = escuro
    ? "text-painel-lilac-soft/60 hover:text-painel-lilac-soft"
    : "text-painel-muted/60 hover:text-painel-primary";
  const corIconeFraco = escuro
    ? "text-painel-lilac-soft/40 hover:text-painel-lilac-soft"
    : "text-painel-muted/40 hover:text-painel-primary";

  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span
        aria-hidden="true"
        className={[
          "h-1.5 w-1.5 rounded-full shrink-0",
          confirmado
            ? escuro
              ? "bg-painel-lilac-soft/50"
              : "bg-painel-muted-2"
            : escuro
              ? "bg-painel-gold-soft"
              : "bg-painel-gold",
        ].join(" ")}
      />
      <span
        title={confirmadoEm ? `Confirmado em ${confirmadaEm(confirmadoEm)}` : undefined}
        className={
          confirmado
            ? escuro
              ? "text-painel-lilac-soft/90"
              : "text-painel-chip-text"
            : escuro
              ? "text-painel-gold-soft font-medium"
              : "text-painel-gold font-medium"
        }
      >
        {texto}
      </span>
      {/* Celular: só editar e WhatsApp, um em cima do outro (mais espaço
          pro toque, sem risco de acertar o botão errado). Copiar e arquivar
          ficam escondidos aqui — ainda disponíveis na versão desktop. */}
      <span className="flex sm:hidden flex-col items-center gap-2.5 ml-auto shrink-0">
        <button
          type="button"
          onClick={() => edicao.onIniciar({ id, data, observacao })}
          title="Editar sessão"
          className={`p-1 transition-colors ${corIcone}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
        {!confirmado && (
          <>
            <button
              type="button"
              onClick={() => envio.onIniciar(id)}
              title="Enviar por WhatsApp"
              className={`p-1 transition-colors ${corIcone}`}
            >
              <MessageCircle className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => marcarConfirmada.onClicar(id)}
              disabled={marcarConfirmada.marcandoId === id}
              title="Marcar como confirmada (assinada no papel)"
              className={`p-1 transition-colors ${corIcone} disabled:opacity-40`}
            >
              {marcarConfirmada.marcandoId === id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BadgeCheck className="h-4 w-4" />
              )}
            </button>
          </>
        )}
      </span>

      <span className="hidden sm:flex items-center gap-1.5 ml-auto shrink-0">
        {!confirmado && (
          <>
            <button
              type="button"
              onClick={onCopiar}
              title="Copiar link"
              className={`transition-colors ${corIcone}`}
            >
              {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => envio.onIniciar(id)}
              title="Enviar por WhatsApp"
              className={`transition-colors ${corIcone}`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => marcarConfirmada.onClicar(id)}
              disabled={marcarConfirmada.marcandoId === id}
              title="Marcar como confirmada (assinada no papel)"
              className={`transition-colors ${corIcone} disabled:opacity-40`}
            >
              {marcarConfirmada.marcandoId === id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BadgeCheck className="h-3.5 w-3.5" />
              )}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => edicao.onIniciar({ id, data, observacao })}
          title="Editar sessão"
          className={`transition-colors ${corIconeFraco}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => arquivar.onIniciar(id)}
          title="Arquivar sessão"
          className={`transition-colors ${escuro ? "text-painel-lilac-soft/40 hover:text-painel-alert-text" : "text-painel-muted/40 hover:text-painel-alert-text"}`}
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
      </span>
    </li>
  );
}

// Agrupa as sessões por item (não por data), para o histórico compacto:
// cada item vira uma lista curta de linhas coloridas por confirmação.
// Sessões sem nenhum item (só observação) caem à parte, em "Outras sessões".
function agruparPorItem(
  sessoes: SessaoAtendimento[],
  tipoPorFicha: Map<string, Tipo>,
): { grupos: GrupoItem[]; semItem: SessaoAtendimento[] } {
  const porChave = new Map<string, GrupoItem>();
  const semItem: SessaoAtendimento[] = [];
  const ordenadas = [...sessoes].sort((a, b) =>
    `${a.data}T${a.created_at}`.localeCompare(`${b.data}T${b.created_at}`),
  );
  for (const s of ordenadas) {
    if (s.areas.length === 0) {
      semItem.push(s);
      continue;
    }
    for (const item of s.areas) {
      const chave = `${s.ficha_id}::${item}`;
      let g = porChave.get(chave);
      if (!g) {
        g = {
          chave,
          fichaId: s.ficha_id,
          tipo: tipoPorFicha.get(s.ficha_id) ?? "laser",
          item,
          linhas: [],
          maisRecente: s.data,
        };
        porChave.set(chave, g);
      }
      g.linhas.push({
        sessaoId: s.id,
        data: s.data,
        observacao: s.observacao,
        confirmado: s.confirmado,
        confirmado_em: s.confirmado_em,
        token: s.token,
      });
      if (s.data > g.maisRecente) g.maisRecente = s.data;
    }
  }
  // Itens (e sessões avulsas) mais recentemente movimentados ficam no topo
  // da ficha — ordem decrescente, em vez de crescente.
  const grupos = [...porChave.values()].sort((a, b) => b.maisRecente.localeCompare(a.maisRecente));
  semItem.sort((a, b) => b.data.localeCompare(a.data));
  return { grupos, semItem };
}

// Histórico de sessões: o "caderninho" digital da cliente. A Marina registra
// data + itens realizados + observação; a cliente confirma pelo link (vale
// como assinatura). Aceita várias fichas: a cliente escolhe o procedimento.
export function HistoricoSessoes({
  fichas,
  nomeCliente,
  telefoneCliente,
}: {
  fichas: Procedimento[];
  nomeCliente: string;
  telefoneCliente?: string | null;
}) {
  const [sessoes, setSessoes] = useState<SessaoAtendimento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [abrindo, setAbrindo] = useState(false);
  const [fichaId, setFichaId] = useState(fichas[0]?.id ?? "");
  const [data, setData] = useState(hojeISO());
  const [itens, setItens] = useState<string[]>([]);
  const [observacao, setObservacao] = useState("");
  const [pacotesForm, setPacotesForm] = useState<Record<string, string>>({});
  // Sessão antiga do caderninho de papel, já assinada pela cliente: marca
  // como confirmada direto ao registrar, sem gerar link nenhum.
  const [jaConfirmada, setJaConfirmada] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // Bônus anexados a um pacote sendo declarado pela 1ª vez, junto da 1ª
  // sessão do item (ver `itensSemPacote` no JSX). Uma lista por item, pois
  // esse formulário pode declarar pacotes de vários itens de uma vez.
  const [bonusFormRegistro, setBonusFormRegistro] = useState<Record<string, LinhaBonus[]>>({});
  const [tipoFaltandoAnamneseRegistro, setTipoFaltandoAnamneseRegistro] = useState<Tipo | null>(
    null,
  );

  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Edição de uma sessão já registrada (corrigir data/observação).
  const [editandoSessaoId, setEditandoSessaoId] = useState<string | null>(null);
  const [editData, setEditData] = useState("");
  const [editObservacao, setEditObservacao] = useState("");
  const [editAreas, setEditAreas] = useState<string[]>([]);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);

  // "Conferir antes de enviar": abre uma checklist antes do link de
  // WhatsApp sair, só quando a sessão junta mais de um item.
  const [enviandoSessaoId, setEnviandoSessaoId] = useState<string | null>(null);
  const [enviarAreas, setEnviarAreas] = useState<string[]>([]);
  const [salvandoEnvio, setSalvandoEnvio] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  // Link pronto depois de salvar: fica como um <a> de verdade pra Marina
  // clicar, em vez de abrir sozinho com window.open (bloqueador de popup
  // do navegador barra chamadas que não vêm direto de um clique).
  const [linkEnvioPronto, setLinkEnvioPronto] = useState<string | null>(null);

  // Confirmação em LOTE: quando a cliente fez vários procedimentos no
  // mesmo dia (ex.: depilação de axila + abdome + queixo, ou depilação +
  // drenagem), a Marina pode mandar UM link só em vez de N. Aqui guarda
  // qual dia está sendo agrupado e quais sessões daquele dia entram no
  // lote. `loteLinkPronto` segue o mesmo padrão de `linkEnvioPronto`:
  // vira um <a> pra Marina clicar (evita bloqueador de popup).
  const [loteData, setLoteData] = useState<string | null>(null);
  const [loteSelecionadas, setLoteSelecionadas] = useState<Set<string>>(new Set());
  const [loteSalvando, setLoteSalvando] = useState(false);
  const [loteErro, setLoteErro] = useState<string | null>(null);
  const [loteLinkPronto, setLoteLinkPronto] = useState<string | null>(null);

  // Pacotes salvos nesta sessão do painel (além dos que já vieram nas
  // fichas), pra refletir na hora sem precisar recarregar a página.
  const [pacotesOverride, setPacotesOverride] = useState<Record<string, PacoteItem[]>>({});

  // Segmentos (pacotes) já concluídos que a Marina abriu manualmente pra
  // ver os detalhes, ou pacotes em aberto que ela recolheu.
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});

  // "Fechou um pacote?": registra um pacote novo pra esse item, mesmo que
  // ele já tenha sessões avulsas (ex.: fez 1 sessão avulsa e só depois
  // comprou o pacote de 10). A(s) sessão(ões) avulsa(s) já feitas continuam
  // avulsas, num card separado — o pacote só passa a contar a partir da
  // próxima sessão registrada. Também serve pra registrar um novo pacote
  // depois que o anterior foi concluído.
  const [editandoPacoteChave, setEditandoPacoteChave] = useState<string | null>(null);
  const [pacoteValor, setPacoteValor] = useState("");
  const [salvandoPacote, setSalvandoPacote] = useState(false);
  const [erroPacote, setErroPacote] = useState<string | null>(null);
  // Bônus da promoção anexados ao pacote sendo cadastrado (ex.: "compre 10
  // sessões de laser e ganhe uma limpeza de pele"). O dropdown oferece os 3
  // tipos de procedimento sempre, mesmo os que a cliente ainda não tem ficha
  // — por isso guarda `tipo` (não fichaId direto, que só existe se a ficha
  // já existir; resolvido na hora de salvar).
  const [bonusForm, setBonusForm] = useState<LinhaBonus[]>([]);
  // Quando ela tenta salvar um bônus de um tipo sem ficha, bloqueia o salvar
  // e mostra o convite de anamnese desse tipo (em vez de criar uma ficha sem
  // nenhuma pergunta de saúde respondida).
  const [tipoFaltandoAnamnese, setTipoFaltandoAnamnese] = useState<Tipo | null>(null);
  // "Cancelar pacote": remove só a última definição de pacote de um item
  // (ex.: cliente desistiu do pacote, ou foi marcado por engano). As sessões
  // que estavam nele não são apagadas — voltam a contar como avulsas.
  const [removendoPacoteChave, setRemovendoPacoteChave] = useState<string | null>(null);

  // "Editar sessões do pacote": corrige o número de sessões do último pacote
  // já fechado desse item (ex.: a Marina digitou errado, ou a cliente
  // negociou sessões extras depois). Só o último pacote pode ser editado
  // (mesma regra de removerPacote) — os anteriores já estão concluídos e
  // mexer no tamanho deles bagunçaria a faixa dos pacotes seguintes.
  const [editandoTamanhoChave, setEditandoTamanhoChave] = useState<string | null>(null);
  const [tamanhoValor, setTamanhoValor] = useState("");
  const [salvandoTamanho, setSalvandoTamanho] = useState(false);
  const [erroTamanho, setErroTamanho] = useState<string | null>(null);

  // Arquivar sessão: se já foi confirmada pela cliente, pede confirmação
  // reforçada (ver ArquivarConfirmada) em vez do window.confirm simples.
  const [arquivandoId, setArquivandoId] = useState<string | null>(null);
  const [salvandoArquivar, setSalvandoArquivar] = useState(false);
  const [erroArquivar, setErroArquivar] = useState<string | null>(null);
  // Restaurar uma sessão arquivada, e mostrar/ocultar a lista delas.
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);

  // Marcar sessão como confirmada direto (sem link) — sessão antiga do
  // caderninho de papel, já assinada pela cliente na clínica.
  const [marcandoConfirmadaId, setMarcandoConfirmadaId] = useState<string | null>(null);

  // "Enviar Relatório": gera (ou atualiza) o link público de progresso de um
  // pacote específico e abre o WhatsApp já com a mensagem pronta. Só um
  // pacote por vez (chave = `${fichaId}::${item}::${numero}`).
  const [enviandoRelatorioChave, setEnviandoRelatorioChave] = useState<string | null>(null);
  const [erroRelatorioChave, setErroRelatorioChave] = useState<Record<string, string>>({});

  const fichaPorId = useMemo(() => {
    const m = new Map<string, Procedimento>();
    fichas.forEach((f) => m.set(f.id, f));
    return m;
  }, [fichas]);

  // Lista de pacotes comprados (ou ganhos de bônus) desse item, em ordem.
  const pacotesDoItem = (fId: string, item: string): PacoteItem[] => {
    const chave = `${fId}::${item}`;
    if (chave in pacotesOverride) return pacotesOverride[chave];
    return normalizarPacotes(fichaPorId.get(fId)?.pacotes[item]);
  };

  const multi = fichas.length > 1;

  // Opções pro dropdown de bônus: os itens dos 3 tipos de procedimento,
  // sempre — mesmo os que a cliente ainda não tem ficha (ex.: promoção de
  // facial que dá sessões de laser de brinde pra apresentar o tratamento).
  // Sem ficha do tipo ainda, `fichaId` fica null — resolvido/bloqueado na
  // hora de salvar, não aqui. Sem categoria no rótulo — lista única em
  // ordem alfabética, em vez de agrupada por tipo.
  const opcoesBonus = useMemo(
    () =>
      TIPOS.flatMap((tipo) =>
        (OPCOES_SESSAO[tipo] ?? []).map((item) => ({
          valor: `${tipo}::${item}`,
          tipo,
          item,
          rotulo: item,
        })),
      ).sort((a, b) => a.item.localeCompare(b.item, "pt-BR")),
    [],
  );
  const tipoPorFicha = useMemo(() => {
    const m = new Map<string, Tipo>();
    fichas.forEach((f) => m.set(f.id, f.tipo));
    return m;
  }, [fichas]);

  const tipoAtual = tipoPorFicha.get(fichaId) ?? fichas[0]?.tipo ?? "laser";
  const opcoes = OPCOES_SESSAO[tipoAtual] ?? [];

  const ids = useMemo(() => fichas.map((f) => f.id), [fichas]);

  // Enquanto a Marina está registrando ou editando uma sessão, o
  // auto-refresh não troca os dados debaixo dela.
  const ocupadoRef = useRef(false);
  useEffect(() => {
    ocupadoRef.current = abrindo || editandoSessaoId !== null || enviandoSessaoId !== null;
  }, [abrindo, editandoSessaoId, enviandoSessaoId]);

  useEffect(() => {
    listarSessoesDeFichas(ids)
      .then(setSessoes)
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar sessões."));

    // Auto-refresh: pega a confirmação da cliente (ou nova sessão de
    // outro dispositivo) a cada 5min, sem precisar recarregar a página.
    const intervalo = setInterval(() => {
      if (ocupadoRef.current) return;
      listarSessoesDeFichas(ids)
        .then(setSessoes)
        .catch(() => {});
    }, CINCO_MINUTOS_MS);
    return () => clearInterval(intervalo);
  }, [ids]);

  const toggleItem = (a: string) =>
    setItens((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const abrirForm = () => {
    setFichaId(fichas[0]?.id ?? "");
    setItens([]);
    setObservacao("");
    setPacotesForm({});
    setBonusFormRegistro({});
    setTipoFaltandoAnamneseRegistro(null);
    setData(hojeISO());
    setJaConfirmada(false);
    setAbrindo(true);
  };

  const registrar = async () => {
    // Adiciona o pacote informado à lista de pacotes desse item (pode já ter
    // pacotes anteriores concluídos).
    const entradas = Object.entries(pacotesForm)
      .filter(([item, v]) => itens.includes(item) && v.trim())
      .map(([item, v]) => [item, parseInt(v, 10)] as const)
      .filter(([, n]) => n > 0);

    // Checa TODOS os bônus antes de criar a sessão — se algum for de um tipo
    // sem ficha, bloqueia tudo em vez de criar a sessão e só travar no meio
    // do salvamento dos pacotes (deixaria a promessa de bônus pra trás).
    for (const [item] of entradas) {
      const tipoFaltante = tipoBonusSemFicha(bonusFormRegistro[item] ?? []);
      if (tipoFaltante) {
        setErro(
          `Essa cliente ainda não tem ficha de ${nomeCurto(tipoFaltante)} — manda a anamnese pra ela preencher antes de registrar esse brinde.`,
        );
        setTipoFaltandoAnamneseRegistro(tipoFaltante);
        return;
      }
    }
    setTipoFaltandoAnamneseRegistro(null);

    setSalvando(true);
    setErro(null);
    try {
      const nova = await criarSessao(fichaId, {
        data,
        areas: itens,
        observacao,
        confirmada: jaConfirmada,
      });
      setSessoes((prev) => [nova, ...(prev ?? [])]);

      // Erro aqui não desfaz a sessão já registrada — só avisa à parte.
      if (entradas.length > 0) {
        try {
          for (const [item, n] of entradas) {
            await aplicarPacote({ fichaId, item }, n, bonusFormRegistro[item] ?? []);
          }
        } catch {
          setErro("Sessão registrada, mas não foi possível salvar o tamanho do pacote.");
        }
      }

      setAbrindo(false);
      setItens([]);
      setObservacao("");
      setPacotesForm({});
      setBonusFormRegistro({});
      setData(hojeISO());
      setJaConfirmada(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao registrar sessão.");
    } finally {
      setSalvando(false);
    }
  };

  const marcarArquivada = (sessaoId: string, arquivado: boolean) =>
    setSessoes((prev) => (prev ?? []).map((x) => (x.id === sessaoId ? { ...x, arquivado } : x)));

  // Sessão ainda não confirmada: um window.confirm simples já basta (mesmo
  // padrão usado no resto do app). Sessão já confirmada pela cliente: abre
  // o cartão de confirmação reforçada (ver ArquivarConfirmada), bem mais
  // difícil de acionar sem querer do que um confirm() do navegador.
  const iniciarArquivar = (sessaoId: string) => {
    const s = (sessoes ?? []).find((x) => x.id === sessaoId);
    if (!s) return;
    if (s.confirmado) {
      setErroArquivar(null);
      setArquivandoId(sessaoId);
      return;
    }
    const detalhe = s.areas.length > 0 ? ` (${s.areas.join(", ")})` : "";
    if (
      !window.confirm(
        `Arquivar a sessão de ${dataBR(s.data)}${detalhe}? Dá pra restaurar depois em "Sessões arquivadas".`,
      )
    )
      return;
    arquivar(sessaoId);
  };

  const arquivar = async (sessaoId: string) => {
    setSalvandoArquivar(true);
    setErroArquivar(null);
    try {
      await arquivarSessao(sessaoId, true);
      marcarArquivada(sessaoId, true);
      setArquivandoId(null);
    } catch (e) {
      setErroArquivar(e instanceof Error ? e.message : "Erro ao arquivar sessão.");
    } finally {
      setSalvandoArquivar(false);
    }
  };

  const cancelarArquivar = () => {
    setArquivandoId(null);
    setErroArquivar(null);
  };

  const arquivarState: ArquivarConfirmada = {
    sessaoId: arquivandoId,
    salvando: salvandoArquivar,
    erro: erroArquivar,
    onConfirmar: () => arquivandoId && arquivar(arquivandoId),
    onCancelar: cancelarArquivar,
    onIniciar: iniciarArquivar,
  };

  const marcarConfirmadaDireto = async (sessaoId: string) => {
    const s = (sessoes ?? []).find((x) => x.id === sessaoId);
    if (!s) return;
    const detalhe = s.areas.length > 0 ? ` (${s.areas.join(", ")})` : "";
    if (
      !window.confirm(
        `Marcar a sessão de ${dataBR(s.data)}${detalhe} como já confirmada, sem mandar link? Use só quando a cliente já assinou no papel.`,
      )
    )
      return;
    setMarcandoConfirmadaId(sessaoId);
    setErro(null);
    try {
      const confirmadoEm = await confirmarSessaoDireto(sessaoId);
      setSessoes((prev) =>
        (prev ?? []).map((x) =>
          x.id === sessaoId ? { ...x, confirmado: true, confirmado_em: confirmadoEm } : x,
        ),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao marcar sessão como confirmada.");
    } finally {
      setMarcandoConfirmadaId(null);
    }
  };

  const marcarConfirmadaState: MarcarConfirmada = {
    marcandoId: marcandoConfirmadaId,
    onClicar: marcarConfirmadaDireto,
  };

  const restaurar = async (sessaoId: string) => {
    setRestaurandoId(sessaoId);
    setErro(null);
    try {
      await arquivarSessao(sessaoId, false);
      marcarArquivada(sessaoId, false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao restaurar sessão.");
    } finally {
      setRestaurandoId(null);
    }
  };

  const iniciarEdicaoSessao = (s: { id: string; data: string; observacao: string | null }) => {
    setEditandoSessaoId(s.id);
    setEditData(s.data);
    setEditObservacao(s.observacao ?? "");
    setEditAreas((sessoes ?? []).find((x) => x.id === s.id)?.areas ?? []);
    setErroEdicao(null);
  };

  const cancelarEdicaoSessao = () => {
    setEditandoSessaoId(null);
    setErroEdicao(null);
  };

  const toggleEditArea = (a: string) =>
    setEditAreas((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const salvarEdicaoSessao = async () => {
    if (!editandoSessaoId) return;
    const sessaoOriginal = (sessoes ?? []).find((s) => s.id === editandoSessaoId);
    // Editar uma sessão que a cliente já confirmou muda o que ela "assinou"
    // sem ela saber — pede uma confirmação extra antes de salvar.
    if (
      sessaoOriginal?.confirmado &&
      !window.confirm("Essa sessão já foi confirmada pela cliente. Alterar os dados mesmo assim?")
    ) {
      return;
    }
    // Itens que estavam nesta sessão e a Marina desmarcou agora — ex.: tinha
    // Braços + Axilas, mas só Axilas foi feito. Sem isso, cada link de
    // WhatsApp dessa sessão confirmaria os dois juntos, mesmo se ela só
    // quisesse mandar a confirmação de um deles.
    const areasRemovidas = (sessaoOriginal?.areas ?? []).filter((a) => !editAreas.includes(a));
    let criarPendente = false;
    if (areasRemovidas.length > 0) {
      criarPendente = window.confirm(
        `"${areasRemovidas.join(", ")}" vai sair desta sessão. Criar uma sessão pendente separada pra isso, com link de confirmação próprio? (Cancelar só remove, sem criar nada)`,
      );
    }
    setSalvandoEdicao(true);
    setErroEdicao(null);
    try {
      const observacao = editObservacao.trim() || null;
      await atualizarSessao(editandoSessaoId, { data: editData, observacao, areas: editAreas });

      let novaPendente: SessaoAtendimento | null = null;
      if (criarPendente && sessaoOriginal) {
        novaPendente = await criarSessao(sessaoOriginal.ficha_id, {
          data: editData,
          areas: areasRemovidas,
          observacao: "",
        });
      }

      setSessoes((prev) => {
        const atualizado = (prev ?? []).map((s) =>
          s.id === editandoSessaoId ? { ...s, data: editData, observacao, areas: editAreas } : s,
        );
        return novaPendente ? [novaPendente, ...atualizado] : atualizado;
      });
      setEditandoSessaoId(null);
    } catch (e) {
      // Mostrado dentro do próprio formulário de edição — não só lá em
      // cima, senão passa despercebido quando a lista está rolada.
      setErroEdicao(e instanceof Error ? e.message : "Erro ao salvar a sessão.");
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const tipoDaSessaoEmEdicao = editandoSessaoId
    ? tipoPorFicha.get((sessoes ?? []).find((x) => x.id === editandoSessaoId)?.ficha_id ?? "")
    : undefined;

  const edicaoSessao: EdicaoSessao = {
    sessaoId: editandoSessaoId,
    data: editData,
    observacao: editObservacao,
    areas: editAreas,
    opcoesAreas: tipoDaSessaoEmEdicao ? (OPCOES_SESSAO[tipoDaSessaoEmEdicao] ?? []) : [],
    salvando: salvandoEdicao,
    erro: erroEdicao,
    onData: setEditData,
    onObservacao: setEditObservacao,
    onToggleArea: toggleEditArea,
    onSalvar: salvarEdicaoSessao,
    onCancelar: cancelarEdicaoSessao,
    onIniciar: iniciarEdicaoSessao,
  };

  const copiar = async (sessaoId: string, token: string) => {
    try {
      await navigator.clipboard.writeText(linkConfirmacao(PAINEL_URL, token));
      setCopiadoId(sessaoId);
      setTimeout(() => setCopiadoId((c) => (c === sessaoId ? null : c)), 2000);
    } catch {
      /* ignore */
    }
  };

  const whatsappDe = (token: string, data: string) =>
    linkWhatsappConfirmacao({
      origin: PAINEL_URL,
      token,
      telefone: telefoneCliente,
      nomeCliente,
      dataBR: dataBR(data),
    });

  // Ao clicar em "Enviar por WhatsApp": se o atendimento tem só um item,
  // manda direto — não tem o que conferir. Se juntou vários no mesmo dia
  // (ex.: braços + axilas agendados juntos), abre a checklist antes.
  const iniciarEnvioWhatsapp = (sessaoId: string) => {
    const s = (sessoes ?? []).find((x) => x.id === sessaoId);
    if (!s) return;
    if (s.areas.length <= 1) {
      window.open(whatsappDe(s.token, s.data), "whatsapp", "noreferrer");
      return;
    }
    setEnviandoSessaoId(sessaoId);
    setEnviarAreas(s.areas);
    setErroEnvio(null);
  };

  const toggleEnviarArea = (a: string) =>
    setEnviarAreas((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const cancelarEnvio = () => {
    setEnviandoSessaoId(null);
    setErroEnvio(null);
    setLinkEnvioPronto(null);
  };

  const confirmarEnvio = async () => {
    if (!enviandoSessaoId) return;
    const s = (sessoes ?? []).find((x) => x.id === enviandoSessaoId);
    if (!s) return;
    const naoRealizados = s.areas.filter((a) => !enviarAreas.includes(a));
    setSalvandoEnvio(true);
    setErroEnvio(null);
    try {
      // A sessão que recebe o link fica só com o que a Marina confirmou; o
      // que não foi feito vira sessão(ões) pendente(s) separada(s), cada
      // uma com seu próprio link, em vez de sumir ou ficar preso ao mesmo
      // link do que já foi enviado.
      await atualizarSessao(s.id, { areas: enviarAreas });
      const pendentes =
        naoRealizados.length > 0
          ? await Promise.all(
              naoRealizados.map((item) =>
                criarSessao(s.ficha_id, { data: s.data, areas: [item], observacao: "" }),
              ),
            )
          : [];
      setSessoes((prev) => {
        const atualizado = (prev ?? []).map((x) =>
          x.id === s.id ? { ...x, areas: enviarAreas } : x,
        );
        return [...pendentes, ...atualizado];
      });
      // Não abre sozinho (window.open depois de um await esbarra no
      // bloqueador de popup) — deixa o link pronto pra Marina clicar.
      setLinkEnvioPronto(whatsappDe(s.token, s.data));
    } catch (e) {
      setErroEnvio(e instanceof Error ? e.message : "Erro ao preparar o envio.");
    } finally {
      setSalvandoEnvio(false);
    }
  };

  const envioSessao: EnvioWhatsapp = {
    sessaoId: enviandoSessaoId,
    linkPronto: linkEnvioPronto,
    onLinkAberto: cancelarEnvio,
    areasDisponiveis: (sessoes ?? []).find((x) => x.id === enviandoSessaoId)?.areas ?? [],
    areasMarcadas: enviarAreas,
    salvando: salvandoEnvio,
    erro: erroEnvio,
    onToggleArea: toggleEnviarArea,
    onConfirmar: confirmarEnvio,
    onCancelar: cancelarEnvio,
    onIniciar: iniciarEnvioWhatsapp,
  };

  const podeSalvar = fichaId && (itens.length > 0 || observacao.trim());

  // Sessões arquivadas ficam fora do histórico ativo (e de qualquer conta
  // de progresso/pacote) — só aparecem na seção "Sessões arquivadas".
  const sessoesAtivas = useMemo(() => (sessoes ?? []).filter((s) => !s.arquivado), [sessoes]);
  const sessoesArquivadas = useMemo(() => (sessoes ?? []).filter((s) => s.arquivado), [sessoes]);

  // --- Confirmação em lote (várias sessões do mesmo dia, um link só) ---
  // Dias em que há 2+ sessões pendentes de confirmação — só nesses casos
  // faz sentido oferecer o lote (com 1 sessão só, o link individual já
  // resolve).
  const diasComVariasPendentes = useMemo(() => {
    const porDia = new Map<string, SessaoAtendimento[]>();
    for (const s of sessoesAtivas) {
      if (s.confirmado) continue;
      const arr = porDia.get(s.data) ?? [];
      arr.push(s);
      porDia.set(s.data, arr);
    }
    return [...porDia.entries()]
      .filter(([, arr]) => arr.length >= 2)
      .map(([data, arr]) => ({ data, sessoes: arr }))
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [sessoesAtivas]);

  const abrirLote = (data: string) => {
    const dia = diasComVariasPendentes.find((d) => d.data === data);
    if (!dia) return;
    setLoteData(data);
    // Pré-seleciona todas — o caso mais comum é confirmar tudo do dia.
    setLoteSelecionadas(new Set(dia.sessoes.map((s) => s.id)));
    setLoteErro(null);
    setLoteLinkPronto(null);
  };

  const fecharLote = () => {
    setLoteData(null);
    setLoteSelecionadas(new Set());
    setLoteErro(null);
    setLoteLinkPronto(null);
  };

  const toggleLoteSessao = (id: string) => {
    setLoteSelecionadas((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const gerarLinkLote = async () => {
    if (!loteData) return;
    const ids = [...loteSelecionadas];
    if (ids.length < 2) {
      setLoteErro("Selecione pelo menos 2 sessões para gerar um link único.");
      return;
    }
    // Token curto e aleatório, mesmo formato dos tokens de sessão (hex).
    const loteToken = crypto.randomUUID().replace(/-/g, "");
    setLoteSalvando(true);
    setLoteErro(null);
    try {
      await atribuirLoteSessoes(ids, loteToken);
      setLoteLinkPronto(
        linkWhatsappConfirmacaoLote({
          origin: PAINEL_URL,
          loteToken,
          telefone: telefoneCliente,
          nomeCliente,
          dataBR: dataBR(loteData),
          quantidade: ids.length,
        }),
      );
    } catch (e) {
      setLoteErro(e instanceof Error ? e.message : "Não foi possível gerar o link.");
    } finally {
      setLoteSalvando(false);
    }
  };

  // Agrupado por item (área/procedimento), para o histórico compacto.
  const { grupos, semItem } = useMemo(
    () => agruparPorItem(sessoesAtivas, tipoPorFicha),
    [sessoesAtivas, tipoPorFicha],
  );

  // Bônus de promoção ainda não totalmente usufruídos. Um item pode ter mais
  // de um bônus (ou um bônus + pacote pago) — soma quantos "lugares" de
  // bônus ainda não têm sessão registrada, em vez de só checar se o item já
  // tem QUALQUER sessão. Senão, ao marcar o 1º bônus de dois, o 2º bônus
  // "sumia" (o item inteiro saía da lista assim que ganhava sua 1ª sessão).
  const linhasPorChave = useMemo(
    () => new Map(grupos.map((g) => [g.chave, g.linhas.length])),
    [grupos],
  );
  const grupoPorChave = useMemo(() => new Map(grupos.map((g) => [g.chave, g])), [grupos]);

  const bonusPendentes = useMemo(() => {
    const lista: {
      chave: string;
      fichaId: string;
      tipo: Tipo;
      item: string;
      quantidade: number;
      // De qual item comprado esse bônus veio (se algum pacote pendente
      // tiver essa informação) — usado pra aninhar dentro do card de
      // origem, em vez de um card próprio separado.
      origemFichaId?: string;
      origemItem?: string;
    }[] = [];
    fichas.forEach((f) => {
      (OPCOES_SESSAO[f.tipo] ?? []).forEach((item) => {
        const chave = `${f.id}::${item}`;
        const totalSessoes = linhasPorChave.get(chave) ?? 0;
        let quantidade = 0;
        let origemFichaId: string | undefined;
        let origemItem: string | undefined;
        for (const faixa of faixasDePacotes(pacotesDoItem(f.id, item))) {
          const usadosNaFaixa = Math.max(0, Math.min(faixa.fim, totalSessoes) - faixa.inicio);
          if (faixa.pacote.bonus) {
            const restante = faixa.pacote.tamanho - usadosNaFaixa;
            quantidade += restante;
            if (restante > 0 && faixa.pacote.origemFichaId && faixa.pacote.origemItem) {
              origemFichaId = faixa.pacote.origemFichaId;
              origemItem = faixa.pacote.origemItem;
            }
          }
        }
        if (quantidade > 0) {
          lista.push({
            chave,
            fichaId: f.id,
            tipo: f.tipo,
            item,
            quantidade,
            origemFichaId,
            origemItem,
          });
        }
      });
    });
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichas, linhasPorChave, pacotesOverride]);

  // Bônus já usufruídos: usa a mesma segmentação por pacote do histórico
  // (segmentarPorPacote) pra achar, dentro das sessões já registradas de
  // cada item, quais caem num pacote marcado como bônus — com a data de
  // cada uma. Ficam listadas no mesmo card dos bônus pendentes, no lugar do
  // "Check", em vez de sumir só pro histórico geral.
  const bonusRealizados = useMemo(() => {
    const lista: {
      chave: string;
      sessaoId: string;
      token: string;
      observacao: string | null;
      tipo: Tipo;
      item: string;
      data: string;
      confirmado: boolean;
      confirmado_em: string | null;
      origemFichaId?: string;
      origemItem?: string;
    }[] = [];
    fichas.forEach((f) => {
      (OPCOES_SESSAO[f.tipo] ?? []).forEach((item) => {
        const chave = `${f.id}::${item}`;
        const linhas = grupoPorChave.get(chave)?.linhas ?? [];
        const pacotesItem = pacotesDoItem(f.id, item);
        segmentarPorPacote(linhas, pacotesItem).forEach((seg) => {
          if (!seg.bonus) return;
          const pacote = pacotesItem[seg.numero - 1];
          seg.linhas.forEach((l) =>
            lista.push({
              chave: `${chave}::${l.sessaoId}`,
              sessaoId: l.sessaoId,
              token: l.token,
              observacao: l.observacao,
              tipo: f.tipo,
              item,
              data: l.data,
              confirmado: l.confirmado,
              confirmado_em: l.confirmado_em,
              origemFichaId: pacote?.origemFichaId,
              origemItem: pacote?.origemItem,
            }),
          );
        });
      });
    });
    return lista.sort((a, b) => b.data.localeCompare(a.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichas, grupoPorChave, pacotesOverride]);

  // Agrupa os bônus pendentes/realizados que têm origem conhecida pelo
  // card do item comprado (chave `${origemFichaId}::${origemItem}`) — pra
  // exibir aninhados dentro desse card, em vez de um card próprio separado
  // pro item do bônus.
  const bonusAninhadoPorOrigem = useMemo(() => {
    const mapa = new Map<
      string,
      { pendentes: typeof bonusPendentes; realizados: typeof bonusRealizados }
    >();
    const entradaDe = (chaveOrigem: string) => {
      let e = mapa.get(chaveOrigem);
      if (!e) {
        e = { pendentes: [], realizados: [] };
        mapa.set(chaveOrigem, e);
      }
      return e;
    };
    bonusPendentes.forEach((b) => {
      if (!b.origemFichaId || !b.origemItem) return;
      entradaDe(`${b.origemFichaId}::${b.origemItem}`).pendentes.push(b);
    });
    bonusRealizados.forEach((b) => {
      if (!b.origemFichaId || !b.origemItem) return;
      entradaDe(`${b.origemFichaId}::${b.origemItem}`).realizados.push(b);
    });
    return mapa;
  }, [bonusPendentes, bonusRealizados]);

  // Bônus sem origem conhecida (cadastrados antes de existir esse vínculo)
  // não têm em qual card aninhar — são a única coisa que ainda cai no card
  // "🎁 Bônus" avulso, como fallback. Some sozinho conforme esses bônus
  // antigos forem recadastrados (aí passam a ter origem e a aninhar certo).
  const bonusPendentesSemOrigem = useMemo(
    () => bonusPendentes.filter((b) => !b.origemFichaId || !b.origemItem),
    [bonusPendentes],
  );
  const bonusRealizadosSemOrigem = useMemo(
    () => bonusRealizados.filter((b) => !b.origemFichaId || !b.origemItem),
    [bonusRealizados],
  );

  // "Check" de bônus usado: registra a sessão do dia em que a cliente
  // usufruiu (a Marina escolhe a data — não tem agendamento no app, ela
  // marca depois que já aconteceu). Uma data por linha pendente, guardada
  // pela chave do item.
  const [dataBonusPendente, setDataBonusPendente] = useState<Record<string, string>>({});
  const [confirmandoBonusChave, setConfirmandoBonusChave] = useState<string | null>(null);
  const [erroBonusPendente, setErroBonusPendente] = useState<string | null>(null);
  const [removendoBonusChave, setRemovendoBonusChave] = useState<string | null>(null);

  // `subChave` identifica uma unidade específica do bônus (ex.: a 1ª ou a 2ª
  // das 2× Axilas ganhas) — cada uma com sua própria data e seu próprio
  // "Check", já que a cliente pode usufruir delas em dias diferentes.
  const confirmarBonusPendente = async (b: { fichaId: string; item: string }, subChave: string) => {
    const data = dataBonusPendente[subChave] || hojeISO();
    if (
      !window.confirm(
        `Confirma que a cliente usou o brinde de ${b.item} em ${dataBR(data)}? Isso registra a sessão e já abre o WhatsApp com o link de confirmação.`,
      )
    )
      return;
    // Aba aberta em branco aqui, ainda dentro do clique (o window.confirm
    // logo acima é síncrono — não conta como "await" pro navegador) — abrir
    // só depois do await esbarraria no bloqueador de pop-up. A URL entra
    // assim que a sessão terminar de salvar.
    const janela = window.open("", "whatsapp");
    setConfirmandoBonusChave(subChave);
    setErroBonusPendente(null);
    try {
      const nova = await criarSessao(b.fichaId, { data, areas: [b.item], observacao: "" });
      setSessoes((prev) => [nova, ...(prev ?? [])]);
      const url = whatsappDe(nova.token, nova.data);
      if (janela) janela.location.href = url;
      else window.open(url, "whatsapp", "noreferrer");
    } catch (e) {
      janela?.close();
      setErroBonusPendente(e instanceof Error ? e.message : "Erro ao registrar o brinde usado.");
    } finally {
      setConfirmandoBonusChave(null);
    }
  };

  // Remove o bônus pendente mais recente desse item (ex.: o pacote pago que
  // deu origem a ele foi cancelado por engano, ou a promoção não vale mais).
  // Não mexe nas sessões já registradas — só tira o "crédito" de bônus ainda
  // não usado.
  const removerBonus = async (fId: string, item: string, chave: string) => {
    const atuais = pacotesDoItem(fId, item);
    const idx = atuais.map((p) => p.bonus === true).lastIndexOf(true);
    if (idx === -1) return;
    const alvo = atuais[idx];
    if (
      !window.confirm(
        `Remover o brinde de ${alvo.tamanho}× ${item}? Se alguma sessão já foi registrada com ele, ela não é apagada — volta a contar como avulsa.`,
      )
    )
      return;
    setRemovendoBonusChave(chave);
    setErroBonusPendente(null);
    try {
      const nova = atuais.filter((_, i) => i !== idx);
      const merge = { ...(fichaPorId.get(fId)?.pacotes ?? {}), [item]: nova };
      await atualizarFicha(fId, { pacotes: merge });
      setPacotesOverride((prev) => ({ ...prev, [`${fId}::${item}`]: nova }));
    } catch (e) {
      setErroBonusPendente(e instanceof Error ? e.message : "Erro ao remover o brinde.");
    } finally {
      setRemovendoBonusChave(null);
    }
  };

  // Nº de sessões já registradas de cada item do procedimento escolhido no
  // formulário, para mostrar "Axilas · seria a 5ª sessão" antes de salvar.
  const contagemDoProcedimento = useMemo(() => {
    const m = new Map<string, number>();
    sessoesAtivas
      .filter((s) => s.ficha_id === fichaId)
      .forEach((s) => s.areas.forEach((a) => m.set(a, (m.get(a) ?? 0) + 1)));
    return m;
  }, [sessoesAtivas, fichaId]);

  // Itens marcados neste registro que estão "fora de qualquer pacote já
  // definido" — ou porque nunca tiveram pacote (avulsa/1ª sessão), ou
  // porque já completaram todos os pacotes anteriores (ex.: terminou o
  // pacote de 10 e comprou mais 10). Mostra o campo opcional nesses casos.
  const itensSemPacote = itens.filter(
    (item) =>
      !temPacoteEmAberto(
        faixasDePacotes(pacotesDoItem(fichaId, item)),
        contagemDoProcedimento.get(item) ?? 0,
      ),
  );

  // Número que a sessão a ser registrada teria DENTRO do pacote/segmento
  // atual (reinicia em 1 a cada pacote novo ou quando cai nas avulsas),
  // em vez de contar tudo junto desde a 1ª sessão do item.
  const proximaOrdinalLocal = (item: string): number => {
    const totalAtual = contagemDoProcedimento.get(item) ?? 0;
    let indiceAnterior = 0;
    for (const faixa of faixasDePacotes(pacotesDoItem(fichaId, item))) {
      if (totalAtual < faixa.inicio) return totalAtual - indiceAnterior + 1;
      if (totalAtual < faixa.fim) return totalAtual - faixa.inicio + 1;
      indiceAnterior = faixa.fim;
    }
    return totalAtual - indiceAnterior + 1;
  };

  const iniciarEdicaoPacote = (chave: string) => {
    setEditandoPacoteChave(chave);
    setPacoteValor("");
    setBonusForm([]);
    setErroPacote(null);
    setTipoFaltandoAnamnese(null);
  };

  const cancelarEdicaoPacote = () => {
    setEditandoPacoteChave(null);
    setBonusForm([]);
    setErroPacote(null);
    setTipoFaltandoAnamnese(null);
  };

  const adicionarLinhaBonus = () =>
    setBonusForm((prev) => [
      ...prev,
      { chave: crypto.randomUUID(), tipo: "", item: "", quantidade: "1" },
    ]);

  const removerLinhaBonus = (chave: string) =>
    setBonusForm((prev) => prev.filter((b) => b.chave !== chave));

  const atualizarLinhaBonus = (
    chave: string,
    patch: Partial<{ tipo: Tipo | ""; item: string; quantidade: string }>,
  ) => setBonusForm((prev) => prev.map((b) => (b.chave === chave ? { ...b, ...patch } : b)));

  // Mesmo formulário de bônus, mas usado dentro de "Registrar sessão" — ali
  // dá pra declarar pacote de mais de um item ao mesmo tempo, então guarda
  // uma lista de linhas por item pago em vez de uma lista só.
  const adicionarLinhaBonusRegistro = (itemPago: string) =>
    setBonusFormRegistro((prev) => ({
      ...prev,
      [itemPago]: [
        ...(prev[itemPago] ?? []),
        { chave: crypto.randomUUID(), tipo: "", item: "", quantidade: "1" },
      ],
    }));

  const removerLinhaBonusRegistro = (itemPago: string, chave: string) =>
    setBonusFormRegistro((prev) => ({
      ...prev,
      [itemPago]: (prev[itemPago] ?? []).filter((b) => b.chave !== chave),
    }));

  const atualizarLinhaBonusRegistro = (
    itemPago: string,
    chave: string,
    patch: Partial<{ tipo: Tipo | ""; item: string; quantidade: string }>,
  ) =>
    setBonusFormRegistro((prev) => ({
      ...prev,
      [itemPago]: (prev[itemPago] ?? []).map((b) => (b.chave === chave ? { ...b, ...patch } : b)),
    }));

  // Um bônus pode ser de um tipo que a cliente ainda não tem ficha (ex.:
  // laser de brinde pra quem só tem ficha facial). Sem anamnese respondida
  // pra esse tipo não dá pra registrar com segurança — retorna o tipo
  // faltante pra quem chamou bloquear e mostrar o convite de anamnese, em
  // vez de criar a ficha sem nenhuma pergunta de saúde respondida.
  const tipoBonusSemFicha = (linhas: LinhaBonus[]): Tipo | null => {
    const tiposComFicha = new Set(fichas.map((f) => f.tipo));
    const semFicha = linhas
      .map((b) => ({ ...b, qtd: parseInt(b.quantidade, 10) }))
      .find((b) => b.tipo && b.item && b.qtd > 0 && !tiposComFicha.has(b.tipo as Tipo));
    return (semFicha?.tipo as Tipo) ?? null;
  };

  // Um bônus do MESMO item que está sendo editado (ex.: "comprou 10 de
  // Virilha, ganhou +3 de Virilha de brinde") só faz sentido pendurado num
  // pacote pago — ou o que está sendo declarado nesta mesma leva
  // (`pagoTamanho`), ou um que já esteja em andamento pra esse item. Sem
  // isso, vira um pacotinho de bônus solto, sem sessão paga nenhuma por
  // trás — e como não dá pra escolher qual sessão é a "de brinde", o app
  // pegaria a PRÓXIMA sessão registrada pra esse item pra dentro dele, o
  // que já confundiu a Marina uma vez (uma sessão avulsa virou "pacote"
  // sem ela ter escolhido isso). Bônus de OUTRO item não tem esse problema
  // (nunca existia sessão prévia dele pra "engolir" por engano).
  const bonusDoMesmoItemSemPacotePago = (
    fId: string,
    item: string,
    pagoTamanho: number | null,
    linhas: LinhaBonus[],
  ): boolean => {
    if (pagoTamanho) return false;
    const tipoItem = tipoPorFicha.get(fId);
    const temBonusMesmoItem = linhas.some(
      (b) =>
        b.tipo === tipoItem && b.item === item && b.tipo && b.item && parseInt(b.quantidade, 10) > 0,
    );
    if (!temBonusMesmoItem) return false;
    const jaTemPacoteAtivo = temPacoteEmAberto(
      faixasDePacotes(pacotesDoItem(fId, item)),
      linhasPorChave.get(`${fId}::${item}`) ?? 0,
    );
    return !jaTemPacoteAtivo;
  };

  // Salva um pacote pago (opcional) + os bônus anexados a ele numa única
  // leva de PATCHes (uma por ficha afetada — bônus podem ser de fichas
  // diferentes da do pacote pago, ex.: limpeza de pele de brinde numa
  // promoção de laser). `pagoTamanho` nulo serve pra anexar só um bônus a um
  // item que já tem pacote em andamento (a Marina esqueceu de registrar o
  // brinde na hora). Assume que já foi checado com `tipoBonusSemFicha` que
  // nenhum bônus está sem ficha; chamar sem checar arrisca salvar o pacote
  // pago sem o bônus prometido.
  const aplicarPacote = async (
    origem: { fichaId: string; item: string },
    pagoTamanho: number | null,
    bonusLinhas: LinhaBonus[],
  ) => {
    const bonusValidos = bonusLinhas
      .map((b) => ({ ...b, qtd: parseInt(b.quantidade, 10) }))
      .filter((b) => b.tipo && b.item && b.qtd > 0);
    const fichaPorTipo = new Map<Tipo, string>();
    fichas.forEach((f) => {
      if (!fichaPorTipo.has(f.tipo)) fichaPorTipo.set(f.tipo, f.id);
    });

    const merges = new Map<string, Record<string, number | number[] | PacoteItem[]>>();
    const overrides = new Map<string, PacoteItem[]>();
    const mergeDe = (fichaAlvo: string) => {
      let m = merges.get(fichaAlvo);
      if (!m) {
        m = { ...(fichaPorId.get(fichaAlvo)?.pacotes ?? {}) };
        merges.set(fichaAlvo, m);
      }
      return m;
    };
    const adiciona = (fichaAlvo: string, itemAlvo: string, entrada: PacoteItem) => {
      const chave = `${fichaAlvo}::${itemAlvo}`;
      // Sessões já registradas pra esse item, antes deste pacote existir,
      // ficam de fora dele (ver `inicioIndice` em PacoteItem) — é o que
      // impede uma sessão avulsa já feita de virar a 1ª sessão do pacote.
      const inicioIndice = linhasPorChave.get(chave) ?? 0;
      const nova = [
        ...(overrides.get(chave) ?? pacotesDoItem(fichaAlvo, itemAlvo)),
        { ...entrada, inicioIndice },
      ];
      mergeDe(fichaAlvo)[itemAlvo] = nova;
      overrides.set(chave, nova);
    };

    if (pagoTamanho) adiciona(origem.fichaId, origem.item, { tamanho: pagoTamanho });
    for (const b of bonusValidos) {
      adiciona(fichaPorTipo.get(b.tipo as Tipo)!, b.item, {
        tamanho: b.qtd,
        bonus: true,
        origemFichaId: origem.fichaId,
        origemItem: origem.item,
      });
    }

    await Promise.all(
      [...merges.entries()].map(([fichaAlvo, pacotes]) => atualizarFicha(fichaAlvo, { pacotes })),
    );
    setPacotesOverride((prev) => {
      const next = { ...prev };
      overrides.forEach((v, k) => (next[k] = v));
      return next;
    });
  };

  const salvarPacote = async (fId: string, item: string) => {
    const n = parseInt(pacoteValor, 10) || 0;
    const temBonusValido = bonusForm.some(
      (b) => b.tipo && b.item && parseInt(b.quantidade, 10) > 0,
    );
    if (n <= 0 && !temBonusValido) return;

    if (bonusDoMesmoItemSemPacotePago(fId, item, n > 0 ? n : null, bonusForm)) {
      setErroPacote(
        `Brinde do mesmo item (${item}) precisa vir junto com o tamanho do pacote pago — preencha "quantas sessões". Se ela já tem um pacote em andamento nesse item, cancele essa edição e use "+ Adicionar brinde" nele em vez de criar um novo.`,
      );
      return;
    }

    const tipoFaltante = tipoBonusSemFicha(bonusForm);
    if (tipoFaltante) {
      setErroPacote(
        `Essa cliente ainda não tem ficha de ${nomeCurto(tipoFaltante)} — manda a anamnese pra ela preencher antes de registrar esse brinde.`,
      );
      setTipoFaltandoAnamnese(tipoFaltante);
      return;
    }
    setTipoFaltandoAnamnese(null);

    setSalvandoPacote(true);
    setErroPacote(null);
    try {
      await aplicarPacote({ fichaId: fId, item }, n > 0 ? n : null, bonusForm);
      setEditandoPacoteChave(null);
      setBonusForm([]);
    } catch (e) {
      setErroPacote(e instanceof Error ? e.message : "Erro ao salvar o pacote.");
    } finally {
      setSalvandoPacote(false);
    }
  };

  const removerPacote = async (fId: string, item: string, chave: string) => {
    const atuais = pacotesDoItem(fId, item);
    const ultimo = atuais[atuais.length - 1];
    if (ultimo === undefined) return;
    if (
      !window.confirm(
        `Cancelar o pacote de ${ultimo.tamanho} sessões? As sessões que já foram feitas nele não são apagadas — voltam a contar como avulsas.`,
      )
    )
      return;
    setRemovendoPacoteChave(chave);
    setErroPacote(null);
    try {
      const nova = atuais.slice(0, -1);
      const merge = { ...(fichaPorId.get(fId)?.pacotes ?? {}), [item]: nova };
      await atualizarFicha(fId, { pacotes: merge });
      setPacotesOverride((prev) => ({ ...prev, [`${fId}::${item}`]: nova }));
    } catch (e) {
      setErroPacote(e instanceof Error ? e.message : "Erro ao cancelar o pacote.");
    } finally {
      setRemovendoPacoteChave(null);
    }
  };

  const iniciarEdicaoTamanho = (chave: string, tamanhoAtual: number) => {
    setEditandoTamanhoChave(chave);
    setTamanhoValor(String(tamanhoAtual));
    setErroTamanho(null);
  };

  const cancelarEdicaoTamanho = () => {
    setEditandoTamanhoChave(null);
    setErroTamanho(null);
  };

  // Corrige o número de sessões do último pacote de um item, sem mexer nas
  // sessões já registradas nele. `sessoesJaFeitas` vem da segmentação atual
  // (ver segmentarPorPacote) — bloqueia reduzir abaixo do que já foi feito,
  // pra não deixar sessão confirmada "sobrando" fora de qualquer pacote.
  const salvarTamanhoPacote = async (
    fId: string,
    item: string,
    chave: string,
    sessoesJaFeitas: number,
  ) => {
    const n = parseInt(tamanhoValor, 10);
    if (!n || n < 1) {
      setErroTamanho("Informe um número válido de sessões.");
      return;
    }
    if (n < sessoesJaFeitas) {
      setErroTamanho(
        `Esse pacote já tem ${sessoesJaFeitas} sessões registradas — não é possível reduzir para menos que isso.`,
      );
      return;
    }
    setSalvandoTamanho(true);
    setErroTamanho(null);
    try {
      const atuais = pacotesDoItem(fId, item);
      const ultimo = atuais[atuais.length - 1];
      if (ultimo === undefined) return;
      const nova = [...atuais.slice(0, -1), { ...ultimo, tamanho: n }];
      const merge = { ...(fichaPorId.get(fId)?.pacotes ?? {}), [item]: nova };
      await atualizarFicha(fId, { pacotes: merge });
      setPacotesOverride((prev) => ({ ...prev, [`${fId}::${item}`]: nova }));
      setEditandoTamanhoChave(null);
    } catch (e) {
      setErroTamanho(e instanceof Error ? e.message : "Erro ao salvar o pacote.");
    } finally {
      setSalvandoTamanho(false);
    }
  };

  // Gera (ou atualiza) o relatório público desse pacote e já abre direto no
  // WhatsApp — sem card intermediário pra clicar de novo. A aba é aberta em
  // branco aqui, ainda de forma síncrona dentro do clique (senão o
  // navegador bloqueia o pop-up, já que abrir só depois do await não conta
  // mais como resposta direta a um clique); a URL entra assim que o
  // relatório terminar de salvar. Se esse pacote deu origem a brinde(s) de
  // outro item (ver bonusAninhadoPorOrigem), eles entram junto no
  // relatório, com o dia em que foram realizados.
  const enviarRelatorio = async (g: GrupoItem, seg: Segmento) => {
    if (seg.pacoteTotal === undefined) return;
    const chave = `${g.chave}::${seg.numero}`;
    const janela = window.open("", "whatsapp");
    setEnviandoRelatorioChave(chave);
    setErroRelatorioChave((prev) => ({ ...prev, [chave]: "" }));
    try {
      const brindes = (bonusAninhadoPorOrigem.get(g.chave)?.realizados ?? []).map((b) => ({
        item: b.item,
        data: b.data,
        confirmado: b.confirmado,
        confirmado_em: b.confirmado_em,
      }));
      const token = await enviarRelatorioPacote({
        fichaId: g.fichaId,
        item: g.item,
        pacoteNumero: seg.numero,
        clienteNome: nomeCliente,
        pacoteTotal: seg.pacoteTotal,
        concluido: seg.completo,
        sessoes: seg.linhas.map((l) => ({
          data: l.data,
          confirmado: l.confirmado,
          confirmado_em: l.confirmado_em,
        })),
        brindes,
      });
      const url = linkWhatsappRelatorio({
        origin: PAINEL_URL,
        token,
        telefone: telefoneCliente,
        nomeCliente,
        item: g.item,
      });
      if (janela) janela.location.href = url;
      else window.open(url, "whatsapp", "noreferrer");
    } catch (e) {
      janela?.close();
      setErroRelatorioChave((prev) => ({
        ...prev,
        [chave]: e instanceof Error ? e.message : "Não foi possível gerar o relatório.",
      }));
    } finally {
      setEnviandoRelatorioChave(null);
    }
  };

  return (
    <div className="rounded-2xl border border-painel-border bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h3 className="font-display text-2xl text-painel-title">Histórico de sessões</h3>
        {!abrindo && (
          <button
            type="button"
            onClick={abrirForm}
            className="inline-flex items-center gap-1.5 rounded-full bg-painel-primary text-white px-4 py-2 text-sm font-medium hover:bg-painel-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Registrar sessão
          </button>
        )}
      </div>
      <p className="text-sm text-painel-muted mb-5">
        Registre o atendimento e envie o link para a cliente confirmar.
      </p>

      {(bonusPendentesSemOrigem.length > 0 || bonusRealizadosSemOrigem.length > 0) && (
        <div className="mb-5 rounded-xl border border-painel-gold/40 bg-painel-gold/10 p-3.5">
          <p className="text-xs font-medium text-painel-gold mb-1.5">🎁 Brinde</p>
          {bonusPendentesSemOrigem.length > 0 && (
            <p className="text-[11px] text-painel-muted mb-2">
              Marque o check no dia em que a cliente usufruir e envie o link de confirmação. A
              quantidade abaixo já desconta o que ela usou.
            </p>
          )}
          <ul className="space-y-1.5">
            {bonusPendentesSemOrigem.map((b) => (
              <li key={b.chave} className="flex flex-col gap-1.5 text-xs text-painel-chip-text">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex-1 min-w-[140px]">
                    {b.quantidade}× {b.item}
                    {multi ? ` — ${nomeCurto(b.tipo)}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => removerBonus(b.fichaId, b.item, b.chave)}
                    disabled={removendoBonusChave === b.chave}
                    title="Remover brinde"
                    className="text-painel-muted/60 hover:text-painel-alert-text transition-colors disabled:opacity-40"
                  >
                    {removendoBonusChave === b.chave ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                {Array.from({ length: b.quantidade }).map((_, i) => {
                  const subChave = `${b.chave}::${i}`;
                  return (
                    <div key={subChave} className="flex items-center gap-2 pl-1">
                      <input
                        type="date"
                        value={dataBonusPendente[subChave] ?? hojeISO()}
                        onChange={(e) =>
                          setDataBonusPendente((prev) => ({ ...prev, [subChave]: e.target.value }))
                        }
                        className="w-[132px] shrink-0 rounded-lg border border-painel-border bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-painel-primary/40"
                      />
                      <button
                        type="button"
                        onClick={() => confirmarBonusPendente(b, subChave)}
                        disabled={confirmandoBonusChave === subChave}
                        title="Marcar como usufruído nessa data e enviar link de confirmação"
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-painel-gold text-white px-2.5 py-1 text-xs font-medium hover:opacity-90 transition-colors disabled:opacity-40"
                      >
                        {confirmandoBonusChave === subChave ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Check
                      </button>
                    </div>
                  );
                })}
              </li>
            ))}
            {bonusRealizadosSemOrigem.map((b) => (
              <LinhaSessaoView
                key={b.chave}
                id={b.sessaoId}
                texto={`Brinde ${b.item} — realizado em ${dataBR(b.data)} (${b.confirmado ? "confirmado" : "aguardando confirmação"})`}
                data={b.data}
                observacao={b.observacao}
                confirmado={b.confirmado}
                confirmadoEm={b.confirmado_em}
                copiado={copiadoId === b.sessaoId}
                onCopiar={() => copiar(b.sessaoId, b.token)}
                arquivar={arquivarState}
                edicao={edicaoSessao}
                envio={envioSessao}
                marcarConfirmada={marcarConfirmadaState}
              />
            ))}
          </ul>
          {erroBonusPendente && (
            <p className="mt-2 text-xs text-painel-alert-text">{erroBonusPendente}</p>
          )}
        </div>
      )}

      {erro && <p className="text-sm text-painel-alert-text mb-4">{erro}</p>}

      {/* Formulário de nova sessão */}
      {abrindo && (
        <div className="rounded-xl border border-painel-border bg-painel-badge-bg/40 p-4 sm:p-5 mb-6">
          {multi && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-painel-muted mb-2">
                Procedimento
              </label>
              <div className="flex flex-wrap gap-2">
                {fichas.map((f) => {
                  const sel = fichaId === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setFichaId(f.id);
                        setItens([]);
                      }}
                      className={[
                        "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                        sel
                          ? "bg-painel-primary border-painel-primary text-white font-medium"
                          : "bg-white border-painel-border text-painel-chip-text hover:border-painel-primary/40",
                      ].join(" ")}
                    >
                      {FICHAS[f.tipo]?.emoji ?? ""} {nomeCurto(f.tipo)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-medium text-painel-muted mb-1.5">
              Data do atendimento
            </label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="rounded-lg border border-painel-border bg-painel-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-painel-primary/40"
            />
          </div>

          {opcoes.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-painel-muted mb-2">
                {rotuloItensSessao(tipoAtual)}
              </label>
              <div className="flex flex-wrap gap-2">
                {opcoes.map((a) => {
                  const sel = itens.includes(a);
                  const proximaOrdinal = proximaOrdinalLocal(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggleItem(a)}
                      className={[
                        "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                        sel
                          ? "bg-painel-primary border-painel-primary text-white font-medium"
                          : "bg-white border-painel-border text-painel-chip-text hover:border-painel-primary/40",
                      ].join(" ")}
                    >
                      {a}
                      <span className="ml-1.5 text-xs opacity-60">· {proximaOrdinal}ª</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {itensSemPacote.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-painel-muted mb-1">
                Pacote comprado (opcional)
              </label>
              <p className="text-xs text-painel-muted/80 mb-2">
                Deixe em branco se for sessão avulsa. Pode informar aqui ou mais tarde, quando ela
                decidir comprar o pacote.
              </p>
              <div className="space-y-3">
                {itensSemPacote.map((item) => (
                  <div key={item}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-painel-chip-text flex-1 truncate">{item}</span>
                      <input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={pacotesForm[item] ?? ""}
                        onChange={(e) =>
                          setPacotesForm((prev) => ({ ...prev, [item]: e.target.value }))
                        }
                        placeholder="nº de sessões"
                        className="w-32 rounded-lg border border-painel-border bg-painel-bg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-painel-primary/40"
                      />
                    </div>
                    {pacotesForm[item]?.trim() && (
                      <div className="mt-1.5 pl-1">
                        {(bonusFormRegistro[item] ?? []).map((b) => (
                          <div key={b.chave} className="flex flex-wrap items-center gap-1.5 mb-1.5">
                            <select
                              value={b.tipo && b.item ? `${b.tipo}::${b.item}` : ""}
                              onChange={(e) => {
                                const [tipoAlvo, ...resto] = e.target.value.split("::");
                                atualizarLinhaBonusRegistro(item, b.chave, {
                                  tipo: (tipoAlvo as Tipo) || "",
                                  item: resto.join("::"),
                                });
                              }}
                              className="rounded-lg border border-painel-border bg-painel-bg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-painel-primary/40"
                            >
                              <option value="">Brinde da promoção (opcional)</option>
                              {opcoesBonus.map((o) => (
                                <option key={o.valor} value={o.valor}>
                                  {o.rotulo}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={1}
                              inputMode="numeric"
                              value={b.quantidade}
                              onChange={(e) =>
                                atualizarLinhaBonusRegistro(item, b.chave, {
                                  quantidade: e.target.value,
                                })
                              }
                              placeholder="qtd"
                              className="w-16 rounded-lg border border-painel-border bg-painel-bg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-painel-primary/40"
                            />
                            <button
                              type="button"
                              onClick={() => removerLinhaBonusRegistro(item, b.chave)}
                              title="Remover brinde"
                              className="text-painel-muted/60 hover:text-painel-alert-text transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => adicionarLinhaBonusRegistro(item)}
                          className="text-xs font-medium text-painel-primary"
                        >
                          + Adicionar brinde
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {tipoFaltandoAnamneseRegistro && (
                <div className="mt-3">
                  <EnviarFicha
                    nomeInicial={nomeCliente}
                    celularInicial={telefoneCliente}
                    tipoInicial={tipoFaltandoAnamneseRegistro}
                    convitePadrao
                    onFechar={() => setTipoFaltandoAnamneseRegistro(null)}
                  />
                </div>
              )}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-medium text-painel-muted mb-1.5">Observação</label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="O que foi realizado, observações..."
              className="w-full rounded-xl border border-painel-border bg-painel-bg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-painel-primary/40"
            />
          </div>

          <label className="mb-4 flex items-start gap-2 text-sm text-painel-chip-text">
            <input
              type="checkbox"
              checked={jaConfirmada}
              onChange={(e) => setJaConfirmada(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-painel-border accent-painel-primary"
            />
            <span>
              Sessão antiga, já assinada no papel — marcar como confirmada direto, sem mandar link
              de confirmação.
            </span>
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={registrar}
              disabled={salvando || !podeSalvar}
              className="inline-flex items-center gap-2 rounded-full bg-painel-primary text-white px-5 py-2.5 text-sm font-medium hover:bg-painel-primary/90 transition-colors disabled:opacity-40"
            >
              {salvando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Salvar sessão
            </button>
            <button
              type="button"
              onClick={() => setAbrindo(false)}
              disabled={salvando}
              className="rounded-full border border-painel-border px-5 py-2.5 text-sm font-medium text-painel-chip-text hover:border-painel-primary/40 transition-colors disabled:opacity-40"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de sessões */}
      {sessoes === null && !erro && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-painel-muted" />
        </div>
      )}

      {sessoes && sessoesAtivas.length === 0 && !abrindo && (
        <p className="text-sm text-painel-muted py-2">Nenhuma sessão registrada ainda.</p>
      )}

      {/* Confirmação em lote: dias em que a cliente fez vários
          procedimentos e a Marina pode mandar 1 link só, em vez de N. */}
      {diasComVariasPendentes.length > 0 && (
        <div className="mb-3 rounded-2xl border border-painel-border bg-painel-badge-bg/40 p-4">
          <div className="flex items-start gap-2 mb-2.5">
            <Send className="h-4 w-4 mt-0.5 text-painel-primary shrink-0" />
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-painel-title">
                Confirmar vários procedimentos num link só
              </h4>
              <p className="text-xs text-painel-muted mt-0.5">
                Se a cliente fez mais de um procedimento no mesmo dia, envie um link único
                em vez de vários pelo WhatsApp.
              </p>
            </div>
          </div>

          <ul className="flex flex-col gap-2">
            {diasComVariasPendentes.map((dia) => {
              const aberto = loteData === dia.data;
              return (
                <li
                  key={dia.data}
                  className="rounded-xl border border-painel-border bg-white/70 p-3"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-sm text-painel-chip-text">
                      <span className="font-medium">{dataBR(dia.data)}</span>
                      <span className="text-painel-muted-2 ml-1.5">
                        · {dia.sessoes.length} sessões pendentes
                      </span>
                    </div>
                    {!aberto ? (
                      <button
                        type="button"
                        onClick={() => abrirLote(dia.data)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-painel-primary text-white px-3.5 py-1.5 text-xs font-medium hover:bg-painel-primary/90 transition-colors"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Enviar confirmação do dia
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={fecharLote}
                        className="rounded-full border border-painel-border px-3 py-1.5 text-xs text-painel-chip-text hover:border-painel-primary/40 transition-colors"
                      >
                        Fechar
                      </button>
                    )}
                  </div>

                  {aberto && (
                    <div className="mt-3 border-t border-painel-border pt-3">
                      {loteLinkPronto ? (
                        <div className="flex flex-col gap-2">
                          <p className="text-xs text-painel-muted">
                            Link pronto — clique para abrir o WhatsApp com a mensagem
                            preenchida:
                          </p>
                          <a
                            href={loteLinkPronto}
                            target="whatsapp"
                            rel="noreferrer"
                            onClick={fecharLote}
                            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-painel-primary text-white px-4 py-2 text-xs font-medium hover:bg-painel-primary/90 transition-colors"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            Abrir WhatsApp
                          </a>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-painel-muted mb-2">
                            Selecione quais sessões entram no link:
                          </p>
                          <ul className="flex flex-col gap-1.5 mb-3">
                            {dia.sessoes.map((s) => {
                              const marcada = loteSelecionadas.has(s.id);
                              const rotulo =
                                s.areas.length > 0
                                  ? s.areas.join(", ")
                                  : (s.observacao?.trim() || "Sessão sem detalhes");
                              return (
                                <li key={s.id}>
                                  <label className="flex items-start gap-2 text-xs text-painel-chip-text cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={marcada}
                                      onChange={() => toggleLoteSessao(s.id)}
                                      className="mt-0.5 accent-painel-primary"
                                    />
                                    <span>{rotulo}</span>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                          {loteErro && (
                            <p className="text-xs text-painel-alert-text mb-2">{loteErro}</p>
                          )}
                          <button
                            type="button"
                            onClick={gerarLinkLote}
                            disabled={loteSalvando || loteSelecionadas.size < 2}
                            className="inline-flex items-center gap-1.5 rounded-full bg-painel-primary text-white px-3.5 py-1.5 text-xs font-medium hover:bg-painel-primary/90 transition-colors disabled:opacity-40"
                          >
                            {loteSalvando ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Gerar link único ({loteSelecionadas.size})
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}


      <div className="flex flex-col gap-3">
        {grupos.map((g) => {
          const pacotes = pacotesDoItem(g.fichaId, g.item);
          const segmentos = segmentarPorPacote(g.linhas, pacotes);
          // Segmento do último pacote de fato — não é necessariamente o
          // último segmento da lista, nem tem numero igual a
          // pacotes.length: sessões avulsas antes, entre, ou depois dos
          // pacotes viram segmentos próprios e empurram a numeração.
          const ultimoSegmentoPacote = [...segmentos]
            .reverse()
            .find((s) => s.pacoteTotal !== undefined);
          // Sessões já registradas no último pacote (usado pra não deixar
          // reduzir o tamanho dele abaixo do que já foi feito, ver
          // salvarTamanhoPacote).
          const sessoesNoUltimoPacote = ultimoSegmentoPacote?.linhas.length ?? 0;
          // Sem pacote em aberto pra esse item — ou nunca teve pacote, ou já
          // concluiu todos os anteriores. É quando faz sentido oferecer
          // "fechar pacote" (as sessões avulsas já feitas continuam de fora,
          // num card separado — o pacote só passa a contar a partir de agora).
          const semPacoteAtivo = !temPacoteEmAberto(faixasDePacotes(pacotes), g.linhas.length);

          // Item inteiro é bônus de outro item comprado (todo pacote dele
          // tem origem conhecida, sem nenhuma sessão avulsa por fora) — não
          // tem card próprio aqui: aparece aninhado dentro do card de
          // origem (ver bonusAninhadoPorOrigem), pra não duplicar.
          const totalmenteBonusAninhado =
            pacotes.length > 0 &&
            pacotes.every((p) => p.bonus && p.origemFichaId && p.origemItem) &&
            !segmentos.some((s) => s.pacoteTotal === undefined);
          if (totalmenteBonusAninhado) return null;

          const bonusAninhado = bonusAninhadoPorOrigem.get(g.chave);

          return (
            <div
              key={g.chave}
              className="rounded-2xl border border-painel-border bg-painel-badge-bg/30 p-4"
            >
              <div className="flex items-baseline justify-between gap-2 mb-2.5">
                <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                  <h4 className="text-lg font-semibold text-painel-title truncate">{g.item}</h4>
                  {multi && (
                    <span className="text-xs text-painel-muted-2 shrink-0">
                      {FICHAS[g.tipo]?.emoji ?? ""} {nomeCurto(g.tipo)}
                    </span>
                  )}
                </div>
                {pacotes.length === 0 && (
                  <span className="text-xs text-painel-muted-2 shrink-0 tabular-nums">
                    {g.linhas.length} {g.linhas.length === 1 ? "sessão" : "sessões"}
                  </span>
                )}
              </div>

              {editandoPacoteChave === g.chave && (
                <div className="flex flex-col gap-3 mb-3 rounded-lg border border-painel-border bg-white p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-painel-muted">
                      {pacotes.length === 0
                        ? "Pacote de quantas sessões? (as sessões avulsas já feitas continuam avulsas, num card separado)"
                        : "Novo pacote de quantas sessões? (deixe em branco pra só adicionar um brinde)"}
                    </label>
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      autoFocus
                      value={pacoteValor}
                      onChange={(e) => setPacoteValor(e.target.value)}
                      placeholder="nº de sessões"
                      className="w-28 rounded-lg border border-painel-border bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-painel-primary/40"
                    />
                  </div>

                  <div>
                    <p className="text-xs text-painel-muted mb-1.5">
                      Brinde da promoção (opcional) — sessões extras ou de outro procedimento, dadas
                      de graça
                    </p>
                    {bonusForm.length > 0 && (
                      <div className="space-y-1.5 mb-1.5">
                        {bonusForm.map((b) => (
                          <div key={b.chave} className="flex flex-wrap items-center gap-1.5">
                            <select
                              value={b.tipo && b.item ? `${b.tipo}::${b.item}` : ""}
                              onChange={(e) => {
                                const [tipoAlvo, ...resto] = e.target.value.split("::");
                                atualizarLinhaBonus(b.chave, {
                                  tipo: (tipoAlvo as Tipo) || "",
                                  item: resto.join("::"),
                                });
                              }}
                              className="rounded-lg border border-painel-border bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-painel-primary/40"
                            >
                              <option value="">Selecione o procedimento</option>
                              {opcoesBonus.map((o) => (
                                <option key={o.valor} value={o.valor}>
                                  {o.rotulo}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={1}
                              inputMode="numeric"
                              value={b.quantidade}
                              onChange={(e) =>
                                atualizarLinhaBonus(b.chave, { quantidade: e.target.value })
                              }
                              placeholder="qtd"
                              className="w-16 rounded-lg border border-painel-border bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-painel-primary/40"
                            />
                            <button
                              type="button"
                              onClick={() => removerLinhaBonus(b.chave)}
                              title="Remover brinde"
                              className="text-painel-muted/60 hover:text-painel-alert-text transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={adicionarLinhaBonus}
                      className="text-xs font-medium text-painel-primary"
                    >
                      + Adicionar brinde
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => salvarPacote(g.fichaId, g.item)}
                      disabled={
                        salvandoPacote ||
                        (!pacoteValor.trim() &&
                          !bonusForm.some(
                            (b) => b.tipo && b.item && parseInt(b.quantidade, 10) > 0,
                          ))
                      }
                      className="rounded-full bg-painel-primary text-white px-3.5 py-1.5 text-xs font-medium hover:bg-painel-primary/90 transition-colors disabled:opacity-40"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={cancelarEdicaoPacote}
                      disabled={salvandoPacote}
                      className="rounded-full border border-painel-border px-3.5 py-1.5 text-xs font-medium text-painel-chip-text hover:border-painel-primary/40 transition-colors disabled:opacity-40"
                    >
                      Cancelar
                    </button>
                  </div>
                  {erroPacote && <p className="text-xs text-painel-alert-text">{erroPacote}</p>}
                  {tipoFaltandoAnamnese && (
                    <EnviarFicha
                      nomeInicial={nomeCliente}
                      celularInicial={telefoneCliente}
                      tipoInicial={tipoFaltandoAnamnese}
                      convitePadrao
                      onFechar={() => setTipoFaltandoAnamnese(null)}
                    />
                  )}
                </div>
              )}

              <div className="space-y-3">
                {segmentos.map((seg) => {
                  const chaveSeg = `${g.chave}::${seg.numero}`;
                  // Só colapsa sozinho quando o pacote está completo E todas as
                  // sessões já confirmadas — senão o botão de WhatsApp de
                  // confirmação fica escondido atrás de "Detalhes" sem a Marina
                  // perceber (ela só vê o "Enviar Relatório", que fica sempre à mostra).
                  const temPendente = seg.linhas.some((l) => !l.confirmado);
                  const aberto = expandidos[chaveSeg] ?? (!seg.completo || temPendente);
                  // Mais de um segmento (ex.: sessão avulsa + pacote comprado
                  // depois) = a sessão avulsa vira um card próprio, claro,
                  // bem separado do card escuro do pacote (ver abaixo) — uma
                  // sessão avulsa nunca deve parecer "parte" do pacote.
                  const classeCardAvulsa =
                    segmentos.length > 1
                      ? "rounded-xl border border-painel-border bg-white p-3"
                      : "";

                  // Segmento sem pacote definido: sessões avulsas.
                  if (seg.pacoteTotal === undefined) {
                    return (
                      <div key={chaveSeg} className={classeCardAvulsa}>
                        {pacotes.length > 0 && (
                          <p className="text-xs text-painel-muted mb-1">Sessões avulsas</p>
                        )}
                        <ul className="space-y-1">
                          {/* Ordinal calculado na ordem cronológica (idx), mas
                              exibido com a mais recente no topo (reverse). */}
                          {seg.linhas
                            .map((l, idx) => ({ l, ordinal: idx + 1 }))
                            .reverse()
                            .map(({ l, ordinal }) => (
                              <LinhaSessaoView
                                key={l.sessaoId}
                                id={l.sessaoId}
                                texto={`${dataBR(l.data)}: ${ordinal}ª sessão (${l.confirmado ? "confirmado" : "aguardando confirmação"})`}
                                data={l.data}
                                observacao={l.observacao}
                                confirmado={l.confirmado}
                                confirmadoEm={l.confirmado_em}
                                copiado={copiadoId === l.sessaoId}
                                onCopiar={() => copiar(l.sessaoId, l.token)}
                                arquivar={arquivarState}
                                edicao={edicaoSessao}
                                envio={envioSessao}
                                marcarConfirmada={marcarConfirmadaState}
                              />
                            ))}
                        </ul>
                      </div>
                    );
                  }

                  // Segmento de um pacote comprado: mesmo fundo escuro do
                  // cabeçalho da cliente (bg-painel-hero-bg), texto bege/lavanda
                  // — deixa claro, de longe, que é um pacote pago (nunca se
                  // confunde com sessões avulsas). Colapsa quando concluído.
                  const pct = Math.min(100, (seg.linhas.length / seg.pacoteTotal) * 100);
                  // Guardado numa const própria (fora do fechamento do botão
                  // "Editar" abaixo) — dentro de uma closure o TS não mantém o
                  // estreitamento de `seg.pacoteTotal` para `number`.
                  const pacoteTotalSeg = seg.pacoteTotal;
                  return (
                    <div
                      key={chaveSeg}
                      className="relative overflow-hidden rounded-xl border border-white/10 bg-painel-hero-bg p-3.5 shadow-sm"
                    >
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0"
                        style={{
                          background:
                            "radial-gradient(circle at 92% 0%, rgba(179,146,76,.4), transparent 50%), radial-gradient(circle at 4% 100%, rgba(154,111,176,.5), transparent 55%)",
                        }}
                      />
                      <div className="relative flex items-start gap-3 mb-2">
                        <div
                          className="relative h-10 w-10 shrink-0 rounded-full"
                          style={{
                            background: `conic-gradient(var(--painel-lilac-soft) ${pct * 3.6}deg, rgba(255,255,255,0.15) ${pct * 3.6}deg 360deg)`,
                          }}
                        >
                          <div className="absolute inset-[3px] flex items-center justify-center rounded-full bg-painel-hero-bg">
                            <span className="text-[10px] font-semibold text-painel-gold-soft">
                              {seg.linhas.length}/{seg.pacoteTotal}
                            </span>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandidos((prev) => ({ ...prev, [chaveSeg]: !aberto }))
                            }
                            className="flex flex-wrap items-center gap-1.5 text-left"
                          >
                            {aberto ? (
                              <ChevronDown className="h-3.5 w-3.5 text-painel-lilac-soft/70 shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-painel-lilac-soft/70 shrink-0" />
                            )}
                            <span
                              className={`text-xs ${seg.completo ? "text-painel-gold-soft font-medium" : "text-painel-lilac-soft"}`}
                            >
                              Pacote {seg.numero}
                              {seg.completo ? " concluído" : ""}
                            </span>
                            {seg.bonus && (
                              <span className="rounded-full bg-white/10 text-painel-gold-soft px-2 py-0.5 text-[10px] font-medium">
                                🎁 Brinde
                              </span>
                            )}
                            <span className="text-xs text-painel-lilac-soft underline underline-offset-2">
                              {aberto ? "Ocultar" : "Detalhes"}
                            </span>
                          </button>
                          <span className="text-xs text-painel-lilac-soft/70">
                            {seg.linhas.length} de {seg.pacoteTotal} sessões
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => enviarRelatorio(g, seg)}
                          disabled={enviandoRelatorioChave === chaveSeg || temPendente}
                          title={
                            temPendente
                              ? "Relatório disponível só depois que a cliente confirmar as sessões pelo WhatsApp"
                              : "Gerar link do relatório desse pacote e enviar por WhatsApp"
                          }
                          aria-label="Enviar Relatório"
                          className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/10 text-painel-lilac-soft px-2.5 py-1.5 sm:py-1 text-[11px] font-medium hover:bg-white/15 transition-colors disabled:opacity-40"
                        >
                          {enviandoRelatorioChave === chaveSeg ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                          <span className="hidden sm:inline">Enviar Relatório</span>
                        </button>
                        {seg === ultimoSegmentoPacote && (
                          <button
                            type="button"
                            onClick={() => iniciarEdicaoTamanho(g.chave, pacoteTotalSeg)}
                            title="Corrigir o número de sessões deste pacote"
                            aria-label="Editar"
                            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/10 text-painel-lilac-soft px-2.5 py-1.5 sm:py-1 text-[11px] font-medium hover:bg-white/15 transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                            <span className="hidden sm:inline">Editar</span>
                          </button>
                        )}
                      </div>
                      {editandoTamanhoChave === g.chave && seg === ultimoSegmentoPacote && (
                        <div className="relative flex flex-col gap-3 mb-2 rounded-lg border border-painel-border bg-white p-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="text-xs text-painel-muted">
                              Corrigir este pacote para quantas sessões?
                            </label>
                            <input
                              type="number"
                              min={1}
                              inputMode="numeric"
                              autoFocus
                              value={tamanhoValor}
                              onChange={(e) => setTamanhoValor(e.target.value)}
                              placeholder="nº de sessões"
                              className="w-28 rounded-lg border border-painel-border bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-painel-primary/40"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                salvarTamanhoPacote(
                                  g.fichaId,
                                  g.item,
                                  g.chave,
                                  sessoesNoUltimoPacote,
                                )
                              }
                              disabled={salvandoTamanho || !tamanhoValor.trim()}
                              className="rounded-full bg-painel-primary text-white px-3.5 py-1.5 text-xs font-medium hover:bg-painel-primary/90 transition-colors disabled:opacity-40"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={cancelarEdicaoTamanho}
                              disabled={salvandoTamanho}
                              className="rounded-full border border-painel-border px-3.5 py-1.5 text-xs font-medium text-painel-chip-text hover:border-painel-primary/40 transition-colors disabled:opacity-40"
                            >
                              Cancelar
                            </button>
                          </div>
                          {erroTamanho && (
                            <p className="text-xs text-painel-alert-text">{erroTamanho}</p>
                          )}
                        </div>
                      )}
                      {temPendente ? (
                        <p className="relative text-[11px] text-painel-lilac-soft/70 mb-2">
                          Relatório disponível após a cliente confirmar{" "}
                          {seg.linhas.length > 1 ? "todas as sessões" : "a sessão"} pelo WhatsApp.
                        </p>
                      ) : (
                        erroRelatorioChave[chaveSeg] && (
                          <p className="relative text-[11px] text-painel-alert-text mb-2">
                            {erroRelatorioChave[chaveSeg]}
                          </p>
                        )
                      )}
                      {aberto && (
                        <ul className="relative space-y-1">
                          {seg.linhas
                            .map((l, idx) => ({ l, ordinal: idx + 1 }))
                            .reverse()
                            .map(({ l, ordinal }) => (
                              <LinhaSessaoView
                                key={l.sessaoId}
                                id={l.sessaoId}
                                texto={`${dataBR(l.data)}: ${ordinal}ª sessão (${l.confirmado ? "confirmado" : "aguardando confirmação"})`}
                                data={l.data}
                                observacao={l.observacao}
                                confirmado={l.confirmado}
                                confirmadoEm={l.confirmado_em}
                                copiado={copiadoId === l.sessaoId}
                                escuro
                                onCopiar={() => copiar(l.sessaoId, l.token)}
                                arquivar={arquivarState}
                                edicao={edicaoSessao}
                                envio={envioSessao}
                                marcarConfirmada={marcarConfirmadaState}
                              />
                            ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>

              {bonusAninhado &&
                (bonusAninhado.pendentes.length > 0 || bonusAninhado.realizados.length > 0) && (
                  <div className="mt-3 pt-2.5 border-t border-painel-border/70 space-y-1.5">
                    {bonusAninhado.realizados.length > 0 && (
                      <ul className="space-y-1">
                        {bonusAninhado.realizados.map((b) => (
                          <LinhaSessaoView
                            key={b.chave}
                            id={b.sessaoId}
                            texto={`🎁 Brinde: ${b.item} — realizado em ${dataBR(b.data)} (${b.confirmado ? "confirmado" : "aguardando confirmação"})`}
                            data={b.data}
                            observacao={b.observacao}
                            confirmado={b.confirmado}
                            confirmadoEm={b.confirmado_em}
                            copiado={copiadoId === b.sessaoId}
                            onCopiar={() => copiar(b.sessaoId, b.token)}
                            arquivar={arquivarState}
                            edicao={edicaoSessao}
                            envio={envioSessao}
                            marcarConfirmada={marcarConfirmadaState}
                          />
                        ))}
                      </ul>
                    )}
                    {bonusAninhado.pendentes.map((b) => (
                      <div key={b.chave} className="flex flex-col gap-1.5 text-xs text-painel-gold">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex-1 min-w-[140px]">
                            🎁 Brinde: {b.quantidade}× {b.item}
                            {multi ? ` — ${nomeCurto(b.tipo)}` : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => removerBonus(b.fichaId, b.item, b.chave)}
                            disabled={removendoBonusChave === b.chave}
                            title="Remover brinde"
                            className="text-painel-gold/70 hover:text-painel-alert-text transition-colors disabled:opacity-40"
                          >
                            {removendoBonusChave === b.chave ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        {Array.from({ length: b.quantidade }).map((_, i) => {
                          const subChave = `${b.chave}::${i}`;
                          return (
                            <div key={subChave} className="flex items-center gap-2 pl-1">
                              <input
                                type="date"
                                value={dataBonusPendente[subChave] ?? hojeISO()}
                                onChange={(e) =>
                                  setDataBonusPendente((prev) => ({
                                    ...prev,
                                    [subChave]: e.target.value,
                                  }))
                                }
                                className="w-[132px] shrink-0 rounded-lg border border-painel-border bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-painel-primary/40"
                              />
                              <button
                                type="button"
                                onClick={() => confirmarBonusPendente(b, subChave)}
                                disabled={confirmandoBonusChave === subChave}
                                title="Marcar como usufruído nessa data e enviar link de confirmação"
                                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-painel-gold text-white px-2.5 py-1 text-xs font-medium hover:opacity-90 transition-colors disabled:opacity-40"
                              >
                                {confirmandoBonusChave === subChave ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                                Check
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    {bonusAninhado.pendentes.length > 0 && erroBonusPendente && (
                      <p className="text-xs text-painel-alert-text">{erroBonusPendente}</p>
                    )}
                  </div>
                )}

              {(semPacoteAtivo || pacotes.length > 0) &&
                editandoPacoteChave !== g.chave &&
                editandoTamanhoChave !== g.chave && (
                  <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-painel-border/70">
                    {semPacoteAtivo && (
                      <button
                        type="button"
                        onClick={() => iniciarEdicaoPacote(g.chave)}
                        className="text-xs font-medium text-painel-primary"
                      >
                        {pacotes.length === 0 ? "Fechou um pacote?" : "+ Novo pacote"}
                      </button>
                    )}
                    {!semPacoteAtivo && pacotes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => iniciarEdicaoPacote(g.chave)}
                        className="text-xs font-medium text-painel-primary"
                      >
                        + Adicionar brinde
                      </button>
                    )}
                    {pacotes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => removerPacote(g.fichaId, g.item, g.chave)}
                        disabled={removendoPacoteChave === g.chave}
                        className="text-xs font-medium text-painel-alert-text disabled:opacity-40"
                      >
                        {removendoPacoteChave === g.chave ? "Cancelando…" : "Cancelar pacote"}
                      </button>
                    )}
                  </div>
                )}
            </div>
          );
        })}

        {semItem.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-painel-title mb-1.5">Outras sessões</h4>
            <ul className="space-y-1">
              {semItem.map((s) => (
                <LinhaSessaoView
                  key={s.id}
                  id={s.id}
                  texto={`${dataBR(s.data)}${s.observacao ? `: ${s.observacao}` : ""} (${s.confirmado ? "confirmado" : "aguardando confirmação"})`}
                  data={s.data}
                  observacao={s.observacao}
                  confirmado={s.confirmado}
                  confirmadoEm={s.confirmado_em}
                  copiado={copiadoId === s.id}
                  onCopiar={() => copiar(s.id, s.token)}
                  arquivar={arquivarState}
                  edicao={edicaoSessao}
                  envio={envioSessao}
                  marcarConfirmada={marcarConfirmadaState}
                />
              ))}
            </ul>
          </div>
        )}
      </div>

      {sessoesArquivadas.length > 0 && (
        <div className="mt-6 pt-5 border-t border-painel-border">
          <button
            type="button"
            onClick={() => setMostrarArquivadas((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-painel-muted hover:text-painel-primary transition-colors"
          >
            {mostrarArquivadas ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <Archive className="h-3.5 w-3.5" />
            Sessões arquivadas ({sessoesArquivadas.length})
          </button>

          {mostrarArquivadas && (
            <ul className="mt-3 space-y-1.5">
              {sessoesArquivadas.map((s) => {
                const item = s.areas.length > 0 ? s.areas.join(", ") : s.observacao || "sem item";
                return (
                  <li key={s.id} className="flex items-center gap-2 text-sm text-painel-muted-2">
                    <span className="truncate">
                      {dataBR(s.data)}: {item}{" "}
                      {s.confirmado ? "(estava confirmada)" : "(estava pendente)"}
                    </span>
                    <button
                      type="button"
                      onClick={() => restaurar(s.id)}
                      disabled={restaurandoId === s.id}
                      title="Restaurar sessão"
                      className="ml-auto shrink-0 inline-flex items-center gap-1 text-xs text-painel-primary hover:opacity-80 transition-colors disabled:opacity-40"
                    >
                      {restaurandoId === s.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      )}
                      Restaurar
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

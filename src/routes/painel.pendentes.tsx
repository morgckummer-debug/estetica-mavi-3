import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Inbox, MessageCircle, Clock, BadgeCheck } from "lucide-react";
import { listarSessoesPendentes, confirmarSessaoDireto, type SessaoPendente } from "@/lib/painel";
import { FICHAS, nomeCurto } from "@/data/anamnese";
import { linkWhatsappConfirmacao } from "@/lib/whatsapp";
import { mascaraCpf } from "@/lib/mascaras";
import { PAINEL_URL } from "@/data/services";

export const Route = createFileRoute("/painel/pendentes")({
  component: PaginaPendentes,
});

function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

// Dias desde a data do atendimento — quem está esperando há mais tempo
// aparece destacado, pra saber quem cutucar de novo primeiro.
function diasEspera(iso: string): number {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const inicio = new Date(ano, (mes ?? 1) - 1, dia ?? 1).setHours(0, 0, 0, 0);
  const hoje = new Date().setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((hoje - inicio) / 86400000));
}

// Uma cliente pode ter mais de uma ficha (laser, facial, depilação...), cada
// uma com suas próprias sessões pendentes — agrupa tudo por cliente (não por
// ficha) pra Marina resolver todo mundo de uma pessoa de uma vez, em vez de
// ver o mesmo nome espalhado pela lista. Fichas de antes da migração 0011,
// sem cliente_id (ver `Ficha`), agrupam por ficha mesmo (chave própria) —
// não têm como saber se são da mesma pessoa.
type GrupoPendente = {
  chave: string;
  clienteId: string | null;
  nome: string;
  cpf: string | null;
  sessoes: SessaoPendente[];
  maisAntiga: string; // data (YYYY-MM-DD) da pendente mais antiga do grupo
};

function agruparPorCliente(sessoes: SessaoPendente[]): GrupoPendente[] {
  const porChave = new Map<string, GrupoPendente>();
  for (const s of sessoes) {
    const chave = s.ficha.cliente_id ?? `ficha:${s.ficha_id}`;
    let g = porChave.get(chave);
    if (!g) {
      g = {
        chave,
        clienteId: s.ficha.cliente_id,
        nome: s.ficha.nome,
        cpf: s.ficha.cliente?.cpf ?? null,
        sessoes: [],
        maisAntiga: s.data,
      };
      porChave.set(chave, g);
    }
    g.sessoes.push(s);
    if (s.data < g.maisAntiga) g.maisAntiga = s.data;
  }
  const grupos = [...porChave.values()];
  grupos.forEach((g) => g.sessoes.sort((a, b) => a.data.localeCompare(b.data)));
  // Quem espera há mais tempo (a pendente mais antiga do grupo) aparece no
  // topo — mesmo critério de antes, agora por cliente em vez de por sessão.
  return grupos.sort((a, b) => a.maisAntiga.localeCompare(b.maisAntiga));
}

function PaginaPendentes() {
  const [sessoes, setSessoes] = useState<SessaoPendente[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Marcar como confirmada direto (sem link) — sessão antiga do caderninho
  // de papel, já assinada pela cliente na clínica.
  const [marcandoId, setMarcandoId] = useState<string | null>(null);

  useEffect(() => {
    listarSessoesPendentes()
      .then(setSessoes)
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."));
  }, []);

  const grupos = useMemo(() => agruparPorCliente(sessoes ?? []), [sessoes]);

  const marcarConfirmada = async (s: SessaoPendente) => {
    if (
      !window.confirm(
        `Marcar o atendimento de ${s.ficha.nome} em ${dataBR(s.data)} como já confirmado, sem mandar link? Use só quando a cliente já assinou no papel.`,
      )
    )
      return;
    setMarcandoId(s.id);
    setErro(null);
    try {
      await confirmarSessaoDireto(s.id);
      setSessoes((prev) => (prev ?? []).filter((x) => x.id !== s.id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao marcar sessão como confirmada.");
    } finally {
      setMarcandoId(null);
    }
  };

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[34px] text-painel-title">Pendentes de confirmação</h2>
        <p className="text-[13px] text-painel-muted">
          {sessoes ? `${sessoes.length} pendente(s)` : "Carregando..."}
        </p>
      </div>
      <p className="text-sm text-painel-muted mb-7">
        Atendimentos realizados há mais de 15 dias e ainda não confirmados pela cliente no WhatsApp.
      </p>

      {erro && (
        <div className="rounded-xl border border-painel-alert-border bg-painel-alert-bg px-4 py-3 text-sm text-painel-alert-text">
          {erro}
        </div>
      )}

      {!sessoes && !erro && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-painel-muted" />
        </div>
      )}

      {sessoes && grupos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-painel-muted">
          <Inbox className="h-10 w-10 mb-3 opacity-50" />
          <p>Nenhum atendimento pendente de confirmação.</p>
        </div>
      )}

      <div className="space-y-6">
        {grupos.map((g) => (
          <div key={g.chave}>
            <div className="flex items-center gap-2.5 flex-wrap mb-2 px-1">
              {g.clienteId ? (
                <Link
                  to="/painel/cliente/$id"
                  params={{ id: g.clienteId }}
                  className="text-[15px] font-medium text-painel-title hover:text-painel-primary transition-colors"
                >
                  {g.nome}
                </Link>
              ) : (
                <span className="text-[15px] font-medium text-painel-title">{g.nome}</span>
              )}
              {g.cpf && (
                <span className="text-[12px] text-painel-muted">CPF {mascaraCpf(g.cpf)}</span>
              )}
              <span className="text-[12px] text-painel-muted">
                · {g.sessoes.length} pendente(s)
              </span>
            </div>

            <div className="space-y-2.5">
              {g.sessoes.map((s) => {
                const dias = diasEspera(s.data);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-4 rounded-[14px] border border-painel-border bg-white px-6 py-5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                        <span className="text-[11px] rounded-full bg-painel-badge-bg text-painel-title px-2.5 py-0.5">
                          {FICHAS[s.ficha.tipo]?.emoji ?? ""} {nomeCurto(s.ficha.tipo)}
                        </span>
                      </div>
                      <p className="text-[13px] text-painel-muted-2 truncate">
                        {s.areas.length > 0 ? s.areas.join(", ") : "Sem áreas registradas"} ·{" "}
                        {dataBR(s.data)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3.5 shrink-0">
                      <span
                        title={`${dias} dia(s) aguardando confirmação`}
                        className="inline-flex items-center gap-1 rounded-full bg-painel-alert-bg text-painel-alert-text px-3 py-1.5 text-xs font-semibold"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        {dias === 0 ? "hoje" : `${dias}d`}
                      </span>
                      <a
                        href={linkWhatsappConfirmacao({
                          origin: PAINEL_URL,
                          token: s.token,
                          telefone: s.ficha.telefone,
                          nomeCliente: s.ficha.nome,
                          dataBR: dataBR(s.data),
                        })}
                        target="whatsapp"
                        rel="noreferrer"
                        title="Enviar por WhatsApp"
                        className="inline-flex items-center gap-1.5 rounded-full bg-painel-primary text-white px-3.5 py-2 text-xs font-medium hover:bg-painel-primary/90 transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Enviar
                      </a>
                      <button
                        type="button"
                        onClick={() => marcarConfirmada(s)}
                        disabled={marcandoId === s.id}
                        title="Marcar como confirmada (assinada no papel), sem mandar link"
                        className="inline-flex items-center gap-1.5 rounded-full border border-painel-border px-3.5 py-2 text-xs font-medium text-painel-chip-text hover:border-painel-primary/40 transition-colors disabled:opacity-40"
                      >
                        {marcandoId === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <BadgeCheck className="h-3.5 w-3.5" />
                        )}
                        Já assinada no papel
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

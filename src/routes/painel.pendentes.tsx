import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Inbox, MessageCircle, Clock } from "lucide-react";
import { listarSessoesPendentes, type SessaoPendente } from "@/lib/painel";
import { FICHAS, nomeCurto } from "@/data/anamnese";
import { linkWhatsappConfirmacao } from "@/lib/whatsapp";

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

function PaginaPendentes() {
  const [sessoes, setSessoes] = useState<SessaoPendente[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    listarSessoesPendentes()
      .then(setSessoes)
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."));
  }, []);

  // Quem espera há mais tempo aparece no topo.
  const ordenadas = useMemo(
    () => (sessoes ? [...sessoes].sort((a, b) => a.data.localeCompare(b.data)) : []),
    [sessoes],
  );

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

      {sessoes && ordenadas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-painel-muted">
          <Inbox className="h-10 w-10 mb-3 opacity-50" />
          <p>Nenhum atendimento pendente de confirmação.</p>
        </div>
      )}

      <div className="space-y-3">
        {ordenadas.map((s) => {
          const dias = diasEspera(s.data);
          return (
            <div
              key={s.id}
              className="flex items-center justify-between gap-4 rounded-[14px] border border-painel-border bg-white px-6 py-5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                  <Link
                    to="/painel/cliente/$id"
                    params={{ id: s.ficha_id }}
                    className="text-[15px] text-painel-title truncate hover:text-painel-primary transition-colors"
                  >
                    {s.ficha.nome}
                  </Link>
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
                    origin,
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

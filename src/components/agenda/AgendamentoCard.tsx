import { Check, Clock, Globe, Phone } from "lucide-react";
import { horaSP, rotuloHorario, type Agendamento } from "@/lib/agenda";

// Visual de cada situação do agendamento: lilás = marcado, verde = a cliente
// confirmou presença (o "check"), dourado = precisa reagendar.
function visual(ag: Agendamento): { borda: string; rotulo: string; etiqueta: string } {
  switch (ag.status) {
    case "cancelado":
      return {
        borda: "border-l-painel-icon-muted",
        rotulo: "Cancelado",
        etiqueta: "bg-painel-badge-bg/60 text-painel-muted",
      };
    case "concluido":
      return {
        borda: "border-l-painel-muted-2",
        rotulo: "Atendida",
        etiqueta: "bg-painel-badge-bg text-painel-chip-text",
      };
    case "faltou":
      return {
        borda: "border-l-painel-alert-text",
        rotulo: "Faltou",
        etiqueta: "bg-painel-alert-bg text-painel-alert-text",
      };
    case "remarcar":
      return {
        borda: "border-l-painel-gold",
        rotulo: "Precisa reagendar",
        etiqueta: "bg-painel-gold-soft/60 text-painel-gold",
      };
    default:
      return ag.presenca_confirmada_em
        ? {
            borda: "border-l-painel-green",
            rotulo: "Confirmou presença",
            etiqueta: "bg-painel-green/10 text-painel-green",
          }
        : {
            borda: "border-l-painel-primary",
            rotulo: "Agendado",
            etiqueta: "bg-painel-badge-bg text-painel-title",
          };
  }
}

// Nomes mais curtos para as colunas estreitas da semana.
const ROTULO_CURTO: Record<string, string> = {
  "Confirmou presença": "Confirmada",
  "Precisa reagendar": "Reagendar",
};

export function EtiquetaStatus({ ag, curta = false }: { ag: Agendamento; curta?: boolean }) {
  const v = visual(ag);
  const confirmou = ag.status === "agendado" && ag.presenca_confirmada_em;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${v.etiqueta}`}
    >
      {confirmou && <Check className="h-3 w-3" />}
      {curta ? (ROTULO_CURTO[v.rotulo] ?? v.rotulo) : v.rotulo}
    </span>
  );
}

// Quem agendou: cliente já cadastrada (reconhecida pelo telefone) ou pessoa nova.
// Ajuda a Marina a desconfiar de nome falso no agendamento online.
export function EtiquetaCadastro({ ag }: { ag: Agendamento }) {
  const cadastrada = Boolean(ag.cliente_id);
  const nome = ag.cliente?.nome;
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        cadastrada
          ? "bg-painel-green/10 text-painel-green"
          : "bg-painel-gold-soft/60 text-painel-gold"
      }`}
    >
      <span className="truncate">
        {cadastrada ? `Cliente cadastrada${nome ? `: ${nome}` : ""}` : "Pessoa nova"}
      </span>
    </span>
  );
}

export function AgendamentoCard({
  ag,
  onAbrir,
  compacto = false,
}: {
  ag: Agendamento;
  onAbrir: (ag: Agendamento) => void;
  compacto?: boolean;
}) {
  const v = visual(ag);
  const apagado = ag.status === "cancelado";
  return (
    <button
      type="button"
      onClick={() => onAbrir(ag)}
      className={`w-full text-left rounded-[14px] border border-painel-border border-l-4 ${v.borda} bg-white transition-shadow hover:shadow-[0_8px_24px_-14px_rgba(120,80,150,0.45)] ${
        compacto ? "px-3 py-2.5" : "px-5 py-4"
      } ${apagado ? "opacity-60" : ""}`}
    >
      <div
        className={
          compacto
            ? "flex flex-col items-start gap-1"
            : "flex items-center justify-between gap-2 flex-wrap"
        }
      >
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-painel-primary-deep">
          {!compacto && <Clock className="h-3.5 w-3.5" />}
          {compacto ? `${horaSP(ag.inicio)}–${horaSP(ag.fim)}` : rotuloHorario(ag.inicio, ag.fim)}
        </span>
        <EtiquetaStatus ag={ag} curta={compacto} />
      </div>
      <p
        className={`mt-1.5 font-medium text-painel-title ${compacto ? "text-[13px]" : "text-[15px]"} ${
          apagado ? "line-through" : ""
        }`}
      >
        {ag.nome}
      </p>
      <p className="text-[12.5px] text-painel-muted-2">
        {ag.servico_nome}
        {ag.areas.length > 0 ? ` · ${ag.areas.join(", ")}` : ""}
      </p>
      <div className="mt-1.5">
        <EtiquetaCadastro ag={ag} />
      </div>
      {!compacto && (
        <p className="mt-1.5 flex items-center gap-3 text-[11.5px] text-painel-muted-2">
          <span className="inline-flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {ag.telefone}
          </span>
          {ag.origem === "online" && (
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3 w-3" />
              Agendou online
            </span>
          )}
        </p>
      )}
    </button>
  );
}

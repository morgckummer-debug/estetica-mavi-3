import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BellRing, CalendarCheck, RotateCw } from "lucide-react";
import { dataSP, hojeSP, listarAgendamentos, somarDias, type Agendamento } from "@/lib/agenda";

const JANELA_DIAS = 8; // hoje + os próximos 7 dias

type Resumo = {
  hoje: number;
  hojeSemConfirmar: number;
  amanha: number;
  amanhaSemAviso: number;
  reagendar: number;
};

function resumir(ags: Agendamento[]): Resumo {
  const hoje = hojeSP();
  const amanha = somarDias(hoje, 1);
  const doDia = (dia: string) =>
    ags.filter((a) => a.status === "agendado" && dataSP(a.inicio) === dia);
  const h = doDia(hoje);
  const am = doDia(amanha);
  return {
    hoje: h.length,
    hojeSemConfirmar: h.filter((a) => !a.presenca_confirmada_em).length,
    amanha: am.length,
    amanhaSemAviso: am.filter((a) => !a.lembrete_enviado_em && !a.presenca_confirmada_em).length,
    reagendar: ags.filter((a) => a.status === "remarcar").length,
  };
}

const cartao =
  "flex min-w-0 flex-1 items-start gap-3 rounded-2xl border border-painel-border bg-white px-4 py-3";

// Painel rápido no topo da agenda: o que pede atenção hoje, independente do
// período que a grade está mostrando.
export function ResumoDoDia({ recarga }: { recarga: number }) {
  const [resumo, setResumo] = useState<Resumo | null>(null);

  useEffect(() => {
    let ativo = true;
    const hoje = hojeSP();
    listarAgendamentos(hoje, somarDias(hoje, JANELA_DIAS))
      .then((ags) => ativo && setResumo(resumir(ags)))
      .catch(() => ativo && setResumo(null));
    return () => {
      ativo = false;
    };
  }, [recarga]);

  if (!resumo) return null;

  return (
    <div className="mb-5 flex flex-col gap-2.5 sm:flex-row">
      <div className={cartao}>
        <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-painel-primary" />
        <div className="min-w-0">
          <p className="font-display text-[24px] leading-none text-painel-title">{resumo.hoje}</p>
          <p className="mt-1 text-[12.5px] text-painel-chip-text">
            {resumo.hoje === 1 ? "cliente hoje" : "clientes hoje"}
          </p>
          {resumo.hojeSemConfirmar > 0 && (
            <p className="text-[11.5px] text-painel-muted">
              {resumo.hojeSemConfirmar} sem confirmar
            </p>
          )}
        </div>
      </div>

      <Link
        to="/painel/lembretes"
        className={`${cartao} transition-colors hover:border-painel-primary/40`}
      >
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-painel-primary" />
        <div className="min-w-0">
          <p className="font-display text-[24px] leading-none text-painel-title">
            {resumo.amanhaSemAviso}
          </p>
          <p className="mt-1 text-[12.5px] text-painel-chip-text">
            {resumo.amanhaSemAviso === 1
              ? "cliente de amanhã sem aviso"
              : "clientes de amanhã sem aviso"}
          </p>
          <p className="text-[11.5px] text-painel-primary">
            {resumo.amanha > 0 ? `${resumo.amanha} amanhã · enviar lembretes` : "Abrir lembretes"}
          </p>
        </div>
      </Link>

      <div className={cartao}>
        <RotateCw
          className={`mt-0.5 h-5 w-5 shrink-0 ${resumo.reagendar > 0 ? "text-painel-gold" : "text-painel-muted"}`}
        />
        <div className="min-w-0">
          <p className="font-display text-[24px] leading-none text-painel-title">
            {resumo.reagendar}
          </p>
          <p className="mt-1 text-[12.5px] text-painel-chip-text">
            {resumo.reagendar === 1 ? "precisa reagendar" : "precisam reagendar"}
          </p>
          <p className="text-[11.5px] text-painel-muted">próximos 7 dias</p>
        </div>
      </div>
    </div>
  );
}

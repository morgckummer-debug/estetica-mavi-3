import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { dataSP, hojeSP, reagendar, type AgendaServico, type Agendamento } from "@/lib/agenda";
import { SeletorHorario } from "./SeletorHorario";
import { btnPrimario, btnSecundario } from "./estilos";

// Move um agendamento para outro horário. Usado no detalhe do agendamento
// e na tela de conflitos de um bloqueio.
export function ReagendarPainel({
  ag,
  servicos,
  onConcluido,
  onVoltar,
}: {
  ag: Agendamento;
  servicos: AgendaServico[];
  onConcluido: () => void;
  onVoltar: () => void;
}) {
  const hoje = hojeSP();
  const original = dataSP(ag.inicio);
  const [dia, setDia] = useState(original < hoje ? hoje : original);
  const [novo, setNovo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const servico = servicos.find((s) => s.id === ag.servico_id);
  // O atendimento pode ter duração diferente da do serviço (escolhida ao agendar).
  const duracaoReal = Math.round(
    (new Date(ag.fim).getTime() - new Date(ag.inicio).getTime()) / 60000,
  );
  const duracaoMin = servico && duracaoReal !== servico.duracao_min ? duracaoReal : undefined;

  const salvar = async () => {
    if (!novo) return;
    setSalvando(true);
    setErro(null);
    try {
      await reagendar(ag, novo);
      onConcluido();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível reagendar.");
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/70">
        Novo horário para <span className="font-medium text-white">{ag.nome}</span> ·{" "}
        {ag.servico_nome}
      </p>
      <SeletorHorario
        servico={servico}
        dia={dia}
        onDia={setDia}
        valor={novo}
        onValor={setNovo}
        ignorarId={ag.id}
        duracaoMin={duracaoMin}
      />
      {erro && <p className="text-sm text-rose-300">{erro}</p>}
      <div className="flex items-center gap-2">
        <button type="button" onClick={salvar} disabled={!novo || salvando} className={btnPrimario}>
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Reagendar
        </button>
        <button type="button" onClick={onVoltar} disabled={salvando} className={btnSecundario}>
          Voltar
        </button>
      </div>
    </div>
  );
}

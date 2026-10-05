import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { editarAgendamento, horaSP, type AgendaServico, type Agendamento } from "@/lib/agenda";
import { btnPrimario, btnSecundario, campo, rotulo } from "./estilos";

// A Marina muda o que será feito na sessão (procedimento, áreas, duração)
// sem mexer no dia e na hora de início. Se o novo fim bater com outro
// atendimento, o banco recusa e o aviso aparece aqui.
export function EditarPainel({
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
  const duracaoAtual = Math.round(
    (new Date(ag.fim).getTime() - new Date(ag.inicio).getTime()) / 60000,
  );
  const [servicoId, setServicoId] = useState(ag.servico_id);
  const [duracao, setDuracao] = useState(String(duracaoAtual));
  const [areasSel, setAreasSel] = useState<string[]>(ag.areas);
  const [areasTexto, setAreasTexto] = useState(ag.areas.join(", "));
  const [observacao, setObservacao] = useState(ag.observacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O serviço marcado pode ter sido desativado: continua na lista para não sumir.
  const servico = servicos.find((s) => s.id === servicoId);
  const opcoes = servico?.areas_opcoes ?? [];
  const duracaoMin = Number(duracao);
  const duracaoValida = Number.isInteger(duracaoMin) && duracaoMin >= 5 && duracaoMin <= 480;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!servico) {
      setErro("Escolha o procedimento.");
      return;
    }
    if (!duracaoValida) {
      setErro("A duração deve ser entre 5 e 480 minutos.");
      return;
    }
    if (opcoes.length > 0 && areasSel.length === 0) {
      setErro("Escolha ao menos uma área.");
      return;
    }
    setSalvando(true);
    try {
      await editarAgendamento(ag, {
        servico,
        areas:
          opcoes.length > 0
            ? areasSel
            : areasTexto
                .split(",")
                .map((a) => a.trim())
                .filter(Boolean),
        duracaoMin,
        observacao,
      });
      onConcluido();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={salvar} className="space-y-3.5">
      <div>
        <label className={rotulo}>Procedimento</label>
        <select
          value={servicoId}
          onChange={(e) => {
            setServicoId(e.target.value);
            setAreasSel([]);
            const novo = servicos.find((s) => s.id === e.target.value);
            if (novo) setDuracao(String(novo.duracao_min));
          }}
          className={campo}
        >
          {!servico && (
            <option value={ag.servico_id} className="text-painel-title">
              {ag.servico_nome}
            </option>
          )}
          {servicos.map((s) => (
            <option key={s.id} value={s.id} className="text-painel-title">
              {s.nome} · {s.duracao_min} min
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={rotulo}>Duração (minutos)</label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            inputMode="numeric"
            min={5}
            max={480}
            step={5}
            value={duracao}
            onChange={(e) => setDuracao(e.target.value)}
            className={`${campo} !w-28`}
          />
          <span className="text-xs text-white/60">
            {duracaoValida
              ? `Começa às ${horaSP(ag.inicio)} e termina às ${horaSP(new Date(new Date(ag.inicio).getTime() + duracaoMin * 60000))}.`
              : "Entre 5 e 480 minutos."}
          </span>
        </div>
      </div>

      {opcoes.length > 0 ? (
        <div>
          <label className={rotulo}>Áreas</label>
          <div className="flex flex-wrap gap-1.5">
            {opcoes.map((a) => {
              const marcada = areasSel.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  aria-pressed={marcada}
                  onClick={() =>
                    setAreasSel((atual) =>
                      atual.includes(a) ? atual.filter((x) => x !== a) : [...atual, a],
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    marcada
                      ? "border-painel-primary bg-painel-primary text-white"
                      : "border-white/20 text-white/80 hover:border-white/50"
                  }`}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <label className={rotulo}>Áreas (opcional, separe por vírgula)</label>
          <input
            value={areasTexto}
            onChange={(e) => setAreasTexto(e.target.value)}
            placeholder="Virilha, axilas"
            className={campo}
          />
        </div>
      )}

      <div>
        <label className={rotulo}>Observação (opcional)</label>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={2}
          className={campo}
        />
      </div>

      {erro && <p className="text-sm text-rose-300">{erro}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={salvando} className={btnPrimario}>
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Salvar
        </button>
        <button type="button" onClick={onVoltar} disabled={salvando} className={btnSecundario}>
          Voltar
        </button>
      </div>
    </form>
  );
}

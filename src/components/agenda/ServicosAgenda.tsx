import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Loader2, Plus, SlidersHorizontal, X } from "lucide-react";
import {
  atualizarServico,
  criarServico,
  listarTodosServicos,
  trocarOrdemServicos,
  type AgendaServico,
} from "@/lib/agenda";
import { nomeCurto, type Tipo } from "@/data/anamnese";
import { PainelModal } from "@/components/PainelModal";
import { RegrasGerais } from "./RegrasGerais";
import { btnPrimario, btnSecundario, campo, rotulo } from "./estilos";

// Fichas que a cliente pode receber antes do atendimento.
const FICHAS: Tipo[] = ["corporal", "facial", "laser"];

const rotuloFicha = (f: Tipo) => (f === "cadastro" ? "Cadastro" : nomeCurto(f));

type Rascunho = { nome: string; duracao: string; ficha: Tipo };

const rascunhoDe = (s: AgendaServico): Rascunho => ({
  nome: s.nome,
  duracao: String(s.duracao_min),
  ficha: s.ficha,
});

// Tela da Marina para escolher quais serviços aparecem na agenda, quanto tempo
// cada um leva e qual ficha a cliente recebe. Mudar a duração vale só para os
// próximos agendamentos: os já marcados continuam como estão.
export function ServicosAgenda({
  onFechar,
  onAlterado,
}: {
  onFechar: () => void;
  // Avisa a agenda para recarregar a lista de serviços.
  onAlterado: () => void;
}) {
  const [servicos, setServicos] = useState<AgendaServico[] | null>(null);
  const [rascunhos, setRascunhos] = useState<Record<string, Rascunho>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState<Rascunho | null>(null);
  const [regrasGerais, setRegrasGerais] = useState(false);

  const carregar = async () => {
    const lista = await listarTodosServicos();
    setServicos(lista);
    setRascunhos(Object.fromEntries(lista.map((s) => [s.id, rascunhoDe(s)])));
  };

  useEffect(() => {
    carregar().catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."));
  }, []);

  // Roda uma ação, mostra o erro se falhar e recarrega a lista.
  const executar = async (chave: string, acao: () => Promise<void>) => {
    setOcupado(chave);
    setErro(null);
    try {
      await acao();
      await carregar();
      onAlterado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setOcupado(null);
    }
  };

  const validar = (r: Rascunho): string | null => {
    const minutos = Number(r.duracao);
    if (r.nome.trim().length < 2) return "Dê um nome ao serviço.";
    if (!Number.isInteger(minutos) || minutos < 5 || minutos > 480)
      return "A duração deve ser entre 5 e 480 minutos.";
    return null;
  };

  const salvar = (s: AgendaServico) => {
    const r = rascunhos[s.id];
    const problema = validar(r);
    if (problema) return setErro(problema);
    void executar(s.id, () =>
      atualizarServico(s.id, {
        nome: r.nome.trim(),
        duracao_min: Number(r.duracao),
        ...(s.tipo === "consulta" ? {} : { ficha: r.ficha }),
      }),
    );
  };

  const mover = (i: number, direcao: -1 | 1) => {
    if (!servicos) return;
    const a = servicos[i];
    const b = servicos[i + direcao];
    if (a && b) void executar(a.id, () => trocarOrdemServicos(a, b));
  };

  const adicionar = () => {
    if (!novo || !servicos) return;
    const problema = validar(novo);
    if (problema) return setErro(problema);
    const proxima = servicos.reduce((m, s) => Math.max(m, s.ordem), -1) + 1;
    void executar("novo", async () => {
      await criarServico(
        { nome: novo.nome.trim(), duracao_min: Number(novo.duracao), ficha: novo.ficha },
        proxima,
      );
      setNovo(null);
    });
  };

  const mudou = (s: AgendaServico) => {
    const r = rascunhos[s.id];
    return (
      r && (r.nome.trim() !== s.nome || Number(r.duracao) !== s.duracao_min || r.ficha !== s.ficha)
    );
  };

  const editar = (id: string, campos: Partial<Rascunho>) =>
    setRascunhos((r) => ({ ...r, [id]: { ...r[id], ...campos } }));

  if (regrasGerais) {
    return <RegrasGerais onVoltar={() => setRegrasGerais(false)} onFechar={onFechar} />;
  }

  return (
    <PainelModal onFechar={onFechar} maxWidth="max-w-xl">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="font-medium text-white">Serviços da agenda</h3>
        <button
          type="button"
          onClick={onFechar}
          title="Fechar"
          className="text-white/50 transition-colors hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-white/60">
        Aqui você escolhe o que as clientes podem agendar e quanto tempo cada serviço leva. Mudar a
        duração vale só para os próximos agendamentos. Serviço desativado some da agenda, mas o
        histórico fica.
      </p>
      <button
        type="button"
        onClick={() => setRegrasGerais(true)}
        className={`${btnSecundario} mb-4`}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Regras gerais (horários e prazos)
      </button>

      {!servicos ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-white/60" />
        </div>
      ) : (
        <ul className="space-y-3">
          {servicos.map((s, i) => {
            const r = rascunhos[s.id];
            if (!r) return null;
            const consulta = s.tipo === "consulta";
            return (
              <li
                key={s.id}
                className={`rounded-xl border border-white/10 bg-white/5 p-3 ${s.ativo ? "" : "opacity-60"}`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      title="Subir"
                      disabled={i === 0 || ocupado !== null}
                      onClick={() => mover(i, -1)}
                      className="text-white/50 hover:text-white disabled:opacity-20"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Descer"
                      disabled={i === servicos.length - 1 || ocupado !== null}
                      onClick={() => mover(i, 1)}
                      className="text-white/50 hover:text-white disabled:opacity-20"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      aria-label="Nome do serviço"
                      value={r.nome}
                      maxLength={80}
                      onChange={(e) => editar(s.id, { nome: e.target.value })}
                      className={campo}
                    />
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="w-28">
                        <label className={rotulo}>Minutos</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={5}
                          max={480}
                          step={5}
                          value={r.duracao}
                          onChange={(e) => editar(s.id, { duracao: e.target.value })}
                          className={campo}
                        />
                      </div>
                      {!consulta && (
                        <div className="min-w-[8rem] flex-1">
                          <label className={rotulo}>Ficha enviada</label>
                          <select
                            value={r.ficha}
                            onChange={(e) => editar(s.id, { ficha: e.target.value as Tipo })}
                            className={campo}
                          >
                            {FICHAS.map((f) => (
                              <option key={f} value={f} className="text-black">
                                {rotuloFicha(f)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {mudou(s) && (
                        <button
                          type="button"
                          disabled={ocupado !== null}
                          onClick={() => salvar(s)}
                          className={btnPrimario}
                        >
                          {ocupado === s.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Salvar
                        </button>
                      )}
                      {consulta ? (
                        <span className="text-xs text-white/50">
                          Consulta de avaliação: porta de entrada das clientes novas (cadastro).
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={ocupado !== null}
                          onClick={() =>
                            executar(s.id, () => atualizarServico(s.id, { ativo: !s.ativo }))
                          }
                          className={btnSecundario}
                        >
                          {s.ativo ? "Desativar" : "Ativar"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {erro && <p className="mt-3 text-sm text-rose-300">{erro}</p>}

      {servicos && (
        <div className="mt-4 border-t border-white/10 pt-4">
          {novo ? (
            <div className="space-y-2">
              <input
                aria-label="Nome do novo serviço"
                placeholder="Nome do serviço"
                value={novo.nome}
                maxLength={80}
                onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                className={campo}
              />
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-28">
                  <label className={rotulo}>Minutos</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={480}
                    step={5}
                    value={novo.duracao}
                    onChange={(e) => setNovo({ ...novo, duracao: e.target.value })}
                    className={campo}
                  />
                </div>
                <div className="min-w-[8rem] flex-1">
                  <label className={rotulo}>Ficha enviada</label>
                  <select
                    value={novo.ficha}
                    onChange={(e) => setNovo({ ...novo, ficha: e.target.value as Tipo })}
                    className={campo}
                  >
                    {FICHAS.map((f) => (
                      <option key={f} value={f} className="text-black">
                        {rotuloFicha(f)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={ocupado !== null}
                  onClick={adicionar}
                  className={btnPrimario}
                >
                  {ocupado === "novo" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Adicionar serviço
                </button>
                <button type="button" onClick={() => setNovo(null)} className={btnSecundario}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNovo({ nome: "", duracao: "60", ficha: "corporal" })}
              className={btnSecundario}
            >
              <Plus className="h-4 w-4" />
              Novo serviço
            </button>
          )}
        </div>
      )}
    </PainelModal>
  );
}

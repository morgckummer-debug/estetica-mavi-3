import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { OPCOES_SESSAO, TIPOS } from "@/data/anamnese";
import { lerValor, reais, salvarPrecos, type PacotePreco, type Preco } from "@/lib/caixa";
import { PainelModal } from "@/components/PainelModal";
import { btnPrimario, btnSecundario, campo, rotulo } from "@/components/agenda/estilos";

const centavos = (n: number) => n.toFixed(2).replace(".", ",");

// Nomes que a Marina já usa nas fichas e nos contratos, para sugerir ao cadastrar.
const NOMES_CONHECIDOS = Array.from(new Set(TIPOS.flatMap((t) => OPCOES_SESSAO[t])));

type Linha = {
  id: string;
  nome: string;
  precoTxt: string;
  pacotes: PacotePreco[];
  // Campos do pacote que está sendo adicionado a esta linha.
  novoSessoes: string;
  novoValor: string;
  novoRotulo: string;
};

const deLinha = (p: Preco): Linha => ({
  id: p.id,
  nome: p.nome,
  precoTxt: p.preco_sessao == null ? "" : centavos(p.preco_sessao),
  pacotes: p.pacotes,
  novoSessoes: "",
  novoValor: "",
  novoRotulo: "",
});

const linhaNova = (nome = ""): Linha => ({
  id: crypto.randomUUID(),
  nome,
  precoTxt: "",
  pacotes: [],
  novoSessoes: "10",
  novoValor: "",
  novoRotulo: "",
});

// Tabela de preços: o valor da sessão avulsa e os pacotes de cada
// procedimento. Muda uma ou duas vezes por ano; serve de sugestão no contrato
// e na "Nova venda" (o valor sempre pode ser ajustado na hora).
export function PrecosCaixa({
  precos,
  onFechar,
  onSalvo,
}: {
  precos: Preco[];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [linhas, setLinhas] = useState<Linha[]>(() => precos.map(deLinha));
  const [removidos, setRemovidos] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const editar = (id: string, patch: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const remover = (l: Linha) => {
    setLinhas((ls) => ls.filter((x) => x.id !== l.id));
    if (precos.some((p) => p.id === l.id)) setRemovidos((r) => [...r, l.id]);
  };

  const adicionarPacote = (l: Linha) => {
    const sessoes = Math.round(lerValor(l.novoSessoes));
    const valor = lerValor(l.novoValor);
    if (!(sessoes > 0) || !(valor > 0))
      return setErro("Para o pacote, informe as sessões e o valor.");
    setErro(null);
    editar(l.id, {
      pacotes: [
        ...l.pacotes,
        { sessoes, valor, ...(l.novoRotulo.trim() ? { rotulo: l.novoRotulo.trim() } : {}) },
      ],
      novoValor: "",
      novoRotulo: "",
    });
  };

  const sugestoes = useMemo(
    () =>
      NOMES_CONHECIDOS.filter(
        (n) => !linhas.some((l) => l.nome.trim().toLowerCase() === n.toLowerCase()),
      ),
    [linhas],
  );

  const salvar = async () => {
    const itens: Preco[] = [];
    for (const l of linhas) {
      if (!l.nome.trim()) return setErro("Todo procedimento precisa de um nome.");
      const preco = l.precoTxt.trim() ? lerValor(l.precoTxt) : null;
      if (preco !== null && !(preco >= 0)) return setErro(`Preço inválido em “${l.nome}”.`);
      itens.push({ id: l.id, nome: l.nome, preco_sessao: preco, pacotes: l.pacotes, ordem: 0 });
    }
    setSalvando(true);
    setErro(null);
    try {
      await salvarPrecos(itens, removidos);
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  };

  return (
    <PainelModal onFechar={onFechar} maxWidth="max-w-2xl">
      <h3 className="mb-1 font-display text-[24px] text-white">Tabela de preços</h3>
      <p className="mb-4 text-[12.5px] text-white/55">
        Use o mesmo nome das fichas e dos contratos (ex.: Drenagem Linfática). O valor aparece como
        sugestão no contrato e na nova venda, e você pode mudar na hora.
      </p>

      <div className="space-y-3">
        {linhas.length === 0 && (
          <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-center text-sm text-white/55">
            Nenhum procedimento ainda. Escolha um abaixo ou crie um com “Outro procedimento”.
          </p>
        )}

        {linhas.map((l) => (
          <div key={l.id} className="rounded-xl border border-white/15 bg-white/5 p-3.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <label className={rotulo}>Procedimento</label>
                <input
                  value={l.nome}
                  onChange={(e) => editar(l.id, { nome: e.target.value })}
                  className={campo}
                />
              </div>
              <div className="w-32 shrink-0">
                <label className={rotulo}>Sessão avulsa (R$)</label>
                <input
                  value={l.precoTxt}
                  onChange={(e) => editar(l.id, { precoTxt: e.target.value })}
                  inputMode="decimal"
                  placeholder="0,00"
                  className={campo}
                />
              </div>
              <button
                type="button"
                onClick={() => remover(l)}
                title="Remover procedimento"
                className="mt-6 shrink-0 rounded-full p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-rose-200"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3">
              <label className={rotulo}>Pacotes</label>
              {l.pacotes.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {[...l.pacotes]
                    .sort((a, b) => a.sessoes - b.sessoes)
                    .map((p, i) => (
                      <span
                        key={`${p.sessoes}-${p.valor}-${i}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 py-1 pl-3 pr-1.5 text-[12.5px] text-white"
                      >
                        {p.rotulo?.trim() || `${p.sessoes} sessões`} · {reais(p.valor)}
                        <button
                          type="button"
                          onClick={() =>
                            editar(l.id, { pacotes: l.pacotes.filter((x) => x !== p) })
                          }
                          title="Remover pacote"
                          className="rounded-full p-0.5 text-white/50 hover:text-rose-200"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={l.novoSessoes}
                  onChange={(e) => editar(l.id, { novoSessoes: e.target.value })}
                  inputMode="numeric"
                  aria-label="Sessões do pacote"
                  className={`${campo} !w-16 text-center`}
                />
                <span className="text-[12px] text-white/50">sessões por R$</span>
                <input
                  value={l.novoValor}
                  onChange={(e) => editar(l.id, { novoValor: e.target.value })}
                  inputMode="decimal"
                  placeholder="0,00"
                  aria-label="Valor do pacote"
                  className={`${campo} !w-28`}
                />
                <input
                  value={l.novoRotulo}
                  onChange={(e) => editar(l.id, { novoRotulo: e.target.value })}
                  placeholder="Nome (opcional)"
                  aria-label="Nome do pacote"
                  className={`${campo} min-w-[8rem] flex-1`}
                />
                <button type="button" onClick={() => adicionarPacote(l)} className={btnSecundario}>
                  <Plus className="h-3.5 w-3.5" />
                  Pacote
                </button>
              </div>
            </div>
          </div>
        ))}

        <div>
          <label className={rotulo}>Adicionar procedimento</label>
          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {sugestoes.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setLinhas((ls) => [...ls, linhaNova(n)])}
                className="rounded-full border border-white/20 px-3 py-1 text-[12.5px] text-white/70 transition-colors hover:border-white/40 hover:text-white"
              >
                + {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setLinhas((ls) => [...ls, linhaNova()])}
              className="rounded-full border border-dashed border-white/30 px-3 py-1 text-[12.5px] text-white/70 transition-colors hover:border-white/50 hover:text-white"
            >
              + Outro procedimento
            </button>
          </div>
        </div>

        {erro && <p className="text-sm text-rose-300">{erro}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onFechar} className={btnSecundario}>
            Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={salvando} className={btnPrimario}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar preços
          </button>
        </div>
      </div>
    </PainelModal>
  );
}

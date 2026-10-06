import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, UserPlus, X } from "lucide-react";
import { hojeSP } from "@/lib/agenda";
import {
  CATEGORIAS_SAIDA,
  FORMAS,
  criarLancamento,
  dividirParcelas,
  lerValor,
  opcoesDoPreco,
  reais,
  taxaSugerida,
  valorLiquido,
  type CaixaConfig,
  type Preco,
  type FormaPagamento,
} from "@/lib/caixa";
import { listarClientes, type Cliente } from "@/lib/painel";
import { digitos } from "@/lib/clientes";
import { mascaraTelefone } from "@/lib/mascaras";
import { PainelModal } from "@/components/PainelModal";
import { SeletorData } from "@/components/agenda/SeletorData";
import { btnPrimario, btnSecundario, campo, rotulo } from "@/components/agenda/estilos";

const chip = (ativo: boolean) =>
  `rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
    ativo
      ? "border-painel-primary bg-painel-primary text-white"
      : "border-white/20 text-white/70 hover:border-white/40"
  }`;

// Janela de "Nova venda" e "Nova saída" do Caixa. Na venda no crédito mostra,
// antes de salvar, quanto cai por mês já sem a taxa da maquininha.
export function NovoLancamento({
  tipo,
  config,
  precos = [],
  onFechar,
  onSalvo,
}: {
  tipo: "entrada" | "saida";
  config: CaixaConfig;
  // Tabela de preços: na venda, oferece os procedimentos e pacotes cadastrados.
  precos?: Preco[];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const venda = tipo === "entrada";
  const [data, setData] = useState(hojeSP());
  const [descricao, setDescricao] = useState("");
  // Venda: cliente obrigatória, buscada entre as já cadastradas.
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cliente, setCliente] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  // "" = nada escolhido; "outro" = descrição digitada à mão; senão, a chave de uma opção da tabela.
  const [opcaoSel, setOpcaoSel] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS_SAIDA[0]);
  const [valorTxt, setValorTxt] = useState("");
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [parcelas, setParcelas] = useState(1);
  // Enquanto a taxa não for editada à mão, acompanha forma e parcelas.
  const [taxaTxt, setTaxaTxt] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const opcoes = useMemo(() => precos.flatMap(opcoesDoPreco), [precos]);

  useEffect(() => {
    if (!venda) return;
    listarClientes()
      .then(setClientes)
      .catch(() => setClientes([]));
  }, [venda]);

  const termo = cliente.trim().toLowerCase();
  const sugestoes = useMemo(() => {
    if (termo.length < 2 || clienteId) return [];
    const nums = digitos(termo);
    return clientes
      .filter(
        (c) =>
          c.nome.toLowerCase().includes(termo) ||
          (nums.length >= 4 && digitos(c.telefone ?? "").includes(nums)),
      )
      .slice(0, 5);
  }, [termo, clientes, clienteId]);
  const clienteNova = !clienteId && termo.length >= 2;
  // Sem opções na tabela de preços, só dá para digitar a descrição.
  const descricaoLivre = opcoes.length === 0 || opcaoSel === "outro";
  const valor = lerValor(valorTxt);
  const taxaAuto = taxaSugerida(config, forma, parcelas);
  const taxa = taxaTxt === null ? taxaAuto : lerValor(taxaTxt);
  const taxaOk = Number.isFinite(taxa) && taxa >= 0 && taxa < 100;
  const comTaxa = venda && (forma === "credito" || forma === "debito");

  const previa = useMemo(() => {
    if (!venda || !(valor > 0) || !taxaOk) return null;
    const liquido = valorLiquido(valor, comTaxa ? taxa : 0);
    const n = forma === "credito" ? parcelas : 1;
    return { liquido, parcela: dividirParcelas(liquido, n)[0], n };
  }, [venda, valor, taxa, taxaOk, comTaxa, forma, parcelas]);

  const salvar = async () => {
    if (venda && cliente.trim().length < 2) return setErro("Informe a cliente.");
    if (!descricao.trim()) {
      return setErro(venda ? "Escolha o pacote ou sessão." : "Escreva uma descrição.");
    }
    if (!(valor > 0)) return setErro("Informe o valor.");
    if (comTaxa && !taxaOk) return setErro("A taxa precisa ficar entre 0 e 100%.");
    setSalvando(true);
    setErro(null);
    try {
      await criarLancamento({
        data,
        tipo,
        descricao,
        categoria: venda ? null : categoria,
        valor,
        forma,
        parcelas,
        taxa_pct: comTaxa ? taxa : 0,
        cliente_id: venda ? clienteId : null,
        cliente_nome: venda ? cliente : null,
      });
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  };

  return (
    <PainelModal onFechar={onFechar} maxWidth="max-w-md">
      <h3 className="mb-4 font-display text-[24px] text-white">
        {venda ? "Nova venda" : "Nova saída"}
      </h3>

      <div className="space-y-4">
        <div>
          <label className={rotulo}>{venda ? "Data da venda" : "Data do gasto"}</label>
          <SeletorData valor={data} onChange={setData} rotulo="Data" />
        </div>

        {venda && (
          <div className="relative">
            <label className={rotulo}>Cliente</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={cliente}
                onChange={(e) => {
                  setCliente(e.target.value);
                  if (clienteId) setClienteId(null);
                }}
                placeholder="Digite o nome ou telefone"
                className={`${campo} pl-10`}
              />
              {clienteId && (
                <button
                  type="button"
                  onClick={() => {
                    setClienteId(null);
                    setCliente("");
                  }}
                  title="Trocar de cliente"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {sugestoes.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-white/15 bg-painel-hero-bg shadow-xl">
                {sugestoes.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setClienteId(c.id);
                        setCliente(c.nome);
                      }}
                      className="flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left text-sm text-white hover:bg-white/10"
                    >
                      <span className="truncate">{c.nome}</span>
                      <span className="shrink-0 text-xs text-white/50">
                        {mascaraTelefone(c.telefone ?? "")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {clienteId && (
              <p className="mt-1.5 text-[12px] text-emerald-200">Cliente já cadastrada.</p>
            )}
            {clienteNova && (
              <div className="mt-1.5 flex items-start gap-2 rounded-xl border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-[12px] text-amber-100">
                <UserPlus className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {sugestoes.length > 0
                    ? "Nenhuma delas? Será lançada como cliente nova, "
                    : "Cliente nova: não há cadastro com esse nome. "}
                  A venda fica só com o nome; o cadastro completo dá para fazer depois, em Clientes.
                </span>
              </div>
            )}
          </div>
        )}

        {venda && opcoes.length > 0 && (
          <div>
            <label className={rotulo}>Pacote ou sessão</label>
            <select
              value={opcaoSel}
              onChange={(e) => {
                const v = e.target.value;
                setOpcaoSel(v);
                if (v === "outro") {
                  setDescricao("");
                  return;
                }
                const o = opcoes.find((x) => x.chave === v);
                if (o) {
                  setDescricao(o.descricao);
                  setValorTxt(o.valor.toFixed(2).replace(".", ","));
                }
              }}
              className={campo}
            >
              <option value="" disabled className="text-painel-title">
                Escolha…
              </option>
              {precos.map((p) => {
                const itens = opcoesDoPreco(p);
                return itens.length === 0 ? null : (
                  <optgroup key={p.id} label={p.nome} className="text-painel-title">
                    {itens.map((o) => (
                      <option key={o.chave} value={o.chave} className="text-painel-title">
                        {o.descricao.replace(`${p.nome} `, "")} · {reais(o.valor)}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
              <option value="outro" className="text-painel-title">
                Outro (digitar)
              </option>
            </select>
            <p className="mt-1 text-[11px] text-white/45">
              Vem da tabela de preços (botão “Preços” na página Caixa). O valor pode ser ajustado.
            </p>
          </div>
        )}

        {(descricaoLivre || !venda) && (
          <div>
            <label className={rotulo}>Descrição</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={
                venda ? "Ex.: Pacote 10 sessões de depilação a laser" : "Ex.: Gel condutor"
              }
              className={campo}
            />
            {venda && opcoes.length === 0 && (
              <p className="mt-1 text-[11px] text-white/45">
                Cadastre os pacotes em “Preços” na página Caixa para escolher aqui em vez de
                digitar.
              </p>
            )}
          </div>
        )}

        {!venda && (
          <div>
            <label className={rotulo}>Categoria</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIAS_SAIDA.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoria(c)}
                  className={chip(categoria === c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className={rotulo}>{venda ? "Valor da venda (R$)" : "Valor (R$)"}</label>
          <input
            value={valorTxt}
            onChange={(e) => setValorTxt(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            className={campo}
          />
        </div>

        <div>
          <label className={rotulo}>{venda ? "Como a cliente pagou" : "Como você pagou"}</label>
          <div className="flex flex-wrap gap-1.5">
            {FORMAS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setForma(f.id);
                  setTaxaTxt(null);
                }}
                className={chip(forma === f.id)}
              >
                {f.rotulo}
              </button>
            ))}
          </div>
        </div>

        {venda && forma === "credito" && (
          <div>
            <label className={rotulo}>Parcelas no cartão</label>
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setParcelas(n);
                    setTaxaTxt(null);
                  }}
                  className={`${chip(parcelas === n)} px-0 text-center`}
                >
                  {n}x
                </button>
              ))}
            </div>
          </div>
        )}

        {comTaxa && (
          <div>
            <label className={rotulo}>Taxa da maquininha (%)</label>
            <input
              value={taxaTxt ?? String(taxaAuto).replace(".", ",")}
              onChange={(e) => setTaxaTxt(e.target.value)}
              inputMode="decimal"
              className={campo}
            />
            <p className="mt-1 text-[11px] text-white/45">
              Começa com a taxa cadastrada em “Taxas” na página Caixa. Pode ajustar só para esta
              venda.
            </p>
          </div>
        )}

        {previa && (
          <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/85">
            {previa.n > 1 ? (
              <>
                <strong className="text-white">
                  {previa.n} parcelas de {reais(previa.parcela)}
                </strong>{" "}
                caem na conta, uma por mês.
              </>
            ) : (
              <>
                <strong className="text-white">{reais(previa.liquido)}</strong> caem na conta.
              </>
            )}
            <span className="block text-[12px] text-white/55">
              Total líquido {reais(previa.liquido)}
              {valor - previa.liquido > 0.004 && ` (taxa de ${reais(valor - previa.liquido)})`}.
            </span>
          </div>
        )}

        {erro && <p className="text-sm text-rose-300">{erro}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onFechar} className={btnSecundario}>
            Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={salvando} className={btnPrimario}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </PainelModal>
  );
}

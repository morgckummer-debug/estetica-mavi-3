import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { hojeSP } from "@/lib/agenda";
import {
  CATEGORIAS_SAIDA,
  FORMAS,
  criarLancamento,
  dividirParcelas,
  lerValor,
  reais,
  taxaSugerida,
  valorLiquido,
  type CaixaConfig,
  type FormaPagamento,
} from "@/lib/caixa";
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
  onFechar,
  onSalvo,
}: {
  tipo: "entrada" | "saida";
  config: CaixaConfig;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const venda = tipo === "entrada";
  const [data, setData] = useState(hojeSP());
  const [descricao, setDescricao] = useState("");
  const [cliente, setCliente] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS_SAIDA[0]);
  const [valorTxt, setValorTxt] = useState("");
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [parcelas, setParcelas] = useState(1);
  // Enquanto a taxa não for editada à mão, acompanha forma e parcelas.
  const [taxaTxt, setTaxaTxt] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
    if (!descricao.trim()) return setErro("Escreva uma descrição.");
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
        </div>

        {venda && (
          <div>
            <label className={rotulo}>Cliente (opcional)</label>
            <input value={cliente} onChange={(e) => setCliente(e.target.value)} className={campo} />
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

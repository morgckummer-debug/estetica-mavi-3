import { useState } from "react";
import { Loader2 } from "lucide-react";
import { lerValor, salvarConfigCaixa, type CaixaConfig } from "@/lib/caixa";
import { PainelModal } from "@/components/PainelModal";
import { btnPrimario, btnSecundario, campo, rotulo } from "@/components/agenda/estilos";

// Taxas cobradas pela maquininha. Servem só para já vir preenchido nas vendas
// novas (cada venda ainda pode ter a sua).
export function TaxasCaixa({
  config,
  onFechar,
  onSalvo,
}: {
  config: CaixaConfig;
  onFechar: () => void;
  onSalvo: (cfg: CaixaConfig) => void;
}) {
  const txt = (n: number) => String(n).replace(".", ",");
  const [debito, setDebito] = useState(txt(config.taxa_debito));
  const [aVista, setAVista] = useState(txt(config.taxa_credito_a_vista));
  const [parcelado, setParcelado] = useState(txt(config.taxa_credito_parcelado));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    const cfg = {
      taxa_debito: lerValor(debito),
      taxa_credito_a_vista: lerValor(aVista),
      taxa_credito_parcelado: lerValor(parcelado),
    };
    if (Object.values(cfg).some((v) => !(v >= 0 && v < 100))) {
      return setErro("Cada taxa precisa ficar entre 0 e 100%.");
    }
    setSalvando(true);
    setErro(null);
    try {
      await salvarConfigCaixa(cfg);
      onSalvo(cfg);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  };

  return (
    <PainelModal onFechar={onFechar}>
      <h3 className="mb-1 font-display text-[24px] text-white">Taxas da maquininha</h3>
      <p className="mb-4 text-[12.5px] text-white/55">
        Confira no contrato ou no app da maquininha. Pix e dinheiro não têm taxa.
      </p>
      <div className="space-y-3">
        <div>
          <label className={rotulo}>Débito (%)</label>
          <input
            value={debito}
            onChange={(e) => setDebito(e.target.value)}
            inputMode="decimal"
            className={campo}
          />
        </div>
        <div>
          <label className={rotulo}>Crédito à vista (%)</label>
          <input
            value={aVista}
            onChange={(e) => setAVista(e.target.value)}
            inputMode="decimal"
            className={campo}
          />
        </div>
        <div>
          <label className={rotulo}>Crédito parcelado (%)</label>
          <input
            value={parcelado}
            onChange={(e) => setParcelado(e.target.value)}
            inputMode="decimal"
            className={campo}
          />
        </div>
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

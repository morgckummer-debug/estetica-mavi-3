import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Percent,
  Tag,
  Trash2,
} from "lucide-react";
import { podeVerCaixa, sessaoValida } from "@/lib/painel";
import { hojeSP, inicioDoMes, rotuloMesAno, somarMeses, ultimoDiaDoMes } from "@/lib/agenda";
import {
  CONFIG_PADRAO,
  FORMAS,
  carregarConfigCaixa,
  excluirLancamento,
  listarLancamentos,
  listarPrecos,
  recebimentosDe,
  reais,
  type CaixaConfig,
  type Lancamento,
  type Preco,
  type Recebimento,
} from "@/lib/caixa";
import { NovoLancamento } from "@/components/caixa/NovoLancamento";
import { PrecosCaixa } from "@/components/caixa/PrecosCaixa";
import { TaxasCaixa } from "@/components/caixa/TaxasCaixa";

export const Route = createFileRoute("/painel/caixa")({
  component: PaginaCaixa,
});

// TEMPORÁRIO (Caixa em desenvolvimento): quem não puder vê-lo é mandada de volta.
function PaginaCaixa() {
  const [permitido, setPermitido] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    sessaoValida().then((s) => {
      const ok = podeVerCaixa(s?.email);
      setPermitido(ok);
      if (!ok) navigate({ to: "/painel", replace: true });
    });
  }, [navigate]);

  if (!permitido) return null;
  return <CaixaConteudo />;
}

type Filtro = "todos" | "entradas" | "saidas";

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todos", rotulo: "Tudo" },
  { id: "entradas", rotulo: "Entradas" },
  { id: "saidas", rotulo: "Saídas" },
];

const botaoSuave =
  "inline-flex items-center gap-1.5 rounded-full border border-painel-border bg-white px-4 py-2 text-[13px] font-medium text-painel-chip-text hover:border-painel-primary/40 transition-colors";

const dataBR = (ymd: string) => ymd.split("-").reverse().join("/");
const rotuloForma = (id: string) => FORMAS.find((f) => f.id === id)?.rotulo ?? id;

function CaixaConteudo() {
  const [mes, setMes] = useState(() => inicioDoMes(hojeSP()));
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [config, setConfig] = useState<CaixaConfig>(CONFIG_PADRAO);
  const [precos, setPrecos] = useState<Preco[]>([]);
  const [editandoPrecos, setEditandoPrecos] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [novo, setNovo] = useState<"entrada" | "saida" | null>(null);
  const [taxas, setTaxas] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [ls, cfg, ps] = await Promise.all([
        listarLancamentos(),
        carregarConfigCaixa(),
        listarPrecos(),
      ]);
      setLancamentos(ls);
      setConfig(cfg);
      setPrecos(ps);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o caixa.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const avisar = (mensagem: string) => {
    setAviso(mensagem);
    window.setTimeout(() => setAviso(null), 4000);
  };

  const hoje = hojeSP();
  const fimMes = ultimoDiaDoMes(mes);

  const todosRecebimentos = useMemo(() => lancamentos.flatMap(recebimentosDe), [lancamentos]);

  const doMes = useMemo(
    () =>
      todosRecebimentos
        .filter((r) => r.data >= mes && r.data <= fimMes)
        .sort((a, b) => b.data.localeCompare(a.data) || a.numero - b.numero),
    [todosRecebimentos, mes, fimMes],
  );

  const resumo = useMemo(() => {
    const soma = (rs: Recebimento[]) => rs.reduce((t, r) => t + r.liquido, 0);
    const entradas = doMes.filter((r) => r.lancamento.tipo === "entrada");
    const saidas = doMes.filter((r) => r.lancamento.tipo === "saida");
    const recebido = soma(entradas.filter((r) => r.data <= hoje));
    return {
      recebido,
      aReceber: soma(entradas.filter((r) => r.data > hoje)),
      saidas: soma(saidas),
      saldo: recebido - soma(saidas),
      // Parcelas de meses depois do que está na tela.
      futuro: soma(
        todosRecebimentos.filter((r) => r.lancamento.tipo === "entrada" && r.data > fimMes),
      ),
    };
  }, [doMes, todosRecebimentos, hoje, fimMes]);

  const visiveis = doMes.filter(
    (r) =>
      filtro === "todos" ||
      (filtro === "entradas" ? r.lancamento.tipo === "entrada" : r.lancamento.tipo === "saida"),
  );

  const excluir = async (l: Lancamento) => {
    const parcelado = l.tipo === "entrada" && l.parcelas > 1;
    const texto = parcelado
      ? `Excluir esta venda? As ${l.parcelas} parcelas somem do caixa, inclusive as de outros meses.`
      : "Excluir este lançamento?";
    if (!window.confirm(texto)) return;
    try {
      await excluirLancamento(l.id);
      avisar("Lançamento excluído.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  };

  // Planilha do mês (abre no Excel/Google Sheets), para levar ao contador.
  const exportar = () => {
    const linhas = [
      ["Data", "Tipo", "Descrição", "Cliente", "Categoria", "Forma", "Parcela", "Valor líquido"],
      ...[...doMes].reverse().map((r) => {
        const l = r.lancamento;
        return [
          dataBR(r.data),
          l.tipo === "entrada" ? "Entrada" : "Saída",
          l.descricao,
          l.cliente_nome ?? "",
          l.categoria ?? "",
          rotuloForma(l.forma),
          r.total > 1 ? `${r.numero}/${r.total}` : "",
          (l.tipo === "entrada" ? r.liquido : -r.liquido).toFixed(2).replace(".", ","),
        ];
      }),
    ];
    const csv = linhas
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `caixa-${mes.slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-[34px] text-painel-title">Caixa MAVI</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setEditandoPrecos(true)} className={botaoSuave}>
            <Tag className="h-3.5 w-3.5" />
            Preços
          </button>
          <button type="button" onClick={() => setTaxas(true)} className={botaoSuave}>
            <Percent className="h-3.5 w-3.5" />
            Taxas
          </button>
          <button type="button" onClick={() => setNovo("saida")} className={botaoSuave}>
            <ArrowUpCircle className="h-3.5 w-3.5" />
            Nova saída
          </button>
          <button
            type="button"
            onClick={() => setNovo("entrada")}
            className="inline-flex items-center gap-1.5 rounded-full bg-painel-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-painel-primary/90 transition-colors"
          >
            <ArrowDownCircle className="h-3.5 w-3.5" />
            Nova venda
          </button>
        </div>
      </div>
      <p className="mb-6 text-sm text-painel-muted">
        Os valores já saem líquidos, sem a taxa da maquininha. Cartão cai uma parcela por mês.
      </p>

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setMes(somarMeses(mes, -1))}
          title="Mês anterior"
          className="rounded-full border border-painel-border bg-white p-2 text-painel-chip-text hover:border-painel-primary/40 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setMes(inicioDoMes(hoje))}
          disabled={mes === inicioDoMes(hoje)}
          className="rounded-full border border-painel-border bg-white px-3.5 py-1.5 text-[13px] font-medium text-painel-chip-text hover:border-painel-primary/40 transition-colors disabled:opacity-40"
        >
          Este mês
        </button>
        <button
          type="button"
          onClick={() => setMes(somarMeses(mes, 1))}
          title="Próximo mês"
          className="rounded-full border border-painel-border bg-white p-2 text-painel-chip-text hover:border-painel-primary/40 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <h3 className="ml-2 font-display text-[26px] text-painel-title first-letter:uppercase">
          {rotuloMesAno(mes)}
        </h3>
      </div>

      {aviso && (
        <div className="mb-4 rounded-xl border border-painel-green/30 bg-painel-green/10 px-4 py-3 text-sm text-painel-green">
          {aviso}
        </div>
      )}
      {erro && (
        <div className="mb-4 rounded-xl border border-painel-alert-border bg-painel-alert-bg px-4 py-3 text-sm text-painel-alert-text">
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-painel-muted" />
        </div>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <Cartao rotulo="Recebido" valor={resumo.recebido} cor="text-painel-green" />
            <Cartao rotulo="A receber no mês" valor={resumo.aReceber} />
            <Cartao rotulo="Saídas" valor={resumo.saidas} cor="text-[#b0405a]" />
            <Cartao rotulo="Saldo do mês" valor={resumo.saldo} forte />
          </div>
          {resumo.futuro > 0 && (
            <p className="mb-5 text-[13px] text-painel-muted">
              Ainda vai entrar nos próximos meses: <strong>{reais(resumo.futuro)}</strong> (parcelas
              de cartão já vendidas).
            </p>
          )}

          <div className="mb-3 mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-full border border-painel-border bg-white p-1">
              {FILTROS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltro(f.id)}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
                    filtro === f.id
                      ? "bg-painel-primary text-white"
                      : "text-painel-chip-text hover:text-painel-title"
                  }`}
                >
                  {f.rotulo}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={exportar}
              disabled={doMes.length === 0}
              className={botaoSuave}
            >
              <Download className="h-3.5 w-3.5" />
              Exportar planilha
            </button>
          </div>

          {visiveis.length === 0 ? (
            <div className="rounded-2xl border border-painel-border bg-white px-6 py-12 text-center text-sm text-painel-muted">
              Nenhum lançamento neste mês.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-painel-border bg-white">
              {visiveis.map((r) => (
                <Linha
                  key={`${r.lancamento.id}-${r.numero}`}
                  r={r}
                  futuro={r.data > hoje}
                  onExcluir={() => excluir(r.lancamento)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {novo && (
        <NovoLancamento
          tipo={novo}
          config={config}
          precos={precos}
          onFechar={() => setNovo(null)}
          onSalvo={() => {
            setNovo(null);
            avisar(novo === "entrada" ? "Venda lançada." : "Saída lançada.");
            carregar();
          }}
        />
      )}
      {editandoPrecos && (
        <PrecosCaixa
          precos={precos}
          onFechar={() => setEditandoPrecos(false)}
          onSalvo={() => {
            setEditandoPrecos(false);
            avisar("Preços salvos.");
            carregar();
          }}
        />
      )}
      {taxas && (
        <TaxasCaixa
          config={config}
          onFechar={() => setTaxas(false)}
          onSalvo={(cfg) => {
            setConfig(cfg);
            setTaxas(false);
            avisar("Taxas salvas.");
          }}
        />
      )}
    </div>
  );
}

function Cartao({
  rotulo,
  valor,
  cor = "text-painel-title",
  forte = false,
}: {
  rotulo: string;
  valor: number;
  cor?: string;
  forte?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        forte ? "border-painel-primary/40 bg-painel-badge-bg/50" : "border-painel-border bg-white"
      }`}
    >
      <p className="text-[12.5px] text-painel-chip-text">{rotulo}</p>
      <p
        className={`mt-1 font-display text-[24px] leading-none ${valor < 0 ? "text-[#b0405a]" : cor}`}
      >
        {reais(valor)}
      </p>
    </div>
  );
}

function Linha({
  r,
  futuro,
  onExcluir,
}: {
  r: Recebimento;
  futuro: boolean;
  onExcluir: () => void;
}) {
  const l = r.lancamento;
  const entrada = l.tipo === "entrada";
  const detalhes = [
    l.cliente_nome,
    l.categoria,
    rotuloForma(l.forma) + (l.forma === "credito" && l.parcelas > 1 ? ` em ${l.parcelas}x` : ""),
    r.numero === 1 && l.data !== r.data ? `venda em ${dataBR(l.data)}` : null,
  ].filter(Boolean);
  return (
    <div className="flex items-center gap-3 border-b border-painel-border/60 px-4 py-3 last:border-b-0">
      <span className="w-[52px] shrink-0 text-[13px] font-medium text-painel-chip-text">
        {dataBR(r.data).slice(0, 5)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-painel-title">
          {l.descricao}
          {r.total > 1 && (
            <span className="ml-2 rounded-full bg-painel-badge-bg px-2 py-0.5 text-[11px] font-semibold text-painel-primary">
              parcela {r.numero}/{r.total}
            </span>
          )}
          {entrada && futuro && (
            <span className="ml-2 rounded-full bg-painel-gold-soft/60 px-2 py-0.5 text-[11px] font-semibold text-painel-gold">
              a receber
            </span>
          )}
        </p>
        <p className="truncate text-[12px] text-painel-muted">{detalhes.join(" · ")}</p>
      </div>
      <p
        className={`shrink-0 text-[14px] font-semibold ${entrada ? "text-painel-green" : "text-[#b0405a]"}`}
      >
        {entrada ? "+" : "−"} {reais(r.liquido)}
      </p>
      <button
        type="button"
        onClick={onExcluir}
        title="Excluir"
        className="shrink-0 rounded-full p-1.5 text-painel-muted transition-colors hover:bg-painel-badge-bg/60 hover:text-[#b0405a]"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

import { apiRest } from "./painel";
import { somarDias } from "./agenda-datas";

// Livro caixa: vendas (entradas) e saídas. A venda é gravada uma vez; as
// parcelas do cartão são calculadas aqui (ver `recebimentosDe`) a partir da
// data, do número de parcelas e da taxa da maquininha.

export type FormaPagamento = "pix" | "debito" | "credito" | "dinheiro";

export const FORMAS: { id: FormaPagamento; rotulo: string }[] = [
  { id: "pix", rotulo: "Pix" },
  { id: "debito", rotulo: "Débito" },
  { id: "credito", rotulo: "Crédito" },
  { id: "dinheiro", rotulo: "Dinheiro" },
];

export const CATEGORIAS_SAIDA = [
  "Produtos",
  "Aluguel e contas",
  "Equipamentos",
  "Marketing",
  "Salários",
  "Impostos",
  "Outros",
];

export type Lancamento = {
  id: string;
  created_at: string;
  data: string; // "YYYY-MM-DD"
  tipo: "entrada" | "saida";
  descricao: string;
  categoria: string | null;
  valor: number;
  forma: FormaPagamento;
  parcelas: number;
  taxa_pct: number;
  cliente_id: string | null;
  cliente_nome: string | null;
  contrato_id: string | null;
};

export type CaixaConfig = {
  taxa_debito: number;
  taxa_credito_a_vista: number;
  taxa_credito_parcelado: number;
};

export const CONFIG_PADRAO: CaixaConfig = {
  taxa_debito: 0,
  taxa_credito_a_vista: 0,
  taxa_credito_parcelado: 0,
};

/** Taxa sugerida para a forma de pagamento, conforme as taxas da maquininha. */
export function taxaSugerida(cfg: CaixaConfig, forma: FormaPagamento, parcelas: number): number {
  if (forma === "debito") return cfg.taxa_debito;
  if (forma === "credito")
    return parcelas > 1 ? cfg.taxa_credito_parcelado : cfg.taxa_credito_a_vista;
  return 0;
}

// ------------------------------------------------------------
// Cálculo das parcelas
// ------------------------------------------------------------

export type Recebimento = {
  lancamento: Lancamento;
  numero: number; // 1..parcelas
  total: number; // parcelas
  data: string; // dia em que o dinheiro cai
  liquido: number; // em reais, já sem a taxa
};

/** Soma `n` meses mantendo o dia (31/jan + 1 mês = 28/fev). */
export function somarMesesNoDia(ymd: string, n: number): string {
  const [a, m, d] = ymd.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m - 1 + n, Math.min(d, ultimo))).toISOString().slice(0, 10);
}

/** Valor que a clínica recebe de fato, depois da taxa da maquininha. */
export function valorLiquido(valor: number, taxaPct: number): number {
  return Math.round(valor * 100 * (1 - taxaPct / 100)) / 100;
}

/** Divide o líquido em parcelas em centavos; a diferença fica na última. */
export function dividirParcelas(liquido: number, n: number): number[] {
  const centavos = Math.round(liquido * 100);
  const base = Math.floor(centavos / n);
  return Array.from(
    { length: n },
    (_, i) => (i === n - 1 ? centavos - base * (n - 1) : base) / 100,
  );
}

/**
 * Quando e quanto cai de uma venda. Pix e dinheiro entram no dia; débito no
 * dia seguinte; crédito uma parcela por mês, a partir de 30 dias da venda.
 * Saídas saem no próprio dia, de uma vez.
 */
export function recebimentosDe(l: Lancamento): Recebimento[] {
  if (l.tipo === "saida") {
    return [{ lancamento: l, numero: 1, total: 1, data: l.data, liquido: l.valor }];
  }
  const liquido = valorLiquido(l.valor, l.taxa_pct);
  if (l.forma === "credito") {
    return dividirParcelas(liquido, l.parcelas).map((v, i) => ({
      lancamento: l,
      numero: i + 1,
      total: l.parcelas,
      data: somarMesesNoDia(l.data, i + 1),
      liquido: v,
    }));
  }
  return [
    {
      lancamento: l,
      numero: 1,
      total: 1,
      data: l.forma === "debito" ? somarDias(l.data, 1) : l.data,
      liquido,
    },
  ];
}

// "1.200,50" / "1200.5" / "R$ 90" → 1200.5 (NaN se não der para ler).
export function lerValor(texto: string): number {
  const limpo = texto.replace(/[^\d.,]/g, "");
  if (!limpo) return NaN;
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export const reais = (v: number): string =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ------------------------------------------------------------
// Acesso ao banco
// ------------------------------------------------------------

const MIGRACAO =
  "Rode a migração 20261014120000_caixa.sql no Supabase (SQL Editor) para ativar o Caixa.";

async function falha(res: Response, padrao: string): Promise<never> {
  const detalhe = await res.text().catch(() => "");
  throw new Error(/does not exist/i.test(detalhe) ? MIGRACAO : padrao);
}

/** Todos os lançamentos (o volume de uma clínica pequena cabe numa só carga). */
export async function listarLancamentos(): Promise<Lancamento[]> {
  const res = await apiRest("caixa_lancamentos?select=*&order=data.desc,created_at.desc");
  if (!res.ok) return falha(res, "Não foi possível carregar o caixa.");
  return ((await res.json()) as Lancamento[]).map((l) => ({
    ...l,
    valor: Number(l.valor),
    taxa_pct: Number(l.taxa_pct),
  }));
}

export type NovoLancamento = {
  data: string;
  tipo: "entrada" | "saida";
  descricao: string;
  categoria?: string | null;
  valor: number;
  forma: FormaPagamento;
  parcelas?: number;
  taxa_pct?: number;
  cliente_id?: string | null;
  cliente_nome?: string | null;
  contrato_id?: string | null;
};

export async function criarLancamento(dados: NovoLancamento): Promise<void> {
  const res = await apiRest("caixa_lancamentos", {
    method: "POST",
    body: JSON.stringify({
      data: dados.data,
      tipo: dados.tipo,
      descricao: dados.descricao.trim(),
      categoria: dados.categoria ?? null,
      valor: dados.valor,
      forma: dados.forma,
      parcelas: dados.forma === "credito" ? (dados.parcelas ?? 1) : 1,
      taxa_pct: dados.taxa_pct ?? 0,
      cliente_id: dados.cliente_id ?? null,
      cliente_nome: dados.cliente_nome?.trim() || null,
      contrato_id: dados.contrato_id ?? null,
    }),
  });
  if (!res.ok) return falha(res, "Não foi possível salvar o lançamento.");
}

export async function excluirLancamento(id: string): Promise<void> {
  const res = await apiRest(`caixa_lancamentos?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) return falha(res, "Não foi possível excluir o lançamento.");
}

export async function carregarConfigCaixa(): Promise<CaixaConfig> {
  const res = await apiRest("caixa_config?select=*&id=eq.1");
  if (!res.ok) return CONFIG_PADRAO;
  const [linha] = (await res.json()) as CaixaConfig[];
  return linha
    ? {
        taxa_debito: Number(linha.taxa_debito),
        taxa_credito_a_vista: Number(linha.taxa_credito_a_vista),
        taxa_credito_parcelado: Number(linha.taxa_credito_parcelado),
      }
    : CONFIG_PADRAO;
}

export async function salvarConfigCaixa(cfg: CaixaConfig): Promise<void> {
  const res = await apiRest("caixa_config?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ id: 1, ...cfg }),
  });
  if (!res.ok) return falha(res, "Não foi possível salvar as taxas.");
}

// ------------------------------------------------------------
// Tabela de preços
// ------------------------------------------------------------

export type PacotePreco = {
  sessoes: number;
  valor: number;
  // Nome opcional para pacotes fora do padrão (ex.: "3 áreas de laser").
  rotulo?: string;
};

export type Preco = {
  id: string;
  nome: string;
  preco_sessao: number | null;
  pacotes: PacotePreco[];
  ordem: number;
};

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** O preço cadastrado para um procedimento (compara sem acento e sem maiúsculas). */
export function precoDe(precos: Preco[], nome: string): Preco | undefined {
  const alvo = semAcento(nome);
  return alvo ? precos.find((p) => semAcento(p.nome) === alvo) : undefined;
}

export type OpcaoDePreco = { chave: string; descricao: string; valor: number };

/** Cada jeito de vender um procedimento: sessão avulsa e cada pacote. */
export function opcoesDoPreco(p: Preco): OpcaoDePreco[] {
  const opcoes: OpcaoDePreco[] = [];
  if (p.preco_sessao != null) {
    opcoes.push({
      chave: `${p.id}:1`,
      descricao: `${p.nome} (sessão avulsa)`,
      valor: p.preco_sessao,
    });
  }
  for (const pc of [...p.pacotes].sort((a, b) => a.sessoes - b.sessoes)) {
    opcoes.push({
      chave: `${p.id}:p${pc.sessoes}:${pc.valor}`,
      descricao: `${p.nome} (${pc.rotulo?.trim() || `pacote de ${pc.sessoes} sessões`})`,
      valor: pc.valor,
    });
  }
  return opcoes;
}

/**
 * Valor sugerido para `quantidade` sessões de um procedimento: o pacote de
 * exatamente esse tamanho, senão a quantidade × o preço da sessão. null se a
 * tabela não tem como calcular.
 */
export function valorSugerido(p: Preco | undefined, quantidade: number): number | null {
  if (!p || !(quantidade > 0)) return null;
  const pacote = p.pacotes.find((x) => x.sessoes === quantidade);
  if (pacote) return pacote.valor;
  if (p.preco_sessao != null) return Math.round(p.preco_sessao * quantidade * 100) / 100;
  return null;
}

export async function listarPrecos(): Promise<Preco[]> {
  const res = await apiRest("caixa_precos?select=*&order=ordem.asc,nome.asc");
  if (!res.ok) return [];
  return ((await res.json()) as Preco[]).map((p) => ({
    ...p,
    preco_sessao: p.preco_sessao == null ? null : Number(p.preco_sessao),
    pacotes: (p.pacotes ?? []).map((x) => ({
      ...x,
      sessoes: Number(x.sessoes),
      valor: Number(x.valor),
    })),
  }));
}

/** Grava a tabela inteira: cria/atualiza as linhas e apaga as que saíram. */
export async function salvarPrecos(itens: Preco[], removidos: string[]): Promise<void> {
  for (const id of removidos) {
    const del = await apiRest(`caixa_precos?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!del.ok) return falha(del, "Não foi possível salvar os preços.");
  }
  if (itens.length === 0) return;
  const res = await apiRest("caixa_precos?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(
      itens.map((p, i) => ({
        id: p.id,
        nome: p.nome.trim(),
        preco_sessao: p.preco_sessao,
        pacotes: p.pacotes,
        ordem: i,
      })),
    ),
  });
  if (!res.ok) return falha(res, "Não foi possível salvar os preços.");
}

import type { PacoteItem } from "@/lib/painel";

// Conta dos pacotes de sessões de cada item, usada no histórico de sessões
// da ficha e na agenda (o "4/10" de cada atendimento).

// Normaliza o valor salvo (formato antigo — um número, ou uma lista de
// números — ou já uma lista de pacotes) para sempre trabalhar com uma lista
// de PacoteItem.
export function normalizarPacotes(v: number | number[] | PacoteItem[] | undefined): PacoteItem[] {
  if (!Array.isArray(v)) return typeof v === "number" && v > 0 ? [{ tamanho: v }] : [];
  return v
    .map((x) => (typeof x === "number" ? { tamanho: x } : x))
    .filter((p): p is PacoteItem => typeof p?.tamanho === "number" && p.tamanho > 0);
}

// A faixa [inicio, fim) que um pacote ocupa dentro da lista cronológica de
// sessões de um item. `inicio` nunca fica antes de `inicioIndice` (o total
// de sessões que já existiam quando o pacote foi registrado) — é isso que
// impede uma sessão avulsa feita antes de existir o pacote de ser puxada
// pra dentro dele.
export type FaixaPacote = { pacote: PacoteItem; numero: number; inicio: number; fim: number };

export function faixasDePacotes(pacotes: PacoteItem[]): FaixaPacote[] {
  const faixas: FaixaPacote[] = [];
  let indice = 0;
  pacotes.forEach((p, i) => {
    const inicio = Math.max(indice, p.inicioIndice ?? 0);
    const fim = inicio + p.tamanho;
    faixas.push({ pacote: p, numero: i + 1, inicio, fim });
    indice = fim;
  });
  return faixas;
}

// Há um pacote em andamento (incompleto) para esse total de sessões já
// registradas? Só o último pacote definido pode estar em aberto — os
// anteriores são sempre concluídos antes de um novo poder ser cadastrado.
export function temPacoteEmAberto(faixas: FaixaPacote[], totalSessoes: number): boolean {
  return faixas.some((f) => totalSessoes >= f.inicio && totalSessoes < f.fim);
}

// Com `feitas` sessões já registradas do item, a próxima é a de número
// `numero` de um pacote de `total`. Null se a próxima cai fora de qualquer
// pacote (avulsa, ou todos os pacotes já concluídos).
export function proximaNoPacote(
  pacotes: PacoteItem[],
  feitas: number,
): { numero: number; total: number } | null {
  const faixa = faixasDePacotes(pacotes).find((f) => feitas >= f.inicio && feitas < f.fim);
  return faixa ? { numero: feitas - faixa.inicio + 1, total: faixa.pacote.tamanho } : null;
}

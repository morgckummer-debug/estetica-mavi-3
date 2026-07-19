// Agregações derivadas das fichas de uma cliente (tipos de tratamento,
// alertas, se está toda arquivada). A identidade da cliente (nome, telefone,
// CPF, endereço...) já vem pronta da tabela `clientes` — ver `lib/painel.ts`
// (`Cliente`, `listarClientes`, `obterCliente`). Antes da migração 0011, esse
// arquivo tinha a lógica de AGRUPAR fichas por nome+telefone/CPF pra inferir
// quem era a mesma pessoa; isso só existe hoje no script
// scripts/migrar-clientes.mjs (rodado uma única vez, sobre os dados antigos).

import type { Ficha } from "./painel";
import type { Tipo } from "@/data/anamnese";

// Só os dígitos (para comparar telefone/CPF sem depender da máscara).
export function digitos(v: string | null | undefined): string {
  return String(v ?? "").replace(/\D/g, "");
}

export type FichasAgregadas = {
  tipos: Tipo[]; // tipos distintos, na ordem em que aparecem
  alertas: number; // total de alertas somando as fichas
  // Só considera a cliente inativa (visual acinzentado na lista) quando
  // TODAS as fichas dela estão arquivadas — se ela ainda tem um
  // procedimento ativo, continua com a aparência normal.
  todasArquivadas: boolean;
};

// Fichas já vêm mais recentes primeiro (listarFichas/listarFichasDoCliente
// ordenam por created_at desc).
export function agregarFichas(fichas: Ficha[]): FichasAgregadas {
  const tipos: Tipo[] = [];
  for (const f of fichas) if (!tipos.includes(f.tipo)) tipos.push(f.tipo);
  return {
    tipos,
    alertas: fichas.reduce((n, f) => n + (f.alertas?.length ?? 0), 0),
    todasArquivadas: fichas.length > 0 && fichas.every((f) => f.arquivada),
  };
}

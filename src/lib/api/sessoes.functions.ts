import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { rpc } from "./rpc";

// Confirmação pública de uma sessão de atendimento (o "assinar" da cliente).
// A cliente abre o link /confirmar/<token> no próprio celular. Estas funções
// chamam funções SECURITY DEFINER do Postgres (ver 0005_sessoes.sql), então
// usam só a chave PÚBLICA (anon) e nunca expõem a tabela nem dados de saúde.

export type SessaoPublica = {
  primeiro_nome: string;
  data: string; // "YYYY-MM-DD"
  areas: string[];
  observacao: string | null;
  confirmado: boolean;
  confirmado_em: string | null;
};

// Dados mínimos para montar a tela de confirmação. Retorna null se o token
// não existir (link inválido/antigo).
export const obterSessaoPublica = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }) => {
    const rows = (await rpc("sessao_por_token", { p_token: data.token })) as SessaoPublica[];
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  });

// Marca a sessão como confirmada pela cliente. Retorna o momento da confirmação.
export const confirmarSessao = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }) => {
    const quando = (await rpc("confirmar_sessao", { p_token: data.token })) as string | null;
    return { confirmado_em: quando };
  });

// Confirmação em LOTE: várias sessões da mesma cliente feitas no mesmo dia
// (ex.: depilação de axila + abdome + queixo) confirmadas por um único
// link. Compartilha o mesmo modelo de segurança do fluxo individual: só
// devolve/altera as linhas do lote_token informado (SECURITY DEFINER em
// 0021_confirmacao_lote.sql).
export type SessaoLoteItem = {
  sessao_id: string;
  primeiro_nome: string;
  data: string; // "YYYY-MM-DD"
  areas: string[];
  observacao: string | null;
  confirmado: boolean;
  confirmado_em: string | null;
};

export const obterLotePublico = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }) => {
    const rows = (await rpc("sessoes_por_lote", { p_lote_token: data.token })) as SessaoLoteItem[];
    return Array.isArray(rows) ? rows : [];
  });

export const confirmarLote = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }) => {
    const quando = (await rpc("confirmar_lote", { p_lote_token: data.token })) as string | null;
    return { confirmado_em: quando };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { rpc } from "./rpc";

// Relatório público de progresso de um pacote (ver 0010_relatorios_pacote.sql):
// a cliente abre o link /relatorio/<token> e confere sozinha a contagem de
// sessões — sem precisar confiar de memória na Marina, e sem a Marina expor
// a ficha inteira.

export type SessaoRelatorio = {
  data: string; // "YYYY-MM-DD"
  confirmado: boolean;
  confirmado_em: string | null;
};

export type RelatorioPacotePublico = {
  cliente_nome: string;
  item: string;
  pacote_total: number;
  concluido: boolean;
  sessoes: SessaoRelatorio[];
};

// Dados mínimos para montar a tela do relatório. Retorna null se o token
// não existir (link inválido/antigo).
export const obterRelatorioPacote = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }) => {
    const rows = (await rpc("relatorio_pacote_por_token", {
      p_token: data.token,
    })) as RelatorioPacotePublico[];
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  });

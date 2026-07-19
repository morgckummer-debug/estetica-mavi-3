import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseComoUsuaria } from "../supabase-client";

export default defineTool({
  name: "listar_fichas",
  title: "Listar fichas de clientes",
  description:
    "Busca fichas de clientes por parte do nome ou telefone; sem busca, retorna as mais recentes. Retorna nome, telefone, tipo (corporal/facial/laser), data de criação e se está arquivada. Não expõe respostas de anamnese nem dados clínicos.",
  inputSchema: {
    busca: z
      .string()
      .optional()
      .describe("Trecho do nome ou telefone. Opcional."),
    limite: z
      .number()
      .int()
      .optional()
      .describe("Máximo de fichas retornadas (1–50). Padrão 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca, limite }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticada." }], isError: true };
    }
    const max = Math.min(Math.max(limite ?? 20, 1), 50);
    const supabase = supabaseComoUsuaria(ctx.getToken()!);
    let query = supabase
      .from("fichas")
      .select("id, created_at, tipo, nome, telefone, arquivada")
      .eq("excluida", false)
      .order("created_at", { ascending: false })
      .limit(max);
    const termo = busca?.trim();
    if (termo) {
      // Escape wildcards do PostgREST para busca literal.
      const seguro = termo.replace(/[%,()]/g, " ").trim();
      if (seguro) {
        query = query.or(`nome.ilike.%${seguro}%,telefone.ilike.%${seguro}%`);
      }
    }
    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: `Erro: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { fichas: data ?? [] },
    };
  },
});
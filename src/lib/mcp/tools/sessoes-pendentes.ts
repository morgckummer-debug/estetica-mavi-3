import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseComoUsuaria } from "../supabase-client";

const DIAS_TOLERANCIA = 15;

function diasAtrasISO(dias: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

export default defineTool({
  name: "sessoes_pendentes_confirmacao",
  title: "Sessões pendentes de confirmação",
  description:
    "Lista sessões de atendimento realizadas há pelo menos 15 dias que ainda não foram confirmadas pela cliente pelo WhatsApp. Retorna nome, telefone, data e áreas atendidas.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticada." }], isError: true };
    }
    const supabase = supabaseComoUsuaria(ctx.getToken()!);
    const limite = diasAtrasISO(DIAS_TOLERANCIA);
    const { data, error } = await supabase
      .from("sessoes")
      .select("id, data, areas, ficha:fichas(nome, telefone, tipo)")
      .eq("confirmado", false)
      .eq("arquivado", false)
      .lte("data", limite)
      .order("data", { ascending: true });
    if (error) {
      return { content: [{ type: "text", text: `Erro: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { pendentes: data ?? [] },
    };
  },
});
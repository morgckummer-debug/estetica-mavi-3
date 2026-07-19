import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarFichas from "./tools/listar-fichas";
import sessoesPendentes from "./tools/sessoes-pendentes";

// Servidor MCP do MAVI. Cada tool roda como a usuária logada (Morgana ou
// Marina) via OAuth 2.1 do Supabase — as políticas RLS existentes das
// tabelas de fichas e sessões continuam valendo.
export default defineMcp({
  name: "mavi-mcp",
  title: "MAVI — Painel de Clientes",
  version: "0.1.0",
  instructions:
    "Ferramentas de leitura do painel MAVI Estética. Use `listar_fichas` para procurar clientes por nome ou telefone e `sessoes_pendentes_confirmacao` para ver quem ainda não confirmou o atendimento pelo WhatsApp.",
  auth: auth.oauth.issuer({
    issuer: "https://jjkmgkorqzbroebhksca.supabase.co/auth/v1",
    acceptedAudiences: "authenticated",
  }),
  tools: [listarFichas, sessoesPendentes],
});
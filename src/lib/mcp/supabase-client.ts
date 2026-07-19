import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../supabase";

// Cliente Supabase por-request, usando o token do usuário validado pelo MCP.
// A RLS existente das tabelas `fichas` e `sessoes` decide o que a Morgana
// ou a Marina podem ver — exatamente igual ao painel.
export function supabaseComoUsuaria(token: string) {
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
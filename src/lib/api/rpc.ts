import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../supabase";

// Chama uma função SECURITY DEFINER do Postgres com a chave PÚBLICA (anon).
// Usado pelas telas públicas (confirmação de sessão, relatório de pacote):
// nunca expõe as tabelas, só o que a função devolve.
//
// A chave só vai no header `apikey`, nunca em `Authorization: Bearer` — as
// chaves novas (sb_publishable_...) não são JWT, e o Supabase rejeita como
// "Invalid JWT" quem tenta autenticar com elas no Authorization.
export async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase não configurado (falta a chave pública).");
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    console.error("Falha na RPC", fn, res.status, detalhe);
    throw new Error("Não foi possível completar a operação. Tente novamente.");
  }
  return res.json();
}

// Funções que devolvem UMA coluna só (ex.: os horários livres) voltam do
// Supabase como lista simples (["2026-10-05", ...]); com mais colunas, como
// lista de objetos. Esta função aceita as duas formas e devolve só os valores.
export function colunaUnica(rows: unknown, chave: string): string[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>)[chave] : r))
    .filter((v): v is string => typeof v === "string");
}

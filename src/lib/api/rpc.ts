import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../supabase";

// Chama uma função SECURITY DEFINER do Postgres com a chave PÚBLICA (anon).
// Usado pelas telas públicas (confirmação de sessão, relatório de pacote):
// nunca expõe as tabelas, só o que a função devolve.
export async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase não configurado (falta a chave pública).");
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
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

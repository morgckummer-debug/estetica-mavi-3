import process from "node:process";

// Código de confirmação do agendamento de procedimento. Sai por e-mail, para o
// endereço JÁ cadastrado da cliente (nunca um digitado na hora). Quem gera e
// guarda o código é o banco (agenda_codigo_gerar), chamado com a chave de
// serviço, que só existe no servidor. Lidas dentro das funções, nunca no topo.
//
// Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (secreta), e as mesmas do
// e-mail de confirmação: RESEND_API_KEY, AGENDA_EMAIL_FROM, AGENDA_EMAIL_REPLY_TO.

export const VALIDADE_CODIGO_MIN = 10;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Chave de um CPF para contar tentativas sem guardar o CPF em texto puro.
export async function chaveDoCpf(digitos: string): Promise<string> {
  const bytes = new TextEncoder().encode(`cpf:${digitos}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Código de 6 dígitos. O erro de arredondamento do módulo é desprezível aqui.
function novoCodigo(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

// Chamada à função do banco com a chave de serviço. Só usada aqui, no servidor.
async function rpcServico<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error("Envio de código não configurado.");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: chave,
  };
  // Chaves antigas são JWT e vão também no Authorization; as novas (sb_secret_) não.
  if (!chave.startsWith("sb_")) headers.Authorization = `Bearer ${chave}`;

  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Falha na função ${fn} (${res.status}).`);
  return (await res.json()) as T;
}

async function enviarEmailCodigo(para: string, nome: string, codigo: string): Promise<void> {
  const chave = process.env.RESEND_API_KEY;
  const remetente = process.env.AGENDA_EMAIL_FROM;
  if (!chave || !remetente) {
    console.error("E-mail do código não enviado: Resend não configurado.");
    return;
  }

  const primeiro = nome.trim().split(" ")[0] || "";
  const assunto = `Seu código para agendar na MAVI: ${codigo}`;
  const texto = [
    `Oi${primeiro ? `, ${primeiro}` : ""}!`,
    "",
    `Seu código para confirmar o agendamento é: ${codigo}`,
    `Ele vale por ${VALIDADE_CODIGO_MIN} minutos.`,
    "",
    "Se você não pediu este código, pode ignorar este e-mail.",
    "",
    "MAVI Centro de Estética · Sete Lagoas, MG",
  ].join("\n");
  const html = `<p>${esc(texto).replace(/\n/g, "<br>")}</p>`;

  const resposta = process.env.AGENDA_EMAIL_REPLY_TO;
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), 6000);
  try {
    const res = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: remetente,
        to: [para],
        subject: assunto,
        html,
        text: texto,
        ...(resposta ? { reply_to: resposta } : {}),
      }),
      signal: controle.signal,
    });
    if (!res.ok) {
      console.error("Resend recusou o e-mail do código", res.status, await res.text());
    }
  } catch (e) {
    console.error("Falha ao enviar o e-mail do código", e instanceof Error ? e.message : e);
  } finally {
    clearTimeout(limite);
  }
}

// Gera o código para a cliente do CPF e manda por e-mail. Não devolve nada:
// quem chama responde igual existindo ou não cadastro.
export async function enviarCodigoAgenda(digitosCpf: string): Promise<void> {
  const codigo = novoCodigo();
  const r = await rpcServico<{ ok: boolean; email?: string; nome?: string }>(
    "agenda_codigo_gerar",
    { p_cpf: digitosCpf, p_codigo: codigo },
  );
  if (!r.ok || !r.email) return;
  await enviarEmailCodigo(r.email, r.nome ?? "", codigo);
}

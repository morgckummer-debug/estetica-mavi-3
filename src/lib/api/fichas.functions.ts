import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../supabase";

// Grava uma ficha de anamnese no Supabase.
// Usa a chave PÚBLICA (anon) — o banco só permite inserir, nunca ler
// (policy do 0003_anon_insert.sql). Ler as fichas continua restrito à
// Marina logada. Não precisa de chave secreta nem de config no hosting.

const schema = z.object({
  tipo: z.enum(["corporal", "facial", "laser", "cadastro"]),
  nome: z.string().min(1, "Informe o nome."),
  telefone: z.string().optional().default(""),
  respostas: z.record(z.string(), z.union([z.string(), z.boolean(), z.null()])).default({}),
  alertas: z.array(z.string()).default([]),
  termo_aceito: z.boolean(),
  autoriza_foto: z.boolean().default(false),
  consentimento_dados: z.boolean(),
});

// Acha (por telefone/CPF) ou cria a cliente dona da ficha, pela função
// security-definer `encontrar_ou_criar_cliente` (0012_clientes.sql) — o
// `anon` nunca lê/grava a tabela `clientes` direto, só chama essa função.
async function encontrarOuCriarCliente(
  respostas: Record<string, string | boolean | null>,
  telefone: string,
): Promise<string> {
  const texto = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/encontrar_ou_criar_cliente`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      p_nome: texto(respostas.nome) ?? "",
      p_telefone: telefone || null,
      p_cpf: texto(respostas.cpf),
      p_email: texto(respostas.email),
      p_nascimento: texto(respostas.nascimento),
      p_sexo: texto(respostas.sexo),
      p_profissao: texto(respostas.profissao),
      p_estado_civil: texto(respostas.estadoCivil),
      p_cep: texto(respostas.cep),
      p_endereco: texto(respostas.endereco),
      p_numero: texto(respostas.numero),
      p_bairro: texto(respostas.bairro),
      p_complemento: texto(respostas.complemento),
      p_cidade: texto(respostas.cidade),
      p_como_conheceu: texto(respostas.comoConheceu),
      p_autoriza_foto: false,
    }),
  });
  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    console.error("Falha ao localizar/criar cliente no Supabase:", res.status, detalhe);
    throw new Error("Não foi possível salvar seus dados. Tente novamente.");
  }
  return (await res.json()) as string;
}

export const salvarFicha = createServerFn({ method: "POST" })
  .inputValidator(schema)
  .handler(async ({ data }) => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Supabase não configurado (falta a chave pública).");
    }
    if (!data.termo_aceito) {
      throw new Error("É necessário aceitar o termo de responsabilidade.");
    }
    if (!data.consentimento_dados) {
      throw new Error("É necessário autorizar o tratamento dos seus dados (LGPD).");
    }

    const clienteId = await encontrarOuCriarCliente(data.respostas, data.telefone);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/fichas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        tipo: data.tipo,
        nome: data.nome,
        telefone: data.telefone || null,
        cliente_id: clienteId,
        respostas: data.respostas,
        alertas: data.alertas,
        termo_aceito: data.termo_aceito,
        autoriza_foto: data.autoriza_foto,
        consentimento_dados: data.consentimento_dados,
      }),
    });

    if (!res.ok) {
      const detalhe = await res.text().catch(() => "");
      console.error("Falha ao gravar ficha no Supabase:", res.status, detalhe);
      throw new Error("Não foi possível salvar a ficha. Tente novamente.");
    }

    return { ok: true } as const;
  });

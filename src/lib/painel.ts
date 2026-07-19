// Cliente do painel da Marina — fala com a API REST do Supabase por fetch.
// Login (Supabase Auth) + leitura/atualização das fichas. A sessão fica
// guardada no navegador (localStorage) e é renovada automaticamente.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase";
import type { Tipo } from "@/data/anamnese";

const CHAVE_SESSAO = "mavi_sessao";

export type Sessao = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix (segundos)
  email?: string;
};

// Uma entrada de pacote comprado (ou ganho de bônus) para um item. `bonus:
// true` marca sessões dadas de brinde numa promoção (não pagas) — usado pra
// exibir o selo "Bônus" e não confundir com o que a cliente pagou.
// `origemFichaId`/`origemItem` (só em bônus) guardam de qual item comprado
// esse bônus veio (ex.: comprou pacote de Virilha, ganhou Hidragloss de
// brinde) — usado pra mostrar o bônus dentro do card do item comprado, em
// vez de um card próprio separado.
export type PacoteItem = {
  tamanho: number;
  bonus?: boolean;
  origemFichaId?: string;
  origemItem?: string;
  // Quantas sessões desse item já existiam quando o pacote foi registrado.
  // Sessões anteriores a esse ponto (ex.: uma sessão avulsa feita antes de a
  // cliente fechar o pacote) ficam de fora dele — nunca contam como parte
  // das sessões do pacote, mesmo que o pacote seja registrado depois.
  inicioIndice?: number;
};

export type Ficha = {
  id: string;
  created_at: string;
  tipo: Tipo;
  nome: string;
  telefone: string | null;
  // Dona da ficha. Nullable só nas fichas de antes da migração 0011
  // (script scripts/migrar-clientes.mjs) — toda ficha nova já nasce ligada.
  cliente_id: string | null;
  respostas: Record<string, string | boolean | null>;
  alertas: string[];
  termo_aceito: boolean;
  autoriza_foto: boolean;
  consentimento_dados: boolean;
  medidas: Record<string, string>;
  relatorio: string | null;
  arquivada: boolean;
  // Soft delete: "Excluir" marca a ficha como excluída em vez de apagar de
  // verdade. Ela some das listas normais, mas fica recuperável em "Fichas
  // excluídas". Diferente de `arquivada`, que é um selo manual de cliente
  // inativa e continua aparecendo nas listas normalmente.
  excluida: boolean;
  // Pacotes comprados (ou ganhos de bônus) por item, em ordem, ex.:
  // "Axilas": [{tamanho:10}, {tamanho:2, bonus:true}] = comprou 10, completou,
  // ganhou mais 2 de brinde numa promoção. Aceita também os formatos antigos
  // (um número só, ou uma lista de números), salvos antes de existir bônus.
  pacotes: Record<string, number | number[] | PacoteItem[]>;
};

// Cadastro da cliente — fonte única da identidade (nome, contato,
// endereço...), separada da anamnese de cada tratamento (que continua em
// `Ficha`). Ver migração 0012_clientes.sql.
export type Cliente = {
  id: string;
  created_at: string;
  nome: string;
  telefone: string | null;
  cpf: string | null;
  email: string | null;
  nascimento: string | null; // "YYYY-MM-DD"
  sexo: string | null;
  profissao: string | null;
  estado_civil: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;
  cidade: string | null;
  como_conheceu: string | null;
  autoriza_foto: boolean;
  arquivada: boolean;
  excluida: boolean;
};

// Um contrato já gerado e impresso — ver migração 0013_contratos.sql.
export type Contrato = {
  id: string;
  cliente_id: string;
  created_at: string;
  profissao: string | null;
  estado_civil: string | null;
  itens: { chave: string; tipo: string; descricao: string; quantidade: string }[];
  forma_pagamento: string | null;
  autoriza_foto: boolean;
  data_contrato: string; // "YYYY-MM-DD"
  // Caminho do PDF assinado, anexado manualmente depois de imprimir (ver
  // migração 0018_contrato_pdf.sql). Null até a Marina anexar.
  pdf_path: string | null;
};

function agora(): number {
  return Math.floor(Date.now() / 1000);
}

function salvarSessao(s: Sessao | null): void {
  if (typeof window === "undefined") return;
  if (s) window.localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s));
  else window.localStorage.removeItem(CHAVE_SESSAO);
}

export function lerSessao(): Sessao | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CHAVE_SESSAO);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Sessao;
  } catch {
    return null;
  }
}

function authHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY ?? "",
  };
}

export async function entrar(email: string, senha: string): Promise<Sessao> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase não configurado. Verifique as variáveis de ambiente.");
  }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password: senha }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error_description?: string;
      msg?: string;
    };
    throw new Error(err.error_description || err.msg || "E-mail ou senha inválidos.");
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
    user?: { email?: string };
  };
  const sessao: Sessao = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: agora() + (data.expires_in ?? 3600),
    email: data.user?.email,
  };
  salvarSessao(sessao);
  return sessao;
}

async function renovar(sessao: Sessao): Promise<Sessao | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: sessao.refresh_token }),
  });
  if (!res.ok) {
    salvarSessao(null);
    return null;
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
    user?: { email?: string };
  };
  const nova: Sessao = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: agora() + (data.expires_in ?? 3600),
    email: data.user?.email ?? sessao.email,
  };
  salvarSessao(nova);
  return nova;
}

// Retorna uma sessão válida (renovando se estiver perto de expirar) ou null.
export async function sessaoValida(): Promise<Sessao | null> {
  let s = lerSessao();
  if (!s) return null;
  if (s.expires_at - 60 <= agora()) {
    s = await renovar(s);
  }
  return s;
}

export function sair(): void {
  salvarSessao(null);
}

// Troca a senha da Marina (já autenticada) — não pede a senha atual porque
// o token de acesso válido já garante que é ela quem está pedindo.
export async function trocarSenha(novaSenha: string): Promise<void> {
  const s = await sessaoValida();
  if (!s) throw new Error("NAO_AUTENTICADO");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY ?? "",
      Authorization: `Bearer ${s.access_token}`,
    },
    body: JSON.stringify({ password: novaSenha }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error_description?: string;
      msg?: string;
    };
    throw new Error(err.error_description || err.msg || "Não foi possível trocar a senha.");
  }
}

async function apiRest(path: string, init: RequestInit = {}): Promise<Response> {
  const s = await sessaoValida();
  if (!s) throw new Error("NAO_AUTENTICADO");
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...init.headers,
      apikey: SUPABASE_ANON_KEY ?? "",
      Authorization: `Bearer ${s.access_token}`,
      "Content-Type": "application/json",
    },
  });
}

// Igual a apiRest, mas para o Storage (upload/link do PDF do contrato) —
// não fixa Content-Type, já que o upload manda o tipo do próprio arquivo.
async function apiStorage(path: string, init: RequestInit = {}): Promise<Response> {
  const s = await sessaoValida();
  if (!s) throw new Error("NAO_AUTENTICADO");
  return fetch(`${SUPABASE_URL}/storage/v1/${path}`, {
    ...init,
    headers: {
      ...init.headers,
      apikey: SUPABASE_ANON_KEY ?? "",
      Authorization: `Bearer ${s.access_token}`,
    },
  });
}

export async function listarFichas(): Promise<Ficha[]> {
  const res = await apiRest("fichas?select=*&excluida=eq.false&order=created_at.desc");
  if (!res.ok) throw new Error("Não foi possível carregar as fichas.");
  return (await res.json()) as Ficha[];
}

// Fichas excluídas (soft delete), para a seção "Fichas excluídas" — de
// onde dá pra restaurar.
export async function listarFichasExcluidas(): Promise<Ficha[]> {
  const res = await apiRest("fichas?select=*&excluida=eq.true&order=created_at.desc");
  if (!res.ok) throw new Error("Não foi possível carregar as fichas excluídas.");
  return (await res.json()) as Ficha[];
}

export async function obterFicha(id: string): Promise<Ficha | null> {
  const res = await apiRest(`fichas?id=eq.${encodeURIComponent(id)}&select=*`);
  if (!res.ok) throw new Error("Não foi possível carregar a ficha.");
  const arr = (await res.json()) as Ficha[];
  return arr[0] ?? null;
}

export async function atualizarFicha(
  id: string,
  patch: Partial<
    Pick<
      Ficha,
      | "medidas"
      | "relatorio"
      | "arquivada"
      | "pacotes"
      | "respostas"
      | "telefone"
      | "nome"
      | "autoriza_foto"
    >
  >,
): Promise<void> {
  const res = await apiRest(`fichas?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Não foi possível salvar as alterações.");
}

// Cadastra uma ficha nova diretamente pelo painel — para transcrever uma
// ficha física (papel) que a Marina já tem na clínica. Ao contrário de
// salvarFicha (server function usada pelo formulário público, gravada com a
// chave anon), aqui a gravação usa a sessão autenticada da Marina; a policy
// de INSERT do 0003_anon_insert.sql já libera tanto anon quanto authenticated.
export async function criarFicha(dados: {
  tipo: Tipo;
  nome: string;
  telefone: string | null;
  clienteId: string;
  respostas: Record<string, string | boolean | null>;
  alertas: string[];
  termo_aceito: boolean;
  autoriza_foto: boolean;
  consentimento_dados: boolean;
}): Promise<Ficha> {
  const res = await apiRest("fichas", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      tipo: dados.tipo,
      nome: dados.nome,
      telefone: dados.telefone || null,
      cliente_id: dados.clienteId,
      respostas: dados.respostas,
      alertas: dados.alertas,
      termo_aceito: dados.termo_aceito,
      autoriza_foto: dados.autoriza_foto,
      consentimento_dados: dados.consentimento_dados,
    }),
  });
  if (!res.ok) throw new Error("Não foi possível cadastrar a ficha.");
  const arr = (await res.json()) as Ficha[];
  return arr[0];
}

// ------------------------------------------------------------
// Cadastro de clientes — fonte única da identidade (nome, contato,
// endereço...). Ver migração 0012_clientes.sql.
// ------------------------------------------------------------

// Acha (por telefone/CPF) ou cria a cliente, pela mesma função
// security-definer usada pelo formulário público (0012_clientes.sql) —
// usada pelo cadastro manual (painel/nova) pra não duplicar cliente
// quando a Marina transcreve uma ficha física de alguém que já tem cadastro.
export async function encontrarOuCriarCliente(
  respostas: Record<string, string | boolean | null>,
  telefone: string | null,
): Promise<string> {
  const texto = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  const res = await apiRest("rpc/encontrar_ou_criar_cliente", {
    method: "POST",
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
    if (/function .*encontrar_ou_criar_cliente.* does not exist/i.test(detalhe)) {
      throw new Error(
        "Rode a migração 0012_clientes.sql no Supabase (SQL Editor) para ativar o cadastro de clientes.",
      );
    }
    throw new Error("Não foi possível salvar os dados da cliente.");
  }
  return (await res.json()) as string;
}

export async function listarClientes(): Promise<Cliente[]> {
  const res = await apiRest("clientes?select=*&excluida=eq.false&order=created_at.desc");
  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    if (/relation .*clientes.* does not exist/i.test(detalhe)) {
      throw new Error(
        "Rode a migração 0012_clientes.sql no Supabase (SQL Editor) para ativar o cadastro de clientes.",
      );
    }
    throw new Error("Não foi possível carregar as clientes.");
  }
  return (await res.json()) as Cliente[];
}

export async function obterCliente(id: string): Promise<Cliente | null> {
  const res = await apiRest(`clientes?id=eq.${encodeURIComponent(id)}&select=*`);
  if (!res.ok) throw new Error("Não foi possível carregar a cliente.");
  const arr = (await res.json()) as Cliente[];
  return arr[0] ?? null;
}

// Fichas de uma cliente específica (aba "Fichas" e histórico de sessões).
export async function listarFichasDoCliente(clienteId: string): Promise<Ficha[]> {
  const res = await apiRest(
    `fichas?select=*&cliente_id=eq.${encodeURIComponent(clienteId)}&excluida=eq.false&order=created_at.desc`,
  );
  if (!res.ok) throw new Error("Não foi possível carregar as fichas da cliente.");
  return (await res.json()) as Ficha[];
}

export async function atualizarCliente(
  id: string,
  patch: Partial<
    Pick<
      Cliente,
      | "nome"
      | "telefone"
      | "cpf"
      | "email"
      | "nascimento"
      | "sexo"
      | "profissao"
      | "estado_civil"
      | "cep"
      | "endereco"
      | "numero"
      | "bairro"
      | "complemento"
      | "cidade"
      | "como_conheceu"
      | "autoriza_foto"
      | "arquivada"
    >
  >,
): Promise<void> {
  const res = await apiRest(`clientes?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Não foi possível salvar as alterações do cadastro.");
}

async function marcarClienteExcluida(id: string, excluida: boolean): Promise<void> {
  const res = await apiRest(`clientes?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ excluida }),
  });
  if (!res.ok) {
    throw new Error(
      excluida ? "Não foi possível excluir a cliente." : "Não foi possível restaurar a cliente.",
    );
  }
  const alteradas = (await res.json().catch(() => [])) as unknown[];
  if (!Array.isArray(alteradas) || alteradas.length === 0) {
    throw new Error(
      "A alteração não foi salva no banco (permissão de atualizar clientes ausente).",
    );
  }
}

export async function excluirCliente(id: string): Promise<void> {
  await marcarClienteExcluida(id, true);
}

export async function restaurarCliente(id: string): Promise<void> {
  await marcarClienteExcluida(id, false);
}

// Exclui a cliente e TODAS as fichas dela de verdade (sem volta) — as
// fichas são excluídas uma a uma (reaproveitando excluirFichaDefinitivamente,
// que já cuida das sessões via cascade) antes de apagar o cadastro, porque
// a FK fichas.cliente_id não tem "on delete cascade" — exclusão definitiva é
// sempre um passo explícito, igual já era por ficha.
export async function excluirClienteDefinitivamente(id: string): Promise<void> {
  const fichas = await listarFichasDoCliente(id);
  for (const f of fichas) {
    await excluirFichaDefinitivamente(f.id);
  }
  const res = await apiRest(`clientes?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  if (!res.ok) throw new Error("Não foi possível excluir a cliente definitivamente.");
  const apagadas = (await res.json().catch(() => [])) as unknown[];
  if (!Array.isArray(apagadas) || apagadas.length === 0) {
    throw new Error("A exclusão não foi salva no banco (permissão de excluir clientes ausente).");
  }
}

// ------------------------------------------------------------
// Contratos gerados — histórico (aba "Contratos"). Ver migração
// 0013_contratos.sql.
// ------------------------------------------------------------

export async function listarContratos(clienteId: string): Promise<Contrato[]> {
  const res = await apiRest(
    `contratos?select=*&cliente_id=eq.${encodeURIComponent(clienteId)}&order=created_at.desc`,
  );
  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    if (/relation .*contratos.* does not exist/i.test(detalhe)) {
      throw new Error(
        "Rode a migração 0013_contratos.sql no Supabase (SQL Editor) para ativar o histórico de contratos.",
      );
    }
    throw new Error("Não foi possível carregar os contratos.");
  }
  return (await res.json()) as Contrato[];
}

export async function criarContrato(dados: {
  clienteId: string;
  profissao: string | null;
  estadoCivil: string | null;
  itens: Contrato["itens"];
  formaPagamento: string | null;
  autorizaFoto: boolean;
  dataContrato: string;
}): Promise<Contrato> {
  const res = await apiRest("contratos", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      cliente_id: dados.clienteId,
      profissao: dados.profissao,
      estado_civil: dados.estadoCivil,
      itens: dados.itens,
      forma_pagamento: dados.formaPagamento,
      autoriza_foto: dados.autorizaFoto,
      data_contrato: dados.dataContrato,
    }),
  });
  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    if (/relation .*contratos.* does not exist/i.test(detalhe)) {
      throw new Error(
        "Rode a migração 0013_contratos.sql no Supabase (SQL Editor) para ativar o histórico de contratos.",
      );
    }
    throw new Error("Não foi possível salvar o contrato.");
  }
  const arr = (await res.json()) as Contrato[];
  return arr[0];
}

// Sobe o PDF (já impresso/salvo pela Marina, fora do app) pro Storage e
// vincula ao contrato — ver migração 0018_contrato_pdf.sql (bucket
// "contratos" + coluna pdf_path). Um upload novo substitui o anterior
// (mesmo caminho, x-upsert).
export async function anexarContratoPdf(
  contrato: { id: string; clienteId: string },
  arquivo: File,
): Promise<string> {
  const caminho = `${contrato.clienteId}/${contrato.id}.pdf`;
  const res = await apiStorage(`object/contratos/${caminho}`, {
    method: "POST",
    headers: {
      "Content-Type": arquivo.type || "application/pdf",
      "x-upsert": "true",
    },
    body: arquivo,
  });
  if (!res.ok) throw new Error("Não foi possível anexar o PDF.");
  await apiRest(`contratos?id=eq.${encodeURIComponent(contrato.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ pdf_path: caminho }),
  });
  return caminho;
}

// Link temporário (1h) pra baixar/ver o PDF anexado — o bucket é privado,
// só a Marina autenticada consegue gerar esse link.
export async function urlContratoPdf(caminho: string): Promise<string> {
  const res = await apiStorage(`object/sign/contratos/${caminho}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  if (!res.ok) throw new Error("Não foi possível abrir o PDF.");
  const data = (await res.json()) as { signedURL: string };
  return `${SUPABASE_URL}/storage/v1${data.signedURL}`;
}

// ------------------------------------------------------------
// Sessões de atendimento (o "caderninho" digital de cada ficha).
// A Marina registra data + áreas + observação; a cliente confirma
// pelo link. Ver migração 0005_sessoes.sql.
// ------------------------------------------------------------

export type SessaoAtendimento = {
  id: string;
  ficha_id: string;
  created_at: string;
  data: string; // "YYYY-MM-DD"
  areas: string[];
  observacao: string | null;
  token: string;
  confirmado: boolean;
  confirmado_em: string | null;
  arquivado: boolean;
};

export async function listarSessoes(fichaId: string): Promise<SessaoAtendimento[]> {
  const res = await apiRest(
    `sessoes?ficha_id=eq.${encodeURIComponent(fichaId)}&select=*&order=data.desc,created_at.desc`,
  );
  if (!res.ok) throw new Error("Não foi possível carregar as sessões.");
  return (await res.json()) as SessaoAtendimento[];
}

// Sessões de várias fichas de uma vez (histórico unificado da cliente,
// que pode ter mais de um procedimento/ficha). Traz também as arquivadas —
// quem exibe filtra por `arquivado` conforme a seção (ativas vs. arquivadas).
export async function listarSessoesDeFichas(fichaIds: string[]): Promise<SessaoAtendimento[]> {
  if (fichaIds.length === 0) return [];
  const lista = fichaIds.map((id) => encodeURIComponent(id)).join(",");
  const res = await apiRest(
    `sessoes?ficha_id=in.(${lista})&select=*&order=data.desc,created_at.desc`,
  );
  if (!res.ok) throw new Error("Não foi possível carregar as sessões.");
  return (await res.json()) as SessaoAtendimento[];
}

export type SessaoPendente = SessaoAtendimento & {
  ficha: { nome: string; telefone: string | null; tipo: Tipo };
};

const DIAS_TOLERANCIA_PENDENTE = 15;

// Data de X dias atrás em "YYYY-MM-DD" no fuso local.
function diasAtrasISO(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

// Sessões (de qualquer cliente/ficha) ainda aguardando confirmação da
// cliente pelo WhatsApp, e realizadas há pelo menos 15 dias — antes disso
// não entra na lista, pra não cutucar quem ainda está dentro do prazo
// normal de confirmar. Sessões arquivadas não entram (foram canceladas).
// Para o painel "Pendentes de confirmação".
export async function listarSessoesPendentes(): Promise<SessaoPendente[]> {
  const limite = diasAtrasISO(DIAS_TOLERANCIA_PENDENTE);
  const res = await apiRest(
    `sessoes?select=*,ficha:fichas(nome,telefone,tipo)&confirmado=eq.false&arquivado=eq.false&data=lte.${limite}&order=data.asc`,
  );
  if (!res.ok) throw new Error("Não foi possível carregar as sessões pendentes.");
  return (await res.json()) as SessaoPendente[];
}

// Data (YYYY-MM-DD) da sessão mais recente de cada ficha — só entre as não
// arquivadas, que é o que de fato conta como "procedimento feito". Usado
// pra detectar clientes sem atividade há muito tempo (ver clientes.ts).
export async function listarUltimasSessoesPorFicha(): Promise<Record<string, string>> {
  const res = await apiRest("sessoes?select=ficha_id,data&arquivado=eq.false&order=data.desc");
  if (!res.ok) throw new Error("Não foi possível carregar as datas de sessão.");
  const linhas = (await res.json()) as { ficha_id: string; data: string }[];
  const ultima: Record<string, string> = {};
  // Já vem ordenado da mais recente pra mais antiga — a 1ª ocorrência de
  // cada ficha_id é a data mais recente dela.
  for (const l of linhas) {
    if (!(l.ficha_id in ultima)) ultima[l.ficha_id] = l.data;
  }
  return ultima;
}

export async function criarSessao(
  fichaId: string,
  dados: { data: string; areas: string[]; observacao: string },
): Promise<SessaoAtendimento> {
  const res = await apiRest("sessoes", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      ficha_id: fichaId,
      data: dados.data,
      areas: dados.areas,
      observacao: dados.observacao.trim() || null,
    }),
  });
  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    if (/relation .*sessoes.* does not exist|does not exist/i.test(detalhe)) {
      throw new Error(
        "Rode a migração 0005_sessoes.sql no Supabase (SQL Editor) para ativar as sessões.",
      );
    }
    throw new Error("Não foi possível registrar a sessão.");
  }
  const arr = (await res.json()) as SessaoAtendimento[];
  return arr[0];
}

// Corrige data/observação/áreas de uma sessão já registrada (ex.: data
// digitada errada, ou marcou braços + axilas mas só fez axilas no dia).
// Não mexe em confirmação nem token.
export async function atualizarSessao(
  id: string,
  patch: Partial<Pick<SessaoAtendimento, "data" | "observacao" | "areas">>,
): Promise<void> {
  const res = await apiRest(`sessoes?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Não foi possível salvar as alterações da sessão.");
  // Se o banco não tem a policy de UPDATE em sessoes, o PostgREST responde
  // OK mas não altera nenhuma linha — sem isso, o erro passaria em
  // silêncio (é o que estava acontecendo).
  const alteradas = (await res.json().catch(() => [])) as unknown[];
  if (!Array.isArray(alteradas) || alteradas.length === 0) {
    throw new Error(
      "A alteração não foi salva no banco (permissão de atualizar sessões ausente). Rode de novo a parte de UPDATE da migração 0005_sessoes.sql no Supabase.",
    );
  }
}

// Arquiva (ou restaura) uma sessão em vez de apagar de verdade — nada é
// perdido, a sessão só some da lista ativa e pode ser restaurada depois em
// "Sessões arquivadas". Ver migração 0008_arquivar_sessoes.sql.
export async function arquivarSessao(id: string, arquivado: boolean): Promise<void> {
  const res = await apiRest(`sessoes?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ arquivado }),
  });
  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    if (/column .*arquivado.* does not exist/i.test(detalhe)) {
      throw new Error(
        "Rode a migração 0008_arquivar_sessoes.sql no Supabase (SQL Editor) para ativar o arquivamento.",
      );
    }
    throw new Error(
      arquivado ? "Não foi possível arquivar a sessão." : "Não foi possível restaurar a sessão.",
    );
  }
  const alteradas = (await res.json().catch(() => [])) as unknown[];
  if (!Array.isArray(alteradas) || alteradas.length === 0) {
    throw new Error(
      "A alteração não foi salva no banco (permissão de atualizar sessões ausente). Rode de novo a parte de UPDATE da migração 0005_sessoes.sql no Supabase.",
    );
  }
}

// Exclui (soft delete) ou restaura uma ficha — nunca apaga de verdade.
// Ver migração 0009_arquivar_fichas.sql.
async function marcarFichaExcluida(id: string, excluida: boolean): Promise<void> {
  const res = await apiRest(`fichas?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ excluida }),
  });
  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    if (/column .*excluida.* does not exist/i.test(detalhe)) {
      throw new Error(
        "Rode a migração 0009_arquivar_fichas.sql no Supabase (SQL Editor) para ativar a exclusão recuperável.",
      );
    }
    throw new Error(
      excluida ? "Não foi possível excluir a ficha." : "Não foi possível restaurar a ficha.",
    );
  }
  // Se o banco não tem a policy de UPDATE, ele responde OK mas não altera
  // nada. Detectamos isso pela lista vazia de linhas retornadas.
  const alteradas = (await res.json().catch(() => [])) as unknown[];
  if (!Array.isArray(alteradas) || alteradas.length === 0) {
    throw new Error("A alteração não foi salva no banco (permissão de atualizar fichas ausente).");
  }
}

export async function excluirFicha(id: string): Promise<void> {
  await marcarFichaExcluida(id, true);
}

export async function restaurarFicha(id: string): Promise<void> {
  await marcarFichaExcluida(id, false);
}

// Exclui a ficha de verdade — ao contrário de excluirFicha (soft delete),
// não fica em "Fichas excluídas" e não tem como desfazer. As sessões dela
// somem junto (on delete cascade, migração 0005_sessoes.sql). A policy de
// DELETE já existe desde a migração 0004_delete.sql.
// ------------------------------------------------------------
// Relatório de pacote — link público (leia-se: 0010_relatorios_pacote.sql)
// pra Marina mandar por WhatsApp mostrando a contagem de sessões de um
// pacote específico. Reenviar o mesmo pacote atualiza o mesmo registro
// (upsert por ficha+item+número), então o link enviado antes continua
// válido e passa a mostrar os dados mais recentes.
// ------------------------------------------------------------

export type NovoRelatorioPacote = {
  fichaId: string;
  item: string;
  pacoteNumero: number;
  clienteNome: string;
  pacoteTotal: number;
  concluido: boolean;
  sessoes: { data: string; confirmado: boolean; confirmado_em: string | null }[];
};

export async function enviarRelatorioPacote(dados: NovoRelatorioPacote): Promise<string> {
  const res = await apiRest("relatorios_pacote?on_conflict=ficha_id,item,pacote_numero", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      ficha_id: dados.fichaId,
      item: dados.item,
      pacote_numero: dados.pacoteNumero,
      cliente_nome: dados.clienteNome,
      pacote_total: dados.pacoteTotal,
      concluido: dados.concluido,
      sessoes: dados.sessoes,
      atualizado_em: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    if (/relation .*relatorios_pacote.* does not exist/i.test(detalhe)) {
      throw new Error(
        "Rode a migração 0010_relatorios_pacote.sql no Supabase (SQL Editor) para ativar o relatório.",
      );
    }
    throw new Error("Não foi possível gerar o relatório.");
  }
  const arr = (await res.json()) as { token: string }[];
  if (!arr[0]) throw new Error("Não foi possível gerar o relatório.");
  return arr[0].token;
}

export async function excluirFichaDefinitivamente(id: string): Promise<void> {
  const res = await apiRest(`fichas?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  if (!res.ok) throw new Error("Não foi possível excluir a ficha definitivamente.");
  const apagadas = (await res.json().catch(() => [])) as unknown[];
  if (!Array.isArray(apagadas) || apagadas.length === 0) {
    throw new Error("A exclusão não foi salva no banco (permissão de excluir fichas ausente).");
  }
}

// ============================================================
// MAVI — migração ÚNICA: cria uma linha em `clientes` para cada pessoa já
// cadastrada nas fichas, e preenche `fichas.cliente_id`.
//
// Roda uma vez só, depois de aplicar as migrações SQL 0012 e 0013 no
// Supabase (SQL Editor). Precisa da chave SERVICE ROLE (não a anon) porque
// lê/escreve ignorando o RLS — pegue em Project Settings > API Keys >
// service_role, no painel do Supabase.
//
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... \
//   node scripts/migrar-clientes.mjs
//
// Por padrão roda em modo "dry run" (só mostra o que faria, não grava nada).
// Pra gravar de verdade: adicione --confirmar no final do comando.
//
// Agrupa fichas da MESMA pessoa pelo mesmo critério que já era usado em
// src/lib/clientes.ts (agruparClientes): nome normalizado + (telefone OU
// CPF) batendo. Não mexe no conteúdo de `fichas.respostas` — só cria o
// cadastro e liga `cliente_id`.
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONFIRMAR = process.argv.includes("--confirmar");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (Project Settings > API Keys > service_role) antes de rodar.",
  );
  process.exit(1);
}

async function api(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      // Só manda Content-Type quando tem corpo (POST/PATCH) - mandar esse
      // cabeçalho num GET sem corpo faz o Supabase responder errado
      // (confirmado: devolvia só 1 linha em vez de todas).
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      ...init.headers,
    },
  });
  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status}: ${detalhe}`);
  }
  return res;
}

function digitos(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function normalizarNome(v) {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function cpfDaFicha(f) {
  return digitos(f.respostas?.cpf);
}

// Mesma lógica de union-find de agruparClientes em src/lib/clientes.ts.
function agrupar(fichas) {
  const n = fichas.length;
  const pai = Array.from({ length: n }, (_, i) => i);
  const achar = (i) => {
    while (pai[i] !== i) {
      pai[i] = pai[pai[i]];
      i = pai[i];
    }
    return i;
  };
  const unir = (a, b) => {
    pai[achar(a)] = achar(b);
  };

  const porNomeTelefone = new Map();
  const porNomeCpf = new Map();
  fichas.forEach((f, i) => {
    const nome = normalizarNome(f.nome ?? "");
    if (!nome) return;
    const tel = digitos(f.telefone);
    const cpf = cpfDaFicha(f);
    if (tel) {
      const chave = `${nome}::${tel}`;
      const j = porNomeTelefone.get(chave);
      if (j !== undefined) unir(i, j);
      else porNomeTelefone.set(chave, i);
    }
    if (cpf) {
      const chave = `${nome}::${cpf}`;
      const j = porNomeCpf.get(chave);
      if (j !== undefined) unir(i, j);
      else porNomeCpf.set(chave, i);
    }
  });

  const grupos = new Map();
  fichas.forEach((f, i) => {
    const r = achar(i);
    const arr = grupos.get(r);
    if (arr) arr.push(f);
    else grupos.set(r, [f]);
  });
  return [...grupos.values()];
}

// Pega o valor não vazio mais recente entre as fichas do grupo (mesma
// ideia do respostaEm já usado em painel.contrato.$id.tsx).
function campoMaisRecente(fichasOrdenadas, campo) {
  for (const f of fichasOrdenadas) {
    const v = f.respostas?.[campo];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

async function main() {
  console.log(CONFIRMAR ? "Modo: GRAVANDO de verdade." : "Modo: dry run (nada será gravado).");

  const fichas = await (
    await api("fichas?select=id,nome,telefone,respostas,cliente_id&excluida=eq.false&order=created_at.desc")
  ).json();

  console.log(`Fichas encontradas: ${fichas.length}`);

  const semNome = fichas.filter((f) => !normalizarNome(f.nome ?? ""));
  const grupos = agrupar(fichas.filter((f) => normalizarNome(f.nome ?? "")));

  console.log(`Pessoas distintas identificadas: ${grupos.length}`);
  if (semNome.length > 0) {
    console.log(
      `Fichas sem nome (ficam sem cliente_id, revisar manualmente): ${semNome.map((f) => f.id).join(", ")}`,
    );
  }

  let criados = 0;
  let fichasLigadas = 0;
  const jaTinhamCliente = fichas.filter((f) => f.cliente_id).length;
  if (jaTinhamCliente > 0) {
    console.log(
      `${jaTinhamCliente} ficha(s) já têm cliente_id — script ignora essas e só processa o restante.`,
    );
  }

  for (const grupo of grupos) {
    const pendentes = grupo.filter((f) => !f.cliente_id);
    if (pendentes.length === 0) continue;

    const ordenadas = [...grupo]; // já vem mais recente primeiro (order=created_at.desc)
    const nome = ordenadas[0].nome;
    const telefone = ordenadas.find((f) => f.telefone)?.telefone ?? null;

    const dadosCliente = {
      nome,
      telefone,
      cpf: campoMaisRecente(ordenadas, "cpf"),
      email: campoMaisRecente(ordenadas, "email"),
      nascimento: campoMaisRecente(ordenadas, "nascimento"),
      sexo: campoMaisRecente(ordenadas, "sexo"),
      profissao: campoMaisRecente(ordenadas, "profissao"),
      estado_civil: campoMaisRecente(ordenadas, "estadoCivil"),
      cep: campoMaisRecente(ordenadas, "cep"),
      endereco: campoMaisRecente(ordenadas, "endereco"),
      numero: campoMaisRecente(ordenadas, "numero"),
      complemento: campoMaisRecente(ordenadas, "complemento"),
      cidade: campoMaisRecente(ordenadas, "cidade"),
      como_conheceu: campoMaisRecente(ordenadas, "comoConheceu"),
      autoriza_foto: grupo.some((f) => f.autoriza_foto === true),
    };

    console.log(`\n- Cliente "${nome}" (${pendentes.length} ficha(s) a ligar)`);
    console.log(`  ${JSON.stringify(dadosCliente)}`);

    if (!CONFIRMAR) continue;

    const criado = await (
      await api("clientes", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(dadosCliente),
      })
    ).json();
    const clienteId = criado[0].id;
    criados++;

    for (const f of pendentes) {
      await api(`fichas?id=eq.${f.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ cliente_id: clienteId }),
      });
      fichasLigadas++;
    }
  }

  console.log("\n============================================================");
  if (!CONFIRMAR) {
    console.log(
      `Dry run concluído. ${grupos.length} cliente(s) seriam criados. Rode de novo com --confirmar para gravar.`,
    );
  } else {
    console.log(`Concluído: ${criados} cliente(s) criados, ${fichasLigadas} ficha(s) ligadas.`);
    console.log(
      "Confira no Supabase antes de rodar a migração 0014 (cliente_id NOT NULL) e de trocar a leitura do app para a tabela clientes.",
    );
  }
}

main().catch((e) => {
  console.error("Erro:", e.message);
  process.exit(1);
});

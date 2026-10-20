import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { enviarEmailConfirmacao } from "./agenda-email.server";
import { chaveDoCpf, enviarCodigoAgenda } from "./agenda-codigo.server";
import { cpfValido } from "../mascaras";
import { colunaUnica, rpc } from "./rpc";

// Agendamento online (páginas públicas /agendar e /agendamento/<token>).
// Tudo passa por funções SECURITY DEFINER do Postgres (ver
// 20261004120000_agenda_mavi.sql), então usa só a chave PÚBLICA (anon): a
// cliente nunca lê nem grava nas tabelas direto. Erros "de negócio" (horário
// ocupado, prazo de 24h...) voltam como { ok: false, erro } para a tela
// mostrar a mensagem certa.

export type ServicoPublico = {
  id: string;
  nome: string;
  tipo: "consulta" | "procedimento";
  duracao_min: number;
  // Áreas que a cliente escolhe ao agendar (vazio = serviço sem áreas).
  areas?: string[];
};

export type ErroAgenda =
  | "dados_invalidos"
  | "servico_invalido"
  // Procedimento sem cadastro, com CPF errado ou com código errado/vencido:
  // a mesma resposta, para não revelar quem é paciente.
  | "codigo_invalido"
  | "areas_obrigatorias"
  | "limite_agendamentos"
  | "horario_indisponivel"
  | "nao_encontrado"
  | "indisponivel"
  | "prazo"
  | "muitas_tentativas";

// Limite de tentativas das telas públicas. Conta no banco (agenda_permitir),
// então vale entre instâncias do servidor. Janela de 10 minutos.
const JANELA_MIN = 10;

// IP de quem fez a chamada. Só os cabeçalhos que a hospedagem põe são
// confiáveis; x-forwarded-for é o último recurso porque o cliente pode forjá-lo.
function ipDaRequisicao(): string {
  const cabecalhos = getRequest().headers;
  const ip =
    cabecalhos.get("cf-connecting-ip") ??
    cabecalhos.get("x-real-ip") ??
    cabecalhos.get("x-forwarded-for")?.split(",")[0];
  return ip?.trim() || "desconhecido";
}

async function dentroDoLimite(chave: string, max: number): Promise<boolean> {
  const ok = await rpc("agenda_permitir", {
    p_chave: chave.slice(0, 200),
    p_max: max,
    p_janela_min: JANELA_MIN,
  });
  return ok === true;
}

export type ResultadoAgendar =
  | {
      ok: true;
      token: string | null;
      inicio: string;
      fim: string;
      servico: string;
      // Áreas escolhidas (serviços feitos por área, como o laser).
      areas?: string[];
      primeiro_nome: string;
      // true quando o e-mail de confirmação foi enviado.
      email_enviado?: boolean;
    }
  | { ok: false; erro: ErroAgenda };

export type AgendamentoPublico = {
  primeiro_nome: string;
  servico_nome: string;
  servico_id: string;
  inicio: string;
  fim: string;
  status: "agendado" | "remarcar" | "cancelado" | "concluido" | "faltou";
  presenca_confirmada_em: string | null;
  pode_alterar: boolean;
  fora_do_prazo: boolean;
};

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().uuid();

export const listarServicosPublicos = createServerFn({ method: "POST" }).handler(async () => {
  const rows = (await rpc("agenda_servicos_publicos", {})) as ServicoPublico[];
  return Array.isArray(rows) ? rows : [];
});

// Dias do intervalo com ao menos um horário livre (pinta o calendário).
export const listarDiasComHorario = createServerFn({ method: "POST" })
  .inputValidator(z.object({ servicoId: uuid, de: dia, ate: dia }))
  .handler(async ({ data }) => {
    const rows = await rpc("agenda_dias_com_horario", {
      p_servico_id: data.servicoId,
      p_de: data.de,
      p_ate: data.ate,
    });
    return colunaUnica(rows, "dia");
  });

// Horários livres (ISO) de um serviço num dia.
export const listarHorariosLivres = createServerFn({ method: "POST" })
  .inputValidator(z.object({ servicoId: uuid, dia }))
  .handler(async ({ data }) => {
    const rows = await rpc("agenda_horarios_livres", {
      p_servico_id: data.servicoId,
      p_dia: data.dia,
      p_ignorar_id: null,
    });
    return colunaUnica(rows, "horario");
  });

export const agendar = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      servicoId: uuid,
      inicio: z.string().datetime({ offset: true }),
      nome: z.string().min(2).max(120),
      telefone: z.string().min(10).max(25),
      // A cliente não informa e-mail no agendamento online (só nome e WhatsApp).
      email: z.union([z.literal(""), z.string().email().max(200)]).optional(),
      areas: z.array(z.string().max(60)).max(40).optional(),
      // CPF: só é pedido para procedimento, e precisa bater com o cadastro.
      cpf: z.string().max(20).optional(),
      // Código de 6 dígitos enviado ao e-mail do cadastro (só procedimento).
      codigo: z.union([z.literal(""), z.string().regex(/^\d{6}$/)]).optional(),
      // Campo-isca, escondido na tela: pessoas não preenchem, robôs sim.
      website: z.string().max(200).optional(),
    }),
  )
  .handler(async ({ data }): Promise<ResultadoAgendar> => {
    if (data.website) {
      // Robô: finge que deu certo, sem criar nada.
      return {
        ok: true,
        token: null,
        inicio: data.inicio,
        fim: data.inicio,
        servico: "",
        primeiro_nome: data.nome.split(" ")[0],
      };
    }
    // Muitas tentativas do mesmo IP ou para o mesmo telefone: para antes de
    // consultar o cadastro (é isso que um robô tentaria em massa).
    const telefone = data.telefone.replace(/\D/g, "");
    if (
      !(await dentroDoLimite(`agendar:ip:${ipDaRequisicao()}`, 20)) ||
      !(await dentroDoLimite(`agendar:tel:${telefone}`, 5))
    ) {
      return { ok: false, erro: "muitas_tentativas" };
    }
    // CPF informado precisa ser um CPF de verdade (dígitos verificadores).
    if (data.cpf && !cpfValido(data.cpf)) return { ok: false, erro: "dados_invalidos" };
    const r = (await rpc("agenda_agendar", {
      p_servico_id: data.servicoId,
      p_inicio: data.inicio,
      p_nome: data.nome,
      p_telefone: data.telefone,
      p_email: data.email ?? "",
      p_areas: data.areas ?? [],
      p_cpf: data.cpf ?? "",
      p_codigo: data.codigo ?? "",
    })) as ResultadoAgendar;

    // E-mail de confirmação (opcional): se falhar, o agendamento continua valendo.
    if (r.ok && r.token && data.email) {
      const envio = await enviarEmailConfirmacao({
        para: data.email,
        primeiroNome: r.primeiro_nome,
        servico: r.areas?.length ? `${r.servico} (${r.areas.join(", ")})` : r.servico,
        inicio: r.inicio,
        fim: r.fim,
        token: r.token,
      });
      return { ...r, email_enviado: envio === "enviado" };
    }
    return r;
  });

// Manda o código de confirmação para o e-mail cadastrado da cliente. A resposta
// é sempre a mesma, exista ou não cadastro com e-mail, para não revelar quem é
// paciente. Limite por IP e por CPF.
export const pedirCodigoAgenda = createServerFn({ method: "POST" })
  .inputValidator(z.object({ cpf: z.string().max(20) }))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; erro: ErroAgenda }> => {
    if (!(await dentroDoLimite(`agendar:ip:${ipDaRequisicao()}`, 20))) {
      return { ok: false, erro: "muitas_tentativas" };
    }
    const digitos = data.cpf.replace(/\D/g, "");
    if (!cpfValido(data.cpf)) return { ok: true };
    if (!(await dentroDoLimite(`codigo:cpf:${await chaveDoCpf(digitos)}`, 3))) {
      return { ok: false, erro: "muitas_tentativas" };
    }
    try {
      await enviarCodigoAgenda(digitos);
    } catch (e) {
      // Falha de envio não pode revelar nada: a cliente vê a mesma mensagem.
      console.error("Falha ao gerar o código da agenda", e instanceof Error ? e.message : e);
    }
    return { ok: true };
  });

// Dados mínimos para a página do link da cliente. Null se o link não existe.
export const obterAgendamentoPublico = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    if (!(await dentroDoLimite(`agendamento:ip:${ipDaRequisicao()}`, 60))) {
      throw new Error("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
    }
    const rows = (await rpc("agendamento_por_token", {
      p_token: data.token,
    })) as AgendamentoPublico[];
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  });

// "Vou comparecer": o check de presença que a Marina vê na agenda.
export const confirmarPresenca = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    if (!(await dentroDoLimite(`agendamento:ip:${ipDaRequisicao()}`, 60))) {
      throw new Error("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
    }
    const quando = (await rpc("agenda_confirmar_presenca", { p_token: data.token })) as
      string | null;
    return { confirmado_em: quando };
  });

export const cancelarAgendamentoPublico = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1).max(100) }))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; erro: ErroAgenda }> => {
    if (!(await dentroDoLimite(`agendamento:ip:${ipDaRequisicao()}`, 60))) {
      return { ok: false, erro: "muitas_tentativas" };
    }
    return (await rpc("agenda_cancelar", { p_token: data.token })) as
      { ok: true } | { ok: false; erro: ErroAgenda };
  });

export const remarcarAgendamentoPublico = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: z.string().min(1).max(100),
      novoInicio: z.string().datetime({ offset: true }),
    }),
  )
  .handler(
    async ({ data }): Promise<{ ok: true; inicio: string } | { ok: false; erro: ErroAgenda }> => {
      if (!(await dentroDoLimite(`agendamento:ip:${ipDaRequisicao()}`, 60))) {
        return { ok: false, erro: "muitas_tentativas" };
      }
      return (await rpc("agenda_remarcar", {
        p_token: data.token,
        p_novo_inicio: data.novoInicio,
      })) as { ok: true; inicio: string } | { ok: false; erro: ErroAgenda };
    },
  );

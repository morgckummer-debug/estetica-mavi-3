import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

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
  // Procedimento sem cadastro ou com CPF que não confere: a mesma resposta,
  // para não revelar quem é paciente.
  | "dados_nao_conferem"
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
      areas: z.array(z.string().max(60)).max(40).optional(),
      // CPF: só é pedido para procedimento, e precisa bater com o cadastro.
      cpf: z.string().max(20).optional(),
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
    return (await rpc("agenda_agendar", {
      p_servico_id: data.servicoId,
      p_inicio: data.inicio,
      p_nome: data.nome,
      p_telefone: data.telefone,
      p_email: "",
      p_areas: data.areas ?? [],
      p_cpf: data.cpf ?? "",
    })) as ResultadoAgendar;
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

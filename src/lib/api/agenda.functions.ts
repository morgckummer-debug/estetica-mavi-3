import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { enviarEmailConfirmacao } from "./agenda-email.server";
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
};

export type ErroAgenda =
  | "dados_invalidos"
  | "servico_invalido"
  | "consulta_primeiro"
  | "limite_agendamentos"
  | "horario_indisponivel"
  | "nao_encontrado"
  | "indisponivel"
  | "prazo";

export type ResultadoAgendar =
  | {
      ok: true;
      token: string | null;
      inicio: string;
      fim: string;
      servico: string;
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
      areas: z.array(z.string().max(60)).max(20).optional(),
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
    const r = (await rpc("agenda_agendar", {
      p_servico_id: data.servicoId,
      p_inicio: data.inicio,
      p_nome: data.nome,
      p_telefone: data.telefone,
      p_email: data.email ?? "",
      p_areas: data.areas ?? [],
    })) as ResultadoAgendar;

    // E-mail de confirmação (opcional): se falhar, o agendamento continua valendo.
    if (r.ok && r.token && data.email) {
      const envio = await enviarEmailConfirmacao({
        para: data.email,
        primeiroNome: r.primeiro_nome,
        servico: r.servico,
        inicio: r.inicio,
        fim: r.fim,
        token: r.token,
      });
      return { ...r, email_enviado: envio === "enviado" };
    }
    return r;
  });

// Dados mínimos para a página do link da cliente. Null se o link não existe.
export const obterAgendamentoPublico = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    const rows = (await rpc("agendamento_por_token", {
      p_token: data.token,
    })) as AgendamentoPublico[];
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  });

// "Vou comparecer": o check de presença que a Marina vê na agenda.
export const confirmarPresenca = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    const quando = (await rpc("agenda_confirmar_presenca", { p_token: data.token })) as
      string | null;
    return { confirmado_em: quando };
  });

export const cancelarAgendamentoPublico = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1).max(100) }))
  .handler(
    async ({ data }) =>
      (await rpc("agenda_cancelar", { p_token: data.token })) as
        { ok: true } | { ok: false; erro: ErroAgenda },
  );

export const remarcarAgendamentoPublico = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: z.string().min(1).max(100),
      novoInicio: z.string().datetime({ offset: true }),
    }),
  )
  .handler(
    async ({ data }) =>
      (await rpc("agenda_remarcar", {
        p_token: data.token,
        p_novo_inicio: data.novoInicio,
      })) as { ok: true; inicio: string } | { ok: false; erro: ErroAgenda },
  );

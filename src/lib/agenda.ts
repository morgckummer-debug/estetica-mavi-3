// Agenda MAVI — acesso da Marina (logada) à agenda, mais os helpers de
// data. Tabelas e regras: supabase/migrations/20261004120000_agenda_mavi.sql.
//
// Todas as datas são exibidas e calculadas no horário de Brasília,
// independente do fuso do aparelho. O Brasil não tem horário de verão
// desde 2019, então o deslocamento fixo de -03:00 é seguro.

import { apiRest } from "./painel";
import { rpc } from "./api/rpc";

export type AgendaStatus = "agendado" | "remarcar" | "cancelado" | "concluido" | "faltou";

export type Agendamento = {
  id: string;
  created_at: string;
  servico_id: string;
  servico_nome: string;
  cliente_id: string | null;
  nome: string;
  telefone: string;
  email: string;
  areas: string[];
  inicio: string;
  fim: string;
  status: AgendaStatus;
  presenca_confirmada_em: string | null;
  cancelado_em: string | null;
  cancelado_por: "cliente" | "clinica" | null;
  observacao: string | null;
  origem: "online" | "painel";
  token: string;
};

export type AgendaServico = {
  id: string;
  nome: string;
  tipo: "consulta" | "procedimento";
  duracao_min: number;
  ativo: boolean;
  ordem: number;
};

export type Bloqueio = {
  id: string;
  inicio: string;
  fim: string;
  motivo: string | null;
};

// Ocupa a agenda (impede outro horário no mesmo intervalo).
export const STATUS_ATIVOS: AgendaStatus[] = ["agendado", "remarcar"];

// ------------------------------------------------------------
// Datas (Brasília)
// ------------------------------------------------------------

const TZ = "America/Sao_Paulo";

const fmtData = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "YYYY-MM-DD" do instante, em Brasília. */
export function dataSP(iso: string | Date): string {
  return fmtData.format(typeof iso === "string" ? new Date(iso) : iso);
}

/** "HH:MM" do instante, em Brasília. */
export function horaSP(iso: string | Date): string {
  return fmtHora.format(typeof iso === "string" ? new Date(iso) : iso);
}

export function hojeSP(): string {
  return dataSP(new Date());
}

/** Instante (ISO) de um dia + hora de Brasília. `hora` = "HH:MM". */
export function instanteSP(ymd: string, hora = "00:00"): string {
  return new Date(`${ymd}T${hora}:00-03:00`).toISOString();
}

export function somarDias(ymd: string, n: number): string {
  const [a, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 0 = domingo ... 6 = sábado. */
export function diaDaSemana(ymd: string): number {
  const [a, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** Segunda-feira da semana do dia informado (a semana vai de seg a dom). */
export function inicioDaSemana(ymd: string): string {
  const dow = diaDaSemana(ymd);
  return somarDias(ymd, dow === 0 ? -6 : 1 - dow);
}

export function inicioDoMes(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

export function somarMeses(ymd: string, n: number): string {
  const [a, m] = ymd.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 10);
}

export function ultimoDiaDoMes(ymd: string): string {
  return somarDias(somarMeses(inicioDoMes(ymd), 1), -1);
}

/** Os dias exibidos no mês: semanas completas (seg–dom) que cobrem o mês. */
export function diasDoMes(mes: string): string[] {
  const inicio = inicioDaSemana(inicioDoMes(mes));
  const fim = somarDias(inicioDaSemana(ultimoDiaDoMes(mes)), 7);
  const dias: string[] = [];
  for (let d = inicio; d < fim; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

const fmtTexto = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...opts });
const fmtDiaLongo = fmtTexto({ weekday: "long", day: "numeric", month: "long" });
const fmtDiaMes = fmtTexto({ day: "numeric", month: "short" });
const fmtMesAno = fmtTexto({ month: "long", year: "numeric" });
const fmtSemanaCurta = fmtTexto({ weekday: "short" });

function utc(ymd: string): Date {
  const [a, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

export function rotuloDiaLongo(ymd: string): string {
  return fmtDiaLongo.format(utc(ymd));
}
export function rotuloDiaMes(ymd: string): string {
  return fmtDiaMes.format(utc(ymd)).replace(".", "");
}
export function rotuloMesAno(ymd: string): string {
  return fmtMesAno.format(utc(ymd));
}
export function rotuloSemanaCurta(ymd: string): string {
  return fmtSemanaCurta.format(utc(ymd)).replace(".", "");
}

/** Intervalo "14:00 – 14:30". */
export function rotuloHorario(inicio: string, fim: string): string {
  return `${horaSP(inicio)} – ${horaSP(fim)}`;
}

// ------------------------------------------------------------
// Leitura
// ------------------------------------------------------------

/** Agendamentos que começam entre [de, ate) — datas "YYYY-MM-DD". */
export async function listarAgendamentos(de: string, ate: string): Promise<Agendamento[]> {
  const res = await apiRest(
    `agenda_agendamentos?select=*` +
      `&inicio=gte.${encodeURIComponent(instanteSP(de))}` +
      `&inicio=lt.${encodeURIComponent(instanteSP(ate))}` +
      `&order=inicio.asc`,
  );
  if (!res.ok) throw new Error("Não foi possível carregar a agenda.");
  return (await res.json()) as Agendamento[];
}

/** Bloqueios que tocam o intervalo [de, ate) — datas "YYYY-MM-DD". */
export async function listarBloqueios(de: string, ate: string): Promise<Bloqueio[]> {
  const res = await apiRest(
    `agenda_bloqueios?select=*` +
      `&fim=gt.${encodeURIComponent(instanteSP(de))}` +
      `&inicio=lt.${encodeURIComponent(instanteSP(ate))}` +
      `&order=inicio.asc`,
  );
  if (!res.ok) throw new Error("Não foi possível carregar os bloqueios.");
  return (await res.json()) as Bloqueio[];
}

export async function listarServicosAgenda(): Promise<AgendaServico[]> {
  const res = await apiRest("agenda_servicos?select=*&ativo=eq.true&order=ordem.asc,nome.asc");
  if (!res.ok) throw new Error("Não foi possível carregar os serviços.");
  return (await res.json()) as AgendaServico[];
}

/** Horários livres de um serviço num dia (ISO de cada início). */
export async function horariosLivres(
  servicoId: string,
  dia: string,
  ignorarId?: string,
): Promise<string[]> {
  const rows = (await rpc("agenda_horarios_livres", {
    p_servico_id: servicoId,
    p_dia: dia,
    p_ignorar_id: ignorarId ?? null,
  })) as { horario: string }[];
  return Array.isArray(rows) ? rows.map((r) => r.horario) : [];
}

/** Agendamentos ativos que se sobrepõem a [inicio, fim) — para avisar
 *  de conflito ao criar um bloqueio. */
export async function agendamentosNoPeriodo(inicio: string, fim: string): Promise<Agendamento[]> {
  const res = await apiRest(
    `agenda_agendamentos?select=*` +
      `&status=in.(${STATUS_ATIVOS.join(",")})` +
      `&fim=gt.${encodeURIComponent(inicio)}` +
      `&inicio=lt.${encodeURIComponent(fim)}` +
      `&order=inicio.asc`,
  );
  if (!res.ok) throw new Error("Não foi possível verificar os agendamentos do período.");
  return (await res.json()) as Agendamento[];
}

// ------------------------------------------------------------
// Escrita
// ------------------------------------------------------------

async function ocupado(res: Response): Promise<boolean> {
  if (res.status !== 409) return false;
  const detalhe = await res.text().catch(() => "");
  return /agenda_sem_sobreposicao|exclusion/i.test(detalhe);
}

export async function criarAgendamentoManual(dados: {
  servico: AgendaServico;
  inicio: string; // ISO
  nome: string;
  telefone: string;
  email: string;
  clienteId: string | null;
  areas: string[];
  observacao: string;
}): Promise<Agendamento> {
  const fim = new Date(new Date(dados.inicio).getTime() + dados.servico.duracao_min * 60000);
  const res = await apiRest("agenda_agendamentos", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      servico_id: dados.servico.id,
      servico_nome: dados.servico.nome,
      cliente_id: dados.clienteId,
      nome: dados.nome.trim(),
      telefone: dados.telefone.replace(/\D/g, ""),
      email: dados.email.trim().toLowerCase(),
      areas: dados.areas,
      inicio: dados.inicio,
      fim: fim.toISOString(),
      observacao: dados.observacao.trim() || null,
      origem: "painel",
    }),
  });
  if (!res.ok) {
    if (await ocupado(res)) throw new Error("Esse horário já está ocupado por outro agendamento.");
    throw new Error("Não foi possível criar o agendamento.");
  }
  return ((await res.json()) as Agendamento[])[0];
}

async function atualizar(id: string, campos: Record<string, unknown>): Promise<void> {
  const res = await apiRest(`agenda_agendamentos?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(campos),
  });
  if (!res.ok) {
    if (await ocupado(res)) throw new Error("Esse horário já está ocupado por outro agendamento.");
    throw new Error("Não foi possível atualizar o agendamento.");
  }
}

export function cancelarAgendamento(id: string): Promise<void> {
  return atualizar(id, {
    status: "cancelado",
    cancelado_em: new Date().toISOString(),
    cancelado_por: "clinica",
  });
}

export function marcarStatus(id: string, status: "concluido" | "faltou" | "agendado") {
  return atualizar(id, { status });
}

/** A clínica precisou mexer no horário: a cliente deve escolher outro. */
export function pedirRemarcacao(id: string): Promise<void> {
  return atualizar(id, { status: "remarcar" });
}

/** Move o agendamento para outro horário (mesma duração). */
export function reagendar(ag: Agendamento, novoInicio: string): Promise<void> {
  const duracao = new Date(ag.fim).getTime() - new Date(ag.inicio).getTime();
  return atualizar(ag.id, {
    inicio: novoInicio,
    fim: new Date(new Date(novoInicio).getTime() + duracao).toISOString(),
    status: "agendado",
    presenca_confirmada_em: null,
  });
}

export async function criarBloqueio(dados: {
  inicio: string;
  fim: string;
  motivo: string;
}): Promise<Bloqueio> {
  const res = await apiRest("agenda_bloqueios", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      inicio: dados.inicio,
      fim: dados.fim,
      motivo: dados.motivo.trim() || null,
    }),
  });
  if (!res.ok) throw new Error("Não foi possível criar o bloqueio.");
  return ((await res.json()) as Bloqueio[])[0];
}

export async function excluirBloqueio(id: string): Promise<void> {
  const res = await apiRest(`agenda_bloqueios?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Não foi possível remover o bloqueio.");
}

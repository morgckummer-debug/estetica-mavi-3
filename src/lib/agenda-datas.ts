// Agenda MAVI — helpers de data, compartilhados pelo painel da Marina e
// pelas páginas públicas (/agendar e /agendamento). Não importa nada do
// painel, para as páginas das clientes não carregarem código da Marina.
//
// Todas as datas são exibidas e calculadas no horário de Brasília,
// independente do fuso do aparelho. O Brasil não tem horário de verão
// desde 2019, então o deslocamento fixo de -03:00 é seguro.

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

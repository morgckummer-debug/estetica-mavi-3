import { ADDRESS_MAPS_URL } from "@/data/services";

// "Adicionar ao Google Agenda": abre o Google Agenda já com título, horário e
// local preenchidos. As datas vão em UTC (YYYYMMDDTHHMMSSZ).
function utcCompacto(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export function linkGoogleAgenda(params: { servico: string; inicio: string; fim: string }): string {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `${params.servico} — MAVI Centro de Estética`,
    dates: `${utcCompacto(params.inicio)}/${utcCompacto(params.fim)}`,
    details: "Seu horário na MAVI Centro de Estética 💜",
    location: "MAVI Centro de Estética, R. Nestor de Andrade, 142 - Sala 1, Sete Lagoas - MG",
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}&sprop=${encodeURIComponent(ADDRESS_MAPS_URL)}`;
}

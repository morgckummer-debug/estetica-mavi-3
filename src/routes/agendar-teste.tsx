import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/data/services";
import { PaginaAgendar } from "@/components/agenda/publico/PaginaAgendar";

// Endereço escondido para testar o agendamento enquanto /agendar ainda
// redireciona para o WhatsApp. Apagar este arquivo depois do lançamento.
export const Route = createFileRoute("/agendar-teste")({
  head: () => ({
    meta: [
      { title: "Agendar horário (teste) | MAVI" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/agendar` }],
  }),
  component: PaginaAgendar,
});

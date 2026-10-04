import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/data/services";
import { PaginaAgendar } from "@/components/agenda/publico/PaginaAgendar";

export const Route = createFileRoute("/agendar")({
  head: () => ({
    meta: [
      { title: "Agendar horário | MAVI Centro de Estética" },
      {
        name: "description",
        content:
          "Agende online sua consulta de avaliação ou procedimento na MAVI Centro de Estética, em Sete Lagoas.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/agendar` }],
  }),
  component: PaginaAgendar,
});

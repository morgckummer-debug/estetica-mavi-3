import { createFileRoute } from "@tanstack/react-router";
import { PowerReduxResultados } from "@/components/resultados/PowerReduxResultados";
import { SITE_URL } from "@/data/services";

export const Route = createFileRoute("/power-redux")({
  head: () => ({
    meta: [
      { title: "Power Redux — Antes e Depois | MAVI Centro de Estética" },
      {
        name: "description",
        content:
          "Veja os resultados reais do Power Redux em Sete Lagoas, MG. Fotos de antes e depois de clientes com redução de medidas, suavização da celulite e pele mais firme. Agende na MAVI.",
      },
      { property: "og:title", content: "Power Redux — Antes e Depois | MAVI Centro de Estética" },
      {
        property: "og:description",
        content:
          "Resultados reais do Power Redux em Sete Lagoas, MG. Redução de medidas e celulite com protocolo corporal de alta performance.",
      },
      { property: "og:url", content: `${SITE_URL}/power-redux` },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/power-redux` }],
  }),
  component: PowerReduxResultados,
});

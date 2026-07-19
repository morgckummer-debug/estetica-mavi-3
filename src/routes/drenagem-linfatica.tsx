import { createFileRoute } from "@tanstack/react-router";
import { DrenagemLinfaticaResultados } from "@/components/resultados/DrenagemLinfaticaResultados";
import { SITE_URL } from "@/data/services";

export const Route = createFileRoute("/drenagem-linfatica")({
  head: () => ({
    meta: [
      { title: "Drenagem Linfática — Antes e Depois | MAVI Centro de Estética" },
      {
        name: "description",
        content:
          "Veja os resultados reais da Drenagem Linfática em Sete Lagoas, MG. Fotos de antes e depois de clientes com redução de inchaço, melhora da circulação e sensação de leveza. Agende na MAVI.",
      },
      { property: "og:title", content: "Drenagem Linfática — Antes e Depois | MAVI Centro de Estética" },
      {
        property: "og:description",
        content:
          "Resultados reais da Drenagem Linfática em Sete Lagoas, MG. Redução de inchaço e melhora da circulação com o Método MAVI.",
      },
      { property: "og:url", content: `${SITE_URL}/drenagem-linfatica` },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/drenagem-linfatica` }],
  }),
  component: DrenagemLinfaticaResultados,
});

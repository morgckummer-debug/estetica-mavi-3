import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/data/services";
import ogSocial from "@/assets/og-social.png.asset.json";
import { Hero } from "@/components/sections/Hero";
import { About } from "@/components/sections/About";
import { ServicesGrid } from "@/components/sections/ServicesGrid";
import { Differentials } from "@/components/sections/Differentials";
import { Promotions } from "@/components/sections/Promotions";
import { Testimonials } from "@/components/sections/Testimonials";
import { Contact } from "@/components/sections/Contact";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MAVI Centro de Estética | Sete Lagoas, MG" },
      {
        name: "description",
        content:
          "Centro de estética em Sete Lagoas, MG. Especialistas em drenagem linfática, depilação a laser Ácrus, limpeza de pele profunda, pós-operatório e tratamentos corporais. Agende sua avaliação.",
      },
      { property: "og:title", content: "MAVI Centro de Estética | Sete Lagoas, MG" },
      {
        property: "og:description",
        content:
          "Centro de estética em Sete Lagoas, MG. Especialistas em drenagem linfática, depilação a laser Ácrus, limpeza de pele profunda, pós-operatório e tratamentos corporais. Agende sua avaliação.",
      },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: `${SITE_URL}${ogSocial.url}` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${SITE_URL}${ogSocial.url}` },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <Hero />
      <About />
      <ServicesGrid />
      <Promotions />
      <Differentials />
      <Testimonials />
      <Contact />
    </>
  );
}

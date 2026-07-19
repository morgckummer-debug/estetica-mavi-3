import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { SITE_URL } from "@/data/services";
import { ServicePage } from "@/components/service/ServicePage";
import { getService } from "@/data/services";

export const Route = createFileRoute("/servicos/$slug")({
  loader: ({ params }) => {
    if (params.slug === "power-redux") throw redirect({ to: "/power-redux" });
    if (params.slug === "drenagem-linfatica") throw redirect({ to: "/drenagem-linfatica" });
    const service = getService(params.slug);
    if (!service) throw notFound();
    return { service };
  },
  head: ({ loaderData, params }) => {
    const service = loaderData?.service;
    if (!service) {
      return { meta: [{ title: "Tratamento — MAVI Centro de Estética" }] };
    }
    return {
      meta: [
        { title: `${service.name} — MAVI Centro de Estética` },
        { name: "description", content: `${service.description} Agende em Sete Lagoas, MG — MAVI Centro de Estética.` },
        { property: "og:title", content: `${service.name} em Sete Lagoas | MAVI Centro de Estética` },
        { property: "og:description", content: `${service.description} Agende em Sete Lagoas, MG — MAVI Centro de Estética.` },
        { property: "og:url", content: `${SITE_URL}/servicos/${params.slug}` },
        { property: "og:image", content: service.image },
        { property: "og:type", content: "article" },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/servicos/${params.slug}` }],
    };
  },
  component: ServiceRoute,
});

function ServiceRoute() {
  const { service } = Route.useLoaderData();
  return <ServicePage service={service} />;
}
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SITE_URL } from "@/data/services";
import ogSocial from "@/assets/og-social.png.asset.json";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MAVI Centro de Estética | Sete Lagoas, MG" },
      {
        name: "description",
        content:
          "Centro de estética em Sete Lagoas, MG. Especialistas em drenagem linfática, depilação a laser Ácrus, limpeza de pele profunda, pós-operatório e tratamentos corporais. Agende sua avaliação.",
      },
      { name: "author", content: "MAVI Centro de Estética" },
      { name: "robots", content: "index, follow" },
      { name: "theme-color", content: "#5a3a63" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "MAVI" },
      { name: "mobile-web-app-capable", content: "yes" },
      { property: "og:title", content: "MAVI Centro de Estética | Sete Lagoas, MG" },
      {
        property: "og:description",
        content:
          "Centro de estética em Sete Lagoas, MG. Especialistas em drenagem linfática, depilação a laser Ácrus, limpeza de pele profunda, pós-operatório e tratamentos corporais. Agende sua avaliação.",
      },
      { property: "og:site_name", content: "MAVI Centro de Estética" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MAVI Centro de Estética | Sete Lagoas, MG" },
      {
        name: "twitter:description",
        content:
          "Centro de estética em Sete Lagoas, MG. Especialistas em drenagem linfática, depilação a laser Ácrus, limpeza de pele profunda, pós-operatório e tratamentos corporais. Agende sua avaliação.",
      },
      { property: "og:image", content: `${SITE_URL}${ogSocial.url}` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "MAVI Centro de Estética — Sete Lagoas, MG" },
      { name: "twitter:image", content: `${SITE_URL}${ogSocial.url}` },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/bb80b404-3a0a-4f67-bf6a-10ebb2e25d08/id-preview-686e6bf1--912ca056-41ca-4b5c-b5f8-f3d3c13513fe.lovable.app-1784476093999.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/bb80b404-3a0a-4f67-bf6a-10ebb2e25d08/id-preview-686e6bf1--912ca056-41ca-4b5c-b5f8-f3d3c13513fe.lovable.app-1784476093999.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", href: "/icon-512.png" },
    ],
    scripts: [
      {
        src: "https://www.googletagmanager.com/gtag/js?id=G-S3GDQ5D7V6",
        async: true,
      },
      {
        children: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-S3GDQ5D7V6');
gtag('config', 'AW-18281593078');`,
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HealthAndBeautyBusiness",
          name: "MAVI Centro de Estética",
          url: "https://www.maviestetica.com.br",
          description:
            "Centro de estética facial e corporal em Sete Lagoas — drenagem linfática, depilação a laser, limpeza de pele e tratamentos exclusivos.",
          telephone: "+5531971671266",
          address: {
            "@type": "PostalAddress",
            streetAddress: "R. Nestor de Andrade, 142 - Sala 1",
            addressLocality: "Sete Lagoas",
            addressRegion: "MG",
            postalCode: "35700-167",
            addressCountry: "BR",
          },
          sameAs: ["https://www.instagram.com/mavicentrodeestetica/"],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // O painel da Marina e as fichas de avaliação ficam sem a navbar/rodapé do
  // site público — telas limpas, focadas na tarefa.
  const semNavbar = pathname.startsWith("/painel") || pathname.startsWith("/avaliacao");

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col min-h-screen">
        {!semNavbar && <Header />}
        <main className="flex-1">
          {/* Required: nested routes render here. */}
          <Outlet />
        </main>
        {!semNavbar && <Footer />}
      </div>
    </QueryClientProvider>
  );
}

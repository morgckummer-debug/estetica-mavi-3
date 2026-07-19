import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/data/services";
import { TIPOS, FICHAS } from "@/data/anamnese";
import { ICONES_FICHA } from "@/data/icones-ficha";

export const Route = createFileRoute("/avaliacao/")({
  head: () => ({
    meta: [
      { title: "Fichas de avaliação | MAVI Centro de Estética" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/avaliacao` }],
  }),
  component: EscolherFicha,
});

function EscolherFicha() {
  return (
    <section className="min-h-[70vh] py-16 lg:py-24">
      <div className="mx-auto max-w-xl px-6">
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl text-primary leading-tight">
            Qual <em className="italic font-normal">ficha</em> você vai preencher?
          </h1>
          <p className="mt-4 text-muted-foreground">Escolha o tipo de avaliação.</p>
        </div>

        <div className="space-y-3">
          {TIPOS.map((t) => {
            const f = FICHAS[t];
            return (
              <Link
                key={t}
                to="/avaliacao/$tipo"
                params={{ tipo: t }}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-6 py-5 hover:border-primary/40 transition-colors"
              >
                <span className="flex items-center gap-4">
                  <img src={ICONES_FICHA[t]} alt="" className="h-14 w-14 shrink-0" />
                  <span className="font-medium text-foreground">{f.nome}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

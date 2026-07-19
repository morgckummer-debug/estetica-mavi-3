import { Link } from "@tanstack/react-router";
import { MessageCircle, Check, ArrowLeft, ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { services, type Service, WHATSAPP_URL } from "@/data/services";

export function ServicePage({ service }: { service: Service }) {
  const related = services.filter((s) => s.slug !== service.slug).slice(0, 3);

  return (
    <>
      <article className="pt-8 pb-16">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-10"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para o início
          </Link>

          <motion.div
            initial={{ opacity: 1, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl"
          >
            <p className="text-xs tracking-[0.3em] uppercase text-primary/70 mb-6">Tratamento</p>
            <h1 className="font-display text-4xl lg:text-6xl text-primary leading-[1.05]">
              {service.name}
            </h1>
            <p className="mt-6 text-xl text-rose font-display italic">{service.tagline}</p>
            <p className="mt-6 text-lg text-foreground/75 leading-relaxed">{service.description}</p>

            <a
              href={WHATSAPP_URL}
              target="whatsapp"
              rel="noreferrer"
              className="mt-10 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-7 py-3.5 text-sm font-medium hover:bg-primary/90 transition-all hover:-translate-y-0.5"
            >
              <MessageCircle className="h-4 w-4" />
              Agendar avaliação
            </a>
          </motion.div>

          <div className="mt-14 grid md:grid-cols-2 gap-8 lg:gap-12">
            <div className="bg-secondary/40 rounded-3xl p-8 lg:p-10">
              <h2 className="font-display text-2xl lg:text-3xl text-primary mb-6">
                Para quem é indicado
              </h2>
              <ul className="space-y-3">
                {service.indicated.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="h-5 w-5 mt-0.5 text-rose flex-shrink-0" />
                    <span className="text-foreground/80">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-lavender-soft/50 rounded-3xl p-8 lg:p-10">
              <h2 className="font-display text-2xl lg:text-3xl text-primary mb-6">Benefícios</h2>
              <ul className="space-y-3">
                {service.benefits.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="h-5 w-5 mt-0.5 text-rose flex-shrink-0" />
                    <span className="text-foreground/80">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </article>

      <section className="py-14 bg-secondary/30">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <h2 className="font-display text-3xl lg:text-4xl text-primary mb-12">
            Outros tratamentos
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {related.map((s) => (
              <Link
                key={s.slug}
                to="/servicos/$slug"
                params={{ slug: s.slug }}
                className="group block"
              >
                <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-muted">
                  <img
                    src={s.image}
                    alt={s.name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-primary/10 to-transparent" />
                  <div
                    className="absolute bottom-5 left-5 right-5 text-white flex items-end justify-between gap-2"
                    style={{ textShadow: "0 2px 8px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.45)" }}
                  >
                    <h3 className="font-display text-2xl">{s.name}</h3>
                    <ArrowUpRight className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
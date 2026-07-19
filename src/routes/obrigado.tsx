import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { CheckCircle, MessageCircle } from "lucide-react";
import { WHATSAPP_URL, SITE_URL } from "@/data/services";

export const Route = createFileRoute("/obrigado")({
  head: () => ({
    meta: [
      { title: "Obrigada pelo contato | MAVI Centro de Estética" },
      { name: "description", content: "Recebemos sua mensagem! Em breve entraremos em contato para confirmar seu agendamento." },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/obrigado` }],
  }),
  component: Obrigado,
});

function Obrigado() {
  return (
    <section className="min-h-[70vh] flex items-center justify-center px-6 py-20">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="max-w-md text-center"
      >
        <div className="flex justify-center mb-6">
          <CheckCircle className="h-16 w-16 text-primary" strokeWidth={1.5} />
        </div>

        <h1 className="font-display text-4xl lg:text-5xl text-primary leading-tight">
          Obrigada pelo<br />
          <span className="italic font-normal">contato!</span>
        </h1>

        <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
          Recebemos sua mensagem e em breve entraremos em contato para confirmar seu agendamento.
        </p>

        <p className="mt-3 text-base text-muted-foreground">
          Mal podemos esperar para cuidar de você. 🌸
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={WHATSAPP_URL}
            target="whatsapp"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-7 py-3.5 text-sm font-medium hover:bg-primary/90 transition-all hover:-translate-y-0.5 shadow-lg shadow-primary/20"
          >
            <MessageCircle className="h-4 w-4" />
            Falar no WhatsApp
          </a>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-border px-7 py-3.5 text-sm font-medium text-foreground/80 hover:text-primary hover:border-primary transition-all"
          >
            Voltar ao início
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

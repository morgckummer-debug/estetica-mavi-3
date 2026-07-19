import { motion } from "motion/react";
import { Quote } from "lucide-react";

const testimonials = [
  {
    text: "Estou encantada com o atendimento da MaVi Centro de Estética. Indico de olhos fechados — é o melhor laser de Sete Lagoas.",
    name: "Jennifer K.",
  },
  {
    text: "Dormi na limpeza de pele profunda. Na depilação não senti incômodo algum. Super recomendo!",
    name: "Letícia M.",
  },
  {
    text: "Estou super satisfeita com os meus resultados! Eu tinha trauma da dor, mas na MaVi não senti absolutamente nada.",
    name: "Juliana R.",
  },
  {
    text: "Atenciosas e prestativas. Na minha terceira sessão já vi diferença!",
    name: "Thaynara M.",
  },
];

export function Testimonials() {
  return (
    <section className="py-8 lg:py-14 bg-secondary/30">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs tracking-[0.3em] uppercase text-primary/70 mb-6">Depoimentos</p>
          <h2 className="font-display text-4xl lg:text-5xl text-primary leading-tight">
            O que nossas clientes <em className="italic font-normal text-rose">dizem</em>.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {testimonials.map((t, i) => (
            <motion.figure
              key={i}
              initial={{ opacity: 1, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-background rounded-3xl p-8 lg:p-10 border border-border/40"
            >
              <Quote className="h-8 w-8 text-lavender mb-4" />
              <blockquote className="font-display text-xl lg:text-2xl text-foreground/85 leading-snug">
                "{t.text}"
              </blockquote>
              <figcaption className="mt-6 text-sm tracking-wide text-primary/70">— {t.name}</figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
import { Link } from "@tanstack/react-router";
import { MessageCircle, ArrowLeft, ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { WHATSAPP_URL } from "@/data/services";
import powerReduxBg from "@/assets/services/power-redux.jpg";

const resultados = [
  { id: 1, src: "/power-1.jpeg", alt: "Power Redux antes e depois — vista lateral" },
  { id: 2, src: "/power-2.jpeg", alt: "Power Redux antes e depois — vista traseira" },
  { id: 3, src: "/power-3.jpeg", alt: "Power Redux antes e depois — vista lateral 2" },
  { id: 4, src: "/power-4.jpeg", alt: "Power Redux antes e depois — vista frontal" },
];

export function PowerReduxResultados() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden min-h-[40vh] flex items-center pt-20 pb-16">
        <div className="absolute inset-0 -z-10">
          <img
            src={powerReduxBg}
            alt="Power Redux"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: "50% 30%" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/40" />
        </div>

        <div className="mx-auto max-w-6xl px-6 lg:px-10 w-full">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para o início
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-2xl"
          >
            <p className="text-xs tracking-[0.3em] uppercase text-primary/70 mb-4">Resultados reais</p>
            <h1 className="font-display text-4xl lg:text-6xl text-primary leading-[1.05]">
              Power Redux
              <br />
              <span className="italic font-normal">antes & depois</span>
            </h1>
            <p className="mt-6 text-lg text-foreground/75 leading-relaxed max-w-xl">
              Transformações reais das nossas clientes — redução de medidas, suavização da celulite e pele mais firme com o protocolo Power Redux.
            </p>

            <a
              href={WHATSAPP_URL}
              target="whatsapp"
              rel="noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-7 py-3.5 text-sm font-medium hover:bg-primary/90 transition-all hover:-translate-y-0.5 shadow-lg shadow-primary/20"
            >
              <MessageCircle className="h-4 w-4" />
              Quero meu resultado
            </a>
          </motion.div>
        </div>
      </section>

      {/* Grid de resultados */}
      <section className="py-14 lg:py-20">
        <div className="mx-auto max-w-5xl px-6 lg:px-10">
          <div className="grid sm:grid-cols-2 gap-6 lg:gap-8">
            {resultados.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-3xl overflow-hidden shadow-md border border-border/20"
              >
                <img
                  src={item.src}
                  alt={item.alt}
                  loading="lazy"
                  className="w-full h-auto object-cover"
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-14 bg-secondary/30">
        <div className="mx-auto max-w-3xl px-6 lg:px-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-display text-3xl lg:text-4xl text-primary">
              Pronta para o seu
              <br />
              <span className="italic font-normal">resultado?</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Agende sua avaliação e descubra o protocolo ideal para o seu corpo.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={WHATSAPP_URL}
                target="whatsapp"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-8 py-4 text-sm font-medium hover:bg-primary/90 transition-all hover:-translate-y-0.5 shadow-lg shadow-primary/20"
              >
                <MessageCircle className="h-4 w-4" />
                Agendar avaliação
              </a>
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground/80 hover:text-primary transition-colors"
              >
                Ver todos os tratamentos <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}

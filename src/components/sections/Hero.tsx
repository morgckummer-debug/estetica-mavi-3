import { MessageCircle } from "lucide-react";
import { motion } from "motion/react";
import heroBg from "@/assets/hero-bg.jpg";
import { WHATSAPP_URL, CITY } from "@/data/services";

export function Hero() {
  return (
    <section className="relative overflow-hidden min-h-[55vh] lg:min-h-[65vh] flex items-center pt-16 pb-16 lg:py-0">
      {/* Imagem de Fundo e Gradientes de Transição */}
      <div className="absolute inset-0 -z-20">
        <img
          src={heroBg}
          alt="Tratamento estético na MAVI"
          className="absolute top-0 right-0 w-full lg:w-[60%] h-full object-cover"
          loading="eager"
        />
        {/* Gradiente mobile: de baixo para cima para garantir leitura do texto */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-background via-background/85 via-background/50 to-transparent lg:hidden"
          aria-hidden="true"
        />
        {/* Transição no desktop: fundo sólido à esquerda + gradiente suave que desvanece a imagem */}
        <div
          className="hidden lg:block absolute inset-y-0 left-0 w-[40%] bg-background"
          aria-hidden="true"
        />
        <div
          className="hidden lg:block absolute inset-y-0 left-[40%] w-[20%] bg-gradient-to-r from-background to-transparent"
          aria-hidden="true"
        />
      </div>

      {/* Conteúdo */}
      <div className="relative z-20 mx-auto max-w-7xl px-6 lg:px-10 w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-xl"
        >
          <p className="text-[11px] tracking-[0.32em] uppercase text-muted-foreground mb-6">
            Centro de Estética · {CITY}
          </p>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl text-foreground leading-[1.05] tracking-tight">
            Seja a sua
            <br />
            <span className="italic font-normal text-primary">melhor versão</span>
          </h1>

          <div className="mt-8 flex items-start gap-4">
            <span aria-hidden className="mt-3 block h-px w-12 bg-primary/40 shrink-0" />
            <p className="text-base sm:text-lg text-muted-foreground max-w-md leading-relaxed">
              Tratamentos faciais e corporais com tecnologia, sensibilidade
              e o cuidado que sua pele merece.
            </p>
          </div>

          <div className="mt-10 flex justify-center lg:justify-start">
            <a
              href={WHATSAPP_URL}
              target="whatsapp"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-8 py-4 text-sm font-medium hover:-translate-y-0.5 transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30"
            >
              <MessageCircle className="h-4 w-4" />
              Agendar avaliação
            </a>
          </div>
        </motion.div>
      </div>

      {/* Divisor Curvo (Onda SVG) */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10 pointer-events-none">
        <svg
          viewBox="0 0 1440 120"
          className="relative block w-full h-[40px] md:h-[80px]"
          preserveAspectRatio="none"
        >
          <path
            d="M0,120 C480,40 960,40 1440,120 L1440,120 L0,120 Z"
            className="fill-background"
            style={{ fill: "var(--color-background)" }}
          />
        </svg>
      </div>
    </section>
  );
}
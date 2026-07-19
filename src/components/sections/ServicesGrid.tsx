import { useRef, useState, useCallback, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { services } from "@/data/services";

export function ServicesGrid() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const CARDS_PER_VIEW = 4;
  const totalDots = Math.ceil(services.length / CARDS_PER_VIEW);

  const updateState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanPrev(scrollLeft > 8);
    setCanNext(scrollLeft < scrollWidth - clientWidth - 8);
    const pct = scrollLeft / (scrollWidth - clientWidth);
    setActiveIndex(Math.round(pct * (totalDots - 1)));
  }, [totalDots]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateState, { passive: true });
    updateState();
    return () => el.removeEventListener("scroll", updateState);
  }, [updateState]);

  const scroll = (dir: "prev" | "next") => {
    const el = trackRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild?.clientWidth ?? 200;
    const gap = 24;
    el.scrollBy({ left: dir === "next" ? cardWidth + gap : -(cardWidth + gap), behavior: "smooth" });
  };

  const scrollToDot = (dotIndex: number) => {
    const el = trackRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild?.clientWidth ?? 200;
    const gap = 24;
    const scrollTo = dotIndex * CARDS_PER_VIEW * (cardWidth + gap);
    el.scrollTo({ left: scrollTo, behavior: "smooth" });
  };

  return (
    <section id="servicos" className="py-10 lg:py-16 bg-secondary/10 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        
        {/* Cabeçalho */}
        <div className="max-w-4xl mb-12">
          <p className="text-xs tracking-[0.3em] uppercase text-primary/70 mb-4">Tratamentos</p>
          <h2 className="font-display text-4xl lg:text-5xl text-primary leading-tight mb-6">
            Cada protocolo, pensado <em className="italic font-normal text-rose">para você</em>.
          </h2>
          <p className="text-foreground/80 text-sm sm:text-base leading-relaxed max-w-3xl">
            No Centro de Estética MAVI, oferecemos tratamentos de estética facial e corporal pensados para valorizar sua beleza, promover autoestima e entregar resultados reais. Seja qual for seu objetivo, desde reduzir medidas, relaxar ou combater a celulite, estamos prontos para cuidar de você com tecnologia avançada e protocolos personalizados.
          </p>
        </div>

        {/* Container do Carrossel */}
        <div className="relative group/services">
          {/* Seta Esquerda */}
          <button
            onClick={() => scroll("prev")}
            disabled={!canPrev}
            aria-label="Tratamento anterior"
            className="absolute left-0 top-[40%] -translate-y-1/2 -translate-x-2 lg:-translate-x-6 z-10
                       w-11 h-11 rounded-full bg-white/90 dark:bg-card/90 shadow-lg border border-border/80
                       flex items-center justify-center text-primary hover:bg-primary hover:text-white
                       disabled:opacity-0 disabled:pointer-events-none transition-all duration-300
                       backdrop-blur-sm active:scale-95"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          {/* Seta Direita */}
          <button
            onClick={() => scroll("next")}
            disabled={!canNext}
            aria-label="Próximo tratamento"
            className="absolute right-0 top-[40%] -translate-y-1/2 translate-x-2 lg:translate-x-6 z-10
                       w-11 h-11 rounded-full bg-white/90 dark:bg-card/90 shadow-lg border border-border/80
                       flex items-center justify-center text-primary hover:bg-primary hover:text-white
                       disabled:opacity-0 disabled:pointer-events-none transition-all duration-300
                       backdrop-blur-sm active:scale-95"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* Track do carrossel */}
          <div
            ref={trackRef}
            className="flex gap-6 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-none px-2"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {services.map((s, i) => (
              <motion.div
                key={s.slug}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.5, delay: Math.min(i * 0.05, 0.3) }}
                className="snap-start shrink-0 flex flex-col items-center w-[45vw] sm:w-48 lg:w-56"
              >
                <Link
                  to={s.slug === "power-redux" ? "/power-redux" : s.slug === "drenagem-linfatica" ? "/drenagem-linfatica" : "/servicos/$slug"}
                  params={s.slug === "power-redux" || s.slug === "drenagem-linfatica" ? undefined : { slug: s.slug }}
                  className="group block w-full text-center"
                >
                  {/* Imagem em formato de cápsula (pill) vertical */}
                  <div className="relative aspect-[9/18] w-full rounded-full overflow-hidden bg-muted border-4 border-white dark:border-card shadow-md group-hover:shadow-xl transition-all duration-300">
                    <img
                      src={s.image}
                      alt={s.name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      style={s.imagePosition ? { objectPosition: s.imagePosition } : undefined}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/30 via-transparent to-transparent opacity-60" />
                  </div>

                  {/* Nome do tratamento abaixo da cápsula */}
                  <h3 className="mt-4 font-sans font-bold text-xs sm:text-sm tracking-widest text-primary uppercase group-hover:text-rose transition-colors duration-300 px-1">
                    {s.name}
                  </h3>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Dots de navegação */}
        {totalDots > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            {Array.from({ length: totalDots }).map((_, di) => (
              <button
                key={di}
                onClick={() => scrollToDot(di)}
                aria-label={`Ir para página ${di + 1}`}
                className={`rounded-full transition-all duration-300 ${
                  di === activeIndex
                    ? "w-6 h-2 bg-primary"
                    : "w-2 h-2 bg-border hover:bg-lavender"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

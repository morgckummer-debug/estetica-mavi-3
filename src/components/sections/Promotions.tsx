import { useRef, useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { promotions } from "@/data/promotions";
import { WHATSAPP_BASE_URL } from "@/data/services";

export function Promotions() {
  if (promotions.length === 0) return null;

  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const pointerStartX = useRef(0);

  const CARDS_PER_VIEW = 3;
  const totalDots = Math.ceil(promotions.length / CARDS_PER_VIEW);

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
    const cardWidth = el.firstElementChild?.clientWidth ?? 260;
    const gap = 20;
    el.scrollBy({ left: dir === "next" ? cardWidth + gap : -(cardWidth + gap), behavior: "smooth" });
  };

  const scrollToDot = (dotIndex: number) => {
    const el = trackRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild?.clientWidth ?? 260;
    const gap = 20;
    el.scrollTo({ left: dotIndex * CARDS_PER_VIEW * (cardWidth + gap), behavior: "smooth" });
  };

  return (
    <section id="promocoes" className="py-8 lg:py-14 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">

        {/* Cabeçalho */}
        <div className="mb-10 lg:mb-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-xl"
          >
            <p className="text-xs tracking-[0.3em] uppercase text-primary/70 mb-4">
              Promoções do Mês
            </p>
            <h2 className="font-display text-4xl lg:text-5xl text-primary leading-tight">
              Você merece{" "}
              <em className="italic font-normal text-rose">o melhor!</em>
            </h2>
          </motion.div>
        </div>

        {/* Carrossel */}
        <div className="relative group/carousel">
          {/* Seta Esquerda */}
          <button
            onClick={() => scroll("prev")}
            disabled={!canPrev}
            aria-label="Promoção anterior"
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 lg:-translate-x-6 z-10
                       w-11 h-11 rounded-full bg-white/90 shadow-lg border border-border/80
                       items-center justify-center text-primary hover:bg-primary hover:text-white
                       disabled:opacity-0 disabled:pointer-events-none transition-all duration-300
                       backdrop-blur-sm active:scale-95"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          {/* Seta Direita */}
          <button
            onClick={() => scroll("next")}
            disabled={!canNext}
            aria-label="Próxima promoção"
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 lg:translate-x-6 z-10
                       w-11 h-11 rounded-full bg-white/90 shadow-lg border border-border/80
                       items-center justify-center text-primary hover:bg-primary hover:text-white
                       disabled:opacity-0 disabled:pointer-events-none transition-all duration-300
                       backdrop-blur-sm active:scale-95"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* Track */}
          <div
            ref={trackRef}
            className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory px-2 sm:px-2"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {promotions.map((promo, i) => {
              const whatsappMsg = encodeURIComponent(
                `Olá! Vi a promoção *${promo.title}* (Arraiá Mavi) no site e gostaria de saber mais!`
              );

              const openWhatsapp = () =>
                window.open(`${WHATSAPP_BASE_URL}?text=${whatsappMsg}`, "whatsapp", "noreferrer");

              const handlePointerDown = (e: React.PointerEvent) => {
                pointerStartX.current = e.clientX;
              };
              const handleClick = (e: React.MouseEvent) => {
                if (Math.abs(e.clientX - pointerStartX.current) > 8) return;
                openWhatsapp();
              };

              return (
                <motion.div
                  key={promo.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-30px" }}
                  transition={{ duration: 0.45, delay: Math.min(i * 0.07, 0.35) }}
                  onPointerDown={handlePointerDown}
                  onClick={handleClick}
                  role="link"
                  tabIndex={0}
                  aria-label={`Ver promoção: ${promo.title} — abrir WhatsApp`}
                  onKeyDown={(e) => e.key === "Enter" && openWhatsapp()}
                  className="snap-start shrink-0 relative rounded-[28px] overflow-hidden cursor-pointer select-none
                             hover:-translate-y-1 hover:shadow-2xl active:scale-[0.98]
                             transition-all duration-300 bg-primary/5
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                             w-[78vw] sm:w-[220px] lg:w-[240px] aspect-[9/16]"
                >
                  <img
                    src={promo.image}
                    alt={promo.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                    draggable={false}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Dots */}
        {totalDots > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
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

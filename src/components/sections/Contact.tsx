import { MessageCircle, Instagram, MapPin, Clock } from "lucide-react";
import { motion } from "motion/react";
import {
  WHATSAPP_URL,
  WHATSAPP_DISPLAY,
  INSTAGRAM_URL,
  INSTAGRAM_HANDLE,
  ADDRESS,
  ADDRESS_MAPS_URL,
} from "@/data/services";

export function Contact() {
  return (
    <section id="contato" className="py-8 lg:py-14">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 1, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative bg-primary text-primary-foreground rounded-[2.5rem] overflow-hidden p-10 lg:p-16"
        >
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-lavender/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-rose/20 blur-3xl" />

          <div className="relative grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs tracking-[0.3em] uppercase text-primary-foreground/70 mb-6">
                Vamos cuidar de você
              </p>
              <h2 className="font-display text-4xl lg:text-5xl leading-tight">
                Agende sua <em className="italic font-normal">avaliação</em>.
              </h2>
              <p className="mt-6 text-primary-foreground/80 leading-relaxed max-w-md">
                Conte com a gente para desenhar o tratamento ideal para o seu momento.
                Atendimento personalizado, sem fórmula pronta.
              </p>

              <div className="mt-10 flex flex-wrap gap-3">
                <a
                  href={WHATSAPP_URL}
                  target="whatsapp"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-rose text-accent-foreground px-7 py-3.5 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 px-7 py-3.5 text-sm font-medium hover:bg-primary-foreground/10 transition-colors"
                >
                  <Instagram className="h-4 w-4" />
                  Instagram
                </a>
              </div>
            </div>

            <ul className="space-y-6">
              <li className="flex items-start gap-4">
                <MessageCircle className="h-5 w-5 mt-1 text-lavender" />
                <div>
                  <p className="text-xs uppercase tracking-widest text-primary-foreground/60">WhatsApp</p>
                  <a href={WHATSAPP_URL} target="whatsapp" rel="noreferrer" className="text-lg">
                    {WHATSAPP_DISPLAY}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <Instagram className="h-5 w-5 mt-1 text-lavender" />
                <div>
                  <p className="text-xs uppercase tracking-widest text-primary-foreground/60">Instagram</p>
                  <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="text-lg">
                    {INSTAGRAM_HANDLE}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <MapPin className="h-5 w-5 mt-1 text-lavender" />
                <div>
                  <p className="text-xs uppercase tracking-widest text-primary-foreground/60">Localização</p>
                  <a
                    href={ADDRESS_MAPS_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline underline-offset-2"
                  >
                    {ADDRESS.split("\n").map((line, i) => (
                      <p key={i} className={i === 0 ? "text-lg" : "text-sm text-primary-foreground/70"}>{line}</p>
                    ))}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <Clock className="h-5 w-5 mt-1 text-lavender" />
                <div>
                  <p className="text-xs uppercase tracking-widest text-primary-foreground/60">Atendimento</p>
                  <p className="text-lg">Seg a Sex · 13h–19h</p>
                  <p className="text-sm text-primary-foreground/70">Sábado · 08h–17h</p>
                </div>
              </li>
            </ul>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
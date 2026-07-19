import { Link } from "@tanstack/react-router";
import { Instagram, MessageCircle, MapPin, Clock } from "lucide-react";
import logo from "@/assets/logo-mavi.png";
import {
  WHATSAPP_URL,
  WHATSAPP_DISPLAY,
  INSTAGRAM_URL,
  INSTAGRAM_HANDLE,
  CITY,
  services,
} from "@/data/services";

export function Footer() {
  return (
    <footer className="bg-secondary/40 border-t border-border/50 mt-0">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-10 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-1">
          <img src={logo} alt="MAVI" className="h-14 w-auto mb-4" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            Centro de estética facial e corporal em {CITY}. Cuidado dedicado para a sua melhor
            versão.
          </p>
        </div>

        <div>
          <h4 className="font-display text-lg text-primary mb-4">Tratamentos</h4>
          <ul className="space-y-2 text-sm">
            {services.slice(0, 6).map((s) => (
              <li key={s.slug}>
                <Link
                  to="/servicos/$slug"
                  params={{ slug: s.slug }}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-display text-lg text-primary mb-4">Contato</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <MessageCircle className="h-4 w-4 mt-0.5 text-primary" />
              <a
                href={WHATSAPP_URL}
                target="whatsapp"
                rel="noreferrer"
                className="hover:text-primary"
              >
                {WHATSAPP_DISPLAY}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Instagram className="h-4 w-4 mt-0.5 text-primary" />
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer"
                className="hover:text-primary"
              >
                {INSTAGRAM_HANDLE}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-primary" />
              <span>{CITY}</span>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-lg text-primary mb-4">Horário</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 text-primary" />
              <div>
                <p>Segunda a sexta</p>
                <p>13h às 19h</p>
              </div>
            </li>
            <li className="pl-6">
              <p>Sábado</p>
              <p>08h às 17h</p>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-6 flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} MAVI Centro de Estética. Todos os direitos reservados.</p>
          <Link to="/politica-de-privacidade" className="hover:text-primary transition-colors">
            Política de Privacidade
          </Link>
          <p>Seja a sua melhor versão.</p>
        </div>
      </div>
    </footer>
  );
}

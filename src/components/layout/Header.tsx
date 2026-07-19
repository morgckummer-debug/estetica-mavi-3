import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, MessageCircle } from "lucide-react";
import logo from "@/assets/logo-mavi.png";
import { WHATSAPP_URL } from "@/data/services";

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border/50">
      <nav className="mx-auto max-w-7xl px-6 lg:px-10 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <img src={logo} alt="MAVI Centro de Estética" className="h-12 w-auto" />
        </Link>

        <div className="hidden md:flex items-center gap-10">
          <Link to="/" className="text-sm tracking-wide text-foreground/80 hover:text-primary transition-colors">
            Início
          </Link>
          <a href="/#servicos" className="text-sm tracking-wide text-foreground/80 hover:text-primary transition-colors">
            Serviços
          </a>
          <a href="/#sobre" className="text-sm tracking-wide text-foreground/80 hover:text-primary transition-colors">
            Sobre
          </a>
          <a href="/#contato" className="text-sm tracking-wide text-foreground/80 hover:text-primary transition-colors">
            Contato
          </a>
          <a
            href={WHATSAPP_URL}
            target="whatsapp"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Agendar
          </a>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 text-foreground"
          aria-label="Menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden border-t border-border/50 bg-background">
          <div className="px-6 py-6 flex flex-col gap-5">
            <Link to="/" onClick={() => setOpen(false)} className="text-foreground/80">Início</Link>
            <a href="/#servicos" onClick={() => setOpen(false)} className="text-foreground/80">Serviços</a>
            <a href="/#sobre" onClick={() => setOpen(false)} className="text-foreground/80">Sobre</a>
            <a href="/#contato" onClick={() => setOpen(false)} className="text-foreground/80">Contato</a>
            <a
              href={WHATSAPP_URL}
              target="whatsapp"
              rel="noreferrer"
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3"
            >
              <MessageCircle className="h-4 w-4" />
              Agendar pelo WhatsApp
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
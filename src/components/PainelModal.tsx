import type { ReactNode } from "react";

// Popup escuro padrão do painel (fundo com blur + card "Vidro Aurora"),
// reaproveitado por qualquer card que apareça sobre a tela (trocar senha,
// enviar ficha, confirmar exclusão...). Fecha ao clicar fora.
export function PainelModal({
  onFechar,
  children,
  maxWidth = "max-w-sm",
}: {
  onFechar?: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-8"
      onClick={onFechar}
    >
      <div
        className={`relative w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-painel-hero-bg p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden"
          style={{
            background:
              "radial-gradient(circle at 10% 0%, rgba(154,111,176,.35), transparent 55%), radial-gradient(circle at 95% 100%, rgba(179,146,76,.28), transparent 50%)",
          }}
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

import ramos from "@/assets/ramos.png";

// Marca d'água decorativa (ramo floral) usada como fundo sutil no login e
// nas fichas de pacientes. `className` controla posição/tamanho/opacidade
// conforme a tela — o componente só cuida do "não atrapalha o clique/leitura".
export function RamosWatermark({ className }: { className: string }) {
  return (
    <img
      src={ramos}
      alt=""
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    />
  );
}

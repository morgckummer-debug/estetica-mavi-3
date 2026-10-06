import { useEffect, useState } from "react";
import logo from "@/assets/logo-mavi.png";

// Tempo total na tela (inclui o fade de saída) — 4,5 s como pedido.
const DURACAO_MS = 4500;
const FADE_MS = 600;

// Roda no <head>, antes da pintura: só marca a página para exibir a abertura
// quando o app foi aberto pelo ícone da tela inicial (modo standalone) e ainda
// não foi mostrada nesta sessão. Para testar no navegador: abra com ?splash=1.
export const SPLASH_BOOT_SCRIPT = `(function(){try{
var d=document.documentElement,q=location.search.indexOf('splash=1')>-1;
var sa=window.navigator.standalone===true||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches);
if(!(sa||q))return;
if(!q&&sessionStorage.getItem('mavi-splash'))return;
sessionStorage.setItem('mavi-splash','1');
d.classList.add('mavi-splash-on');
}catch(e){}})();`;

export function SplashScreen() {
  const [saindo, setSaindo] = useState(false);
  const [removida, setRemovida] = useState(false);

  useEffect(() => {
    if (!document.documentElement.classList.contains("mavi-splash-on")) {
      setRemovida(true);
      return;
    }
    const t1 = setTimeout(() => setSaindo(true), DURACAO_MS - FADE_MS);
    const t2 = setTimeout(() => {
      document.documentElement.classList.remove("mavi-splash-on");
      setRemovida(true);
    }, DURACAO_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (removida) return null;

  return (
    <div className={`mavi-splash${saindo ? " mavi-splash-out" : ""}`} aria-hidden="true">
      <div className="mavi-splash-glow" />
      <img src={logo} alt="" className="mavi-splash-logo" width={900} height={860} />
      <div className="mavi-splash-bar">
        <span style={{ animationDuration: `${DURACAO_MS - FADE_MS}ms` }} />
      </div>
    </div>
  );
}

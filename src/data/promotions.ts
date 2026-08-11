// ============================================================
//  PROMOÇÕES DO MÊS — edite aqui para atualizar o site
// ============================================================
//
//  Como funciona:
//  - Cada promoção é a ARTE PRONTA (imagem) que você criou.
//  - Coloque a imagem da campanha na pasta `public/` e referencie
//    aqui em `image` com o caminho começando por "/".
//    Ex: imagem em public/aniversario-combo-amigas.jpeg → image: "/aniversario-combo-amigas.jpeg"
//  - `title` é usado no texto do WhatsApp e na acessibilidade (alt).
//  - Para tirar o bloco do site em meses sem promoção: deixe o array vazio []
//  - A ordem do array é a ordem que aparece no carrossel.
// ============================================================

export type Promotion = {
  id: string;
  /** Caminho da arte na pasta public — ex: "/aniversario-combo-amigas.jpeg" */
  image: string;
  /** Título usado na mensagem do WhatsApp e no alt da imagem */
  title: string;
};

export const promotions: Promotion[] = [
  {
    id: "combo-amigas",
    image: "/aniversario-combo-amigas.jpeg",
    title: "Combo das Amigas — Virilha Completa + Perianal + Axilas (10x R$159,99)",
  },
  {
    id: "fem-vpac-coxa",
    image: "/aniversario-fem-vpac-coxa.jpeg",
    title: "Laser Feminina — Virilha + Perianal + Axilas + Canela + Coxa (10x R$199,99)",
  },
  {
    id: "fem-vpac",
    image: "/aniversario-fem-vpac.jpeg",
    title: "Laser Feminina — Virilha + Perianal + Axilas + Canela (10x R$149,99)",
  },
  {
    id: "fem-vpa",
    image: "/aniversario-fem-vpa.jpeg",
    title: "Laser Feminina — Virilha + Perianal + Axilas (10x R$99,99)",
  },
  {
    id: "canela-coxa",
    image: "/aniversario-canela-coxa.jpeg",
    title: "Laser Feminina — Canela ganha Coxa (12x R$99,99)",
  },
  {
    id: "fem-axilas",
    image: "/aniversario-fem-axilas.jpeg",
    title: "Laser Feminina — Axilas (R$149,99 à vista)",
  },
  {
    id: "masc-torax-abdomen",
    image: "/aniversario-masc-torax-abdomen.jpeg",
    title: "Laser Masculina — Tórax ou Abdômen (10x R$75,00)",
  },
  {
    id: "masc-axilas",
    image: "/aniversario-masc-axilas.jpeg",
    title: "Laser Masculina — Axilas (R$99,99 à vista)",
  },
  {
    id: "masc-pescoco",
    image: "/aniversario-masc-pescoco.jpeg",
    title: "Laser Masculina — Pescoço (10x R$45,00)",
  },
  {
    id: "power-redux",
    image: "/aniversario-power-redux.jpeg",
    title: "Combo das Amigas — Power Redux — 10 sessões (10x R$299,99)",
  },
  {
    id: "max-pos-parto",
    image: "/aniversario-max-pos-parto.jpeg",
    title: "Max Pós Parto — 10 sessões (10x R$299,99)",
  },
  {
    id: "drenagem-gestante",
    image: "/aniversario-drenagem-gestante.jpeg",
    title: "Drenagem Linfática para Gestante — 07 sessões (R$550,00 em até 6x)",
  },
  {
    id: "limpeza-pele",
    image: "/aniversario-limpeza-pele.jpeg",
    title: "Limpeza de Pele Profunda (R$150,00 à vista)",
  },
  {
    id: "massagem-relaxante",
    image: "/aniversario-massagem-relaxante.jpeg",
    title: "Massagem Relaxante — sessão avulsa (R$120,00 à vista)",
  },
];

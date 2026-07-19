import powerRedux from "@/assets/services/power-redux.jpg";
import drenagemLinfatica from "@/assets/services/drenagem-linfatica.jpg";
import depilacaoLaser from "@/assets/services/depilacao-laser.jpg";
import hidragloss from "@/assets/services/hidragloss.jpg";
import posOperatorio from "@/assets/services/pos-operatorio.jpg";
import limpezaDePele from "@/assets/services/limpeza-de-pele.jpg";
import drenagemGestantes from "@/assets/services/drenagem-gestantes.jpg";
import correnteRussa from "@/assets/services/corrente-russa.jpg";
import tapingPosParto from "@/assets/services/taping-pos-parto.jpg";

export type Service = {
  slug: string;
  name: string;
  short: string;
  tagline: string;
  description: string;
  indicated: string[];
  benefits: string[];
  image: string;
  imagePosition?: string;
};

export const services: Service[] = [
  {
    slug: "power-redux",
    name: "Power Redux",
    short: "Redução de medidas e modelagem corporal",
    tagline: "Modelagem e firmeza com tecnologia avançada",
    description:
      "Protocolo corporal de alta performance que combina tecnologias para reduzir medidas, suavizar a celulite e tonificar a pele em sessões confortáveis e personalizadas.",
    indicated: [
      "Quem busca redução de medidas localizadas",
      "Pele com flacidez leve a moderada",
      "Tratamento de celulite em fase inicial",
    ],
    benefits: [
      "Redução visível de medidas",
      "Modelagem do contorno corporal",
      "Pele mais firme e uniforme",
      "Resultados progressivos a cada sessão",
    ],
    image: powerRedux,
    imagePosition: "50% 30%",
  },
  {
    slug: "drenagem-linfatica",
    name: "Drenagem Linfática — Método MAVI",
    short: "Drenagem manual exclusiva da casa",
    tagline: "A manualidade que desincha e relaxa",
    description:
      "Nosso método autoral de drenagem linfática combina movimentos precisos para estimular o sistema linfático, reduzindo retenção, inchaço e dando uma sensação imediata de leveza ao corpo.",
    indicated: [
      "Retenção de líquidos e inchaço",
      "Pós-treino e fadiga muscular",
      "Quem busca uma sensação imediata de leveza",
    ],
    benefits: [
      "Redução de inchaço e desconforto",
      "Melhora da circulação",
      "Sensação de leveza nas pernas",
      "Pele com aparência mais saudável",
    ],
    image: drenagemLinfatica,
  },
  {
    slug: "depilacao-laser",
    name: "Depilação a Laser Ácrus",
    short: "Triple Wave para todos os fototipos",
    tagline: "O laser mais avançado de Sete Lagoas",
    description:
      "Realizamos a depilação a laser com o equipamento Ácrus Triple Wave — confortável, seguro e eficaz para todos os tipos de pele e tons. Protocolos personalizados conduzidos por profissional especializada.",
    indicated: [
      "Todos os fototipos de pele",
      "Rosto, axilas, virilha, pernas e corpo todo",
      "Quem busca resultados duradouros",
    ],
    benefits: [
      "Pele lisa e sem pelos encravados",
      "Sessões rápidas e confortáveis",
      "Tecnologia segura para todos os tons",
      "Resultado progressivo e duradouro",
    ],
    image: depilacaoLaser,
    imagePosition: "40% 50%",
  },
  {
    slug: "hidragloss",
    name: "Hidragloss",
    short: "Hidratação labial profunda",
    tagline: "Lábios mais hidratados, volumosos e luminosos",
    description:
      "Tratamento exclusivo de hidratação profunda para os lábios. Devolve volume natural, suaviza linhas e deixa um acabamento glossy luminoso em uma única sessão.",
    indicated: [
      "Lábios ressecados ou desidratados",
      "Quem busca volume natural sem preenchedor",
      "Antes de eventos importantes",
    ],
    benefits: [
      "Hidratação profunda imediata",
      "Volume natural realçado",
      "Brilho saudável e duradouro",
      "Procedimento rápido e confortável",
    ],
    image: hidragloss,
    imagePosition: "65% 50%",
  },
  {
    slug: "pos-operatorio",
    name: "Pós-Operatório",
    short: "Recuperação cirúrgica especializada",
    tagline: "Cuidado dedicado para uma recuperação tranquila",
    description:
      "Protocolo completo para o pós-cirúrgico, com técnicas que aceleram a recuperação, reduzem inchaço, previnem aderências e ajudam a moldar o resultado final da sua cirurgia.",
    indicated: [
      "Pós-cirurgias plásticas em geral",
      "Lipoaspiração, abdominoplastia, mamoplastia",
      "Quem precisa de cuidado profissional contínuo",
    ],
    benefits: [
      "Recuperação mais rápida e tranquila",
      "Redução de inchaço e fibrose",
      "Prevenção de aderências",
      "Resultados estéticos otimizados",
    ],
    image: posOperatorio,
    imagePosition: "right center",
  },
  {
    slug: "limpeza-de-pele",
    name: "Limpeza de Pele Profunda",
    short: "Pele renovada e radiante",
    tagline: "Uma pele limpa, leve e visivelmente renovada",
    description:
      "Limpeza de pele profunda em etapas, com extração cuidadosa, esfoliação e máscaras nutritivas. Devolve à pele o brilho natural e prepara o terreno para outros tratamentos.",
    indicated: [
      "Pele com cravos, oleosidade ou impurezas",
      "Manutenção mensal de pele saudável",
      "Preparação para outros procedimentos",
    ],
    benefits: [
      "Pele limpa em profundidade",
      "Poros desobstruídos e refinados",
      "Brilho natural recuperado",
      "Sensação relaxante durante a sessão",
    ],
    image: limpezaDePele,
  },
  {
    slug: "drenagem-gestantes",
    name: "Drenagem Linfática para Gestantes",
    short: "Conforto e bem-estar na gestação",
    tagline: "Cuidado especializado para a sua gestação",
    description:
      "Drenagem linfática adaptada para gestantes, com técnicas seguras que aliviam o inchaço, melhoram a circulação e proporcionam momentos de relaxamento profundo para mamãe e bebê.",
    indicated: ["Gestantes a partir do 2º trimestre", "Inchaço nas pernas e pés", "Quem busca relaxamento e bem-estar"],
    benefits: [
      "Alívio do inchaço gestacional",
      "Melhora da circulação",
      "Relaxamento profundo",
      "Sensação de leveza no corpo",
    ],
    image: drenagemGestantes,
  },
  {
    slug: "corrente-russa",
    name: "Corrente Russa",
    short: "Tonificação muscular com eletroestimulação",
    tagline: "Definição muscular sem sair da maca",
    description:
      "A corrente russa é uma eletroestimulação que provoca contrações musculares profundas, ideal para tonificar, definir e fortalecer a musculatura de forma confortável.",
    indicated: [
      "Quem busca tonificação muscular",
      "Complemento para tratamentos corporais",
      "Recuperação de tônus pós-emagrecimento",
    ],
    benefits: [
      "Tonificação muscular visível",
      "Definição do contorno corporal",
      "Fortalecimento sem esforço",
      "Resultados a partir das primeiras sessões",
    ],
    image: correnteRussa,
  },
  {
    slug: "taping-pos-parto",
    name: "Taping Pós-Parto",
    short: "Suporte e conforto no pós-parto",
    tagline: "Sustentação delicada para o seu corpo após o parto",
    description:
      "Aplicação de bandagens elásticas terapêuticas (taping) no pós-parto, que ajudam a sustentar a musculatura abdominal, aliviar desconfortos, estimular a drenagem e devolver sensação de firmeza e conforto durante a recuperação.",
    indicated: [
      "Mulheres no pós-parto (normal ou cesárea, após liberação médica)",
      "Sensação de flacidez e desconforto abdominal",
      "Quem busca suporte adicional na recuperação",
    ],
    benefits: [
      "Sustentação confortável da parede abdominal",
      "Estímulo à drenagem e redução de inchaço",
      "Alívio de desconfortos posturais",
      "Sensação de firmeza e bem-estar",
    ],
    image: tapingPosParto,
  },
];

export const getService = (slug: string) => services.find((s) => s.slug === slug);

export const SITE_URL = "https://www.maviestetica.com.br";

const WHATSAPP_NUMBER = "https://wa.me/5531971671266";
const WHATSAPP_MSG = encodeURIComponent(
  "Olá! 💜 Vim do site ou do Instagram e gostaria de agendar com você!",
);
export const WHATSAPP_URL = `${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`;
export const WHATSAPP_BASE_URL = WHATSAPP_NUMBER;
export const WHATSAPP_DISPLAY = "(31) 97167-1266";
export const INSTAGRAM_URL = "https://www.instagram.com/mavicentrodeestetica/";
export const INSTAGRAM_HANDLE = "@mavicentrodeestetica";
export const CITY = "Sete Lagoas, MG";
export const ADDRESS = "R. Nestor de Andrade, 142 - Sala 1\nChácara do Paiva, Sete Lagoas - MG\nCEP 35700-167";
export const ADDRESS_MAPS_URL = "https://maps.google.com/?q=R.+Nestor+de+Andrade,+142,+Sete+Lagoas,+MG";

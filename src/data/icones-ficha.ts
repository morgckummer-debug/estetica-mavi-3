import type { Tipo } from "@/data/anamnese";
import iconeCorporal from "@/assets/icone-corporal.png";
import iconeFacial from "@/assets/icone-facial.png";
import iconeLaser from "@/assets/icone-laser.png";
import iconeCadastro from "@/assets/icone-cadastro.svg";

export const ICONES_FICHA: Record<Tipo, string> = {
  corporal: iconeCorporal,
  facial: iconeFacial,
  laser: iconeLaser,
  cadastro: iconeCadastro,
};

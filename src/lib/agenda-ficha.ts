import type { Tipo } from "@/data/anamnese";

// Qual ficha a cliente preenche antes de cada serviço da agenda:
//   consulta de avaliação        → cadastro (a anamnese é feita na consulta)
//   depilação a laser            → depilação
//   limpeza de pele, hidragloss  → facial
//   os demais (Power Redux, drenagens, corrente russa, pós-operatório,
//   taping)                      → corporal
// A ficha vem da coluna `ficha` do serviço (ajustável na tela "Serviços").
// Só quando o serviço não existe mais ou foi desativado e não está na lista,
// cai na dedução pelo nome gravado no agendamento.
export function tipoFichaDoServico(nomeServico: string): Tipo {
  const nome = nomeServico.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/consulta|avalia/.test(nome)) return "cadastro";
  if (/laser|depila/.test(nome)) return "laser";
  if (/facial|pele|hidragloss/.test(nome)) return "facial";
  return "corporal";
}

// Cores pastel dos serviços da agenda. A Marina escolhe a de cada serviço na
// tela "Serviços"; o banco guarda só o nome da cor (agenda_servicos.cor).

export const CORES_SERVICO = [
  "creme",
  "lilas",
  "rosa",
  "pessego",
  "azul",
  "turquesa",
  "menta",
  "amarelo",
  "lavanda",
  "coral",
] as const;

export type CorServico = (typeof CORES_SERVICO)[number];

export type Paleta = { nome: string; fundo: string; borda: string };

export const PALETA: Record<CorServico, Paleta> = {
  creme: { nome: "Creme", fundo: "#FBF1D9", borda: "#D8B45E" },
  lilas: { nome: "Lilás", fundo: "#EADBF5", borda: "#A77CC4" },
  rosa: { nome: "Rosa", fundo: "#FADDE6", borda: "#E08FAB" },
  pessego: { nome: "Pêssego", fundo: "#FDE3D3", borda: "#EBA277" },
  azul: { nome: "Azul", fundo: "#D9E8FA", borda: "#6FA3DA" },
  turquesa: { nome: "Turquesa", fundo: "#D3F0EC", borda: "#5BB8AC" },
  menta: { nome: "Menta", fundo: "#DDF0D8", borda: "#7DBB6F" },
  amarelo: { nome: "Amarelo", fundo: "#F6F2C8", borda: "#C9BE55" },
  lavanda: { nome: "Lavanda", fundo: "#E1E3F7", borda: "#8890D6" },
  coral: { nome: "Coral", fundo: "#FBD9D6", borda: "#E58A82" },
};

// Serviço sem cor (ou com uma cor que não existe mais) usa o lilás.
export function paletaDe(cor: string | null | undefined): Paleta {
  return PALETA[cor as CorServico] ?? PALETA.lilas;
}

// Primeira cor que nenhum serviço usa ainda (para o serviço novo).
export function proximaCorLivre(usadas: (string | null | undefined)[]): CorServico {
  return (
    CORES_SERVICO.find((c) => !usadas.includes(c)) ??
    CORES_SERVICO[usadas.length % CORES_SERVICO.length]
  );
}

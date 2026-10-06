import { dataSP, type Agendamento } from "@/lib/agenda";
import { normalizarPacotes, proximaNoPacote } from "@/lib/pacotes";
import { listarFichasDeClientes, listarSessoesDeFichas } from "@/lib/painel";

// "Virilha completa" na agenda = "virilha completa" no pacote da ficha: as
// áreas da agenda são texto livre, os itens da ficha vêm de uma lista fixa.
function chave(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Rótulo do pacote de cada atendimento ("4/10"), por id do agendamento. Só
// entra quem é cliente cadastrada e tem pacote em andamento na área marcada.
// Na dúvida (área sem item igual na ficha, ou o mesmo item com pacote em
// mais de uma ficha), não mostra nada — melhor nada do que um número errado.
export async function rotulosDePacote(ags: Agendamento[]): Promise<Map<string, string>> {
  const rotulos = new Map<string, string>();
  const relevantes = ags.filter(
    (a) => a.cliente_id && a.areas.length > 0 && a.status !== "cancelado",
  );
  const clienteIds = [...new Set(relevantes.map((a) => a.cliente_id as string))];
  const fichas = await listarFichasDeClientes(clienteIds);
  if (fichas.length === 0) return rotulos;
  const sessoes = (await listarSessoesDeFichas(fichas.map((f) => f.id))).filter(
    (s) => !s.arquivado,
  );

  for (const ag of relevantes) {
    // Só as sessões de antes do dia do atendimento: assim o número continua
    // certo depois que a Marina registra a sessão desse mesmo dia.
    const dia = dataSP(ag.inicio);
    const partes: { area: string; texto: string }[] = [];
    for (const area of ag.areas) {
      const candidatos = fichas.flatMap((f) =>
        f.cliente_id !== ag.cliente_id
          ? []
          : Object.keys(f.pacotes ?? {})
              .filter(
                (item) =>
                  chave(item) === chave(area) && normalizarPacotes(f.pacotes[item]).length > 0,
              )
              .map((item) => ({ ficha: f, item })),
      );
      if (candidatos.length !== 1) continue;
      const { ficha, item } = candidatos[0];
      const feitas = sessoes.filter(
        (s) => s.ficha_id === ficha.id && s.data < dia && s.areas.includes(item),
      ).length;
      const prox = proximaNoPacote(normalizarPacotes(ficha.pacotes[item]), feitas);
      if (prox) partes.push({ area, texto: `${prox.numero}/${prox.total}` });
    }
    if (partes.length === 0) continue;
    // Uma área só (ou todas no mesmo ponto do pacote): só o número.
    const igual =
      partes.length === ag.areas.length && partes.every((p) => p.texto === partes[0].texto);
    rotulos.set(
      ag.id,
      igual ? partes[0].texto : partes.map((p) => `${p.area} ${p.texto}`).join(" · "),
    );
  }
  return rotulos;
}

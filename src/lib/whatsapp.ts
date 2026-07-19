// Link de WhatsApp para pedir confirmação de um atendimento — mesmo texto
// usado no histórico de sessões (por cliente) e na lista de pendentes
// (de todas as clientes).

// Números salvos são sempre nacionais (DDD + número, 10 ou 11 dígitos) —
// prefixamos o código do Brasil (55), igual ao resto do site.
function numeroWhatsapp(telefone: string | null | undefined): string {
  const d = String(telefone ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

export function linkConfirmacao(origin: string, token: string): string {
  return `${origin}/confirmar/${token}`;
}

export function linkWhatsappConfirmacao(params: {
  origin: string;
  token: string;
  telefone: string | null | undefined;
  nomeCliente: string;
  dataBR: string;
}): string {
  const primeiro = params.nomeCliente.trim().split(" ")[0] || "";
  const msg = `Oi ${primeiro}! 💜 Confirme seu atendimento na MAVI do dia ${params.dataBR} — é rapidinho: ${linkConfirmacao(params.origin, params.token)}`;
  const numero = numeroWhatsapp(params.telefone);
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
}

export function linkRelatorio(origin: string, token: string): string {
  return `${origin}/relatorio/${token}`;
}

export function linkWhatsappRelatorio(params: {
  origin: string;
  token: string;
  telefone: string | null | undefined;
  nomeCliente: string;
  item: string;
}): string {
  const primeiro = params.nomeCliente.trim().split(" ")[0] || "";
  const msg = `Oi ${primeiro}! 💜 Segue o relatório do seu pacote de ${params.item} na MAVI: ${linkRelatorio(params.origin, params.token)}`;
  const numero = numeroWhatsapp(params.telefone);
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
}

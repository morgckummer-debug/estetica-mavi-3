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

// Abre a conversa com a cliente, sem mensagem pronta.
export function linkWhatsappContato(telefone: string | null | undefined): string {
  return `https://wa.me/${numeroWhatsapp(telefone)}`;
}

// Convite para a cliente preencher a ficha antes do atendimento — mesmo
// texto e mesmo link (com nome e WhatsApp já preenchidos) do "Enviar ficha"
// da página da cliente.
export function linkWhatsappFicha(params: {
  origin: string;
  tipo: string;
  nomeFicha: string;
  nomeCliente: string;
  telefone: string | null | undefined;
}): string {
  const primeiro = params.nomeCliente.trim().split(" ")[0] || "";
  const digitos = String(params.telefone ?? "").replace(/\D/g, "");
  const query = [
    params.nomeCliente.trim() && `nome=${encodeURIComponent(params.nomeCliente.trim())}`,
    digitos && `whatsapp=${digitos}`,
  ]
    .filter(Boolean)
    .join("&");
  const link = `${params.origin}/avaliacao/${params.tipo}${query ? `?${query}` : ""}`;
  const msg = `Oi${primeiro ? ` ${primeiro}` : ""}! 💜 Antes do seu atendimento na MAVI, preencha sua ficha de ${params.nomeFicha.toLowerCase()} — leva só alguns minutinhos: ${link}`;
  return `https://wa.me/${numeroWhatsapp(params.telefone)}?text=${encodeURIComponent(msg)}`;
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
  const msg = `Oi ${primeiro}! 💜 Confirme seu atendimento na MAVI do dia ${params.dataBR} — é rapidinho 😊: ${linkConfirmacao(params.origin, params.token)}`;
  const numero = numeroWhatsapp(params.telefone);
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
}

// Confirmação em LOTE: um link só para vários procedimentos feitos no
// mesmo dia (ex.: depilação axila + abdome + queixo, ou depilação +
// drenagem). A cliente confirma tudo de uma vez em /confirmar/lote/<token>.
export function linkConfirmacaoLote(origin: string, loteToken: string): string {
  return `${origin}/confirmar/lote/${loteToken}`;
}

export function linkWhatsappConfirmacaoLote(params: {
  origin: string;
  loteToken: string;
  telefone: string | null | undefined;
  nomeCliente: string;
  dataBR: string;
  quantidade: number;
}): string {
  const primeiro = params.nomeCliente.trim().split(" ")[0] || "";
  const msg = `Oi ${primeiro}! 💜 Confirme seus ${params.quantidade} atendimentos na MAVI do dia ${params.dataBR} — é rapidinho, tudo num link só 😊: ${linkConfirmacaoLote(params.origin, params.loteToken)}`;
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

import process from "node:process";

import { linkGoogleAgenda } from "@/components/agenda/publico/google-agenda";
import { dataSP, horaSP, rotuloDiaLongo } from "@/lib/agenda-datas";
import { ADDRESS, ADDRESS_MAPS_URL, PAINEL_URL, WHATSAPP_URL } from "@/data/services";

// E-mail de confirmação do agendamento online, enviado pelo Resend
// (https://resend.com). Só sai quando a cliente informou e-mail E o envio
// está configurado no servidor (variáveis abaixo). Sem configuração, o
// agendamento funciona normalmente — a cliente só não recebe o e-mail.
//
// Variáveis de ambiente (Vercel → Settings → Environment Variables):
//   RESEND_API_KEY        chave da API do Resend (secreta)
//   AGENDA_EMAIL_FROM     remetente, ex.: MAVI Centro de Estética <agenda@esteticamavi.com.br>
//                         (o domínio precisa estar verificado no Resend)
//   AGENDA_EMAIL_REPLY_TO (opcional) para onde vão as respostas da cliente
//   RESEND_API_URL        (opcional, só para testes) endereço da API
//
// Lidas dentro da função (por requisição), nunca no topo do módulo.

const COR = {
  fundo: "#fdf9f7",
  texto: "#38275b",
  primaria: "#4a2e7e",
  lavandaSuave: "#eae2ff",
  suave: "#6b6383",
  borda: "#dfdaf0",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type DadosEmailConfirmacao = {
  para: string;
  primeiroNome: string;
  servico: string;
  inicio: string; // ISO
  fim: string; // ISO
  token: string;
};

export function montarEmailConfirmacao(d: DadosEmailConfirmacao): {
  assunto: string;
  html: string;
  texto: string;
} {
  const diaLongo = rotuloDiaLongo(dataSP(d.inicio));
  const dia = diaLongo.charAt(0).toUpperCase() + diaLongo.slice(1);
  const hora = horaSP(d.inicio);
  const link = `${PAINEL_URL}/agendamento/${d.token}`;
  const agenda = linkGoogleAgenda({ servico: d.servico, inicio: d.inicio, fim: d.fim });
  const endereco = ADDRESS.split("\n").map(esc).join("<br>");
  const assunto = "Seu horário na MAVI está confirmado ✨";

  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(assunto)}</title></head>
<body style="margin:0;padding:0;background:${COR.fundo};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Você está agendada! ${esc(dia)}, ${esc(hora)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.fundo};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td align="center" style="padding-bottom:20px;">
      <img src="${PAINEL_URL}/icon-192.png" width="96" height="96" alt="MAVI Centro de Estética" style="display:block;border:0;">
    </td></tr>
    <tr><td style="background:#ffffff;border:1px solid ${COR.borda};border-radius:20px;padding:36px 28px;font-family:Helvetica,Arial,sans-serif;color:${COR.texto};">
      <h1 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:30px;line-height:1.2;color:${COR.primaria};text-align:center;">Você está agendada! ✨</h1>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:${COR.suave};text-align:center;">Oi, ${esc(d.primeiroNome)}! Seu horário na MAVI está reservado.</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.lavandaSuave};border-radius:14px;">
        <tr><td style="padding:20px 22px;">
          <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${COR.suave};">${esc(d.servico)}</div>
          <div style="margin-top:8px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;color:${COR.primaria};">${esc(dia)}</div>
          <div style="font-size:20px;line-height:1.4;color:${COR.texto};">às ${esc(hora)}</div>
          <div style="margin-top:14px;font-size:14px;line-height:1.5;color:${COR.suave};">
            <a href="${ADDRESS_MAPS_URL}" style="color:${COR.suave};text-decoration:none;">📍 ${endereco}</a>
          </div>
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
        <tr><td align="center">
          <a href="${link}" style="display:inline-block;background:${COR.primaria};color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;padding:16px 28px;border-radius:999px;">Precisa cancelar ou reagendar? Clique aqui</a>
        </td></tr>
        <tr><td align="center" style="padding-top:16px;">
          <a href="${agenda}" style="color:${COR.primaria};font-size:14px;text-decoration:underline;">Adicionar ao Google Agenda</a>
        </td></tr>
      </table>

      <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:${COR.suave};text-align:center;">
        Cancelamentos e remarcações com menos de 24 horas de antecedência devem ser combinados
        pelo <a href="${WHATSAPP_URL}" style="color:${COR.primaria};">WhatsApp</a>.
      </p>
    </td></tr>
    <tr><td align="center" style="padding:20px 8px 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${COR.suave};">
      MAVI Centro de Estética · Sete Lagoas, MG<br>Seja a sua melhor versão 💜
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  const texto = [
    "Você está agendada! ✨",
    "",
    `Oi, ${d.primeiroNome}! Seu horário na MAVI está reservado.`,
    "",
    `${d.servico}`,
    `${dia}, às ${hora}`,
    ADDRESS.replace(/\n/g, ", "),
    "",
    `Precisa cancelar ou reagendar? ${link}`,
    `Adicionar ao Google Agenda: ${agenda}`,
    "",
    `Cancelamentos e remarcações com menos de 24 horas devem ser combinados pelo WhatsApp: ${WHATSAPP_URL}`,
    "",
    "MAVI Centro de Estética · Sete Lagoas, MG",
  ].join("\n");

  return { assunto, html, texto };
}

export type ResultadoEnvioEmail = "enviado" | "desativado" | "falhou";

export async function enviarEmailConfirmacao(
  d: DadosEmailConfirmacao,
): Promise<ResultadoEnvioEmail> {
  const chave = process.env.RESEND_API_KEY;
  const remetente = process.env.AGENDA_EMAIL_FROM;
  if (!chave || !remetente) return "desativado";

  const { assunto, html, texto } = montarEmailConfirmacao(d);
  const resposta = process.env.AGENDA_EMAIL_REPLY_TO;
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), 6000);
  try {
    const res = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: remetente,
        to: [d.para],
        subject: assunto,
        html,
        text: texto,
        ...(resposta ? { reply_to: resposta } : {}),
      }),
      signal: controle.signal,
    });
    if (!res.ok) {
      console.error("Resend recusou o e-mail de confirmação", res.status, await res.text());
      return "falhou";
    }
    return "enviado";
  } catch (e) {
    console.error("Falha ao enviar o e-mail de confirmação", e instanceof Error ? e.message : e);
    return "falhou";
  } finally {
    clearTimeout(limite);
  }
}

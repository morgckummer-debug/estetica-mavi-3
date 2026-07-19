import { useEffect, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { motion } from "motion/react";
import { CheckCircle, Loader2, PartyPopper, XCircle } from "lucide-react";
import { SITE_URL } from "@/data/services";
import { obterRelatorioPacote, type RelatorioPacotePublico } from "@/lib/api/relatorios.functions";

export const Route = createFileRoute("/relatorio/$token")({
  head: () => ({
    meta: [
      { title: "Relatório do pacote | MAVI Centro de Estética" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/relatorio` }],
  }),
  component: RelatorioPage,
});

function formatarDataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

function formatarQuando(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type Estado = "carregando" | "invalido" | "pronto" | "erro";

function RelatorioPage() {
  const { token } = useParams({ from: "/relatorio/$token" });
  const [estado, setEstado] = useState<Estado>("carregando");
  const [relatorio, setRelatorio] = useState<RelatorioPacotePublico | null>(null);

  useEffect(() => {
    obterRelatorioPacote({ data: { token } })
      .then((r) => {
        if (!r) {
          setEstado("invalido");
          return;
        }
        setRelatorio(r);
        setEstado("pronto");
      })
      .catch(() => setEstado("erro"));
  }, [token]);

  const faltam = relatorio ? Math.max(0, relatorio.pacote_total - relatorio.sessoes.length) : 0;

  return (
    <section className="min-h-[80vh] flex items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        {estado === "carregando" && (
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {estado === "invalido" && (
          <div className="text-center">
            <XCircle className="mx-auto h-14 w-14 text-muted-foreground mb-5" strokeWidth={1.5} />
            <h1 className="font-display text-3xl text-primary">Link não encontrado</h1>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Este link de relatório não é válido ou expirou. Fale com a Marina se precisar. 🌸
            </p>
          </div>
        )}

        {estado === "erro" && (
          <div className="text-center">
            <XCircle className="mx-auto h-14 w-14 text-destructive mb-5" strokeWidth={1.5} />
            <h1 className="font-display text-3xl text-primary">Algo deu errado</h1>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Não conseguimos carregar o relatório agora. Tente abrir o link de novo em instantes.
            </p>
          </div>
        )}

        {estado === "pronto" && relatorio && (
          <>
            <div className="text-center">
              <h1 className="font-display text-3xl lg:text-4xl text-primary leading-tight">
                Oi, {relatorio.cliente_nome}! 🌸
              </h1>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Aqui está o retrato do seu pacote de{" "}
                <span className="text-foreground font-medium">{relatorio.item}</span> na{" "}
                <span className="text-foreground font-medium">MAVI</span>.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3 mb-1">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Pacote de {relatorio.item}
                </p>
                <p className="text-sm font-medium text-foreground tabular-nums">
                  {relatorio.sessoes.length} de {relatorio.pacote_total}
                </p>
              </div>

              <ul className="mt-4 space-y-2.5">
                {relatorio.sessoes.map((s, idx) => (
                  <li
                    key={`${s.data}-${idx}`}
                    className="flex items-start gap-2.5 text-sm border-b border-border/60 pb-2.5 last:border-0 last:pb-0"
                  >
                    <span className="mt-0.5 shrink-0 rounded-full bg-lavender-soft text-primary text-xs font-medium h-5 w-5 flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-foreground">Realizada em {formatarDataBR(s.data)}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {s.confirmado && s.confirmado_em
                          ? `Confirmada por você em ${formatarQuando(s.confirmado_em)}`
                          : "Aguardando sua confirmação"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 text-center">
              {relatorio.concluido ? (
                <p className="inline-flex items-center gap-2 text-base font-medium text-primary">
                  <PartyPopper className="h-5 w-5" />
                  Pacote concluído — todas as {relatorio.pacote_total} sessões realizadas!
                </p>
              ) : (
                <p className="inline-flex items-center gap-2 text-base font-medium text-foreground">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Faltam {faltam} {faltam === 1 ? "sessão" : "sessões"}
                </p>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Alguma dúvida sobre a contagem? Fale direto com a Marina. 💜
            </p>
          </>
        )}
      </motion.div>
    </section>
  );
}

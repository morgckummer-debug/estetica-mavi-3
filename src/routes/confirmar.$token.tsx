import { useEffect, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { motion } from "motion/react";
import { CheckCircle, Loader2, Sparkles, XCircle } from "lucide-react";
import { SITE_URL } from "@/data/services";
import { obterSessaoPublica, confirmarSessao, type SessaoPublica } from "@/lib/api/sessoes.functions";

export const Route = createFileRoute("/confirmar/$token")({
  head: () => ({
    meta: [
      { title: "Confirmar atendimento | MAVI Centro de Estética" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/confirmar` }],
  }),
  component: ConfirmarPage,
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

type Estado = "carregando" | "invalido" | "pronta" | "confirmada" | "erro";

function ConfirmarPage() {
  const { token } = useParams({ from: "/confirmar/$token" });
  const [estado, setEstado] = useState<Estado>("carregando");
  const [sessao, setSessao] = useState<SessaoPublica | null>(null);
  const [confirmadoEm, setConfirmadoEm] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    obterSessaoPublica({ data: { token } })
      .then((s) => {
        if (!s) {
          setEstado("invalido");
          return;
        }
        setSessao(s);
        if (s.confirmado) {
          setConfirmadoEm(s.confirmado_em);
          setEstado("confirmada");
        } else {
          setEstado("pronta");
        }
      })
      .catch(() => setEstado("erro"));
  }, [token]);

  const confirmar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      const r = await confirmarSessao({ data: { token } });
      setConfirmadoEm(r.confirmado_em);
      setEstado("confirmada");
    } catch {
      setErro("Não foi possível confirmar agora. Tente novamente em instantes.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="min-h-[80vh] flex items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md text-center"
      >
        {estado === "carregando" && (
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
        )}

        {estado === "invalido" && (
          <>
            <XCircle className="mx-auto h-14 w-14 text-muted-foreground mb-5" strokeWidth={1.5} />
            <h1 className="font-display text-3xl text-primary">Link não encontrado</h1>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Este link de confirmação não é válido ou expirou. Fale com a Marina se precisar. 🌸
            </p>
          </>
        )}

        {estado === "erro" && (
          <>
            <XCircle className="mx-auto h-14 w-14 text-destructive mb-5" strokeWidth={1.5} />
            <h1 className="font-display text-3xl text-primary">Algo deu errado</h1>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Não conseguimos carregar seu atendimento agora. Tente abrir o link de novo em instantes.
            </p>
          </>
        )}

        {estado === "pronta" && sessao && (
          <>
            <div className="flex justify-center mb-6">
              <div className="rounded-full bg-lavender-soft p-4">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
            </div>
            <h1 className="font-display text-3xl lg:text-4xl text-primary leading-tight">
              Oi, {sessao.primeiro_nome}! 🌸
            </h1>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Confirme que você realizou este atendimento na{" "}
              <span className="text-foreground font-medium">MAVI</span> no dia{" "}
              <span className="text-foreground font-medium">{formatarDataBR(sessao.data)}</span>.
            </p>

            <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-left">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                Atendimento
              </p>
              {sessao.areas.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {sessao.areas.map((a) => (
                    <span
                      key={a}
                      className="rounded-full bg-lavender-soft px-3 py-1 text-sm text-primary"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-foreground">Atendimento realizado.</p>
              )}
              {sessao.observacao && (
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {sessao.observacao}
                </p>
              )}
            </div>

            {erro && (
              <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {erro}
              </div>
            )}

            <button
              type="button"
              onClick={confirmar}
              disabled={enviando}
              className="mt-7 w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-7 py-4 text-base font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              {enviando ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle className="h-5 w-5" />
              )}
              Confirmar meu atendimento
            </button>
            <p className="mt-3 text-xs text-muted-foreground">
              Ao confirmar, você registra que este atendimento foi realizado.
            </p>
          </>
        )}

        {estado === "confirmada" && sessao && (
          <>
            <div className="flex justify-center mb-6">
              <CheckCircle className="h-16 w-16 text-primary" strokeWidth={1.5} />
            </div>
            <h1 className="font-display text-3xl lg:text-4xl text-primary leading-tight">
              Confirmado! ✨
            </h1>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Obrigada, {sessao.primeiro_nome}. Seu atendimento do dia{" "}
              <span className="text-foreground font-medium">{formatarDataBR(sessao.data)}</span> está
              confirmado.
            </p>
            {confirmadoEm && (
              <p className="mt-2 text-sm text-muted-foreground">
                Confirmado em {formatarQuando(confirmadoEm)}.
              </p>
            )}
            <p className="mt-6 text-base text-muted-foreground">
              Cuide-se com carinho! Até a próxima! 🌸
            </p>
          </>
        )}
      </motion.div>
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { motion } from "motion/react";
import { CheckCircle, Loader2, Sparkles, XCircle } from "lucide-react";
import { SITE_URL } from "@/data/services";
import {
  obterLotePublico,
  confirmarLote,
  type SessaoLoteItem,
} from "@/lib/api/sessoes.functions";

export const Route = createFileRoute("/confirmar/lote/$token")({
  head: () => ({
    meta: [
      { title: "Confirmar atendimentos | MAVI Centro de Estética" },
      {
        name: "description",
        content:
          "Confirme em um único toque todos os procedimentos realizados no dia na MAVI.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Confirmar atendimentos | MAVI" },
      {
        property: "og:description",
        content: "Confirme seus atendimentos do dia num link só.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/confirmar/lote` }],
  }),
  component: ConfirmarLotePage,
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

function ConfirmarLotePage() {
  const { token } = useParams({ from: "/confirmar/lote/$token" });
  const [estado, setEstado] = useState<Estado>("carregando");
  const [itens, setItens] = useState<SessaoLoteItem[]>([]);
  const [confirmadoEm, setConfirmadoEm] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    obterLotePublico({ data: { token } })
      .then((rows) => {
        if (!rows || rows.length === 0) {
          setEstado("invalido");
          return;
        }
        setItens(rows);
        if (rows.every((r) => r.confirmado)) {
          const maisRecente = rows
            .map((r) => r.confirmado_em)
            .filter((x): x is string => !!x)
            .sort()
            .pop() ?? null;
          setConfirmadoEm(maisRecente);
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
      const r = await confirmarLote({ data: { token } });
      setConfirmadoEm(r.confirmado_em);
      setEstado("confirmada");
    } catch {
      setErro("Não foi possível confirmar agora. Tente novamente em instantes.");
    } finally {
      setEnviando(false);
    }
  };

  const primeiroNome = itens[0]?.primeiro_nome ?? "";
  const data = itens[0]?.data ?? "";

  // Todas as áreas realizadas, sem repetir — a página não separa por
  // procedimento (a cliente só quer confirmar que fez tudo aquilo no dia).
  const areas = useMemo(() => {
    const s = new Set<string>();
    itens.forEach((i) => i.areas.forEach((a) => s.add(a)));
    return [...s];
  }, [itens]);

  const observacoes = useMemo(
    () =>
      itens
        .map((i) => i.observacao?.trim())
        .filter((x): x is string => !!x),
    [itens],
  );

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
              Não conseguimos carregar seus atendimentos agora. Tente abrir o link de novo em instantes.
            </p>
          </>
        )}

        {estado === "pronta" && itens.length > 0 && (
          <>
            <div className="flex justify-center mb-6">
              <div className="rounded-full bg-lavender-soft p-4">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
            </div>
            <h1 className="font-display text-3xl lg:text-4xl text-primary leading-tight">
              Oi, {primeiroNome}! 🌸
            </h1>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Confirme que você realizou estes{" "}
              <span className="text-foreground font-medium">{itens.length} atendimentos</span> na{" "}
              <span className="text-foreground font-medium">MAVI</span> no dia{" "}
              <span className="text-foreground font-medium">{formatarDataBR(data)}</span>.
            </p>

            <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-left">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                Atendimentos
              </p>
              {areas.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {areas.map((a) => (
                    <span
                      key={a}
                      className="rounded-full bg-lavender-soft px-3 py-1 text-sm text-primary"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-foreground">Atendimentos realizados.</p>
              )}
              {observacoes.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {observacoes.map((o, i) => (
                    <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                      {o}
                    </p>
                  ))}
                </div>
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
              Confirmar tudo
            </button>
            <p className="mt-3 text-xs text-muted-foreground">
              Ao confirmar, você registra que todos estes atendimentos foram realizados.
            </p>
          </>
        )}

        {estado === "confirmada" && itens.length > 0 && (
          <>
            <div className="flex justify-center mb-6">
              <CheckCircle className="h-16 w-16 text-primary" strokeWidth={1.5} />
            </div>
            <h1 className="font-display text-3xl lg:text-4xl text-primary leading-tight">
              Confirmado! ✨
            </h1>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Obrigada, {primeiroNome}. Seus atendimentos do dia{" "}
              <span className="text-foreground font-medium">{formatarDataBR(data)}</span> estão
              confirmados.
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

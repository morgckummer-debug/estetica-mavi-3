import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import { SITE_URL } from "@/data/services";
import {
  getFicha,
  TERMO_TEXTO,
  AUTORIZACAO_FOTO_TEXTO,
  CONSENTIMENTO_DADOS_TEXTO,
  calcularAlertas,
  campoVisivel,
  campoValido,
  type Respostas,
} from "@/data/anamnese";
import { salvarFicha } from "@/lib/api/fichas.functions";
import { aplicarMascara } from "@/lib/mascaras";
import { RamosWatermark } from "@/components/RamosWatermark";
import { ICONES_FICHA } from "@/data/icones-ficha";
import { CampoView } from "@/components/FichaCampos";

export const Route = createFileRoute("/avaliacao/$tipo")({
  head: ({ params }) => {
    const def = getFicha(params.tipo);
    const nome = def?.nome ?? "Ficha de Avaliação";
    const descricao =
      "Responda antes do seu atendimento na MAVI. Leva poucos minutos e ajuda a gente a te receber com mais cuidado e segurança.";
    return {
      meta: [
        { title: `${nome} | MAVI Centro de Estética` },
        { name: "description", content: descricao },
        { name: "robots", content: "noindex, nofollow" },
        { property: "og:title", content: `${nome} | MAVI Centro de Estética` },
        { property: "og:description", content: descricao },
        { property: "og:type", content: "website" },
        // Cadastro não tem imagem própria de compartilhamento (só as 3
        // fichas de tratamento têm og/ficha-*.png).
        ...(def && def.tipo !== "cadastro"
          ? [
              { property: "og:image", content: `${SITE_URL}/og/ficha-${def.tipo}.png` },
              { property: "og:image:width", content: "1200" },
              { property: "og:image:height", content: "630" },
              { name: "twitter:card", content: "summary_large_image" },
              { name: "twitter:image", content: `${SITE_URL}/og/ficha-${def.tipo}.png` },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/avaliacao` }],
    };
  },
  component: FichaPage,
});

function FichaPage() {
  const { tipo } = useParams({ from: "/avaliacao/$tipo" });
  const def = getFicha(tipo);

  const [step, setStep] = useState(0);
  const [respostas, setRespostas] = useState<Respostas>({});
  const [termoAceito, setTermoAceito] = useState(false);
  const [autorizaFoto, setAutorizaFoto] = useState(false);
  const [consentimentoDados, setConsentimentoDados] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarErros, setMostrarErros] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setMostrarErros(false);
  }, [step]);

  // Convite da Mavi: nome/celular já vêm no link (?nome=...&whatsapp=...),
  // só pré-preenche — nada é salvo até a cliente enviar a ficha no final.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nomeConvite = params.get("nome");
    const whatsappConvite = params.get("whatsapp");
    if (!nomeConvite && !whatsappConvite) return;
    setRespostas((r) => ({
      ...r,
      ...(nomeConvite ? { nome: nomeConvite } : {}),
      ...(whatsappConvite ? { whatsapp: aplicarMascara("telefone", whatsappConvite) } : {}),
    }));
  }, []);

  if (!def) {
    return (
      <section className="min-h-[70vh] flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="font-display text-3xl text-primary mb-3">Ficha não encontrada</h1>
          <p className="text-muted-foreground mb-6">Este link de ficha não é válido.</p>
          <Link to="/avaliacao" className="text-primary underline">
            Ver as fichas disponíveis
          </Link>
        </div>
      </section>
    );
  }

  const etapas = def.etapas;
  const totalEtapas = etapas.length + 1; // + termo
  const stepLabels = [...etapas.map((e) => e.titulo), "Termo"];

  const set = (id: string, v: string | boolean | null) => setRespostas((r) => ({ ...r, [id]: v }));

  const alertas = calcularAlertas(tipo, respostas);
  const naTermo = step === etapas.length;

  const podeAvancar = (() => {
    if (naTermo) return termoAceito && consentimentoDados && !enviando;
    return etapas[step].campos.every(
      (c) => !campoVisivel(c, respostas) || campoValido(c, respostas),
    );
  })();

  const enviar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      await salvarFicha({
        data: {
          tipo: def.tipo,
          nome: String(respostas.nome ?? "").trim(),
          telefone: String(respostas.whatsapp ?? "").trim(),
          respostas,
          alertas,
          termo_aceito: termoAceito,
          autoriza_foto: autorizaFoto,
          consentimento_dados: consentimentoDados,
        },
      });
      navigate({ to: "/obrigado" });
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível enviar. Tente novamente em instantes.",
      );
      setEnviando(false);
    }
  };

  return (
    <section className="min-h-[80vh] py-14 lg:py-20 overflow-x-hidden">
      <RamosWatermark className="fixed left-1/2 top-1/2 hidden h-[70vh] max-h-[600px] w-auto -translate-x-1/2 -translate-y-1/2 opacity-[0.05] sm:block" />
      <div className="mx-auto max-w-2xl px-6">
        <div className="relative -mt-14 lg:-mt-20 mb-8 overflow-hidden rounded-[2rem] bg-painel-hero-bg px-6 py-10 sm:px-10 sm:py-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 90% 0%, rgba(179,146,76,.4), transparent 50%), radial-gradient(circle at 5% 100%, rgba(154,111,176,.5), transparent 55%)",
            }}
          />
          <div className="relative text-center mb-10">
            <p className="text-xs tracking-[0.3em] uppercase text-white/50 mb-4">
              Antes do seu atendimento
            </p>
            <h1 className="font-display text-4xl lg:text-5xl leading-tight flex items-center justify-center gap-3 text-white">
              <img
                src={ICONES_FICHA[def.tipo]}
                alt=""
                className="h-11 w-11 lg:h-14 lg:w-14 shrink-0"
                style={{
                  filter:
                    "brightness(0) saturate(100%) invert(74%) sepia(16%) saturate(3701%) hue-rotate(204deg) brightness(121%) contrast(88%)",
                }}
              />
              <span>
                Ficha{" "}
                <em
                  className="italic font-normal"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, var(--painel-lilac-soft), var(--painel-gold-soft))",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  {def.nome.replace(/^Anamnese\s*/i, "").toLowerCase() || def.nome}
                </em>
              </span>
            </h1>
            <p className="mt-4 text-white/60 max-w-md mx-auto leading-relaxed">
              Leva poucos minutos. Isso nos ajuda a te receber com mais cuidado e segurança.
            </p>
          </div>

          <div className="relative flex gap-2 mb-2">
            {stepLabels.map((_, i) => (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full transition-colors"
                style={{
                  background:
                    i < step
                      ? "linear-gradient(90deg, var(--painel-lilac-soft), var(--painel-gold-soft))"
                      : i === step
                        ? "var(--painel-gold-soft)"
                        : "rgba(255,255,255,.18)",
                }}
              />
            ))}
          </div>
          <p className="relative text-xs uppercase tracking-widest text-white/50">
            Etapa {step + 1} de {totalEtapas} — {stepLabels[step]}
          </p>
        </div>

        <div className="relative overflow-hidden bg-card border border-border rounded-[2rem] p-6 sm:p-8 lg:p-10 min-h-[420px] flex flex-col shadow-[0_30px_60px_-30px_rgba(0,0,0,.25)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="flex-1"
            >
              {!naTermo && (
                <div>
                  {etapas[step].descricao && (
                    <p className="text-sm text-muted-foreground mb-6">{etapas[step].descricao}</p>
                  )}
                  {etapas[step].layout === "grid" ? (
                    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                      {etapas[step].campos
                        .filter((c) => campoVisivel(c, respostas))
                        .map((c) => (
                          <div key={c.id} className="border-b border-border/50 pb-3">
                            <CampoView
                              campo={c}
                              respostas={respostas}
                              set={set}
                              compacto
                              mostrarErro={mostrarErros}
                            />
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {etapas[step].campos
                        .filter((c) => campoVisivel(c, respostas))
                        .map((c) => (
                          <CampoView
                            key={c.id}
                            campo={c}
                            respostas={respostas}
                            set={set}
                            mostrarErro={mostrarErros}
                          />
                        ))}
                    </div>
                  )}
                </div>
              )}

              {naTermo && (
                <div className="space-y-5">
                  <label
                    className={`flex gap-3 rounded-xl border bg-background px-4 py-4 cursor-pointer ${
                      mostrarErros && !termoAceito ? "border-rose" : "border-border"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={termoAceito}
                      onChange={(e) => setTermoAceito(e.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
                    />
                    <span className="text-sm text-foreground/80 leading-relaxed">
                      <strong className="text-foreground">Termo de responsabilidade.</strong>{" "}
                      {TERMO_TEXTO}
                    </span>
                  </label>

                  <label
                    className={`flex gap-3 rounded-xl border bg-background px-4 py-4 cursor-pointer ${
                      mostrarErros && !consentimentoDados ? "border-rose" : "border-border"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={consentimentoDados}
                      onChange={(e) => setConsentimentoDados(e.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
                    />
                    <span className="text-sm text-foreground/80 leading-relaxed">
                      <strong className="text-foreground">Tratamento de dados (LGPD).</strong>{" "}
                      {CONSENTIMENTO_DADOS_TEXTO}
                    </span>
                  </label>

                  <label className="flex gap-3 rounded-xl border border-border bg-background px-4 py-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autorizaFoto}
                      onChange={(e) => setAutorizaFoto(e.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
                    />
                    <span className="text-sm text-foreground/80 leading-relaxed">
                      <strong className="text-foreground">Autorização de imagem (opcional).</strong>{" "}
                      {AUTORIZACAO_FOTO_TEXTO}
                    </span>
                  </label>

                  {alertas.length > 0 && (
                    <div className="flex gap-3 rounded-xl border border-rose/40 bg-rose/10 px-4 py-3.5 text-sm text-rose">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <ul className="space-y-1">
                        {alertas.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-3 rounded-xl border border-lavender/40 bg-lavender-soft/50 px-4 py-3.5 text-sm text-primary">
                    <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                    <p>Ao enviar, sua ficha fica salva com segurança para a Marina te atender.</p>
                  </div>

                  {erro && (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {erro}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex gap-3 mt-8 pt-6 border-t border-border/60">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                disabled={enviando}
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground/70 hover:border-primary/40 transition-colors disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
            )}
            {!naTermo ? (
              <button
                type="button"
                aria-disabled={!podeAvancar}
                onClick={() => {
                  if (podeAvancar) setStep((s) => s + 1);
                  else setMostrarErros(true);
                }}
                className={`ml-auto inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:bg-primary/90 transition-colors ${podeAvancar ? "" : "opacity-40"}`}
              >
                Continuar
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={enviando}
                aria-disabled={!podeAvancar}
                onClick={() => {
                  if (podeAvancar) enviar();
                  else setMostrarErros(true);
                }}
                className={`ml-auto inline-flex items-center gap-2 rounded-full bg-rose text-accent-foreground px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 ${podeAvancar ? "" : "opacity-40"}`}
              >
                {enviando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    Enviar ficha
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
          </div>
          {mostrarErros && !podeAvancar && !enviando && (
            <p className="mt-3 text-sm text-rose text-right">
              {naTermo
                ? "Aceite o termo de responsabilidade e o tratamento de dados para enviar."
                : "Responda todas as perguntas para continuar."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

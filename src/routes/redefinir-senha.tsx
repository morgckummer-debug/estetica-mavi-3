import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Check } from "lucide-react";
import { SITE_URL } from "@/data/services";
import { definirNovaSenha } from "@/lib/painel";
import logo from "@/assets/logo-mavi.png";
import { RamosWatermark } from "@/components/RamosWatermark";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [{ title: "Redefinir senha | MAVI" }, { name: "robots", content: "noindex, nofollow" }],
    links: [{ rel: "canonical", href: `${SITE_URL}/redefinir-senha` }],
  }),
  component: RedefinirSenhaPage,
});

type Tokens = { access_token: string; refresh_token: string; expires_in?: number };

// O link do e-mail de recuperação (Supabase Auth) volta com os tokens no
// fragmento da URL (#access_token=...&refresh_token=...&type=recovery), não
// na query string — por isso lemos direto de window.location.hash.
function lerTokensDaUrl(): Tokens | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  const type = params.get("type");
  if (!access_token || !refresh_token || type !== "recovery") return null;
  const expiresIn = params.get("expires_in");
  return { access_token, refresh_token, expires_in: expiresIn ? Number(expiresIn) : undefined };
}

function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [tokens, setTokens] = useState<Tokens | null | "invalido">(null);
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const t = lerTokensDaUrl();
    setTokens(t ?? "invalido");
    if (t && typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokens || tokens === "invalido") return;
    setErro(null);
    if (senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      setErro("As senhas não coincidem.");
      return;
    }
    setSalvando(true);
    try {
      await definirNovaSenha(tokens, senha);
      setSucesso(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível definir a nova senha.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-6 py-16 bg-painel-hero-bg">
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 10% 0%, rgba(154,111,176,.55), transparent 55%), radial-gradient(circle at 95% 100%, rgba(179,146,76,.4), transparent 50%)",
        }}
      />
      <RamosWatermark className="absolute -right-16 top-1/2 h-[85vh] max-h-[700px] w-auto -translate-y-1/2 opacity-[0.06]" />
      <RamosWatermark className="absolute -left-16 top-1/2 h-[85vh] max-h-[700px] w-auto -translate-y-1/2 scale-x-[-1] opacity-[0.06]" />

      <div className="relative w-full max-w-sm text-center">
        <img
          src={logo}
          alt="Clínica MAVI"
          className="mx-auto h-24 w-auto mb-10 brightness-0 invert"
        />

        <div className="rounded-[20px] border border-painel-border bg-white p-9 text-left shadow-[0_24px_50px_-30px_rgba(120,80,150,0.25)]">
          <h1 className="mb-5 text-lg font-medium text-painel-title">Redefinir senha</h1>

          {tokens === null && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-painel-muted" />
            </div>
          )}

          {tokens === "invalido" && (
            <p className="text-sm text-painel-alert-text">
              Este link é inválido ou já expirou. Peça um novo link em "Esqueci minha senha" na
              tela de login.
            </p>
          )}

          {tokens && tokens !== "invalido" && sucesso && (
            <div className="space-y-4">
              <p className="text-sm text-painel-title">Senha alterada com sucesso.</p>
              <button
                type="button"
                onClick={() => navigate({ to: "/painel" })}
                className="inline-flex items-center gap-1.5 rounded-full bg-painel-primary text-white px-5 py-2.5 text-sm font-medium hover:bg-painel-primary/90 transition-colors"
              >
                <Check className="h-4 w-4" />
                Ir para o painel
              </button>
            </div>
          )}

          {tokens && tokens !== "invalido" && !sucesso && (
            <form onSubmit={submeter} className="space-y-5">
              <div>
                <label className="block text-[11px] tracking-[.06em] text-painel-muted mb-2.5 uppercase">
                  Nova senha
                </label>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-painel-border bg-painel-bg px-4 py-3.5 text-sm text-painel-title focus:outline-none focus:ring-2 focus:ring-painel-primary/40"
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-[.06em] text-painel-muted mb-2.5 uppercase">
                  Confirmar nova senha
                </label>
                <input
                  type="password"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-painel-border bg-painel-bg px-4 py-3.5 text-sm text-painel-title focus:outline-none focus:ring-2 focus:ring-painel-primary/40"
                />
              </div>

              {erro && (
                <div className="rounded-xl border border-painel-alert-border bg-painel-alert-bg px-4 py-3 text-sm text-painel-alert-text">
                  {erro}
                </div>
              )}

              <button
                type="submit"
                disabled={salvando}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-painel-primary text-white px-6 py-3.5 text-sm font-semibold tracking-[.03em] hover:bg-painel-primary/90 transition-colors disabled:opacity-40"
              >
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Salvar nova senha
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

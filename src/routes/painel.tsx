import { useEffect, useRef, useState } from "react";
import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { LogOut, Loader2, KeyRound, Check, X, ChevronDown } from "lucide-react";
import { SITE_URL } from "@/data/services";
import { supabaseConfigurado } from "@/lib/supabase";
import { entrar, sair, sessaoValida, trocarSenha, type Sessao } from "@/lib/painel";
import logo from "@/assets/logo-mavi.png";
import { RamosWatermark } from "@/components/RamosWatermark";
import { PainelModal } from "@/components/PainelModal";

// Deriva um nome de exibição a partir do e-mail de login (ex.:
// "marina.figueiredo@..." → "Marina Figueiredo"), já que o login continua
// sendo por e-mail mas o cabeçalho fica mais pessoal mostrando um nome.
function nomeExibicao(email?: string): string {
  const local = email?.split("@")[0] ?? "";
  const partes = local
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return "Usuária";
  return partes.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

export const Route = createFileRoute("/painel")({
  head: () => ({
    meta: [{ title: "Painel | MAVI" }, { name: "robots", content: "noindex, nofollow" }],
    links: [{ rel: "canonical", href: `${SITE_URL}/painel` }],
  }),
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({
    next: typeof s.next === "string" && s.next.startsWith("/") ? s.next : undefined,
  }),
  component: PainelLayout,
});

function LoginForm({ onEntrar }: { onEntrar: (s: Sessao) => void }) {
  const USUARIAS = [
    { nome: "Morgana", email: "morgckummer@gmail.com" },
    { nome: "Marina", email: "morganamavi26@gmail.com" },
  ] as const;
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!email) {
      setErro("Selecione a usuária.");
      return;
    }
    setCarregando(true);
    try {
      const s = await entrar(email.trim(), senha);
      onEntrar(s);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível entrar.");
      setCarregando(false);
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
          {!supabaseConfigurado() && (
            <div className="mb-5 rounded-xl border border-painel-alert-border bg-painel-alert-bg px-4 py-3 text-sm text-painel-alert-text">
              Supabase ainda não configurado. Defina as variáveis de ambiente
              <code className="mx-1">VITE_SUPABASE_URL</code> e
              <code className="mx-1">VITE_SUPABASE_ANON_KEY</code>.
            </div>
          )}

          <form onSubmit={submeter} className="space-y-5">
            <div>
              <label className="block text-[11px] tracking-[.06em] text-painel-muted mb-2.5 uppercase">
                Usuária
              </label>
              <select
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                className="w-full rounded-xl border border-painel-border bg-painel-bg px-4 py-3.5 text-sm text-painel-title focus:outline-none focus:ring-2 focus:ring-painel-primary/40 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2214%22 height=%2214%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23a685bb%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-no-repeat bg-[right_1rem_center] pr-10"
              >
                <option value="" disabled>
                  Selecione…
                </option>
                {USUARIAS.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] tracking-[.06em] text-painel-muted mb-2.5 uppercase">
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                autoComplete="current-password"
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
              disabled={carregando || !email}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-painel-primary text-white px-6 py-3.5 text-sm font-semibold tracking-[.03em] hover:bg-painel-primary/90 transition-colors disabled:opacity-40"
            >
              {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Entrar
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function TrocarSenhaForm({ onFechar }: { onFechar: () => void }) {
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
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
      await trocarSenha(senha);
      setSucesso(true);
      setSenha("");
      setConfirmar("");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível trocar a senha.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <PainelModal onFechar={onFechar}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-painel-lilac-soft" />
          <h3 className="font-medium text-white">Trocar senha</h3>
        </div>
        <button
          type="button"
          onClick={onFechar}
          title="Fechar"
          className="text-white/50 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {sucesso ? (
        <p className="text-sm text-painel-lilac-soft">Senha alterada com sucesso.</p>
      ) : (
        <form onSubmit={submeter} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">Nova senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-painel-lilac-soft/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              Confirmar nova senha
            </label>
            <input
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-painel-lilac-soft/50"
            />
          </div>
          {erro && <p className="text-sm text-rose-300">{erro}</p>}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center gap-1.5 rounded-full bg-painel-primary text-white px-4 py-2 text-sm font-medium hover:bg-painel-primary/90 transition-colors disabled:opacity-40"
            >
              {salvando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Salvar
            </button>
            <button
              type="button"
              onClick={onFechar}
              disabled={salvando}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/70 hover:border-white/40 transition-colors disabled:opacity-40"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </PainelModal>
  );
}

function MenuUsuario({
  nome,
  onTrocarSenha,
  onSair,
}: {
  nome: string;
  onTrocarSenha: () => void;
  onSair: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="inline-flex items-center gap-2.5 rounded-full border border-white/25 pl-2 pr-4 py-[7px] text-sm font-medium text-white hover:border-white/50 transition-colors"
      >
        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-painel-primary text-xs font-bold text-white">
          {nome.charAt(0).toUpperCase()}
        </span>
        <span className="hidden sm:inline text-[13px]">{nome}</span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-white/70 transition-transform ${aberto ? "rotate-180" : ""}`}
        />
      </button>

      {aberto && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-painel-border bg-white shadow-lg py-1.5 z-20">
          <button
            type="button"
            onClick={() => {
              setAberto(false);
              onTrocarSenha();
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-painel-title hover:bg-painel-badge-bg/40 transition-colors"
          >
            <KeyRound className="h-4 w-4" />
            Trocar senha
          </button>
          <button
            type="button"
            onClick={() => {
              setAberto(false);
              onSair();
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-painel-alert-text hover:bg-painel-alert-bg/50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

function PainelLayout() {
  const [estado, setEstado] = useState<"carregando" | "logado" | "deslogado">("carregando");
  const [email, setEmail] = useState<string | undefined>();
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const navigate = useNavigate();
  const { next } = Route.useSearch();

  // Depois que a sessão ficar válida (login novo ou já tinha sessão), se a URL
  // trouxer ?next=/caminho relativo, redireciona pra lá — usado pela tela de
  // consentimento OAuth em /.lovable/oauth/consent.
  useEffect(() => {
    if (estado === "logado" && next) {
      window.location.assign(next);
    }
  }, [estado, next]);

  useEffect(() => {
    let ativo = true;
    sessaoValida().then((s) => {
      if (!ativo) return;
      if (s) {
        setEmail(s.email);
        setEstado("logado");
      } else {
        setEstado("deslogado");
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  if (estado === "carregando") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-painel-bg">
        <Loader2 className="h-6 w-6 animate-spin text-painel-muted" />
      </div>
    );
  }

  if (estado === "deslogado") {
    return (
      <LoginForm
        onEntrar={(s) => {
          setEmail(s.email);
          setEstado("logado");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-painel-bg">
      <header className="relative bg-painel-hero-bg">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 8% 0%, rgba(154,111,176,.5), transparent 55%), radial-gradient(circle at 96% 100%, rgba(179,146,76,.38), transparent 50%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 py-6 flex items-center justify-between gap-4">
          <Link to="/painel">
            <img src={logo} alt="Painel MAVI" className="h-11 w-auto brightness-0 invert" />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <nav className="hidden sm:flex items-center gap-1 mr-2">
              <Link
                to="/painel"
                className="rounded-full px-3.5 py-2 text-[13px] font-medium text-white/70 hover:text-white transition-colors"
                activeProps={{ className: "text-white" }}
                activeOptions={{ exact: true }}
              >
                Clientes
              </Link>
              <Link
                to="/painel/pendentes"
                className="rounded-full px-3.5 py-2 text-[13px] font-medium text-white/70 hover:text-white transition-colors"
                activeProps={{ className: "text-white" }}
              >
                Pendentes
              </Link>
            </nav>
            <MenuUsuario
              nome={nomeExibicao(email)}
              onTrocarSenha={() => setTrocandoSenha(true)}
              onSair={() => {
                sair();
                setEstado("deslogado");
                navigate({ to: "/painel" });
              }}
            />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        {trocandoSenha && <TrocarSenhaForm onFechar={() => setTrocandoSenha(false)} />}
        <Outlet />
      </div>
    </div>
  );
}

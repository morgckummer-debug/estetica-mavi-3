import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Loader2, Check, X } from "lucide-react";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { lerSessao } from "@/lib/painel";
import logo from "@/assets/logo-mavi.png";

// Tela de consentimento OAuth 2.1 do Supabase. Aparece quando um cliente
// externo (ChatGPT, Claude, Codex…) inicia o fluxo pra conectar no MCP
// deste app. Reaproveita o login existente do painel — se não estiver
// logada, manda pra /painel preservando o authorization_id.

type ConsentSearch = { authorization_id: string; next?: string };

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  validateSearch: (s: Record<string, unknown>): ConsentSearch => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: ({ search, location }) => {
    if (!search.authorization_id) {
      throw new Error("authorization_id ausente na URL.");
    }
    const sessao = lerSessao();
    if (!sessao) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/painel", search: { next } as never });
    }
  },
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <FullScreen>
      <p className="text-sm text-painel-alert-text">
        Não foi possível carregar a autorização: {String((error as Error)?.message ?? error)}
      </p>
    </FullScreen>
  ),
});

type Detalhes = {
  authorization_id?: string;
  client?: { name?: string; logo_uri?: string };
  redirect_uri?: string;
  scope?: string;
};

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-painel-bg px-6 py-16">
      <div className="w-full max-w-md text-center">
        <img src={logo} alt="MAVI" className="mx-auto h-16 w-auto mb-8" />
        {children}
      </div>
    </main>
  );
}

function ConsentPage() {
  const { authorization_id } = Route.useSearch();
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [detalhes, setDetalhes] = useState<Detalhes | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [decidindo, setDecidindo] = useState<"approve" | "deny" | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const sessao = lerSessao();
        if (!sessao) throw new Error("Sessão expirada. Entre novamente no painel.");
        const sb = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        await sb.auth.setSession({
          access_token: sessao.access_token,
          refresh_token: sessao.refresh_token,
        });
        const { data, error } = await sb.auth.oauth.getAuthorizationDetails(authorization_id);
        if (!ativo) return;
        if (error) throw error;
        // Já consentido: o servidor devolve direto o redirect_url.
        if (data && "redirect_url" in data && !("authorization_id" in data)) {
          window.location.href = data.redirect_url;
          return;
        }
        setClient(sb);
        setDetalhes(data as Detalhes);
        setCarregando(false);
      } catch (e) {
        if (!ativo) return;
        setErro(e instanceof Error ? e.message : String(e));
        setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [authorization_id]);

  async function decidir(aprovar: boolean) {
    if (!client) return;
    setDecidindo(aprovar ? "approve" : "deny");
    setErro(null);
    const { data, error } = aprovar
      ? await client.auth.oauth.approveAuthorization(authorization_id, { skipBrowserRedirect: true })
      : await client.auth.oauth.denyAuthorization(authorization_id, { skipBrowserRedirect: true });
    if (error) {
      setErro(error.message);
      setDecidindo(null);
      return;
    }
    const alvo = data?.redirect_url;
    if (!alvo) {
      setErro("O servidor não devolveu URL de retorno.");
      setDecidindo(null);
      return;
    }
    window.location.href = alvo;
  }

  if (carregando) {
    return (
      <FullScreen>
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-painel-muted" />
      </FullScreen>
    );
  }
  if (erro) {
    return (
      <FullScreen>
        <p className="text-sm text-painel-alert-text">{erro}</p>
      </FullScreen>
    );
  }

  const nomeCliente = detalhes?.client?.name ?? "um aplicativo";
  return (
    <FullScreen>
      <div className="rounded-[20px] border border-painel-border bg-white p-8 text-left shadow-[0_24px_50px_-30px_rgba(120,80,150,0.25)]">
        <h1 className="text-lg font-semibold text-painel-title mb-2">
          Conectar <span className="text-painel-primary">{nomeCliente}</span> ao seu painel
        </h1>
        <p className="text-sm text-painel-muted mb-4">
          Isso permite que <strong>{nomeCliente}</strong> consulte as fichas de clientes e as
          sessões pendentes de confirmação — apenas o que você já vê no painel. Nenhuma alteração
          será feita.
        </p>
        {detalhes?.redirect_uri && (
          <p className="text-[11px] text-painel-muted break-all mb-6">
            Retorno: {detalhes.redirect_uri}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => decidir(true)}
            disabled={decidindo !== null}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-painel-primary text-white px-6 py-3 text-sm font-semibold hover:bg-painel-primary/90 transition-colors disabled:opacity-40"
          >
            {decidindo === "approve" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Aprovar
          </button>
          <button
            type="button"
            onClick={() => decidir(false)}
            disabled={decidindo !== null}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-painel-border px-6 py-3 text-sm font-medium text-painel-muted hover:border-painel-primary/40 transition-colors disabled:opacity-40"
          >
            {decidindo === "deny" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
            Cancelar
          </button>
        </div>
      </div>
    </FullScreen>
  );
}
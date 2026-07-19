import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Search,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Loader2,
  Camera,
  CameraOff,
  Inbox,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Send,
  FileText,
} from "lucide-react";
import {
  listarClientes,
  listarFichas,
  listarFichasExcluidas,
  listarUltimasSessoesPorFicha,
  restaurarFicha,
  type Cliente,
  type Ficha,
} from "@/lib/painel";
import { agregarFichas, digitos, type FichasAgregadas } from "@/lib/clientes";
import { TIPOS, FICHAS, nomeCurto, nomeTipo, type Tipo } from "@/data/anamnese";
import { EnviarFicha } from "@/components/EnviarFicha";
import { RamosWatermark } from "@/components/RamosWatermark";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/painel/")({
  component: ListaFichas,
});

const POR_PAGINA = 20;
const CINCO_MINUTOS_MS = 5 * 60 * 1000;
// Cliente sem nenhuma sessão (em nenhuma ficha) há mais tempo que isso
// aparece automaticamente acinzentada na lista, sem precisar de ninguém
// clicar em "Arquivar" — calculado toda vez que a lista carrega.
const DIAS_INATIVA = 180;

function hojeISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

function diasEntre(dataAntigaISO: string, dataRecenteISO: string): number {
  const [a1, m1, d1] = dataAntigaISO.split("-").map(Number);
  const [a2, m2, d2] = dataRecenteISO.split("-").map(Number);
  const ms = Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1);
  return Math.round(ms / 86400000);
}

// Cliente + o que é derivado das fichas dela (contagem, tipos, alertas...).
type ClienteListado = Cliente & FichasAgregadas & { fichas: Ficha[] };

function ListaFichas() {
  const [clientesBase, setClientesBase] = useState<Cliente[] | null>(null);
  const [fichas, setFichas] = useState<Ficha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<Tipo | "todas">("todas");
  const [pagina, setPagina] = useState(1);
  const [enviandoFicha, setEnviandoFicha] = useState(false);
  // Data da sessão mais recente de cada ficha (ficha_id -> "YYYY-MM-DD"),
  // pra detectar cliente sem atividade há muito tempo. Se falhar, o app
  // segue normal, só sem o acinzentado automático — não é crítico.
  const [ultimaSessaoPorFicha, setUltimaSessaoPorFicha] = useState<Record<string, string> | null>(
    null,
  );

  // "Fichas excluídas": carregada só quando a seção é aberta pela primeira
  // vez — é um recurso raro, não vale buscar sempre que a lista carrega.
  const [mostrarExcluidas, setMostrarExcluidas] = useState(false);
  const [fichasExcluidas, setFichasExcluidas] = useState<Ficha[] | null>(null);
  const [erroExcluidas, setErroExcluidas] = useState<string | null>(null);
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);
  const [erroRestaurar, setErroRestaurar] = useState<string | null>(null);

  useEffect(() => {
    listarClientes()
      .then(setClientesBase)
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."));
    listarFichas()
      .then(setFichas)
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."));
    listarUltimasSessoesPorFicha()
      .then(setUltimaSessaoPorFicha)
      .catch(() => {});

    // Auto-refresh: atualiza a lista sozinha a cada 5min (ex.: nova ficha
    // preenchida pela cliente), sem precisar recarregar a página. Falhas
    // aqui ficam em silêncio — não interrompe quem já está com a lista
    // carregada só por causa de uma soneca de rede.
    const intervalo = setInterval(() => {
      listarClientes()
        .then(setClientesBase)
        .catch(() => {});
      listarFichas()
        .then(setFichas)
        .catch(() => {});
      listarUltimasSessoesPorFicha()
        .then(setUltimaSessaoPorFicha)
        .catch(() => {});
    }, CINCO_MINUTOS_MS);
    return () => clearInterval(intervalo);
  }, []);

  // Junta cada cliente com as fichas dela (por cliente_id) e o que é
  // derivado disso (tipos, alertas, se está toda arquivada).
  const clientes = useMemo<ClienteListado[]>(() => {
    if (!clientesBase || !fichas) return [];
    const porCliente = new Map<string, Ficha[]>();
    for (const f of fichas) {
      if (!f.cliente_id) continue;
      const arr = porCliente.get(f.cliente_id);
      if (arr) arr.push(f);
      else porCliente.set(f.cliente_id, [f]);
    }
    return clientesBase.map((c) => {
      const fichasDoCliente = porCliente.get(c.id) ?? [];
      return { ...c, fichas: fichasDoCliente, ...agregarFichas(fichasDoCliente) };
    });
  }, [clientesBase, fichas]);

  // Dias desde a atividade mais recente da cliente (a sessão mais nova,
  // entre TODAS as fichas dela — se ela ainda mexe em algum procedimento,
  // não conta como inativa). Sem sessão nenhuma numa ficha, usa a data em
  // que a ficha foi criada. null enquanto as datas de sessão não chegaram.
  const diasSemAtividade = useMemo(() => {
    const m = new Map<string, number>();
    if (!ultimaSessaoPorFicha) return m;
    const hoje = hojeISO();
    for (const c of clientes) {
      const maisRecente = c.fichas.reduce((acc, f) => {
        const ref = ultimaSessaoPorFicha[f.id] ?? f.created_at.slice(0, 10);
        return ref > acc ? ref : acc;
      }, "");
      if (maisRecente) m.set(c.id, diasEntre(maisRecente, hoje));
    }
    return m;
  }, [clientes, ultimaSessaoPorFicha]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qDigitos = q.replace(/\D/g, ""); // só números (para CPF/telefone)
    return clientes.filter((c) => {
      if (filtroTipo !== "todas" && !c.tipos.includes(filtroTipo)) return false;
      if (!q) return true;
      if (c.nome.toLowerCase().includes(q)) return true;
      if (qDigitos) {
        if (digitos(c.telefone).includes(qDigitos)) return true;
        if (digitos(c.cpf).includes(qDigitos)) return true;
      }
      return false;
    });
  }, [clientes, busca, filtroTipo]);

  // Volta para a primeira página sempre que a busca ou o filtro mudam o
  // resultado — senão a cliente pode ficar "presa" numa página vazia.
  useEffect(() => {
    setPagina(1);
  }, [busca, filtroTipo]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginados = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  const alternarExcluidas = () => {
    const abrindo = !mostrarExcluidas;
    setMostrarExcluidas(abrindo);
    if (abrindo && fichasExcluidas === null) {
      setErroExcluidas(null);
      listarFichasExcluidas()
        .then(setFichasExcluidas)
        .catch((e) => setErroExcluidas(e instanceof Error ? e.message : "Erro ao carregar."));
    }
  };

  const restaurar = async (f: Ficha) => {
    setRestaurandoId(f.id);
    setErroRestaurar(null);
    try {
      await restaurarFicha(f.id);
      setFichasExcluidas((prev) => (prev ?? []).filter((x) => x.id !== f.id));
      setFichas((prev) => (prev ? [f, ...prev] : [f]));
    } catch (e) {
      setErroRestaurar(e instanceof Error ? e.message : "Erro ao restaurar ficha.");
    } finally {
      setRestaurandoId(null);
    }
  };

  return (
    <div>
      <RamosWatermark className="fixed left-1/2 top-1/2 hidden h-[70vh] max-h-[600px] w-auto -translate-x-1/2 -translate-y-1/2 opacity-[0.05] sm:block" />
      <div className="relative z-10">
        {/* Busca principal — encontrar a cliente por nome ou CPF */}
        <div className="relative mb-7">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-painel-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente por nome ou CPF"
            className="w-full rounded-full border border-painel-border bg-white pl-[52px] pr-5 py-4 text-[15px] text-painel-title placeholder:text-painel-muted-2 focus:outline-none focus:ring-2 focus:ring-painel-primary/40"
          />
        </div>

        <div className="mb-7 flex flex-wrap justify-end gap-2.5">
          <Link
            to="/painel/nova"
            className="inline-flex items-center gap-2 rounded-full border border-painel-border bg-white text-painel-title px-5 py-3 text-sm font-semibold hover:border-painel-primary/40 transition-colors"
          >
            <FileText className="h-4 w-4" />
            Cadastrar ficha física
          </Link>
          <button
            type="button"
            onClick={() => setEnviandoFicha(true)}
            className="inline-flex items-center gap-2 rounded-full bg-painel-primary text-white px-5 py-3 text-sm font-semibold hover:bg-painel-primary/90 transition-colors"
          >
            <Send className="h-4 w-4" />
            Enviar ficha
          </button>
        </div>

        {enviandoFicha && <EnviarFicha convitePadrao onFechar={() => setEnviandoFicha(false)} />}

        <div className="mb-5 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[34px] text-painel-title">Clientes</h2>
          <p className="text-[13px] text-painel-muted">
            {clientesBase && fichas
              ? busca || filtroTipo !== "todas"
                ? `${filtrados.length} de ${clientes.length} cliente(s)`
                : `${clientes.length} cliente(s) · ${fichas.length} ficha(s)`
              : "Carregando..."}
          </p>
        </div>

        <div className="flex items-center gap-2.5 mb-7">
          <span className="text-[13px] text-painel-muted">Filtrar por ficha</span>
          <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as Tipo | "todas")}>
            <SelectTrigger className="w-[190px] rounded-full border-painel-border bg-white text-[13px] text-painel-chip-text focus:ring-painel-primary/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {TIPOS.map((t) => (
                <SelectItem key={t} value={t}>
                  {FICHAS[t].emoji} {nomeCurto(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {erro && (
          <div className="rounded-xl border border-painel-alert-border bg-painel-alert-bg px-4 py-3 text-sm text-painel-alert-text">
            {erro}
          </div>
        )}

        {(!clientesBase || !fichas) && !erro && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-painel-muted" />
          </div>
        )}

        {clientesBase && fichas && filtrados.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-painel-muted">
            <Inbox className="h-10 w-10 mb-3 opacity-50" />
            <p>
              {busca || filtroTipo !== "todas"
                ? "Nenhuma cliente encontrada."
                : "Ainda não há clientes registradas."}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {paginados.map((c: ClienteListado) => {
            const dias = diasSemAtividade.get(c.id);
            const inativaAutomatica = dias !== undefined && dias >= DIAS_INATIVA;
            const inativa = c.todasArquivadas || inativaAutomatica;
            return (
              <Link
                key={c.id}
                to="/painel/cliente/$id"
                params={{ id: c.id }}
                className={[
                  "flex items-center justify-between gap-4 rounded-[14px] border bg-white px-6 py-5 transition-colors",
                  inativa
                    ? "grayscale opacity-60 hover:opacity-90 border-painel-border"
                    : "border-painel-border hover:border-painel-primary/40",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                    <span className="text-[15px] text-painel-title truncate">{c.nome}</span>
                    {c.todasArquivadas && (
                      <span className="text-[11px] rounded-full bg-painel-muted-2/20 text-painel-muted px-2.5 py-0.5">
                        arquivada
                      </span>
                    )}
                    {!c.todasArquivadas && inativaAutomatica && (
                      <span
                        title="Nenhuma sessão registrada nesse período, em nenhum procedimento"
                        className="text-[11px] rounded-full bg-painel-muted-2/20 text-painel-muted px-2.5 py-0.5"
                      >
                        sem atividade há {dias}d
                      </span>
                    )}
                    {c.tipos.map((t) => (
                      <span
                        key={t}
                        className="text-[11px] rounded-full px-2.5 py-0.5 bg-painel-badge-bg text-painel-title"
                      >
                        {FICHAS[t]?.emoji ?? ""} {nomeCurto(t)}
                      </span>
                    ))}
                  </div>
                  <p className="text-[13px] text-painel-muted-2 truncate">
                    {c.telefone || "sem telefone"}
                    {c.fichas.length > 1 ? ` · ${c.fichas.length} fichas` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3.5 shrink-0">
                  {c.autoriza_foto ? (
                    <span title="Autorizou uso de imagem">
                      <Camera className="h-4 w-4 text-painel-green" />
                    </span>
                  ) : (
                    <span title="Não autorizou uso de imagem">
                      <CameraOff className="h-4 w-4 text-painel-icon-muted" />
                    </span>
                  )}
                  {c.alertas > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-painel-alert-bg text-painel-alert-text px-3 py-1.5 text-xs font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {c.alertas}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {filtrados.length > POR_PAGINA && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              type="button"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={paginaAtual === 1}
              className="inline-flex items-center gap-1 rounded-full border border-painel-border px-3 py-1.5 text-sm text-painel-chip-text hover:border-painel-primary/40 disabled:opacity-40 disabled:hover:border-painel-border"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            <span className="text-sm text-painel-muted">
              Página {paginaAtual} de {totalPaginas}
            </span>
            <button
              type="button"
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual === totalPaginas}
              className="inline-flex items-center gap-1 rounded-full border border-painel-border px-3 py-1.5 text-sm text-painel-chip-text hover:border-painel-primary/40 disabled:opacity-40 disabled:hover:border-painel-border"
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-painel-border">
          <button
            type="button"
            onClick={alternarExcluidas}
            className="flex items-center gap-1.5 text-sm text-painel-muted hover:text-painel-primary transition-colors"
          >
            {mostrarExcluidas ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <Archive className="h-3.5 w-3.5" />
            Fichas excluídas{fichasExcluidas ? ` (${fichasExcluidas.length})` : ""}
          </button>

          {mostrarExcluidas && (
            <div className="mt-3">
              {erroExcluidas && <p className="text-sm text-painel-alert-text">{erroExcluidas}</p>}
              {erroRestaurar && <p className="text-sm text-painel-alert-text">{erroRestaurar}</p>}
              {fichasExcluidas === null && !erroExcluidas && (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-painel-muted" />
                </div>
              )}
              {fichasExcluidas && fichasExcluidas.length === 0 && (
                <p className="text-sm text-painel-muted">Nenhuma ficha excluída.</p>
              )}
              {fichasExcluidas && fichasExcluidas.length > 0 && (
                <ul className="space-y-1.5">
                  {fichasExcluidas.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 text-sm text-painel-muted-2">
                      <span className="truncate">
                        {f.nome} · {FICHAS[f.tipo]?.emoji ?? ""} {nomeTipo(f.tipo)}
                        {f.telefone ? ` · ${f.telefone}` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => restaurar(f)}
                        disabled={restaurandoId === f.id}
                        title="Restaurar ficha"
                        className="ml-auto shrink-0 inline-flex items-center gap-1 text-xs text-painel-primary hover:opacity-80 transition-colors disabled:opacity-40"
                      >
                        {restaurandoId === f.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        )}
                        Restaurar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

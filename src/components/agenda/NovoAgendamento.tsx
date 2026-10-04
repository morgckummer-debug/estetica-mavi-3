import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { criarAgendamentoManual, hojeSP, type AgendaServico } from "@/lib/agenda";
import { listarClientes, type Cliente } from "@/lib/painel";
import { digitos } from "@/lib/clientes";
import { mascaraTelefone } from "@/lib/mascaras";
import { PainelModal } from "@/components/PainelModal";
import { SeletorHorario } from "./SeletorHorario";
import { btnPrimario, btnSecundario, campo, rotulo } from "./estilos";

// Agendamento feito pela Marina no painel (cliente que ligou, encaixe...).
export function NovoAgendamento({
  diaInicial,
  servicos,
  onFechar,
  onCriado,
}: {
  diaInicial: string;
  servicos: AgendaServico[];
  onFechar: () => void;
  onCriado: () => void;
}) {
  const hoje = hojeSP();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [servicoId, setServicoId] = useState(servicos[0]?.id ?? "");
  const [dia, setDia] = useState(diaInicial < hoje ? hoje : diaInicial);
  const [inicio, setInicio] = useState<string | null>(null);
  const [areas, setAreas] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarClientes()
      .then(setClientes)
      .catch(() => setClientes([]));
  }, []);

  const sugestoes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (termo.length < 2 || clienteId) return [];
    const nums = digitos(termo);
    return clientes
      .filter(
        (c) =>
          c.nome.toLowerCase().includes(termo) ||
          (nums.length >= 4 && digitos(c.telefone).includes(nums)),
      )
      .slice(0, 5);
  }, [busca, clientes, clienteId]);

  const escolherCliente = (c: Cliente) => {
    setClienteId(c.id);
    setBusca(c.nome);
    setNome(c.nome);
    setTelefone(mascaraTelefone(c.telefone ?? ""));
    setEmail(c.email ?? "");
  };

  const limparCliente = () => {
    setClienteId(null);
    setBusca("");
    setNome("");
    setTelefone("");
    setEmail("");
  };

  const servico = servicos.find((s) => s.id === servicoId);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!servico || !inicio) {
      setErro("Escolha o serviço e o horário.");
      return;
    }
    if (nome.trim().length < 2) {
      setErro("Informe o nome da cliente.");
      return;
    }
    if (digitos(telefone).length < 10) {
      setErro("Informe o WhatsApp com DDD.");
      return;
    }
    setSalvando(true);
    try {
      await criarAgendamentoManual({
        servico,
        inicio,
        nome,
        telefone,
        email,
        clienteId,
        areas: areas
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        observacao,
      });
      onCriado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível agendar.");
      setSalvando(false);
    }
  };

  return (
    <PainelModal onFechar={onFechar} maxWidth="max-w-md">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="font-medium text-white">Novo agendamento</h3>
        <button
          type="button"
          onClick={onFechar}
          title="Fechar"
          className="text-white/50 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={salvar} className="space-y-3.5">
        <div className="relative">
          <label className={rotulo}>Cliente já cadastrada (opcional)</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                if (clienteId) setClienteId(null);
              }}
              placeholder="Buscar por nome ou telefone"
              className={`${campo} pl-10`}
            />
            {clienteId && (
              <button
                type="button"
                onClick={limparCliente}
                title="Trocar de cliente"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {sugestoes.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-white/15 bg-painel-hero-bg shadow-xl">
              {sugestoes.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => escolherCliente(c)}
                    className="flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left text-sm text-white hover:bg-white/10"
                  >
                    <span className="truncate">{c.nome}</span>
                    <span className="shrink-0 text-xs text-white/50">
                      {mascaraTelefone(c.telefone ?? "")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label className={rotulo}>Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={Boolean(clienteId)}
              className={`${campo} disabled:opacity-60`}
            />
          </div>
          <div>
            <label className={rotulo}>WhatsApp</label>
            <input
              value={telefone}
              onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
              inputMode="tel"
              placeholder="(31) 90000-0000"
              disabled={Boolean(clienteId)}
              className={`${campo} disabled:opacity-60`}
            />
          </div>
        </div>
        <div>
          <label className={rotulo}>E-mail (opcional)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={campo}
          />
        </div>

        <div>
          <label className={rotulo}>Serviço</label>
          <select
            value={servicoId}
            onChange={(e) => {
              setServicoId(e.target.value);
              setInicio(null);
            }}
            className={campo}
          >
            {servicos.map((s) => (
              <option key={s.id} value={s.id} className="text-painel-title">
                {s.nome} · {s.duracao_min} min
              </option>
            ))}
          </select>
        </div>

        <SeletorHorario
          servico={servico}
          dia={dia}
          onDia={setDia}
          valor={inicio}
          onValor={setInicio}
        />

        <div>
          <label className={rotulo}>Áreas (opcional, separe por vírgula)</label>
          <input
            value={areas}
            onChange={(e) => setAreas(e.target.value)}
            placeholder="Virilha, axilas"
            className={campo}
          />
        </div>
        <div>
          <label className={rotulo}>Observação (opcional)</label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            className={campo}
          />
        </div>

        {erro && <p className="text-sm text-rose-300">{erro}</p>}
        <div className="flex items-center gap-2">
          <button type="submit" disabled={salvando} className={btnPrimario}>
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Agendar
          </button>
          <button type="button" onClick={onFechar} disabled={salvando} className={btnSecundario}>
            Cancelar
          </button>
        </div>
      </form>
    </PainelModal>
  );
}

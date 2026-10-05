import { useState } from "react";
import { Check, Loader2, Lock, MessageCircle, X } from "lucide-react";
import {
  agendamentosNoPeriodo,
  criarBloqueio,
  dataSP,
  horaSP,
  hojeSP,
  instanteSP,
  pedirRemarcacao,
  rotuloDiaLongo,
  rotuloHorario,
  somarDias,
  type AgendaServico,
  type Agendamento,
} from "@/lib/agenda";
import { PAINEL_URL } from "@/data/services";
import { linkWhatsappEscolherHorario } from "@/lib/whatsapp";
import { PainelModal } from "@/components/PainelModal";
import { ReagendarPainel } from "./ReagendarPainel";
import { btnPrimario, btnSecundario, campo, rotulo } from "./estilos";

// Bloqueia um horário, um dia inteiro ou um período (férias, feriado). Com
// `ferias`, vira o atalho "Férias": sempre dias inteiros, motivo "Férias", e
// pode ser cadastrado com bastante antecedência.
// Se já houver cliente agendada no período, o bloqueio é criado mas NADA é
// cancelado sozinho: a Marina decide, cliente por cliente, entre reagendar
// agora, pedir que a cliente escolha outro horário, ou manter.
export function BloquearHorario({
  diaInicial,
  servicos,
  ferias = false,
  onFechar,
  onConcluido,
}: {
  diaInicial: string;
  servicos: AgendaServico[];
  ferias?: boolean;
  onFechar: () => void;
  onConcluido: (mensagem: string) => void;
}) {
  const hoje = hojeSP();
  const [de, setDe] = useState(diaInicial < hoje ? hoje : diaInicial);
  const [ate, setAte] = useState(diaInicial < hoje ? hoje : diaInicial);
  const [diaInteiro, setDiaInteiro] = useState(true);
  const [horaDe, setHoraDe] = useState("12:00");
  const [horaAte, setHoraAte] = useState("13:00");
  const [motivo, setMotivo] = useState(ferias ? "Férias" : "");
  const textoConcluido = ferias ? "Férias registradas." : "Bloqueio criado.";
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Segunda etapa: agendamentos que o bloqueio atingiu.
  const [conflitos, setConflitos] = useState<Agendamento[] | null>(null);
  // Quem foi marcada como "precisa reagendar" e ainda pode receber o aviso por WhatsApp.
  const [avisaveis, setAvisaveis] = useState<Set<string>>(new Set());
  const [resolvidos, setResolvidos] = useState<Record<string, string>>({});
  const [reagendando, setReagendando] = useState<Agendamento | null>(null);
  const [trabalhando, setTrabalhando] = useState<string | null>(null);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const fimDia = ate < de ? de : ate;
    const inicio = diaInteiro || ferias ? instanteSP(de) : instanteSP(de, horaDe);
    const fim =
      diaInteiro || ferias ? instanteSP(somarDias(fimDia, 1)) : instanteSP(fimDia, horaAte);
    if (new Date(fim) <= new Date(inicio)) {
      setErro("O fim precisa ser depois do início.");
      return;
    }
    setSalvando(true);
    try {
      await criarBloqueio({ inicio, fim, motivo });
      const atingidos = await agendamentosNoPeriodo(inicio, fim);
      if (atingidos.length === 0) {
        onConcluido(textoConcluido);
        return;
      }
      setConflitos(atingidos);
      setSalvando(false);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível bloquear.");
      setSalvando(false);
    }
  };

  const pedirEscolha = async (ag: Agendamento) => {
    setTrabalhando(ag.id);
    setErro(null);
    try {
      await pedirRemarcacao(ag.id);
      setResolvidos((r) => ({ ...r, [ag.id]: "Marcada como “precisa reagendar”" }));
      setAvisaveis((s) => new Set(s).add(ag.id));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível atualizar.");
    } finally {
      setTrabalhando(null);
    }
  };

  if (conflitos) {
    const pendentes = conflitos.filter((c) => !resolvidos[c.id]);
    return (
      <PainelModal onFechar={() => onConcluido(textoConcluido)} maxWidth="max-w-md">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-painel-lilac-soft" />
            <h3 className="font-medium text-white">
              {ferias ? "Férias registradas" : "Bloqueio criado"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onConcluido(textoConcluido)}
            title="Fechar"
            className="text-white/50 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {reagendando ? (
          <ReagendarPainel
            ag={reagendando}
            servicos={servicos}
            onConcluido={() => {
              setResolvidos((r) => ({ ...r, [reagendando.id]: "Reagendada" }));
              setReagendando(null);
            }}
            onVoltar={() => setReagendando(null)}
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-amber-200">
              ⚠️ Esse bloqueio atinge {conflitos.length}{" "}
              {conflitos.length === 1 ? "agendamento" : "agendamentos"}. Nada foi cancelado —
              escolha o que fazer com cada um:
            </p>
            <ul className="space-y-3">
              {conflitos.map((ag) => (
                <li key={ag.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-sm font-medium text-white">{ag.nome}</p>
                  <p className="text-xs text-white/60">
                    {ag.servico_nome} · {rotuloDiaLongo(dataSP(ag.inicio))},{" "}
                    {rotuloHorario(ag.inicio, ag.fim)}
                  </p>
                  {resolvidos[ag.id] ? (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <p className="inline-flex items-center gap-1 text-xs font-medium text-painel-lilac-soft">
                        <Check className="h-3.5 w-3.5" />
                        {resolvidos[ag.id]}
                      </p>
                      {avisaveis.has(ag.id) && (
                        <a
                          href={linkWhatsappEscolherHorario({
                            origin: PAINEL_URL,
                            token: ag.token,
                            telefone: ag.telefone,
                            nomeCliente: ag.nome,
                            servico: ag.servico_nome,
                            dia: rotuloDiaLongo(dataSP(ag.inicio)),
                            hora: horaSP(ag.inicio),
                          })}
                          target="whatsapp"
                          rel="noreferrer"
                          className={btnSecundario}
                        >
                          <MessageCircle className="h-4 w-4" />
                          Avisar por WhatsApp
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setReagendando(ag)}
                        className={btnSecundario}
                      >
                        Reagendar agora
                      </button>
                      <button
                        type="button"
                        disabled={trabalhando === ag.id}
                        onClick={() => pedirEscolha(ag)}
                        className={btnSecundario}
                      >
                        {trabalhando === ag.id && <Loader2 className="h-4 w-4 animate-spin" />}
                        Pedir que ela escolha
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setResolvidos((r) => ({ ...r, [ag.id]: "Mantida no horário" }))
                        }
                        className="px-2 py-2 text-xs font-medium text-white/50 hover:text-white"
                      >
                        Manter
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {erro && <p className="mt-3 text-sm text-rose-300">{erro}</p>}
            <div className="mt-5">
              <button
                type="button"
                onClick={() => onConcluido(textoConcluido)}
                className={btnPrimario}
              >
                {pendentes.length > 0 ? "Resolver depois" : "Concluir"}
              </button>
            </div>
          </>
        )}
      </PainelModal>
    );
  }

  return (
    <PainelModal onFechar={onFechar}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-painel-lilac-soft" />
          <h3 className="font-medium text-white">{ferias ? "Férias" : "Bloquear horário"}</h3>
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

      <form onSubmit={salvar} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo}>De</label>
            <input
              type="date"
              value={de}
              min={hoje}
              onChange={(e) => {
                setDe(e.target.value);
                if (ate < e.target.value) setAte(e.target.value);
              }}
              className={`${campo} [color-scheme:dark]`}
            />
          </div>
          <div>
            <label className={rotulo}>Até</label>
            <input
              type="date"
              value={ate}
              min={de}
              onChange={(e) => setAte(e.target.value)}
              className={`${campo} [color-scheme:dark]`}
            />
          </div>
        </div>

        {ferias && (
          <p className="text-xs leading-relaxed text-white/60">
            Os dias de férias ficam fechados na agenda online. Pode cadastrar com bastante
            antecedência: se já houver clientes marcadas nesse período, você escolhe o que fazer com
            cada uma.
          </p>
        )}

        <label
          className={`flex items-center gap-2 text-sm text-white/80 ${ferias ? "hidden" : ""}`}
        >
          <input
            type="checkbox"
            checked={diaInteiro}
            onChange={(e) => setDiaInteiro(e.target.checked)}
            className="h-4 w-4 accent-painel-primary"
          />
          Dia inteiro
        </label>

        {!diaInteiro && !ferias && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rotulo}>Das</label>
              <input
                type="time"
                value={horaDe}
                onChange={(e) => setHoraDe(e.target.value)}
                required
                className={`${campo} [color-scheme:dark]`}
              />
            </div>
            <div>
              <label className={rotulo}>Às</label>
              <input
                type="time"
                value={horaAte}
                onChange={(e) => setHoraAte(e.target.value)}
                required
                className={`${campo} [color-scheme:dark]`}
              />
            </div>
          </div>
        )}

        <div>
          <label className={rotulo}>Motivo (opcional)</label>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={ferias ? "Férias" : "Férias, feriado, consulta médica…"}
            className={campo}
          />
        </div>

        {erro && <p className="text-sm text-rose-300">{erro}</p>}
        <div className="flex items-center gap-2">
          <button type="submit" disabled={salvando} className={btnPrimario}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {ferias ? "Registrar férias" : "Bloquear"}
          </button>
          <button type="button" onClick={onFechar} disabled={salvando} className={btnSecundario}>
            Cancelar
          </button>
        </div>
      </form>
    </PainelModal>
  );
}

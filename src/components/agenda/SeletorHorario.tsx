import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { horariosLivres, horaSP, hojeSP, instanteSP, type AgendaServico } from "@/lib/agenda";
import { campo, rotulo } from "./estilos";
import { SeletorData } from "./SeletorData";

// Escolha de data + horário. Os horários livres vêm do banco (já descontando
// expediente, bloqueios e outros agendamentos). "Outro horário" é o encaixe:
// a Marina digita a hora, mesmo fora da grade — o banco ainda impede
// sobreposição com outro agendamento.
export function SeletorHorario({
  servico,
  dia,
  onDia,
  valor,
  onValor,
  ignorarId,
}: {
  servico: AgendaServico | undefined;
  dia: string;
  onDia: (dia: string) => void;
  valor: string | null;
  onValor: (iso: string | null) => void;
  ignorarId?: string;
}) {
  const [livres, setLivres] = useState<string[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [horaManual, setHoraManual] = useState("");

  const servicoId = servico?.id;
  useEffect(() => {
    if (!servicoId || !dia) {
      setLivres([]);
      return;
    }
    let ativo = true;
    setLivres(null);
    setErro(null);
    horariosLivres(servicoId, dia, ignorarId)
      .then((h) => ativo && setLivres(h))
      .catch(() => {
        if (!ativo) return;
        setLivres([]);
        setErro("Não foi possível carregar os horários.");
      });
    return () => {
      ativo = false;
    };
  }, [servicoId, dia, ignorarId]);

  // Hora que já veio escolhida (clique na grade) e não está entre os horários
  // livres: vira encaixe, com a hora preenchida no campo.
  useEffect(() => {
    if (livres === null || !valor || manual) return;
    if (!livres.some((h) => mesmoInstante(valor, h))) {
      setManual(true);
      setHoraManual(horaSP(valor));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livres]);

  return (
    <div className="space-y-3">
      <div>
        <label className={rotulo}>Data</label>
        <SeletorData
          valor={dia}
          min={hojeSP()}
          rotulo="Data"
          onChange={(ymd) => {
            onDia(ymd);
            onValor(null);
            setManual(false);
          }}
        />
      </div>

      <div>
        <label className={rotulo}>Horário</label>
        {livres === null && <Loader2 className="h-4 w-4 animate-spin text-white/60" />}
        {livres && livres.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {livres.map((h) => {
              const selecionado = !manual && valor !== null && mesmoInstante(valor, h);
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setManual(false);
                    onValor(h);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selecionado
                      ? "border-painel-primary bg-painel-primary text-white"
                      : "border-white/20 text-white/80 hover:border-white/50"
                  }`}
                >
                  {horaSP(h)}
                </button>
              );
            })}
          </div>
        )}
        {livres && livres.length === 0 && (
          <p className="text-xs text-white/60">
            {erro ??
              (servico
                ? "Sem horários livres neste dia. Use “Outro horário” para encaixar."
                : "Escolha o serviço para ver os horários livres.")}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setManual((v) => !v);
            onValor(null);
            setHoraManual("");
          }}
          className="mt-2 text-xs font-medium text-painel-lilac-soft hover:underline"
        >
          {manual ? "Voltar aos horários livres" : "Outro horário (encaixe)"}
        </button>
        {manual && (
          <input
            type="time"
            value={horaManual}
            onChange={(e) => {
              setHoraManual(e.target.value);
              onValor(e.target.value && dia ? instanteSP(dia, e.target.value) : null);
            }}
            className={`${campo} mt-2 [color-scheme:dark]`}
          />
        )}
      </div>
    </div>
  );
}

// Os horários vêm do banco em um formato de texto e o escolhido em outro:
// compara pelo instante, não pelo texto.
function mesmoInstante(a: string, b: string): boolean {
  return new Date(a).getTime() === new Date(b).getTime();
}

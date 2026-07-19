import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, AlertTriangle, Loader2, FileText } from "lucide-react";
import {
  TIPOS,
  FICHAS,
  getFicha,
  nomeCurto,
  calcularAlertas,
  campoVisivel,
  campoValido,
  type Tipo,
  type Respostas,
} from "@/data/anamnese";
import { criarFicha, encontrarOuCriarCliente } from "@/lib/painel";
import { CampoView } from "@/components/FichaCampos";
import { RamosWatermark } from "@/components/RamosWatermark";

// Cadastro manual de uma ficha — para a Marina transcrever uma ficha física
// (papel) que a cliente já preencheu na clínica, sem precisar mandar link
// nenhum. Reaproveita as mesmas perguntas de /avaliacao/$tipo, mas quem
// preenche e confirma o envio é a Marina, autenticada no painel.
export const Route = createFileRoute("/painel/nova")({
  component: NovaFicha,
});

function SeletorTipo({ onEscolher }: { onEscolher: (t: Tipo) => void }) {
  return (
    <div className="rounded-[14px] border border-painel-border bg-white p-6 sm:p-8">
      <p className="text-sm text-painel-muted mb-5">Qual ficha física você vai transcrever?</p>
      <div className="grid sm:grid-cols-3 gap-3">
        {TIPOS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onEscolher(t)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-painel-border bg-white px-5 py-6 text-center hover:border-painel-primary/50 hover:bg-painel-badge-bg/30 transition-colors"
          >
            <span className="text-2xl">{FICHAS[t].emoji}</span>
            <span className="text-sm font-medium text-painel-title">{nomeCurto(t)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Formulario({ tipo, onTrocarTipo }: { tipo: Tipo; onTrocarTipo: () => void }) {
  const def = getFicha(tipo)!;
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [respostas, setRespostas] = useState<Respostas>({});
  const [termoFisico, setTermoFisico] = useState(false);
  const [autorizaFoto, setAutorizaFoto] = useState(false);
  const [consentimentoDados, setConsentimentoDados] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarErros, setMostrarErros] = useState(false);

  const etapas = def.etapas;
  const totalEtapas = etapas.length + 1; // + confirmação
  const stepLabels = [...etapas.map((e) => e.titulo), "Confirmar"];
  const naConfirmacao = step === etapas.length;

  const set = (id: string, v: string | boolean | null) => setRespostas((r) => ({ ...r, [id]: v }));

  const alertas = calcularAlertas(tipo, respostas);

  const podeAvancar = (() => {
    if (naConfirmacao) return termoFisico && consentimentoDados && !enviando;
    return etapas[step].campos.every(
      (c) => !campoVisivel(c, respostas) || campoValido(c, respostas),
    );
  })();

  const cadastrar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      const telefone = String(respostas.whatsapp ?? "").trim() || null;
      const clienteId = await encontrarOuCriarCliente(respostas, telefone);
      const ficha = await criarFicha({
        tipo,
        nome: String(respostas.nome ?? "").trim(),
        telefone,
        clienteId,
        respostas,
        alertas,
        termo_aceito: termoFisico,
        autoriza_foto: autorizaFoto,
        consentimento_dados: consentimentoDados,
      });
      navigate({ to: "/painel/$id", params: { id: ficha.id } });
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível cadastrar a ficha. Tente novamente.",
      );
      setEnviando(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-painel-muted">
          {FICHAS[tipo].emoji} {nomeCurto(tipo)} · Etapa {step + 1} de {totalEtapas} —{" "}
          {stepLabels[step]}
        </p>
        <button
          type="button"
          onClick={onTrocarTipo}
          disabled={enviando}
          className="text-xs font-medium text-painel-primary underline underline-offset-2 disabled:opacity-40"
        >
          Trocar tipo de ficha
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {stepLabels.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= step ? "bg-painel-primary" : "bg-painel-border"
            }`}
          />
        ))}
      </div>

      <div className="relative overflow-hidden rounded-[14px] border border-painel-border bg-white p-6 sm:p-8 min-h-[380px] flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            {!naConfirmacao && (
              <div>
                {etapas[step].descricao && (
                  <p className="text-sm text-painel-muted mb-6">{etapas[step].descricao}</p>
                )}
                {etapas[step].layout === "grid" ? (
                  <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                    {etapas[step].campos
                      .filter((c) => campoVisivel(c, respostas))
                      .map((c) => (
                        <div key={c.id} className="border-b border-painel-border/60 pb-3">
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

            {naConfirmacao && (
              <div className="space-y-5">
                <label
                  className={`flex gap-3 rounded-xl border bg-painel-bg px-4 py-4 cursor-pointer ${
                    mostrarErros && !termoFisico
                      ? "border-painel-alert-border"
                      : "border-painel-border"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={termoFisico}
                    onChange={(e) => setTermoFisico(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-painel-primary"
                  />
                  <span className="text-sm text-painel-title leading-relaxed">
                    <strong>Termo de responsabilidade assinado no papel.</strong> Confirmo que essa
                    ficha física, com o termo assinado pela cliente, está arquivada na clínica.
                  </span>
                </label>

                <label
                  className={`flex gap-3 rounded-xl border bg-painel-bg px-4 py-4 cursor-pointer ${
                    mostrarErros && !consentimentoDados
                      ? "border-painel-alert-border"
                      : "border-painel-border"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={consentimentoDados}
                    onChange={(e) => setConsentimentoDados(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-painel-primary"
                  />
                  <span className="text-sm text-painel-title leading-relaxed">
                    <strong>Consentimento de dados (LGPD) assinado no papel.</strong> Confirmo que a
                    ficha física também tinha a autorização de tratamento de dados assinada pela
                    cliente.
                  </span>
                </label>

                <label className="flex gap-3 rounded-xl border border-painel-border bg-painel-bg px-4 py-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autorizaFoto}
                    onChange={(e) => setAutorizaFoto(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-painel-primary"
                  />
                  <span className="text-sm text-painel-title leading-relaxed">
                    <strong>Autorização de imagem.</strong> A cliente autorizou o uso de fotos
                    (antes/depois) no termo físico.
                  </span>
                </label>

                {alertas.length > 0 && (
                  <div className="flex gap-3 rounded-xl border border-painel-alert-border bg-painel-alert-bg px-4 py-3.5 text-sm text-painel-alert-text">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <ul className="space-y-1">
                      {alertas.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {erro && (
                  <div className="rounded-xl border border-painel-alert-border bg-painel-alert-bg px-4 py-3 text-sm text-painel-alert-text">
                    {erro}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-3 mt-8 pt-6 border-t border-painel-border">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={enviando}
              className="inline-flex items-center gap-2 rounded-full border border-painel-border px-5 py-3 text-sm font-medium text-painel-chip-text hover:border-painel-primary/40 transition-colors disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
          )}
          {!naConfirmacao ? (
            <button
              type="button"
              aria-disabled={!podeAvancar}
              onClick={() => {
                if (podeAvancar) setStep((s) => s + 1);
                else setMostrarErros(true);
              }}
              className={`ml-auto inline-flex items-center gap-2 rounded-full bg-painel-primary text-white px-6 py-3 text-sm font-medium hover:bg-painel-primary/90 transition-colors ${podeAvancar ? "" : "opacity-40"}`}
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
                if (podeAvancar) cadastrar();
                else setMostrarErros(true);
              }}
              className={`ml-auto inline-flex items-center gap-2 rounded-full bg-painel-primary text-white px-6 py-3 text-sm font-medium hover:bg-painel-primary/90 transition-colors disabled:opacity-40 ${podeAvancar ? "" : "opacity-40"}`}
            >
              {enviando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                <>
                  Cadastrar ficha
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
        {mostrarErros && !podeAvancar && !enviando && (
          <p className="mt-3 text-sm text-painel-alert-text text-right">
            {naConfirmacao
              ? "Confirme os dois termos assinados no papel para cadastrar."
              : "Responda todas as perguntas para continuar."}
          </p>
        )}
      </div>
    </div>
  );
}

function NovaFicha() {
  const [tipo, setTipo] = useState<Tipo | null>(null);

  return (
    <div>
      <RamosWatermark className="fixed -right-14 top-24 hidden h-[75vh] max-h-[640px] w-auto opacity-[0.05] sm:block" />
      <div className="relative z-10">
        <Link
          to="/painel"
          className="inline-flex items-center gap-2 text-[13px] text-painel-muted hover:text-painel-primary mb-7"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Todas as clientes
        </Link>

        <div className="mb-7">
          <h2 className="font-display text-[34px] text-painel-title flex items-center gap-3">
            <FileText className="h-7 w-7 text-painel-primary" />
            Cadastrar ficha física
          </h2>
          <p className="text-sm text-painel-muted mt-1.5">
            Transcreva aqui uma ficha em papel que a cliente já preencheu na clínica — sem precisar
            enviar link nenhum.
          </p>
        </div>

        {tipo ? (
          <Formulario tipo={tipo} onTrocarTipo={() => setTipo(null)} />
        ) : (
          <SeletorTipo onEscolher={setTipo} />
        )}
      </div>
    </div>
  );
}

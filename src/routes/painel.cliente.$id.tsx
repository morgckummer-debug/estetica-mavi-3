import { Fragment, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useParams, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowLeft,
  AlertTriangle,
  Archive,
  Camera,
  CameraOff,
  Check,
  FileSignature,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  Printer,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  CAMPOS_CADASTRO,
  FICHAS,
  TIPOS,
  nomeTipo,
  nomeCurto,
  alertasComCampo,
  type Tipo,
  type Campo,
} from "@/data/anamnese";
import {
  obterCliente,
  listarFichasDoCliente,
  listarContratos,
  atualizarCliente,
  atualizarFicha,
  excluirCliente,
  excluirClienteDefinitivamente,
  anexarContratoPdf,
  urlContratoPdf,
  excluirContrato,
  type Cliente,
  type Ficha,
  type Contrato,
} from "@/lib/painel";
import { agregarFichas } from "@/lib/clientes";
import {
  mascaraTelefone,
  mascaraCpf,
  formatarDataBR,
  formatarDataBRBarra,
  calcularIdade,
  hojeISO,
} from "@/lib/mascaras";
import { CampoView } from "@/components/FichaCampos";
import { HistoricoSessoes, type Procedimento } from "@/components/HistoricoSessoes";
import { EnviarFicha } from "@/components/EnviarFicha";
import { RamosWatermark } from "@/components/RamosWatermark";
import { PainelModal } from "@/components/PainelModal";

const ABAS = [
  { id: "cadastro", label: "Cadastro" },
  { id: "fichas", label: "Fichas" },
  { id: "historico", label: "Histórico das sessões" },
  { id: "contratos", label: "Contratos" },
] as const;
type AbaId = (typeof ABAS)[number]["id"];
const ABA_IDS = ABAS.map((a) => a.id);

export const Route = createFileRoute("/painel/cliente/$id")({
  component: PaginaCliente,
  // ?aba=contratos — usado ao voltar de "Gerar contrato" pra já abrir na
  // aba certa, em vez de cair sempre no Cadastro.
  validateSearch: (s: Record<string, unknown>): { aba?: AbaId } => ({
    aba:
      typeof s.aba === "string" && (ABA_IDS as string[]).includes(s.aba)
        ? (s.aba as AbaId)
        : undefined,
  }),
});

function formatarData(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// Só pra colunas `date` puras (sem hora/fuso), tipo `data_contrato` — usar
// formatarData() aqui mostraria o dia anterior: "YYYY-MM-DD" sem hora é
// interpretado como UTC pelo Date(), e no fuso do Brasil isso volta pro
// dia de trás. Lê os números direto da string em vez de passar por Date.
function formatarDataSemHora(data: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : data;
}

// "Contrato de 10 sessões de axila - Tatiana Mendes - 19.07.2026" — pra
// identificar o contrato de relance na lista, em vez de um "Contrato"
// genérico igual pra todo mundo.
function tituloContrato(c: Contrato, nomeCliente: string): string {
  const itensValidos = c.itens.filter((i) => (i.descricao || i.tipo) && i.quantidade);
  const partesItens = itensValidos.map((i) => {
    const sessao = Number(i.quantidade) === 1 ? "sessão" : "sessões";
    return `${i.quantidade} ${sessao} de ${i.descricao || i.tipo}`;
  });
  const dataTitulo = formatarDataSemHora(c.data_contrato).replace(/\//g, ".");
  const partes = [
    partesItens.length > 0 ? `Contrato de ${partesItens.join(", ")}` : "Contrato",
    nomeCliente,
    dataTitulo,
  ].filter(Boolean);
  return partes.join(" - ");
}

// Ida e volta entre as colunas da tabela `clientes` e os ids dos campos de
// CAMPOS_CADASTRO (mesmos ids usados nas respostas da ficha) — "whatsapp"
// vira "telefone", "estadoCivil" vira "estado_civil" etc.
function clienteParaForm(c: Cliente): Record<string, string> {
  return {
    nome: c.nome ?? "",
    whatsapp: c.telefone ?? "",
    nascimento: c.nascimento ?? "",
    profissao: c.profissao ?? "",
    estadoCivil: c.estado_civil ?? "",
    sexo: c.sexo ?? "",
    email: c.email ?? "",
    cpf: c.cpf ?? "",
    cep: c.cep ?? "",
    endereco: c.endereco ?? "",
    numero: c.numero ?? "",
    bairro: c.bairro ?? "",
    complemento: c.complemento ?? "",
    cidade: c.cidade ?? "",
    comoConheceu: c.como_conheceu ?? "",
  };
}

function formParaPatch(form: Record<string, string>): Partial<Cliente> {
  const t = (v: string | undefined) => v?.trim() || null;
  return {
    nome: form.nome?.trim() || "",
    telefone: t(form.whatsapp),
    nascimento: t(form.nascimento),
    profissao: t(form.profissao),
    estado_civil: t(form.estadoCivil),
    sexo: t(form.sexo),
    email: t(form.email),
    cpf: t(form.cpf),
    cep: t(form.cep),
    endereco: t(form.endereco),
    numero: t(form.numero),
    bairro: t(form.bairro),
    complemento: t(form.complemento),
    cidade: t(form.cidade),
    como_conheceu: t(form.comoConheceu),
  };
}

// Junta rua, número, bairro e cidade numa linha só de exibição (a Marina
// edita os campos separados, mas a visão geral não precisa de uma linha
// pra cada pedaço do endereço).
function enderecoCompleto(c: Cliente): string {
  return [[c.endereco, c.numero].filter(Boolean).join(", "), c.bairro, c.cidade]
    .filter(Boolean)
    .join(" - ");
}

// Formata o valor exibido conforme o campo (celular, CPF, data de nascimento
// + idade calculada automaticamente a partir dela).
function formatarValorCampo(campoId: string, val: string): string {
  if (campoId === "whatsapp") return mascaraTelefone(val);
  if (campoId === "cpf") return mascaraCpf(val);
  if (campoId === "nascimento") {
    const idade = calcularIdade(val);
    return idade !== null ? `${formatarDataBR(val)} (${idade} anos)` : formatarDataBR(val);
  }
  return val;
}

function AbaCadastro({
  cliente,
  onAtualizado,
  onExcluido,
}: {
  cliente: Cliente;
  onAtualizado: (c: Cliente) => void;
  onExcluido: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState<"arquivar" | "definitivo" | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const iniciarEdicao = () => {
    setForm(clienteParaForm(cliente));
    setErro(null);
    setEditando(true);
  };

  const set = (id: string, v: string | boolean | null) =>
    setForm((prev) => ({ ...prev, [id]: v == null ? "" : String(v) }));

  // Só o nome é exigido pra salvar uma edição — os outros campos
  // "obrigatórios" valem pro cadastro novo (ficha completa), mas não podem
  // travar a edição de uma cliente já cadastrada: quem se cadastrou por uma
  // ficha de tratamento (só nome/nascimento/CPF/whatsapp) nunca teve
  // endereço/sexo/CEP preenchidos, e exigir tudo isso só pra corrigir um
  // campo pontual (WhatsApp errado, endereço errado...) obrigava a Marina a
  // completar o cadastro inteiro antes de conseguir salvar qualquer coisa.
  const nomeVazio = !String(form.nome ?? "").trim();
  const podeSalvar = !nomeVazio;

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const patch = formParaPatch(form);
      await atualizarCliente(cliente.id, patch);
      onAtualizado({ ...cliente, ...patch });
      setEditando(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar o cadastro.");
    } finally {
      setSalvando(false);
    }
  };

  const arquivarNaExclusao = async () => {
    setExcluindo("arquivar");
    setErroExclusao(null);
    try {
      await excluirCliente(cliente.id);
      onExcluido();
    } catch (e) {
      setErroExclusao(e instanceof Error ? e.message : "Erro ao excluir.");
      setExcluindo(null);
      setConfirmandoExclusao(false);
    }
  };

  const excluirDefinitivamente = async () => {
    setExcluindo("definitivo");
    setErroExclusao(null);
    try {
      await excluirClienteDefinitivamente(cliente.id);
      onExcluido();
    } catch (e) {
      setErroExclusao(e instanceof Error ? e.message : "Erro ao excluir definitivamente.");
      setExcluindo(null);
      setConfirmandoExclusao(false);
    }
  };

  return (
    <div className="rounded-[14px] border border-painel-border bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-medium text-painel-title">Dados da cliente</h3>
        <div className="flex items-center gap-3">
          {!editando && (
            <button
              type="button"
              onClick={iniciarEdicao}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-painel-primary hover:opacity-80 transition-opacity"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
          )}
          {!editando && !confirmandoExclusao && (
            <button
              type="button"
              onClick={() => setConfirmandoExclusao(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-painel-alert-text hover:opacity-80 transition-opacity"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </button>
          )}
        </div>
      </div>

      {confirmandoExclusao && (
        <PainelModal
          onFechar={excluindo === null ? () => setConfirmandoExclusao(false) : undefined}
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-white/80">
              Excluir <strong className="text-white">{cliente.nome}</strong>? Arquivar move o
              cadastro e todas as fichas para "excluídas" (dá pra restaurar depois); excluir
              definitivamente apaga tudo — cadastro, fichas e sessões — pra sempre.
            </p>
            {erroExclusao && <p className="text-sm text-rose-300">{erroExclusao}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setConfirmandoExclusao(false)}
                disabled={excluindo !== null}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/70 hover:border-white/40 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={arquivarNaExclusao}
                disabled={excluindo !== null}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/40 px-4 py-2 text-sm font-medium text-rose-300 hover:bg-white/5 transition-colors disabled:opacity-40"
              >
                {excluindo === "arquivar" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
                Arquivar
              </button>
              <button
                type="button"
                onClick={excluirDefinitivamente}
                disabled={excluindo !== null}
                className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition-colors disabled:opacity-40"
              >
                {excluindo === "definitivo" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Excluir definitivamente
              </button>
            </div>
          </div>
        </PainelModal>
      )}

      {editando ? (
        <div>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            {CAMPOS_CADASTRO.map((c) => (
              <CampoView key={c.id} campo={c} respostas={form} set={set} compacto={false} />
            ))}
          </div>

          {erro && <p className="text-sm text-painel-alert-text mb-3">{erro}</p>}
          {!podeSalvar && (
            <p className="text-sm text-painel-alert-text mb-3">Preencha o nome para salvar.</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando || !podeSalvar}
              className="inline-flex items-center gap-2 rounded-full bg-painel-primary text-white px-5 py-2 text-sm font-medium hover:bg-painel-primary/90 transition-colors disabled:opacity-40"
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
              onClick={() => setEditando(false)}
              disabled={salvando}
              className="inline-flex items-center gap-1.5 rounded-full border border-painel-border px-5 py-2 text-sm font-medium text-painel-chip-text hover:border-painel-primary/40 transition-colors disabled:opacity-40"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <dl className="grid md:grid-cols-2 gap-x-8">
          {/* Rua, número, bairro e cidade viram uma única linha "Endereço" —
              os campos separados só aparecem na edição. */}
          {CAMPOS_CADASTRO.filter(
            (c) => !["endereco", "numero", "bairro", "cidade"].includes(c.id),
          ).map((c) => {
            const bruto = clienteParaForm(cliente)[c.id];
            return (
              <Fragment key={c.id}>
                {bruto && (
                  <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-painel-border/50">
                    <dt className="text-painel-muted shrink-0">{c.label}</dt>
                    <dd className="text-right font-medium text-painel-title min-w-0 break-words">
                      {formatarValorCampo(c.id, bruto)}
                    </dd>
                  </div>
                )}
                {/* Endereço combinado logo depois do nome — inverte a dupla
                    Endereço/Nome que ficava na 1ª linha (rua não vem antes
                    do nome da cliente). */}
                {c.id === "nome" && enderecoCompleto(cliente) && (
                  <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-painel-border/50">
                    <dt className="text-painel-muted shrink-0">Endereço</dt>
                    <dd className="text-right font-medium text-painel-title min-w-0 break-words">
                      {enderecoCompleto(cliente)}
                    </dd>
                  </div>
                )}
              </Fragment>
            );
          })}
        </dl>
      )}
    </div>
  );
}

function AbaFichas({
  fichas,
  cliente,
  tipoSugerido,
}: {
  fichas: Ficha[];
  cliente: Cliente;
  tipoSugerido: Tipo;
}) {
  const [enviandoFicha, setEnviandoFicha] = useState(false);

  return (
    <div className="rounded-[14px] border border-painel-border bg-white p-5 sm:p-6">
      <div className="flex flex-wrap gap-2">
        {fichas.length === 0 && <p className="text-sm text-painel-muted">Nenhuma ficha ainda.</p>}
        {fichas.map((f) => (
          <Link
            key={f.id}
            to="/painel/$id"
            params={{ id: f.id }}
            title={`${nomeTipo(f.tipo)} · enviada em ${formatarData(f.created_at)}`}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium bg-painel-badge-bg text-painel-title transition-opacity hover:opacity-90 ${
              f.arquivada ? "opacity-60" : ""
            }`}
          >
            <span>{FICHAS[f.tipo]?.emoji ?? ""}</span>
            <span>{nomeCurto(f.tipo)}</span>
            <span className="opacity-70">{formatarData(f.created_at).slice(0, 5)}</span>
            {f.alertas.length > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-white/90 px-1 text-[10px] font-bold text-painel-alert-text">
                {f.alertas.length}
              </span>
            )}
          </Link>
        ))}
      </div>

      <div className="mt-5 pt-5 border-t border-painel-border">
        {!enviandoFicha && (
          <button
            type="button"
            onClick={() => setEnviandoFicha(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-painel-primary text-white px-[18px] py-2.5 text-sm font-semibold hover:bg-painel-primary/90 transition-colors"
          >
            <Send className="h-4 w-4" />
            Enviar ficha
          </button>
        )}
        {enviandoFicha && (
          <EnviarFicha
            nomeInicial={cliente.nome}
            celularInicial={cliente.telefone}
            tipoInicial={tipoSugerido}
            tipos={TIPOS}
            convitePadrao
            onFechar={() => setEnviandoFicha(false)}
          />
        )}
      </div>
    </div>
  );
}

// Anexa (ou baixa) o PDF do contrato — impresso e salvo pela Marina fora
// do app, depois anexado aqui pra ficar guardado junto do histórico.
function AnexoContratoPdf({
  contrato,
  clienteId,
  onAnexado,
}: {
  contrato: Contrato;
  clienteId: string;
  onAnexado: (c: Contrato) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const anexar = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setEnviando(true);
    setErro(null);
    try {
      const pdf_path = await anexarContratoPdf({ id: contrato.id, clienteId }, arquivo);
      onAnexado({ ...contrato, pdf_path });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao anexar o PDF.");
    } finally {
      setEnviando(false);
    }
  };

  const abrir = async () => {
    if (!contrato.pdf_path) return;
    setAbrindo(true);
    setErro(null);
    try {
      const url = await urlContratoPdf(contrato.pdf_path);
      window.open(url, "_blank", "noreferrer");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao abrir o PDF.");
    } finally {
      setAbrindo(false);
    }
  };

  // Manda o PDF anexado direto pro diálogo de impressão, sem precisar
  // abrir o PDF numa aba primeiro. O link assinado do Supabase é de outro
  // domínio — colocado direto num iframe, o navegador bloqueia o
  // print() por segurança (cross-origin) e falha calado, sem erro
  // nenhum. Por isso baixa o PDF primeiro (fetch + blob) e usa um link
  // local (blob:), que aí sim é do mesmo domínio da página.
  const imprimir = async () => {
    if (!contrato.pdf_path) return;
    setImprimindo(true);
    setErro(null);
    try {
      const url = await urlContratoPdf(contrato.pdf_path);
      const resposta = await fetch(url);
      if (!resposta.ok) throw new Error("Não foi possível baixar o PDF pra imprimir.");
      const blobUrl = URL.createObjectURL(await resposta.blob());
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.onload = () => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          iframe.remove();
          URL.revokeObjectURL(blobUrl);
        }, 60_000);
      };
      iframe.src = blobUrl;
      document.body.appendChild(iframe);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao imprimir o PDF.");
    } finally {
      setImprimindo(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      {contrato.pdf_path ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={abrir}
            disabled={abrindo}
            className="inline-flex items-center gap-1.5 rounded-full border border-painel-border px-3 py-1.5 text-xs font-medium text-painel-title hover:border-painel-primary/40 transition-colors disabled:opacity-40"
          >
            {abrindo ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            Ver PDF
          </button>
          <button
            type="button"
            onClick={imprimir}
            disabled={imprimindo}
            title="Imprimir PDF"
            className="p-1.5 text-painel-muted/60 hover:text-painel-primary disabled:opacity-40 transition-colors"
          >
            {imprimindo ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Printer className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      ) : (
        <label className="inline-flex items-center gap-1.5 rounded-full border border-painel-border px-3 py-1.5 text-xs font-medium text-painel-title hover:border-painel-primary/40 transition-colors cursor-pointer disabled:opacity-40">
          {enviando ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Paperclip className="h-3.5 w-3.5" />
          )}
          Anexar PDF
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={enviando}
            onChange={(e) => anexar(e.target.files?.[0])}
          />
        </label>
      )}
      {erro && <p className="text-[11px] text-painel-alert-text">{erro}</p>}
    </div>
  );
}

// Exclui um contrato da lista — pra desfazer um registro criado sem
// querer (ex.: a Marina cancelou a impressão, mas o contrato já tinha
// sido salvo). Confirmação simples: nada aqui tem "assinatura" da cliente
// como as sessões já confirmadas, não precisa do reforço extra.
function ExcluirContrato({
  contrato,
  onExcluido,
}: {
  contrato: Contrato;
  onExcluido: (id: string) => void;
}) {
  const [excluindo, setExcluindo] = useState(false);

  const excluir = async () => {
    if (!window.confirm("Excluir este contrato? Essa ação não pode ser desfeita.")) return;
    setExcluindo(true);
    try {
      await excluirContrato({ id: contrato.id, pdf_path: contrato.pdf_path });
      onExcluido(contrato.id);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Erro ao excluir o contrato.");
      setExcluindo(false);
    }
  };

  return (
    <button
      type="button"
      onClick={excluir}
      disabled={excluindo}
      title="Excluir contrato"
      className="p-1.5 text-painel-muted/60 hover:text-painel-alert-text disabled:opacity-40 transition-colors"
    >
      {excluindo ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function AbaContratos({
  clienteId,
  nomeCliente,
  contratos,
  onAtualizado,
  onExcluido,
}: {
  clienteId: string;
  nomeCliente: string;
  contratos: Contrato[] | null;
  onAtualizado: (c: Contrato) => void;
  onExcluido: (id: string) => void;
}) {
  return (
    <div className="rounded-[14px] border border-painel-border bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-medium text-painel-title">Contratos gerados</h3>
        <Link
          to="/painel/contrato/$id"
          params={{ id: clienteId }}
          className="inline-flex items-center gap-1.5 rounded-full bg-painel-primary text-white px-[18px] py-2.5 text-sm font-semibold hover:bg-painel-primary/90 transition-colors"
        >
          <FileSignature className="h-4 w-4" />
          Gerar novo contrato
        </Link>
      </div>

      {contratos === null && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-painel-muted" />
        </div>
      )}
      {contratos && contratos.length === 0 && (
        <p className="text-sm text-painel-muted">Nenhum contrato gerado ainda.</p>
      )}
      {contratos && contratos.length > 0 && (
        <ul className="space-y-2">
          {contratos.map((c) => (
            <li
              key={c.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-painel-border px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="text-painel-title">{tituloContrato(c, nomeCliente)}</p>
                {c.forma_pagamento && (
                  <p className="text-painel-muted-2 text-xs">{c.forma_pagamento}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <AnexoContratoPdf contrato={c} clienteId={clienteId} onAnexado={onAtualizado} />
                <ExcluirContrato contrato={c} onExcluido={onExcluido} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PaginaCliente() {
  const { id } = useParams({ from: "/painel/cliente/$id" });
  const { aba: abaInicial } = useSearch({ from: "/painel/cliente/$id" });
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [fichas, setFichas] = useState<Ficha[] | null>(null);
  const [contratos, setContratos] = useState<Contrato[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [naoEncontrada, setNaoEncontrada] = useState(false);
  const [aba, setAba] = useState<AbaId>(abaInicial ?? "cadastro");

  useEffect(() => {
    obterCliente(id)
      .then((c) => {
        if (!c) {
          setNaoEncontrada(true);
          return;
        }
        setCliente(c);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."));
    listarFichasDoCliente(id)
      .then(setFichas)
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."));
    listarContratos(id)
      .then(setContratos)
      .catch(() => setContratos([]));
  }, [id]);

  const agregado = useMemo(() => agregarFichas(fichas ?? []), [fichas]);

  // Alertas de todas as fichas do cliente, com a ficha e o campo de origem
  // de cada um — pra dar pra registrar a liberação médica direto daqui, sem
  // precisar entrar em cada ficha. Mesma lógica de painel.$id.tsx, só que
  // somando as fichas do cliente inteiro. Continua incluindo os já
  // respondidos (não só os em aberto) pra manter o card visível como
  // registro, só mudando de cor/mensagem.
  const alertasCliente = useMemo(
    () =>
      (fichas ?? []).flatMap((f) =>
        alertasComCampo(f.tipo, f.respostas).map(({ campo, mensagem }) => ({
          ficha: f,
          campo,
          mensagem,
        })),
      ),
    [fichas],
  );

  // Registra se a cliente já apresentou liberação médica para um alerta
  // específico, na ficha de onde ele veio, com a data. O card continua
  // visível depois de respondido — só muda de cor e de mensagem — em vez de
  // sumir sem deixar rastro. "Sim" também tira a mensagem original do array
  // `alertas` gravado no banco (usado pelos contadores/badges do painel);
  // "Não" mantém a mensagem original lá.
  // Se já havia uma resposta registrada e a Marina clica na opção oposta,
  // pede confirmação — é fácil clicar sem querer e trocar um "sim" por um
  // "não" (ou vice-versa) num dado sensível como esse.
  const definirLiberacaoMedica = async (
    ficha: Ficha,
    campo: Campo,
    mensagem: string,
    valor: boolean,
  ) => {
    const atual = ficha.respostas[`${campo.id}__liberacaoMedica`];
    if ((atual === true || atual === false) && atual !== valor) {
      const pergunta = valor
        ? "A cliente já tinha sido marcada como NÃO liberada. Mudar para liberada?"
        : "A cliente já tinha sido marcada como liberada. Mudar para NÃO liberada?";
      if (!window.confirm(pergunta)) return;
    }
    const novasRespostas = {
      ...ficha.respostas,
      [`${campo.id}__liberacaoMedica`]: valor,
      [`${campo.id}__liberacaoMedicaData`]: hojeISO(),
    };
    const novosAlertas = valor
      ? ficha.alertas.filter((a) => a !== mensagem)
      : ficha.alertas.includes(mensagem)
        ? ficha.alertas
        : [...ficha.alertas, mensagem];
    try {
      await atualizarFicha(ficha.id, { respostas: novasRespostas, alertas: novosAlertas });
      setFichas(
        (atual) =>
          atual?.map((f) =>
            f.id === ficha.id ? { ...f, respostas: novasRespostas, alertas: novosAlertas } : f,
          ) ?? atual,
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao registrar a liberação médica.");
    }
  };

  // Cadastro não é tratamento — não entra na lista de procedimentos do
  // histórico de sessões.
  const procedimentos: Procedimento[] = useMemo(
    () =>
      (fichas ?? [])
        .filter((f) => f.tipo !== "cadastro")
        .map((f) => ({
          id: f.id,
          tipo: f.tipo,
          nome: f.nome,
          pacotes: f.pacotes ?? {},
        })),
    [fichas],
  );

  // Sugere de cara um procedimento que a cliente ainda não tem ficha.
  const tipoSugerido = TIPOS.find((t) => !agregado.tipos.includes(t)) ?? TIPOS[0];

  if (naoEncontrada) {
    return (
      <div className="text-center py-16">
        <p className="text-painel-muted mb-4">Cliente não encontrada.</p>
        <Link to="/painel" className="text-painel-primary underline">
          Voltar à lista
        </Link>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="text-center py-16">
        <p className="text-painel-alert-text text-sm mb-4">{erro}</p>
        <Link to="/painel" className="text-painel-primary underline">
          Voltar à lista
        </Link>
      </div>
    );
  }

  if (!cliente || !fichas) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-painel-muted" />
      </div>
    );
  }

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

        {/* Cabeçalho da cliente */}
        <div className="relative -mx-4 sm:-mx-6 mb-6 overflow-hidden rounded-b-2xl bg-painel-hero-bg px-4 py-7 sm:px-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 92% 0%, rgba(179,146,76,.4), transparent 50%), radial-gradient(circle at 4% 100%, rgba(154,111,176,.5), transparent 55%)",
            }}
          />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-4xl text-white">{cliente.nome}</h2>
              <p className="text-[13px] text-white/60 mt-2">
                {cliente.telefone ? mascaraTelefone(cliente.telefone) : "sem telefone"}
                {" · "}
                {fichas.length} ficha(s)
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {cliente.autoriza_foto ? (
                <span title="Autorizou uso de imagem">
                  <Camera className="h-4 w-4 text-painel-green" />
                </span>
              ) : (
                <span title="Não autorizou uso de imagem">
                  <CameraOff className="h-4 w-4 text-white/60" />
                </span>
              )}
            </div>
          </div>
        </div>

        {alertasCliente.length > 0 && (
          <div className="flex flex-col gap-3 mb-8">
            {alertasCliente.map(({ ficha: f, campo, mensagem }) => {
              const liberacao = f.respostas[`${campo.id}__liberacaoMedica`];
              const data = f.respostas[`${campo.id}__liberacaoMedicaData`];
              const dataFmt = typeof data === "string" ? formatarDataBRBarra(data) : null;
              const liberada = liberacao === true;
              const negada = liberacao === false;
              return (
                <div
                  key={`${f.id}-${campo.id}`}
                  className={`flex gap-3 rounded-[14px] border px-[22px] py-[18px] text-sm ${
                    liberada
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-painel-alert-border bg-painel-alert-bg text-painel-alert-text"
                  }`}
                >
                  {liberada ? (
                    <Check className="h-4 w-4 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                    <div>
                      <p className="font-medium">
                        {campo.label}
                        <span
                          className={liberada ? "text-success/70" : "text-painel-alert-text/70"}
                        >
                          {" "}
                          ({nomeCurto(f.tipo)})
                        </span>
                      </p>
                      <p className={liberada ? "text-success/80" : "text-painel-alert-text/80"}>
                        {liberada
                          ? `Liberação médica${dataFmt ? ` em ${dataFmt}` : ""}`
                          : negada
                            ? `Liberação médica negada${dataFmt ? ` em ${dataFmt}` : ""}`
                            : mensagem}
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => definirLiberacaoMedica(f, campo, mensagem, true)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          liberada
                            ? "border-success bg-success text-success-foreground"
                            : "border-success/40 bg-success/10 text-success hover:bg-success/25"
                        }`}
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => definirLiberacaoMedica(f, campo, mensagem, false)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          negada
                            ? "border-destructive bg-destructive text-destructive-foreground"
                            : "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/25"
                        }`}
                      >
                        Não
                      </button>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Abas */}
        <div className="flex flex-wrap gap-2 mb-6">
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              className={[
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                aba === a.id
                  ? "bg-painel-primary text-white"
                  : "border border-painel-border bg-white text-painel-chip-text hover:border-painel-primary/40",
              ].join(" ")}
            >
              {a.label}
              {a.id === "fichas" && ` (${fichas.length})`}
              {a.id === "contratos" && contratos ? ` (${contratos.length})` : ""}
            </button>
          ))}
        </div>

        {aba === "cadastro" && (
          <AbaCadastro
            cliente={cliente}
            onAtualizado={setCliente}
            onExcluido={() => navigate({ to: "/painel" })}
          />
        )}
        {aba === "fichas" && (
          <AbaFichas fichas={fichas} cliente={cliente} tipoSugerido={tipoSugerido} />
        )}
        {aba === "historico" && (
          <HistoricoSessoes
            fichas={procedimentos}
            nomeCliente={cliente.nome}
            telefoneCliente={cliente.telefone}
          />
        )}
        {aba === "contratos" && (
          <AbaContratos
            clienteId={cliente.id}
            nomeCliente={cliente.nome}
            contratos={contratos}
            onAtualizado={(atualizado) =>
              setContratos((prev) =>
                (prev ?? []).map((c) => (c.id === atualizado.id ? atualizado : c)),
              )
            }
            onExcluido={(id) => setContratos((prev) => (prev ?? []).filter((c) => c.id !== id))}
          />
        )}
      </div>
    </div>
  );
}

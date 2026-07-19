import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Camera, CameraOff, Loader2, Plus, Printer, Trash2 } from "lucide-react";
import { obterCliente, criarContrato, type Cliente } from "@/lib/painel";
import { OPCOES_SESSAO, TIPOS, nomeCurto, type Tipo } from "@/data/anamnese";
import { aplicarMascara, formatarDataBRBarra } from "@/lib/mascaras";
import { ESTADOS_CIVIS, MESES_PT, type ItemContratado } from "@/data/contrato";
import { ContratoImpresso } from "@/components/contrato/ContratoImpresso";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Gera o contrato de prestação de serviços pronto pra imprimir: pré-preenche
// os dados da cliente a partir da(s) ficha(s) dela, a Marina completa o que
// falta (profissão, estado civil, itens do pacote, forma de pagamento) e
// manda imprimir — o texto das cláusulas é sempre o mesmo (ver
// src/data/contrato.ts), só os dados variáveis mudam a cada contrato.
export const Route = createFileRoute("/painel/contrato/$id")({
  component: GerarContrato,
});

function hojeDMY(): { dia: string; mes: string; ano: string } {
  const d = new Date();
  return { dia: String(d.getDate()), mes: String(d.getMonth() + 1), ano: String(d.getFullYear()) };
}

let proximoIdItem = 0;
function novoItem(): ItemContratado {
  proximoIdItem += 1;
  return { chave: `item-${proximoIdItem}`, tipo: "", descricao: "", quantidade: "" };
}

// Encolhe a pré-visualização (tamanho real de impressão, A4) pra caber na
// largura da coluna, sem cortar nem precisar rolar de lado. Não afeta a
// impressão de verdade — o @media print em styles.css (.contrato-preview-
// escala) desfaz a escala nesse momento.
function ContratoPreviewEscalado({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const conteudoRef = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  const [alturaEscalada, setAlturaEscalada] = useState<number | undefined>(undefined);

  useEffect(() => {
    const atualizar = () => {
      const container = containerRef.current;
      const conteudo = conteudoRef.current;
      if (!container || !conteudo) return;
      const largura = conteudo.scrollWidth;
      if (largura === 0) return;
      const novaEscala = Math.min(1, container.clientWidth / largura);
      setEscala(novaEscala);
      setAlturaEscalada(conteudo.scrollHeight * novaEscala);
    };
    atualizar();
    const ro = new ResizeObserver(atualizar);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  });

  return (
    <div ref={containerRef} className="w-full">
      <div style={{ height: alturaEscalada }}>
        <div
          ref={conteudoRef}
          className="contrato-preview-escala mx-auto w-fit"
          style={{ transform: `scale(${escala})`, transformOrigin: "top center" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function GerarContrato() {
  const { id } = useParams({ from: "/painel/contrato/$id" });
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [naoEncontrada, setNaoEncontrada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [hidratado, setHidratado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const [profissao, setProfissao] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [itens, setItens] = useState<ItemContratado[]>([novoItem()]);
  const [formaPagamento, setFormaPagamento] = useState("");
  const [autorizaFoto, setAutorizaFoto] = useState(false);
  const [dataDia, setDataDia] = useState("");
  const [dataMes, setDataMes] = useState("");
  const [dataAno, setDataAno] = useState("");

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
    const hoje = hojeDMY();
    setDataDia(hoje.dia);
    setDataMes(hoje.mes);
    setDataAno(hoje.ano);
  }, [id]);

  // Pré-preenche a partir do cadastro da cliente, uma única vez — depois
  // disso a Marina pode editar livremente sem o formulário sobrescrever por
  // cima. Vem de uma linha só (tabela `clientes`), então não tem mais o
  // risco de misturar endereço de fichas diferentes da mesma pessoa.
  useEffect(() => {
    if (!cliente || hidratado) return;
    setNascimento(cliente.nascimento ? formatarDataBRBarra(cliente.nascimento) : "");
    setCpf(cliente.cpf ? aplicarMascara("cpf", cliente.cpf) : "");
    setTelefone(cliente.telefone ? aplicarMascara("telefone", cliente.telefone) : "");
    setEndereco(
      [
        [cliente.endereco, cliente.numero].filter(Boolean).join(", "),
        cliente.bairro,
        cliente.complemento,
        cliente.cidade,
      ]
        .filter(Boolean)
        .join(", "),
    );
    setProfissao(cliente.profissao ?? "");
    setEstadoCivil(cliente.estado_civil ?? "");
    setAutorizaFoto(cliente.autoriza_foto);
    setHidratado(true);
  }, [cliente, hidratado]);

  const atualizarItem = (chave: string, patch: Partial<ItemContratado>) =>
    setItens((prev) => prev.map((i) => (i.chave === chave ? { ...i, ...patch } : i)));

  const removerItem = (chave: string) =>
    setItens((prev) => (prev.length > 1 ? prev.filter((i) => i.chave !== chave) : prev));

  // Salva o contrato (aba "Contratos" da cliente) e só então abre a
  // impressão — se o salvamento falhar, avisa mas não trava a impressão,
  // já que ela pode precisar do papel na hora mesmo assim.
  const imprimir = async () => {
    if (!cliente) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      const ano = Number(dataAno) || new Date().getFullYear();
      const mes = String(Number(dataMes) || new Date().getMonth() + 1).padStart(2, "0");
      const dia = String(Number(dataDia) || new Date().getDate()).padStart(2, "0");
      await criarContrato({
        clienteId: cliente.id,
        profissao: profissao.trim() || null,
        estadoCivil: estadoCivil.trim() || null,
        itens,
        formaPagamento: formaPagamento.trim() || null,
        autorizaFoto,
        dataContrato: `${ano}-${mes}-${dia}`,
      });
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : "Erro ao salvar o contrato.");
    } finally {
      setSalvando(false);
    }
    // O navegador sugere o <title> da página como nome do arquivo ao
    // "Salvar como PDF" na impressão — troca pelo nome da cliente nessa
    // hora, sem mudar o título da aba fora disso.
    const tituloOriginal = document.title;
    document.title = `Contrato - ${cliente.nome}`;
    window.print();
    document.title = tituloOriginal;
  };

  const dados = {
    nome: cliente?.nome ?? "",
    profissao,
    estadoCivil,
    nascimento,
    cpf,
    telefone,
    endereco,
    itens,
    formaPagamento,
    autorizaFoto,
    dataDia,
    dataMes,
    dataAno,
  };

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

  if (!cliente) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-painel-muted" />
      </div>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-painel-border bg-white px-3 py-2 text-sm text-painel-title focus:outline-none focus:ring-2 focus:ring-painel-primary/40";
  const selectTriggerCls = "rounded-lg border-painel-border bg-white text-sm";
  const labelCls = "block text-xs font-medium text-painel-muted mb-1.5";

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/painel/cliente/$id"
          params={{ id }}
          className="inline-flex items-center gap-2 text-[13px] text-painel-muted hover:text-painel-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para {cliente.nome}
        </Link>
      </div>

      <h2 className="font-display text-[32px] text-painel-title mb-6">Gerar contrato</h2>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Formulário */}
        <div className="rounded-[14px] border border-painel-border bg-white p-6 space-y-6 self-start">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Profissão</label>
              <input
                value={profissao}
                onChange={(e) => setProfissao(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Estado civil</label>
              <Select value={estadoCivil} onValueChange={setEstadoCivil}>
                <SelectTrigger className={selectTriggerCls}>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_CIVIS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={labelCls}>Data de nascimento</label>
              <input
                value={nascimento}
                onChange={(e) => setNascimento(e.target.value)}
                placeholder="dd/mm/aaaa"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>CPF</label>
              <input
                value={cpf}
                onChange={(e) => setCpf(aplicarMascara("cpf", e.target.value))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Telefone</label>
              <input
                value={telefone}
                onChange={(e) => setTelefone(aplicarMascara("telefone", e.target.value))}
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Endereço</label>
              <input
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-painel-muted">
                Sessões e tratamentos contratados
              </span>
              <button
                type="button"
                onClick={() => setItens((prev) => [...prev, novoItem()])}
                className="inline-flex items-center gap-1 text-xs font-medium text-painel-primary hover:opacity-80 transition-opacity"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar item
              </button>
            </div>
            <div className="space-y-3">
              {itens.map((item) => {
                const opcoes = item.tipo ? (OPCOES_SESSAO[item.tipo as Tipo] ?? []) : [];
                return (
                  <div
                    key={item.chave}
                    className="flex flex-wrap items-end gap-2 rounded-lg border border-painel-border/70 p-3"
                  >
                    <div className="w-24">
                      <label className={labelCls}>Sessões</label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantidade}
                        onChange={(e) => atualizarItem(item.chave, { quantidade: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div className="w-36">
                      <label className={labelCls}>Categoria</label>
                      <Select
                        value={item.tipo}
                        onValueChange={(v) => atualizarItem(item.chave, { tipo: v, descricao: "" })}
                      >
                        <SelectTrigger className={selectTriggerCls}>
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS.map((t) => (
                            <SelectItem key={t} value={t}>
                              {nomeCurto(t)}
                            </SelectItem>
                          ))}
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <label className={labelCls}>Procedimento</label>
                      {opcoes.length > 0 ? (
                        <Select
                          value={item.descricao}
                          onValueChange={(v) => atualizarItem(item.chave, { descricao: v })}
                        >
                          <SelectTrigger className={selectTriggerCls}>
                            <SelectValue placeholder="Selecione…" />
                          </SelectTrigger>
                          <SelectContent>
                            {opcoes.map((op) => (
                              <SelectItem key={op} value={op}>
                                {op}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <input
                          value={item.descricao}
                          onChange={(e) => atualizarItem(item.chave, { descricao: e.target.value })}
                          placeholder="Descreva o procedimento"
                          className={inputCls}
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removerItem(item.chave)}
                      disabled={itens.length === 1}
                      title="Remover item"
                      className="mb-0.5 p-1 text-painel-muted/60 hover:text-painel-alert-text disabled:opacity-30 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-painel-muted mb-1.5 block">
              Autoriza uso de imagem (fotos/vídeos)?
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAutorizaFoto(true)}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors",
                  autorizaFoto
                    ? "bg-painel-primary border-painel-primary text-white font-medium"
                    : "bg-white border-painel-border text-painel-title hover:border-painel-primary/40",
                ].join(" ")}
              >
                <Camera className="h-3.5 w-3.5" />
                Sim
              </button>
              <button
                type="button"
                onClick={() => setAutorizaFoto(false)}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors",
                  !autorizaFoto
                    ? "bg-painel-primary border-painel-primary text-white font-medium"
                    : "bg-white border-painel-border text-painel-title hover:border-painel-primary/40",
                ].join(" ")}
              >
                <CameraOff className="h-3.5 w-3.5" />
                Não
              </button>
            </div>
            <p className="text-[11px] text-painel-muted mt-1.5">
              Vem preenchido conforme a ficha da cliente — ajuste aqui se ela mudou de ideia.
            </p>
          </div>

          <div>
            <label className={labelCls}>Forma de pagamento</label>
            <textarea
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              rows={3}
              placeholder="Ex.: R$ 1.200,00 em 3x de R$ 400,00 no cartão de crédito"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Dia</label>
              <input
                type="number"
                min={1}
                max={31}
                value={dataDia}
                onChange={(e) => setDataDia(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Mês</label>
              <Select value={dataMes} onValueChange={setDataMes}>
                <SelectTrigger className={selectTriggerCls}>
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {MESES_PT.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={labelCls}>Ano</label>
              <input
                type="number"
                value={dataAno}
                onChange={(e) => setDataAno(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {erroSalvar && <p className="text-sm text-painel-alert-text">{erroSalvar}</p>}

          <button
            type="button"
            onClick={imprimir}
            disabled={salvando}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-painel-primary text-white px-6 py-3 text-sm font-semibold hover:bg-painel-primary/90 transition-colors disabled:opacity-60"
          >
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            Imprimir contrato
          </button>
        </div>

        {/* Pré-visualização — o que sai na impressão (3 folhas) */}
        <div className="rounded-[14px] border border-painel-border bg-painel-bg p-4 overflow-auto max-h-[85vh]">
          <ContratoPreviewEscalado>
            <ContratoImpresso dados={dados} />
          </ContratoPreviewEscalado>
        </div>
      </div>
    </div>
  );
}

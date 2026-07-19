// Versão impressa do contrato — só o que vai para o papel. Renderizado tanto
// na pré-visualização (dentro da "folha" no painel) quanto na impressão de
// verdade (ver #contrato-imprimir no styles.css, que esconde todo o resto da
// página quando a Marina manda imprimir). Cabe em 2 folhas A4 — página 1 tem
// os dados da contratante e as Cláusulas 1 e 2 (objeto e pagamento); página 2
// tem condições gerais, rescisão e as assinaturas. As linhas de assinatura
// ficam em branco de propósito — a cliente assina a caneta, no papel.

import {
  CONTRATADA_TEXTO,
  CONTRATADA_NOME,
  CONTRATADA_CNPJ,
  CLAUSULA_1_INTRO,
  CLAUSULA_1_OBJETO_INTRO,
  CLAUSULA_1_ITENS,
  CLAUSULA_2_INTRO,
  CLAUSULA_2_ITENS,
  CLAUSULA_3_ITENS,
  CLAUSULA_4_ITENS,
  FORO_TEXTO,
  MESES_PT,
  type DadosContrato,
} from "@/data/contrato";

function CampoPreenchido({ label, valor }: { label: string; valor: string }) {
  return (
    <p className="text-[9.5pt] leading-relaxed mb-1.5">
      <span className="font-semibold">{label}: </span>
      <span className="border-b border-black/70">{valor || " ".repeat(32)}</span>
    </p>
  );
}

function ItemClausula({
  letra,
  texto,
  extra,
}: {
  letra: string;
  texto: string;
  extra?: React.ReactNode;
}) {
  return (
    <p className="text-[8.7pt] leading-snug text-justify mb-1.5">
      {letra}) {texto}
      {extra}
    </p>
  );
}

function Pagina({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="contrato-pagina bg-white text-black mb-6 shadow-md print:shadow-none print:mb-0"
      style={{
        fontFamily: "Arial, sans-serif",
        width: "210mm",
        minHeight: "297mm",
        padding: "14mm 16mm",
      }}
    >
      {children}
    </div>
  );
}

export function ContratoImpresso({ dados }: { dados: DadosContrato }) {
  const itensValidos = dados.itens.filter((i) => i.descricao.trim() && i.quantidade.trim());
  const mesPorExtenso = MESES_PT[Number(dados.dataMes) - 1] ?? dados.dataMes;
  let contador = 0; // letra sequencial (a, b, c...) através das 4 cláusulas

  return (
    <div id="contrato-imprimir">
      <Pagina>
        <h1 className="text-center font-bold text-[13.5pt] mb-3">
          CONTRATO DE PRESTAÇÃO DE SERVIÇOS ESTÉTICOS
        </h1>

        <p className="text-[9.5pt] leading-relaxed mb-4">{CONTRATADA_TEXTO}</p>

        <div className="grid grid-cols-2 gap-x-6 mb-5">
          <div className="col-span-2">
            <CampoPreenchido label="CONTRATANTE" valor={dados.nome} />
          </div>
          <CampoPreenchido label="Profissão" valor={dados.profissao} />
          <CampoPreenchido label="Estado civil" valor={dados.estadoCivil} />
          <CampoPreenchido label="Data de nascimento" valor={dados.nascimento} />
          <CampoPreenchido label="CPF" valor={dados.cpf} />
          <CampoPreenchido label="Telefone" valor={dados.telefone} />
          <div className="col-span-2">
            <CampoPreenchido label="Endereço" valor={dados.endereco} />
          </div>
        </div>

        <p className="text-[9pt] leading-relaxed mb-4">{CLAUSULA_1_INTRO}</p>

        <h2 className="font-bold text-[10.5pt] mb-2">CLÁUSULA 1 - DO OBJETO</h2>
        <p className="text-[9pt] leading-relaxed mb-2">{CLAUSULA_1_OBJETO_INTRO}</p>
        <div className="mb-4 min-h-[60px] border-y border-black/40 py-2">
          {itensValidos.length === 0 ? (
            <p className="text-[9.5pt]">&nbsp;</p>
          ) : (
            <ul className="text-[9.5pt] leading-relaxed list-none font-bold">
              {itensValidos.map((item) => (
                <li key={item.chave}>
                  {item.quantidade} sessão(ões) de {item.descricao}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mb-4">
          {CLAUSULA_1_ITENS.map((texto) => (
            <ItemClausula key={texto} letra={String.fromCharCode(97 + contador++)} texto={texto} />
          ))}
        </div>

        <h2 className="font-bold text-[10.5pt] mb-2">CLÁUSULA 2 - DO PAGAMENTO</h2>
        <p className="text-[9pt] leading-relaxed mb-2">{CLAUSULA_2_INTRO}</p>
        <div className="mb-4 min-h-[35px] border-y border-black/40 py-2">
          <p className="text-[9.5pt] leading-relaxed whitespace-pre-wrap font-bold">
            {dados.formaPagamento || " "}
          </p>
        </div>
        <div>
          {CLAUSULA_2_ITENS.map((texto) => (
            <ItemClausula key={texto} letra={String.fromCharCode(97 + contador++)} texto={texto} />
          ))}
        </div>
      </Pagina>

      <Pagina>
        <h2 className="font-bold text-[10.5pt] mb-1.5">CLÁUSULA 3 - DAS CONDIÇÕES GERAIS</h2>
        <div className="mb-3">
          {CLAUSULA_3_ITENS.map((texto, i) => {
            const ultima = i === CLAUSULA_3_ITENS.length - 1;
            return (
              <ItemClausula
                key={texto}
                letra={String.fromCharCode(97 + contador++)}
                texto={texto}
                extra={
                  ultima ? (
                    <span className="ml-1 whitespace-nowrap font-semibold">
                      {dados.autorizaFoto ? "(X)" : "( )"} SIM {dados.autorizaFoto ? "( )" : "(X)"}{" "}
                      NÃO
                    </span>
                  ) : undefined
                }
              />
            );
          })}
        </div>

        <h2 className="font-bold text-[10.5pt] mb-1.5">CLÁUSULA 4 - DA RESCISÃO</h2>
        <div className="mb-3">
          {CLAUSULA_4_ITENS.map((texto) => (
            <ItemClausula key={texto} letra={String.fromCharCode(97 + contador++)} texto={texto} />
          ))}
        </div>

        <p className="text-[8.7pt] leading-snug text-justify mb-3">{FORO_TEXTO}</p>

        <p className="text-[9.5pt] text-center mb-1">
          Sete Lagoas, {dados.dataDia || "____"} de{" "}
          {dados.dataMes ? mesPorExtenso : "________________"} de {dados.dataAno || "________"}
        </p>

        {/* Espaço em branco de verdade pra assinar a caneta — não só um
            respiro visual, tem que caber uma assinatura de próprio punho. */}
        <div style={{ height: "18mm" }} aria-hidden="true" />

        <div className="grid grid-cols-2 gap-10 text-center text-[9.5pt]">
          <div className="border-t border-black pt-1">
            {dados.nome}
            <br />
            CPF: {dados.cpf}
          </div>
          <div className="border-t border-black pt-1">
            {CONTRATADA_NOME}
            <br />
            CNPJ: {CONTRATADA_CNPJ}
          </div>
        </div>
      </Pagina>
    </div>
  );
}

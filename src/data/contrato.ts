// Texto do "Contrato de Prestação de Serviços Estéticos" (MAVI) — a Marina
// imprime um exemplar a cada pacote vendido e a cliente assina a punho.
// O texto das cláusulas fica FIXO aqui (idêntico ao contrato de papel que já
// está em uso, revisado pela advogada da Marina); só os dados da contratante,
// os itens contratados, a forma de pagamento e a data mudam a cada impressão.
//
// IMPORTANTE: não reescreva o texto das cláusulas sem confirmar com a Marina
// — é conteúdo jurídico, em revisão com a advogada dela.

// RG da Marina como consta no contrato original (logo antes do nome dela, no
// cabeçalho) — não é CPF, é o RG.
export const CONTRATADA_NOME = "MARINA OLIVEIRA ARAÚJO";
export const CONTRATADA_RG = "47.189.380";
export const CONTRATADA_CNPJ = "50.531.164/0001-13";

export const CONTRATADA_TEXTO =
  `CONTRATADA: ${CONTRATADA_RG} ${CONTRATADA_NOME}, Nome Fantasia MAVI CENTRO DE ESTÉTICA, CNPJ ` +
  `${CONTRATADA_CNPJ}, sediada à Rua Nestor de Andrade, N° 142, Bairro Chácara do Paiva, Sete Lagoas, MG.`;

export const CLAUSULA_1_INTRO =
  "Por este instrumento, a CONTRATADA, através de profissionais, regularmente habilitados obriga-se a " +
  "prestar serviço(s) de estética(s) à CONTRATANTE, através do(s) tratamento(s) abaixo descriminado(s).";

export const CLAUSULA_1_OBJETO_INTRO =
  "A CONTRATANTE adquire o número de sessões e o(s) tratamento(s) indicado(s) abaixo:";

export const CLAUSULA_1_ITENS: string[] = [
  "A CONTRATADA obriga-se a prestar serviços de estética à CONTRATANTE, com aplicação de métodos e " +
    "equipamentos próprios, objetivando o tratamento corporal/facial da CONTRATANTE, nos termos das " +
    "condições gerais contidas nesse instrumento.",
  "Os serviços estéticos contratados compreendem na realização do número de sessões contratadas nas " +
    "datas e horários de acordo com agendamento prévio.",
  "Caso haja necessidade de alteração nos horários e datas em anexo, decorrentes de algum imprevisto " +
    "que impossibilite a CONTRATANTE de comparecer no horário pré-estabelecido, a mesma deverá avisar a " +
    "CONTRATADA com no mínimo 24 horas de antecedência, para que assim seja reagendada.",
  "Em caso da desmarcação de sessão com menos de 24 horas de antecedência ou não comparecimento, " +
    "acarretará na perda da sessão.",
  'Ocorrendo a hipótese do § 5" acima, o reagendamento dependerá da disponibilidade da CONTRATADA.',
  "Caso a CONTRATANTE não compareça nas datas e horários pré-definidos, a CONTRATADA exime-se de " +
    "qualquer responsabilidade no que diz respeito aos resultados esperados pelos procedimentos, não " +
    "podendo a CONTRATANTE questionar posteriormente.",
];

export const CLAUSULA_2_INTRO =
  "O preço e forma de pagamento livremente ajustado para a realização dos procedimentos descritos na " +
  "cláusula 1ª será pago da seguinte forma:";

export const CLAUSULA_2_ITENS: string[] = [
  "Nos pagamentos realizados mediante crédito recorrente, a data do débito acompanhará o dia do " +
    "primeiro procedimento realizado, em todos os meses subsequentes. Em caso de atraso no pagamento da " +
    "parcela, a CONTRATANTE pagará o equivalente a 3% (três por cento) de juros ao dia referente ao valor " +
    "a parcela, a contar do primeiro dia útil após o vencimento.",
  "O pagamento recorrente não é limitado à realização dos procedimentos. Caso ocorra o reagendamento " +
    "da sessão, a data do vencimento da parcela não será alterada.",
];

export const CLAUSULA_3_ITENS: string[] = [
  "A CONTRATANTE declara ter sido previamente informada sobre todos os benefícios, riscos, indicações, " +
    "contraindicações, principais efeitos colaterais, princípios ativos dos produtos usados, passo a " +
    "passo e advertências gerais relacionadas aos procedimentos contratados, sendo que referidas " +
    "informações foram suficientes esclarecidas, claras e elucidativas.",
  "A CONTRATANTE declara que todos os termos técnicos foram explicados, bem como todas as dúvidas " +
    "foram-lhe sanadas.",
  "A CONTRATANTE compromete-se a seguir todas as orientações e, havendo necessidade, fazer uso de " +
    "produtos contidos em sua prescrição domiciliar, respeitando os horários indicados de utilização. Se " +
    "encontra ciente que o não uso do home care adequado, pode afetar nos resultados almejados.",
  "A CONTRATANTE declara ter plena ciência de que os resultados dos procedimentos estão condicionados " +
    "à rigorosa frequência às sessões subscrita, devendo considerar-se ainda a reação de cada organismo e " +
    "as necessidades de cada indivíduo, do comportamento apresentado durante e após o tratamento " +
    "estético, sendo todos estes fatos externos e independente do controle da CONTRATADA.",
  "O prazo deste instrumento inicia-se na data da primeira sessão agendada, e seu término dar-se-á " +
    "após 12 (doze) meses. Caso ocorra alguma situação de caso fortuito ou força maior que impeça a " +
    "CONTRATANTE de comparecer às sessões dentro do prazo de 12 meses, a CONTRATADA irá cobrar a parte o " +
    "valor da diferença dos procedimentos, uma vez que o reajuste é feito anualmente.",
  "A CONTRATANTE não poderá rescindir o presente contrato alegando insatisfação com o resultado.",
  "Ocorrendo atraso acima de 15 (quinze) minutos por parte da CONTRATANTE para a realização da sessão " +
    "agendada, esta deverá esperar a CONTRATADA atender todas as próximas pacientes, uma vez que as " +
    "demais não serão prejudicadas pelo atraso da CONTRATANTE.",
  "A CONTRATANTE declara ter plena ciência de que o serviço contratado neste instrumento não poderá " +
    "ser trocado por outros serviços oferecidos pela empresa depois de ter iniciado este contrato.",
  "A CONTRATANTE autoriza tirar foto(s) e fazer vídeo(s) da(s) área(s) tratada(s) para o acompanhamento " +
    "de todo o processo do(s) tratamento(s), ciente que a CONTRATADA poderá postar os resultados nas " +
    "redes sociais da clínica.",
];

export const CLAUSULA_4_ITENS: string[] = [
  "Em caso de rescisão do presente contrato, a CONTRATANTE pagará multa de 10% do valor que faltar " +
    "das sessões e do tratamento. Caso tenha produtos parcelados junto ao pacote, os mesmos serão " +
    "cobrados a parte valor integral, pois já vão ter sido utilizados em home care.",
  "A CONTRATADA terá o prazo de 10 (dez) dias úteis para reembolsar a CONTRATANTE, já descontando a " +
    "multa de 10% referente à rescisão contratual, através de PIX na conta da CONTRATANTE, e em hipótese " +
    "nenhuma na conta de terceiros. Em caso de compras no cartão de crédito, o valor será estornado já " +
    "descontando a multa de 10% e os produtos vendidos para utilização em home care.",
  "A CONTRATANTE está ciente da taxa de cancelamento e não apresenta dúvidas ou objeções.",
];

export const FORO_TEXTO =
  "Para dirimir todas e quaisquer controvérsias as questões oriundas deste contrato, as partes elegem " +
  "o foro da Comarca Sete Lagoas - MG.";

// ESTADOS_CIVIS mora em data/anamnese.ts (a ficha é quem coleta o dado);
// reexportado aqui só pra quem já importa esse módulo não precisar trocar.
export { ESTADOS_CIVIS } from "./anamnese";

export type ItemContratado = {
  chave: string;
  tipo: string; // "corporal" | "facial" | "laser" | "" (outro)
  descricao: string; // nome do item/procedimento (ou texto livre, se "Outro")
  quantidade: string; // número de sessões, como string (input controlado)
};

export type DadosContrato = {
  nome: string;
  profissao: string;
  estadoCivil: string;
  nascimento: string; // já formatado, ex.: "30/12/1977"
  cpf: string;
  telefone: string;
  endereco: string;
  itens: ItemContratado[];
  formaPagamento: string;
  autorizaFoto: boolean;
  dataDia: string;
  dataMes: string;
  dataAno: string;
};

export const MESES_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

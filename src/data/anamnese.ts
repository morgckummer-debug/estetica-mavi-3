// Configuração das fichas da MAVI: 3 anamneses de tratamento (corporal,
// facial, laser) + o cadastro (só dados pessoais, sem anamnese clínica).
// As perguntas ficam aqui — para mudar/criar uma ficha, edite só este arquivo.
// As respostas são salvas no Supabase no campo `respostas` (JSONB), indexadas
// pelo `id` de cada campo, então mudar perguntas não exige alterar o banco.

import { cpfValido } from "@/lib/mascaras";

// Esconde o campo quando outro campo tiver determinado valor.
// Ex.: perguntas de menstruação com { campo: "sexo", valor: "Masculino" }.
export type CondicaoCampo = { campo: string; valor: string };

export type CampoTexto = {
  tipo: "texto";
  id: string;
  label: string;
  placeholder?: string;
  obrigatorio?: boolean;
  multiline?: boolean;
  inputMode?: "text" | "tel" | "email" | "date" | "numeric";
  // Formata o texto enquanto digita (ex.: celular e CPF). "cep" também
  // dispara a busca automática de endereço (ver CampoView).
  mascara?: "telefone" | "cpf" | "cep";
  ocultarSe?: CondicaoCampo;
  ajuda?: string;
};

export type CampoSimNao = {
  tipo: "simnao";
  id: string;
  label: string;
  // Mostra um campo de texto quando responder "Sim"
  especifique?: boolean;
  especifiquePlaceholder?: string;
  // Se marcado "Sim", gera um alerta de segurança para a Marina
  alertaSeSim?: string;
  ocultarSe?: CondicaoCampo;
};

// Escolha única (ex.: Sexo, Tipo de pele). Guarda a opção escolhida como texto.
export type CampoSelecao = {
  tipo: "selecao";
  id: string;
  label: string;
  opcoes: string[];
  obrigatorio?: boolean;
  // Mostra um campo de texto depois de escolher
  especifique?: boolean;
  especifiquePlaceholder?: string;
  ocultarSe?: CondicaoCampo;
};

// Escolha múltipla (ex.: métodos/áreas da depilação). Guarda as opções
// escolhidas juntas num texto separado por ", ".
export type CampoMulti = {
  tipo: "multi";
  id: string;
  label: string;
  opcoes: string[];
  obrigatorio?: boolean;
  ocultarSe?: CondicaoCampo;
};

export type Campo = CampoTexto | CampoSimNao | CampoSelecao | CampoMulti;

export type Etapa = {
  titulo: string;
  descricao?: string;
  // "grid" = layout compacto em duas colunas (para as perguntas curtas)
  layout?: "lista" | "grid";
  campos: Campo[];
};

// "cadastro" é uma ficha só com a etapa de dados pessoais (sem anamnese
// clínica) — usada para mandar um link de cadastro puro, sem vincular a
// cliente a nenhum tratamento ainda.
export type Tipo = "corporal" | "facial" | "laser" | "cadastro";

// Campos da avaliação clínica preenchida pela Marina no painel (não pela
// paciente). Guardados junto das medidas — seleção como texto, múltipla como
// texto separado por ", ".
export type CampoAvaliacao =
  | { tipo: "selecao"; id: string; label: string; opcoes: string[] }
  | { tipo: "multi"; id: string; label: string; opcoes: string[] };

export type GrupoAvaliacao = {
  titulo: string;
  campos: CampoAvaliacao[];
};

export type DefinicaoFicha = {
  tipo: Tipo;
  nome: string; // ex.: "Anamnese Corporal"
  emoji: string;
  etapas: Etapa[];
  // Medidas preenchidas pela Marina no painel (vazio = ficha sem medidas)
  camposMedidas: { id: string; label: string }[];
  // Avaliação clínica preenchida pela Marina no painel (ex.: avaliação da pele)
  avaliacao?: GrupoAvaliacao[];
  // true enquanto as perguntas ainda não foram transcritas do papel
  emConstrucao?: boolean;
};

export const TERMO_TEXTO =
  "Declaro que as informações acima são verdadeiras, não cabendo ao profissional " +
  "qualquer responsabilidade por informações omitidas nesta avaliação. Comprometo-me " +
  "a seguir todos os cuidados necessários após o procedimento.";

export const AUTORIZACAO_FOTO_TEXTO =
  "Autorizo o registro fotográfico do trabalho realizado (antes/depois) para fins de " +
  "documentação e divulgação em redes sociais ou material publicitário. A autorização é " +
  "concedida gratuitamente, sem nada a ser reclamado a título de direitos.";

// Consentimento específico de tratamento de dados (LGPD, Lei 13.709/2018) —
// separado do termo de responsabilidade acima, que é sobre a avaliação
// clínica, não sobre proteção de dados. Fica destacado por ser dado
// sensível (saúde) quando a ficha tem perguntas de anamnese (Art. 11).
export const CONSENTIMENTO_DADOS_TEXTO =
  "Autorizo o tratamento dos meus dados pessoais e de saúde informados nesta ficha " +
  "(nome, contato, endereço e as respostas desta avaliação) pela MAVI Centro de Estética, " +
  "para as finalidades de prestação do serviço, histórico de atendimento e contato sobre " +
  "meus tratamentos, conforme a Lei Geral de Proteção de Dados (LGPD). Posso pedir acesso, " +
  "correção ou exclusão dos meus dados, ou retirar este consentimento, a qualquer momento, " +
  "falando com a Marina.";

// Opções de estado civil — usadas na ficha e reaproveitadas no contrato de
// prestação de serviços (ver src/data/contrato.ts).
export const ESTADOS_CIVIS = [
  "Solteiro(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "União estável",
] as const;

// Etapa de dados pessoais — comum às 3 fichas.
const ETAPA_DADOS: Etapa = {
  titulo: "Seus dados",
  descricao: "Para a Marina te receber com cuidado e segurança.",
  campos: [
    {
      tipo: "texto",
      id: "nome",
      label: "Nome completo",
      placeholder: "Seu nome",
      obrigatorio: true,
    },
    { tipo: "texto", id: "nascimento", label: "Data de nascimento", inputMode: "date" },
    {
      tipo: "texto",
      id: "profissao",
      label: "Profissão (opcional)",
      placeholder: "Sua profissão",
    },
    {
      tipo: "selecao",
      id: "estadoCivil",
      label: "Estado civil (opcional)",
      opcoes: [...ESTADOS_CIVIS],
    },
    {
      tipo: "selecao",
      id: "sexo",
      label: "Gênero",
      opcoes: ["Feminino", "Masculino"],
      obrigatorio: true,
    },
    {
      tipo: "texto",
      id: "whatsapp",
      label: "WhatsApp",
      placeholder: "(31)93998-3485",
      inputMode: "tel",
      mascara: "telefone",
      obrigatorio: true,
    },
    {
      tipo: "texto",
      id: "email",
      label: "E-mail",
      placeholder: "voce@email.com",
      inputMode: "email",
    },
    {
      tipo: "texto",
      id: "cpf",
      label: "CPF",
      placeholder: "254.654.325-86",
      inputMode: "numeric",
      mascara: "cpf",
      obrigatorio: true,
    },
    {
      tipo: "texto",
      id: "cep",
      label: "CEP",
      placeholder: "35700-000",
      inputMode: "numeric",
      mascara: "cep",
      obrigatorio: true,
    },
    {
      tipo: "texto",
      id: "endereco",
      label: "Rua",
      placeholder: "Preenchido automaticamente pelo CEP",
      obrigatorio: true,
    },
    {
      tipo: "texto",
      id: "numero",
      label: "Número",
      placeholder: "123",
      inputMode: "numeric",
      obrigatorio: true,
    },
    {
      tipo: "texto",
      id: "bairro",
      label: "Bairro",
      placeholder: "Preenchido automaticamente pelo CEP",
      obrigatorio: true,
    },
    {
      tipo: "texto",
      id: "complemento",
      label: "Complemento (opcional)",
      placeholder: "Apto, bloco, casa...",
    },
    { tipo: "texto", id: "cidade", label: "Cidade", placeholder: "Sete Lagoas", obrigatorio: true },
    {
      tipo: "texto",
      id: "comoConheceu",
      label: "Como nos conheceu? (opcional)",
      placeholder: "Instagram, indicação...",
    },
  ],
};

// Campos do Cadastro da cliente (aba "Cadastro", tabela `clientes` —
// migração 0012_clientes.sql). Mesmos campos de ETAPA_DADOS: continuam
// sendo perguntados no formulário de ficha (é assim que os dados de uma
// cliente nova entram no sistema), mas a edição depois de enviada a ficha
// passa a acontecer no Cadastro, não mais dentro de cada ficha.
export const CAMPOS_CADASTRO: Campo[] = ETAPA_DADOS.campos;

// ---------- CADASTRO (só dados pessoais, sem anamnese clínica) ----------
// Link que a Marina manda pra uma cliente nova se cadastrar antes de
// escolher/agendar um tratamento — mesma etapa de dados das outras fichas,
// sem perguntas de saúde nem medidas.
const CADASTRO: DefinicaoFicha = {
  tipo: "cadastro",
  nome: "Cadastro",
  emoji: "📋",
  camposMedidas: [],
  etapas: [ETAPA_DADOS],
};

// Perguntas que não se aplicam a pacientes do sexo masculino
// (menstruação, gravidez, menopausa, amamentação).
const OCULTAR_SE_MASCULINO: CondicaoCampo = { campo: "sexo", valor: "Masculino" };

// ---------- CORPORAL (transcrita do papel da Mavi) ----------
const CORPORAL: DefinicaoFicha = {
  tipo: "corporal",
  nome: "Anamnese Corporal",
  emoji: "🌿",
  camposMedidas: [
    { id: "altura", label: "Altura (m)" },
    { id: "peso", label: "Peso (kg)" },
    { id: "busto", label: "Busto" },
    { id: "bracoDir", label: "Braço Dir." },
    { id: "bracoEsq", label: "Braço Esq." },
    { id: "abdomen", label: "Abdômen" },
    { id: "cintura", label: "Cintura" },
    { id: "quadril", label: "Quadril" },
    { id: "culote", label: "Culote" },
    { id: "coxaDir", label: "Coxa Dir." },
    { id: "coxaEsq", label: "Coxa Esq." },
    { id: "panturrilhaDir", label: "Panturrilha Dir." },
    { id: "panturrilhaEsq", label: "Panturrilha Esq." },
  ],
  etapas: [
    ETAPA_DADOS,
    {
      titulo: "Rotina e hábitos",
      campos: [
        {
          tipo: "simnao",
          id: "cuidadosPele",
          label: "Faz cuidados diários com a pele?",
          especifique: true,
          especifiquePlaceholder: "Quais produtos/rotina?",
        },
        {
          tipo: "texto",
          id: "aguaFrequencia",
          label: "Com que frequência bebe água?",
          placeholder: "Pouco, médio, bastante...",
        },
        { tipo: "simnao", id: "alimentacaoBalanceada", label: "Tem alimentação balanceada?" },
        {
          tipo: "simnao",
          id: "bebidaAlcoolica",
          label: "Ingere bebida alcoólica?",
          especifique: true,
          especifiquePlaceholder: "Com que frequência?",
        },
        {
          tipo: "simnao",
          id: "atividadeFisica",
          label: "Pratica atividade física?",
          especifique: true,
          especifiquePlaceholder: "Qual e com que frequência?",
        },
        { tipo: "simnao", id: "muitoTempoSentado", label: "Fica muito tempo sentado(a)?" },
        { tipo: "simnao", id: "intestinoRegular", label: "Funcionamento intestinal é regular?" },
      ],
    },
    {
      titulo: "Sua saúde",
      campos: [
        {
          tipo: "simnao",
          id: "problemasPele",
          label: "Tem problemas de pele?",
          especifique: true,
          especifiquePlaceholder: "Acne, melasma, dermatite...",
        },
        {
          tipo: "simnao",
          id: "medicamentoDiario",
          label: "Usa medicamento de uso diário?",
          especifique: true,
          especifiquePlaceholder: "Quais?",
        },
        {
          tipo: "simnao",
          id: "emTratamentoMedico",
          label: "Está em tratamento médico?",
          especifique: true,
          especifiquePlaceholder: "Qual?",
        },
        {
          tipo: "simnao",
          id: "possuiAlergia",
          label: "Possui alguma alergia?",
          especifique: true,
          especifiquePlaceholder: "A quê? (produtos, látex, medicamentos...)",
        },
        {
          tipo: "simnao",
          id: "antecedentesOncologicos",
          label: "Tem antecedentes oncológicos?",
          especifique: true,
          especifiquePlaceholder: "Qual e quando?",
          alertaSeSim: "Antecedentes oncológicos — avaliar contraindicações antes do procedimento.",
        },
        {
          tipo: "simnao",
          id: "antecedentesCirurgicos",
          label: "Tem antecedentes cirúrgicos?",
          especifique: true,
          especifiquePlaceholder: "Qual(is) cirurgia(s)?",
        },
        {
          tipo: "simnao",
          id: "cirurgiaRecente",
          label: "Fez cirurgia recente?",
          especifique: true,
          especifiquePlaceholder: "Qual e quando?",
          alertaSeSim: "Cirurgia recente — confirmar liberação médica e tempo de recuperação.",
        },
        {
          tipo: "simnao",
          id: "problemasOrtopedicos",
          label: "Tem problemas ortopédicos?",
          especifique: true,
          especifiquePlaceholder: "Quais? (hérnia, lordose, escoliose...)",
        },
        {
          tipo: "simnao",
          id: "protesesMetalicas",
          label: "Possui próteses metálicas ou metal implantado?",
          alertaSeSim: "Prótese/metal implantado — contraindicação possível para radiofrequência.",
        },
      ],
    },
    {
      titulo: "Condições de saúde",
      descricao: "Só marcar Sim ou Não.",
      layout: "grid",
      campos: [
        {
          tipo: "simnao",
          id: "cicloMenstrualRegular",
          label: "Ciclo menstrual regular?",
          ocultarSe: OCULTAR_SE_MASCULINO,
        },
        {
          tipo: "simnao",
          id: "estaMenstruada",
          label: "Está menstruada?",
          ocultarSe: OCULTAR_SE_MASCULINO,
        },
        {
          tipo: "simnao",
          id: "menopausa",
          label: "Já está na menopausa?",
          ocultarSe: OCULTAR_SE_MASCULINO,
        },
        {
          tipo: "simnao",
          id: "estaGravida",
          label: "Está grávida?",
          alertaSeSim: "Gestante — confirmar contraindicação do procedimento.",
          ocultarSe: OCULTAR_SE_MASCULINO,
        },
        { tipo: "simnao", id: "disturbioHormonal", label: "Distúrbio hormonal?" },
        { tipo: "simnao", id: "fumante", label: "Fumante?" },
        {
          tipo: "simnao",
          id: "diabetes",
          label: "Diabetes?",
          alertaSeSim: "Diabetes — atenção redobrada em procedimentos com extração/lesão de pele.",
        },
        { tipo: "simnao", id: "disturbioRenal", label: "Distúrbio renal?" },
        {
          tipo: "simnao",
          id: "hiperHipotensao",
          label: "Hiper / hipotensão?",
          alertaSeSim: "Hiper/hipotensão — monitorar durante o atendimento.",
        },
        {
          tipo: "simnao",
          id: "problemasCardiacos",
          label: "Problemas cardíacos?",
          alertaSeSim: "Problemas cardíacos — avaliar segurança antes de procedimentos.",
        },
        {
          tipo: "simnao",
          id: "disturbioCirculatorio",
          label: "Distúrbio circulatório?",
          alertaSeSim: "Distúrbio circulatório — atenção em drenagem e procedimentos corporais.",
        },
        {
          tipo: "simnao",
          id: "varizesLesoes",
          label: "Varizes ou lesões?",
          alertaSeSim: "Varizes/lesões — evitar manipulação direta na área afetada.",
        },
        {
          tipo: "simnao",
          id: "epilepsiaConvulsoes",
          label: "Epilepsia ou convulsões?",
          alertaSeSim: "Epilepsia/convulsões — contraindicação possível para eletroterapia.",
        },
      ],
    },
  ],
};

// ---------- FACIAL (transcrita do papel da Mavi) ----------
const FACIAL: DefinicaoFicha = {
  tipo: "facial",
  nome: "Anamnese Facial",
  emoji: "💧",
  camposMedidas: [],
  avaliacao: [
    {
      titulo: "Avaliação da pele",
      campos: [
        {
          tipo: "selecao",
          id: "fototipo",
          label: "Fototipo",
          opcoes: ["1", "2", "3", "4", "5", "6"],
        },
        {
          tipo: "selecao",
          id: "grauAcne",
          label: "Grau de acne",
          opcoes: ["I", "II", "III", "IV"],
        },
        {
          tipo: "selecao",
          id: "espessura",
          label: "Espessura",
          opcoes: ["Espessa", "Fina", "Muito fina"],
        },
        {
          tipo: "selecao",
          id: "hidratacao",
          label: "Hidratação",
          opcoes: ["Desidratada", "Normal"],
        },
        {
          tipo: "selecao",
          id: "oleosidade",
          label: "Oleosidade",
          opcoes: ["Normal", "Lipídica", "Alípica", "Seborréica"],
        },
        {
          tipo: "multi",
          id: "achados",
          label: "Achados",
          opcoes: [
            "Acromia",
            "Efélides",
            "Cloasma",
            "Hipocromia",
            "Hipercromia",
            "Hematoma",
            "Nódulos",
            "Pápulas",
            "Comedão",
            "Milium",
            "Teleangectasias",
            "Nevo melanocítico",
            "Nevo vascular",
            "Descamação",
            "Escoriação",
            "Bolha",
            "Pústulas",
            "Atrofia",
            "Cicatriz",
            "Quelóide",
            "Hirsutismo",
            "Hiperqueratose",
            "Hipertricose",
            "Papiloma",
            "Xantelasma",
            "Rugas",
            "Eczemas",
            "Psoríase",
            "Ptose",
            "Foliculite",
          ],
        },
      ],
    },
  ],
  etapas: [
    ETAPA_DADOS,
    {
      titulo: "Rotina e hábitos",
      campos: [
        {
          tipo: "simnao",
          id: "cuidadosPele",
          label: "Faz cuidados diários com a pele?",
          especifique: true,
          especifiquePlaceholder: "Quais produtos/rotina?",
        },
        {
          tipo: "simnao",
          id: "ingereAgua",
          label: "Ingere água regularmente?",
          especifique: true,
          especifiquePlaceholder: "Com que frequência?",
        },
        {
          tipo: "simnao",
          id: "alimentacaoBalanceada",
          label: "Tem alimentação balanceada?",
          especifique: true,
          especifiquePlaceholder: "Observações",
        },
        {
          tipo: "simnao",
          id: "bebidaAlcoolica",
          label: "Ingere bebida alcoólica?",
          especifique: true,
          especifiquePlaceholder: "Com que frequência?",
        },
        {
          tipo: "simnao",
          id: "atividadeFisica",
          label: "Pratica atividade física?",
          especifique: true,
          especifiquePlaceholder: "Qual e com que frequência?",
        },
        {
          tipo: "simnao",
          id: "costumaTomarSol",
          label: "Costuma tomar sol?",
          especifique: true,
          especifiquePlaceholder: "Com que frequência? Usa protetor solar?",
        },
      ],
    },
    {
      titulo: "Sua pele e saúde",
      campos: [
        {
          tipo: "selecao",
          id: "tipoPele",
          label: "Tipo de pele",
          opcoes: ["Oleosa", "Normal", "Seca"],
          especifique: true,
          especifiquePlaceholder: "Observações (opcional)",
        },
        {
          tipo: "simnao",
          id: "problemasPele",
          label: "Problemas de pele?",
          especifique: true,
          especifiquePlaceholder: "Acne, melasma, dermatite...",
        },
        {
          tipo: "simnao",
          id: "jaFezTratamentoEstetico",
          label: "Já fez tratamento estético?",
          especifique: true,
          especifiquePlaceholder: "Qual e quando?",
        },
        {
          tipo: "simnao",
          id: "medicamentoDiario",
          label: "Usa medicamento de uso diário?",
          especifique: true,
          especifiquePlaceholder: "Quais?",
        },
        {
          tipo: "simnao",
          id: "possuiAlergia",
          label: "Possui alguma alergia?",
          especifique: true,
          especifiquePlaceholder: "A quê? (produtos, látex, medicamentos...)",
        },
        {
          tipo: "simnao",
          id: "protesesMetalicas",
          label: "Possui próteses metálicas?",
          especifique: true,
          especifiquePlaceholder: "Quais e onde?",
        },
        {
          tipo: "simnao",
          id: "cicloMenstrualRegular",
          label: "Ciclo menstrual regular?",
          especifique: true,
          especifiquePlaceholder: "Observações",
          ocultarSe: OCULTAR_SE_MASCULINO,
        },
        {
          tipo: "simnao",
          id: "antecedentesOncologicos",
          label: "Tem antecedentes oncológicos?",
          especifique: true,
          especifiquePlaceholder: "Qual e quando?",
          alertaSeSim: "Antecedentes oncológicos — avaliar contraindicações antes do procedimento.",
        },
        {
          tipo: "simnao",
          id: "outroProblema",
          label: "Algum outro problema a ser informado?",
          especifique: true,
          especifiquePlaceholder: "Descreva",
        },
      ],
    },
    {
      titulo: "Condições de saúde",
      descricao: "Só marcar Sim ou Não.",
      layout: "grid",
      campos: [
        { tipo: "simnao", id: "fumante", label: "Fumante?" },
        {
          tipo: "simnao",
          id: "estaMenstruada",
          label: "Está menstruada?",
          ocultarSe: OCULTAR_SE_MASCULINO,
        },
        {
          tipo: "simnao",
          id: "menopausa",
          label: "Já está na menopausa?",
          ocultarSe: OCULTAR_SE_MASCULINO,
        },
        {
          tipo: "simnao",
          id: "estaGravida",
          label: "Está grávida?",
          alertaSeSim: "Gestante — confirmar contraindicação do procedimento.",
          ocultarSe: OCULTAR_SE_MASCULINO,
        },
        {
          tipo: "simnao",
          id: "epilepsiaConvulsoes",
          label: "Tem epilepsia ou convulsões?",
          alertaSeSim: "Epilepsia/convulsões — contraindicação possível para eletroterapia.",
        },
        { tipo: "simnao", id: "intestinoRegular", label: "Funcionamento intestinal regular?" },
        {
          tipo: "simnao",
          id: "problemasCardiacos",
          label: "Problemas cardíacos?",
          alertaSeSim: "Problemas cardíacos — avaliar segurança antes de procedimentos.",
        },
        {
          tipo: "simnao",
          id: "diabetes",
          label: "Diabetes?",
          alertaSeSim: "Diabetes — atenção redobrada em procedimentos com extração/lesão de pele.",
        },
        { tipo: "simnao", id: "disturbioHormonal", label: "Distúrbio hormonal?" },
      ],
    },
  ],
};

// ---------- DEPILAÇÃO (transcrita do papel da Mavi) ----------
// Dados pessoais próprios da ficha de depilação (inclui Sexo, como no papel).
const ETAPA_DADOS_DEPILACAO: Etapa = {
  titulo: "Seus dados",
  descricao: "Para a Marina te receber com cuidado e segurança.",
  campos: [
    {
      tipo: "texto",
      id: "nome",
      label: "Nome completo",
      placeholder: "Seu nome",
      obrigatorio: true,
    },
    {
      tipo: "texto",
      id: "cpf",
      label: "CPF",
      placeholder: "254.654.325-86",
      inputMode: "numeric",
      mascara: "cpf",
      obrigatorio: true,
    },
    { tipo: "texto", id: "nascimento", label: "Data de nascimento", inputMode: "date" },
    {
      tipo: "texto",
      id: "profissao",
      label: "Profissão (opcional)",
      placeholder: "Sua profissão",
    },
    {
      tipo: "selecao",
      id: "estadoCivil",
      label: "Estado civil (opcional)",
      opcoes: [...ESTADOS_CIVIS],
    },
    {
      tipo: "selecao",
      id: "sexo",
      label: "Gênero",
      opcoes: ["Feminino", "Masculino"],
      obrigatorio: true,
    },
    {
      tipo: "texto",
      id: "cep",
      label: "CEP",
      placeholder: "35700-000",
      inputMode: "numeric",
      mascara: "cep",
      obrigatorio: true,
    },
    {
      tipo: "texto",
      id: "endereco",
      label: "Rua",
      placeholder: "Preenchido automaticamente pelo CEP",
      obrigatorio: true,
    },
    {
      tipo: "texto",
      id: "numero",
      label: "Número",
      placeholder: "123",
      inputMode: "numeric",
      obrigatorio: true,
    },
    {
      tipo: "texto",
      id: "bairro",
      label: "Bairro",
      placeholder: "Preenchido automaticamente pelo CEP",
      obrigatorio: true,
    },
    {
      tipo: "texto",
      id: "complemento",
      label: "Complemento (opcional)",
      placeholder: "Apto, bloco, casa...",
    },
    { tipo: "texto", id: "cidade", label: "Cidade", placeholder: "Sete Lagoas", obrigatorio: true },
    {
      tipo: "texto",
      id: "whatsapp",
      label: "Celular",
      placeholder: "(31)93998-3485",
      inputMode: "tel",
      mascara: "telefone",
      obrigatorio: true,
    },
  ],
};

const LASER: DefinicaoFicha = {
  tipo: "laser",
  nome: "Anamnese Depilação",
  emoji: "🔆",
  camposMedidas: [],
  etapas: [
    ETAPA_DADOS_DEPILACAO,
    {
      titulo: "Sobre sua pele",
      campos: [
        {
          tipo: "simnao",
          id: "jaFezDepilacao",
          label: "Já fez depilação antes?",
          especifique: true,
          especifiquePlaceholder: "Qual método e há quanto tempo?",
        },
        {
          tipo: "simnao",
          id: "problemasPele",
          label: "Problemas de pele?",
          especifique: true,
          especifiquePlaceholder: "Quais?",
        },
        {
          tipo: "selecao",
          id: "tipoPele",
          label: "Tipo de pele",
          opcoes: ["Oleosa", "Normal", "Seca"],
          especifique: true,
          especifiquePlaceholder: "Observações (opcional)",
        },
        {
          tipo: "simnao",
          id: "foliculite",
          label: "Foliculite?",
          especifique: true,
          especifiquePlaceholder: "Em qual região?",
        },
        {
          tipo: "simnao",
          id: "temNodulos",
          label: "Tem nódulos?",
          especifique: true,
          especifiquePlaceholder: "Onde?",
        },
        {
          tipo: "simnao",
          id: "tratamentoDermatologico",
          label: "Está em tratamento dermatológico?",
          especifique: true,
          especifiquePlaceholder: "Qual? (ex.: uso de ácidos, isotretinoína/Roacutan...)",
          alertaSeSim:
            "Tratamento dermatológico — confirmar uso de ácidos/isotretinoína antes de laser ou cera.",
        },
      ],
    },
    {
      titulo: "Sua saúde",
      campos: [
        {
          tipo: "simnao",
          id: "diabetes",
          label: "Diabetes?",
          especifique: true,
          especifiquePlaceholder: "Controlada? Desde quando?",
          alertaSeSim: "Diabetes — atenção redobrada com a cicatrização da pele.",
        },
        {
          tipo: "simnao",
          id: "alteracoesCardiacas",
          label: "Alterações cardíacas?",
          alertaSeSim: "Alterações cardíacas — avaliar segurança antes do procedimento.",
        },
        {
          tipo: "simnao",
          id: "marcapasso",
          label: "Portador de marcapasso?",
          alertaSeSim: "Marcapasso — contraindicação para laser/luz pulsada.",
        },
        { tipo: "simnao", id: "fumante", label: "Fumante?" },
        {
          tipo: "simnao",
          id: "gestante",
          label: "Gestante?",
          alertaSeSim: "Gestante — contraindicação para depilação a laser/luz pulsada.",
          ocultarSe: OCULTAR_SE_MASCULINO,
        },
        {
          tipo: "simnao",
          id: "amamentando",
          label: "Está amamentando?",
          especifique: true,
          especifiquePlaceholder: "Há quantas semanas?",
          ocultarSe: OCULTAR_SE_MASCULINO,
        },
        {
          tipo: "simnao",
          id: "estaMenstruada",
          label: "Está no período menstrual?",
          especifique: true,
          especifiquePlaceholder: "Data da menstruação",
          ocultarSe: OCULTAR_SE_MASCULINO,
        },
        {
          tipo: "simnao",
          id: "alergiaTipo",
          label: "Ocorreu alergia de algum tipo?",
          especifique: true,
          especifiquePlaceholder: "A quê?",
        },
        {
          tipo: "simnao",
          id: "cirurgiaRecente",
          label: "Realizou alguma cirurgia recente?",
          especifique: true,
          especifiquePlaceholder: "Qual e quando?",
          alertaSeSim: "Cirurgia recente — confirmar liberação médica e tempo de recuperação.",
        },
        {
          tipo: "simnao",
          id: "usoMedicamento",
          label: "Faz uso de algum medicamento?",
          especifique: true,
          especifiquePlaceholder: "Quais?",
        },
        {
          tipo: "simnao",
          id: "alergiaCosmeticos",
          label: "Alergia a cosméticos ou medicamentos?",
          especifique: true,
          especifiquePlaceholder: "A quê?",
        },
        {
          tipo: "simnao",
          id: "tumorLesao",
          label: "Tumor ou lesão pré-cancerígena?",
          especifique: true,
          especifiquePlaceholder: "Especifique",
          alertaSeSim:
            "Tumor ou lesão pré-cancerígena — avaliação médica necessária antes do procedimento.",
        },
        {
          tipo: "simnao",
          id: "outroProblema",
          label: "Algum outro problema a ser informado?",
          especifique: true,
          especifiquePlaceholder: "Descreva",
        },
      ],
    },
    {
      titulo: "Áreas",
      descricao: "Marque as áreas que deseja depilar — pode escolher mais de uma.",
      campos: [
        {
          tipo: "multi",
          id: "areas",
          label: "Área(s) a depilar",
          obrigatorio: true,
          opcoes: [
            "Axilas",
            "Seios e/ou abdômen",
            "Braço/antebraço",
            "Virilha",
            "Coxa e/ou canela",
            "Glúteos e extras",
            "Linha alba",
          ],
        },
      ],
    },
  ],
};

export const FICHAS: Record<Tipo, DefinicaoFicha> = {
  corporal: CORPORAL,
  facial: FACIAL,
  laser: LASER,
  cadastro: CADASTRO,
};

// Áreas de depilação, reaproveitadas no registro de sessões do painel
// (mesma lista da ficha a laser, para a Marina marcar o que foi feito).
export const AREAS_DEPILACAO: string[] = [
  "Meia-perna",
  "Axilas",
  "Virilha",
  "Virilha completa",
  "Perianal",
  "Coxa",
  "Buço",
  "Queixo",
  "Tórax",
  "Abdômen",
  "Pescoço",
];

// Botões de "o que foi feito" no registro de sessão, por tipo de ficha.
// Baseados nos serviços reais da MAVI. A Marina sempre pode complementar
// no campo de observação.
export const OPCOES_SESSAO: Record<Tipo, string[]> = {
  laser: AREAS_DEPILACAO,
  facial: ["Limpeza de Pele", "Hidragloss"],
  corporal: [
    "Drenagem Linfática",
    "Power Redux",
    "Corrente Russa",
    "Taping Pós-Parto",
    "Pós-Operatório",
    "Drenagem para Gestantes",
    "Max Pós-Parto",
  ],
  // Cadastro não é um tratamento — nunca vira sessão.
  cadastro: [],
};

// Rótulo do grupo de botões conforme o tipo (áreas x procedimentos).
export function rotuloItensSessao(tipo: Tipo): string {
  return tipo === "laser" ? "Áreas realizadas" : "Procedimentos realizados";
}

// Fichas de tratamento (usadas para escolher/filtrar procedimento — não
// inclui "cadastro", que não é um tratamento).
export const TIPOS: Tipo[] = ["corporal", "facial", "laser"];

// Todas as fichas que dá pra mandar um link — cadastro primeiro, por ser
// o ponto de entrada de uma cliente nova.
export const TIPOS_ENVIO: Tipo[] = ["cadastro", ...TIPOS];

export function ehTipo(v: string): v is Tipo {
  return v === "corporal" || v === "facial" || v === "laser" || v === "cadastro";
}

export function getFicha(tipo: string): DefinicaoFicha | undefined {
  return ehTipo(tipo) ? FICHAS[tipo] : undefined;
}

export function nomeTipo(tipo: string): string {
  return getFicha(tipo)?.nome ?? tipo;
}

// Rótulo curto (sem o "Anamnese "), para caber melhor em botões no celular.
export function nomeCurto(tipo: string): string {
  return (getFicha(tipo)?.nome ?? tipo).replace(/^Anamnese\s+/i, "");
}

export type Respostas = Record<string, string | boolean | null>;

// Um campo com `ocultarSe` só aparece quando a condição NÃO bate.
// Ex.: perguntas de menstruação somem quando gênero = "Masculino".
export function campoVisivel(campo: Campo, respostas: Respostas): boolean {
  if (!campo.ocultarSe) return true;
  return respostas[campo.ocultarSe.campo] !== campo.ocultarSe.valor;
}

// Campo preenchido corretamente pra avançar/enviar — obrigatoriedade (todos
// os tipos) + validade dos dígitos verificadores do CPF (mesmo campo
// opcional, um CPF digitado errado não passa). Compartilhado entre
// /avaliacao/$tipo (cliente) e /painel/nova (cadastro manual da Marina),
// que têm as mesmas regras.
export function campoValido(campo: Campo, respostas: Respostas): boolean {
  if (campo.tipo === "texto" && campo.mascara === "cpf") {
    const valor = String(respostas[campo.id] ?? "").trim();
    if (valor.length === 0) return !campo.obrigatorio;
    return cpfValido(valor);
  }
  if (campo.tipo === "texto" && campo.obrigatorio) {
    return String(respostas[campo.id] ?? "").trim().length > 0;
  }
  if (campo.tipo === "selecao" && campo.obrigatorio) {
    return String(respostas[campo.id] ?? "").trim().length > 0;
  }
  if (campo.tipo === "multi" && campo.obrigatorio) {
    return String(respostas[campo.id] ?? "").trim().length > 0;
  }
  if (campo.tipo === "simnao") {
    return respostas[campo.id] === true || respostas[campo.id] === false;
  }
  return true;
}

// Calcula os alertas de segurança a partir das respostas de uma ficha
export function calcularAlertas(tipo: string, respostas: Respostas): string[] {
  const def = getFicha(tipo);
  if (!def) return [];
  const alertas: string[] = [];
  for (const etapa of def.etapas) {
    for (const campo of etapa.campos) {
      if (campo.tipo === "simnao" && campo.alertaSeSim && respostas[campo.id] === true) {
        alertas.push(campo.alertaSeSim);
      }
    }
  }
  return alertas;
}

// Rótulo legível de um campo (para o painel da Marina)
export function rotuloCampo(tipo: string, id: string): string {
  const def = getFicha(tipo);
  if (def) {
    for (const etapa of def.etapas) {
      for (const campo of etapa.campos) {
        if (campo.id === id) return campo.label;
      }
    }
    const medida = def.camposMedidas.find((m) => m.id === id);
    if (medida) return medida.label;
  }
  return id;
}

# Guia Digital Interativo para Obstetras — Arquitetura da Informação

> Etapa atual: arquitetura, UX, UI e Design System. Sem conteúdo médico e sem
> implementação de autenticação. Este documento descreve a estrutura, não o texto.

## 1. Visão geral do produto

Um PWA mobile-first (otimizado para iPhone) que funciona como copiloto de decisão
durante a consulta obstétrica. Não é material de estudo — é uma ferramenta de
consulta rápida. Toda a experiência é desenhada em torno de uma métrica única:

**Tempo até a resposta certa < 10 segundos.**

Isso implica três restrições de arquitetura que valem para qualquer decisão de
produto tomada daqui pra frente:

- **Título em forma de pergunta** é a unidade de busca — o obstetra pensa em
  perguntas ("posso liberar parto normal com placenta baixa?"), não em capítulos.
- **Uma pergunta = uma página.** Nunca uma pergunta exige navegar por múltiplas
  telas para ter a resposta inicial (🎯 O Essencial sempre no topo, sem scroll).
- **Hierarquia visual > hierarquia de texto.** A resposta rápida (🎯) tem que ser
  reconhecível pela forma do card antes mesmo de ler a palavra.

## 2. Modelo de conteúdo

### 2.1 Unidade atômica: **Tema**

Um "Tema" é a menor unidade navegável e vendável de conteúdo — equivale a uma
pergunta/página. Estrutura de dados (independente da tecnologia de backend):

```
Tema {
  id: slug único                         // ex: "placenta-baixa-parto"
  titulo: string (forma de pergunta)
  modulo_id: ref -> Modulo
  tags: string[]                         // usado por busca e "veja também"
  nivel_urgencia: enum(rotina, atencao, encaminhar)  // define acentos visuais
  atualizado_em: datetime
  versao_conteudo: int                   // ver §6 Atualização automática

  blocos: {
    essencial: RichText
    erro_comum: RichText
    proximo_passo: RichText | Checklist
    explicar_paciente: RichText
    paciente_pensando: RichText
    fortalece_confianca: RichText
    aprendi_que: RichText
    aula_express: { video_id, duracao, thumbnail } | null
    referencias: Referencia[]
    veja_tambem: TemaRef[]

    // contextuais — posição livre dentro do fluxo, não fixa:
    voce_sabia: RichText[]               // 0..n, inseridos onde fizer sentido
    quando_encaminhar: RichText | null    // 0..1, aparece se nivel_urgencia relevante
  }
}
```

### 2.2 Agrupamento: **Módulo**

Módulos agrupam Temas por área clínica (ex.: "1º trimestre", "Intercorrências
hipertensivas"). É o nível do índice — não da leitura. Um Módulo tem: título,
ícone, cor de destaque (dentro da paleta do design system), lista ordenada de Temas.

### 2.3 Por que separar "bloco fixo" de "bloco contextual"

Os 10 blocos da sequência oficial (Essencial → Veja também) **sempre existem na
mesma ordem** — isso é o que permite ao cérebro do usuário escanear por posição,
não por leitura. 💡 *Você sabia?* e 🚩 *Quando encaminhar* são **contextuais**:
só aparecem quando há conteúdo real para eles, e podem ser inseridos em qualquer
ponto do corpo (normalmente logo após 🎯 Essencial ou ✅ Próximo passo). Um Tema
sem urgência de encaminhamento simplesmente não renderiza o bloco 🚩 — o layout
nunca mostra um card vazio.

## 3. Mapa de navegação

```
┌─ Início (últimos acessados + destaques do dia)
├─ Índice (Módulo > Tema, com busca embutida)
├─ Busca rápida (overlay full-screen, atalho global)
├─ Favoritos (Temas marcados pelo usuário)
├─ Tema (template único — ver §4)
│   ├─ Anterior / Próximo (navegação sequencial dentro do Módulo)
│   ├─ Voltar ao índice
│   └─ Veja também → Tema
└─ Perfil / Conta
    ├─ Licença e acesso (ver §5)
    ├─ Dispositivos conectados (ver §5.2)
    └─ Atualizações do conteúdo (changelog, ver §6)
```

Navegação primária: **tab bar inferior fixa** (padrão iOS nativo — reconhecível,
polegar-friendly, não some com o teclado). Busca não é uma aba: é um ícone no
cabeçalho que abre um overlay full-screen (modelo cmd-K/Spotlight), porque busca
é uma ação transitória, não um destino.

## 4. Template de página (regra fixa)

Todo Tema renderiza o mesmo esqueleto, na mesma ordem, controlado por um único
componente `GuiaArticleTemplate` (ver biblioteca de componentes). Isso é o que
garante consistência entre 3 propostas visuais diferentes (§ Propostas de
Layout) — a ordem dos blocos nunca muda, só a pele muda.

1. Cabeçalho fixo: breadcrumb do Módulo + botão voltar + progresso de leitura
2. Título (pergunta) + badge de nível de urgência (se aplicável)
3. 🎯 O Essencial
4. ⚠️ Erro comum
5. ✅ Qual é o próximo passo?
6. 💬 Como explicar para a paciente
7. ❤️ O que a paciente provavelmente está pensando
8. 🤝 O que fortalece a confiança da paciente
9. 💜 Com o tempo, aprendi que…
10. 🎥 Aula Express
11. 📚 Referências (colapsado por padrão — não compete por atenção com o essencial)
12. ➜ Veja também
13. Rodapé de navegação: Tema anterior / Tema seguinte / Voltar ao índice

## 5. Modelo de acesso (arquitetura, sem UI de autenticação nesta etapa)

O produto é **licença de acesso vitalícia**, não um arquivo. A arquitetura
precisa deixar claro, desde já, onde entram peças que ainda não serão
implementadas — para não travar o design agora e refazer depois.

### 5.1 Integração com plataforma de venda (ex.: Kiwify)

A venda e o processamento de pagamento **não acontecem dentro do PWA**. O
fluxo desenhado (arquitetura apenas, nada implementado nesta etapa):

```
Kiwify (checkout) ──webhook de compra aprovada──▶ Backend do Guia
                                                        │
                                                        ├─ cria conta/licença vinculada ao e-mail
                                                        ├─ envia e-mail de boas-vindas + link de ativação
                                                        └─ registra: produto, plano, data, upsells futuros
```

Pontos de desenho que ficam reservados na arquitetura, mas fora de escopo agora:
- Endpoint de webhook desacoplado do domínio de autenticação (o provedor de
  checkout pode trocar sem afetar o resto do sistema).
- Identificador de licença é o **e-mail**, não um ID interno da plataforma de
  venda — permite trocar de Kiwify para outro provedor sem migrar usuários.
- Reemissão de acesso (reembolso, chargeback, upgrade de plano) tratada como
  evento de webhook separado, nunca como exclusão manual de conta.

### 5.2 Sessões e dispositivos (arquitetura, a implementar depois)

- Limite de dispositivos conectados simultâneos é **configurável por licença**
  (não fixo no código) — permite testar 2 vs 3 dispositivos sem deploy.
- Tela "Dispositivos conectados" no Perfil: lista com nome do aparelho, último
  acesso, botão "desconectar este aparelho" — desenhada nesta etapa como
  estado visual (ver Proposta de layout), sem lógica funcional ainda.
- Sessão expira por inatividade longa, não por tempo curto — o produto é usado
  em consulta, não pode pedir login no meio de um atendimento.

### 5.3 Conteúdo servido, não empacotado

- Texto dos Temas: carregado do servidor com cache local (service worker) —
  abre offline com o último conteúdo sincronizado, atualiza em background.
- Vídeos (Aula Express): **nunca** ficam no cache local. Sempre stream
  autenticado sob demanda (token de curta duração por sessão), o que também é
  a principal barreira prática contra compartilhamento de conta.
- Compartilhamento é dificultado por fricção de dispositivo + vídeo não
  baixável — não por bloqueios agressivos que prejudicam quem comprou
  legitimamente (sem DRM invasivo, sem watermark que atrapalhe leitura).

## 6. Atualização automática de conteúdo

- Cada Tema tem `versao_conteudo`. O app mantém um índice leve
  (id + versão + hash) sincronizado a cada abertura.
- Se a versão local diverge da versão do servidor, o Tema é rebaixado para
  "requer atualização" e recarregado em background — sem exigir novo build/
  download da PWA na App Store/Home Screen.
- Changelog visível em Perfil → Atualizações: lista "O que mudou" por Tema,
  reforça a percepção de valor contínuo da licença vitalícia.

## 7. Reservado para expansão futura (não construir agora, só não travar)

| Área | O que a arquitetura já prevê |
|---|---|
| Favoritos | campo `favoritos: TemaRef[]` por usuário, sincronizado no perfil |
| Histórico | log leve de `tema_id + timestamp` para "Últimos acessados" na Início |
| Comunidade | módulo separado (rota própria), sem acoplamento ao template de Tema |
| Novos módulos | Módulo é uma entidade independente — adicionar não altera o template |
| Multi-idioma | textos dos blocos como chave de tradução, não string fixa no componente |

## 8. Critério de sucesso da arquitetura

Qualquer decisão de tela deve responder "sim" a: *o obstetra, em pé, com o
celular numa mão, no meio de uma dúvida real, chega na resposta em menos de
10 segundos?* Se a resposta exigir dois taps a mais que o necessário, a tela
está errada — não o conteúdo.

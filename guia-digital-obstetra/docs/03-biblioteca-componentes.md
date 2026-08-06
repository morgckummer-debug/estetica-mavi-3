# Biblioteca de Componentes — Guia Digital do Obstetra

Todos os componentes de conteúdo compartilham a mesma anatomia base
(`InfoBlock`), variando apenas cor de acento, ícone e comportamento
específico. Isso é o que garante "mesmo padrão visual" entre os 11 tipos
pedidos no briefing, mesmo com propósitos diferentes.

## Anatomia base — `InfoBlock`

```
┌───────────────────────────────────────┐
│ [ícone 32×32]  RÓTULO EM CAPS          │  ← header: icon chip + eyebrow
│                                         │
│  Corpo do conteúdo em texto corrido     │  ← body: 16/24, ink-900
│  ou lista, conforme o tipo.             │
│                                         │
│  [ação opcional: link / botão / lista] │  ← footer opcional
└───────────────────────────────────────┘
```

- Container: `radius-lg` (20px), `shadow-2`, fundo = tint do tipo (ou branco),
  borda hairline `1px solid ink-100/50%`, padding 20–24.
- Icon chip: 32×32, `radius-sm`, fundo = acento em 15% opacidade, emoji 18px
  centralizado.
- Eyebrow: Caption (12px, 600, uppercase, tracking), cor = acento 700.
- Espaço header→body: 12px. Entre blocos consecutivos na página: 16px.

Estado de toque (quando o card é acionável, ex. abrir referência): `scale .97`
+ `shadow-1` no `:active`.

---

## Os 10 blocos fixos da sequência

### 1. 🎯 O Essencial
- **Papel:** resposta em 1 parágrafo curto (2–4 linhas) — o único bloco que
  deve ser visível sem scroll ao abrir o Tema.
- **Acento:** lavanda (`--lav-100` bg, `--lav-500` ícone, `--lav-700` texto do rótulo).
- **Variante visual:** levemente maior que os demais (padding +4, borda
  `1px solid --lav-300` em vez de hairline neutro) — sinaliza "comece aqui".
- **Regra de conteúdo (estrutural, não editorial):** máximo ~280 caracteres.

### 2. ⚠️ Erro comum
- **Papel:** o engano mais frequente relacionado ao tema.
- **Acento:** âmbar (`--warning`).
- **Variante:** ícone chip com leve contorno tracejado — comunica "cuidado"
  sem depender só da cor.

### 3. ✅ Qual é o próximo passo?
- **Papel:** ação concreta imediata.
- **Acento:** sage (`--success`).
- **Variante:** corpo pode renderizar como checklist numerada (1, 2, 3) em vez
  de parágrafo — único bloco com essa flexibilidade estrutural.

### 4. 💬 Como explicar para a paciente
- **Papel:** frase pronta, em linguagem simples, para usar na consulta.
- **Acento:** neutro com borda esquerda lavanda de 3px (estilo "citação").
- **Variante:** tipografia levemente diferenciada — itálico no corpo, como
  fala direta, distinguindo de texto técnico dos outros blocos.

### 5. ❤️ O que a paciente provavelmente está pensando
- **Papel:** antecipar a preocupação não verbalizada.
- **Acento:** rosa empatia (`--empathy`).
- **Variante:** balão com "cauda" sutil (pseudo-elemento triangular) apontando
  para cima, reforçando "isto está na cabeça dela".

### 6. 🤝 O que fortalece a confiança da paciente
- **Papel:** atitude/gesto que aumenta confiança no profissional.
- **Acento:** dourado — um dos poucos usos de `--gold` fora de Aula Express,
  porque este bloco é sobre "valor percebido", coerente com a cor de prestígio.

### 7. 💜 Com o tempo, aprendi que…
- **Papel:** voz de experiência/mentoria, tom pessoal.
- **Acento:** lavanda profunda (`--lav-700` texto sobre `--lav-100`).
- **Variante:** único bloco com aspas decorativas grandes (glifo `"`) no canto
  superior esquerdo, em `--lav-300`, e corpo em itálico — diferenciação
  editorial proposital para sinalizar "isto é experiência, não protocolo".

### 8. 🎥 Aula Express
- **Papel:** vídeo curto complementar.
- **Acento:** único card **escuro** do sistema (`--ink-900` bg, texto branco)
  — funciona como "janela de mídia", contraste deliberado com o resto da
  página clara.
- **Anatomia própria:** thumbnail com botão de play central, badge de duração
  (ex. "3 min") no canto, botão "Assistir" em pílula dourada.
- **Estado bloqueado (fora de escopo de auth nesta etapa, mas previsto):** se
  sessão de vídeo não puder ser validada, o card mostra estado "indisponível
  offline" em vez de tela de erro — nunca quebra o layout da página.

### 9. 📚 Referências
- **Papel:** embasamento, citações.
- **Acento:** neutro (`--bg-subtle`), sem sombra (`shadow-1` apenas) —
  deliberadamente o bloco de menor peso visual da página.
- **Variante:** **colapsado por padrão**, expande com toque ("Ver referências
  (3)"). Isso é decisão de UX, não só visual: referência não compete com a
  resposta rápida pela atenção do usuário.

### 10. ➜ Veja também
- **Papel:** navegação para Temas relacionados, ao final da página.
- **Acento:** neutro, lista de linhas com seta, sem fundo colorido.
- **Variante inline:** a mesma seta `➜` pode aparecer como link curto dentro do
  corpo de outro bloco (ex. dentro do Essencial: "➜ Veja também: Placenta
  prévia") — mesmo estilo de texto, sem virar um card completo.

---

## Blocos contextuais (posição livre, aparecem só quando há conteúdo)

### 💡 Você sabia?
- **Papel:** curiosidade/complemento opcional, tom leve.
- **Formato:** chip compacto (não card completo) — outline lavanda, sem
  preenchimento, para não competir visualmente com os blocos fixos.
- **Posição:** inserido dentro do fluxo onde fizer sentido (após Essencial ou
  Próximo passo), nunca em posição fixa própria.

### 🚩 Quando encaminhar
- **Papel:** critério objetivo de encaminhamento/alerta.
- **Formato:** card com acento de urgência (`--danger`), borda mais espessa
  (2px) — é o único bloco com peso de borda diferente, reservado para
  informação que não pode ser perdida.
- **Posição:** logo após ✅ Próximo passo quando presente, para ficar próximo
  da decisão de conduta.

---

## Componentes de navegação e estrutura

### `GuiaArticleTemplate`
Componente "esqueleto" que recebe os dados de um Tema e monta a sequência
fixa de blocos automaticamente (ver `01-arquitetura-informacao.md §4`).
Responsável por: cabeçalho com progresso de leitura, inserir blocos
contextuais na posição certa, e renderizar rodapé de navegação.

### `IndiceModulo`
Lista de Módulos expansíveis → Temas. Cada linha de Tema mostra: título
(pergunta), badge de urgência se houver, ícone de favorito. Suporta busca
embutida no topo (filtra em tempo real, sem tela separada).

### `BuscaRapida` (overlay)
Full-screen, ativado por ícone no cabeçalho. Input grande no topo, resultados
agrupados por Módulo, aparecem a partir de 2 caracteres digitados. Pensado
para responder à meta de 10 segundos mesmo quando o usuário não sabe em qual
Módulo o Tema está.

### `NavegacaoSequencial`
Rodapé fixo ao fim do Tema: "◀ Tema anterior" / "Voltar ao índice" / "Próximo
tema ▶". Permite "ler o módulo inteiro" sem voltar ao índice a cada Tema.

### `TabBarInferior`
4 destinos fixos: Início, Índice, Favoritos, Perfil. Ícones outline, rótulo
abaixo, item ativo em `--lav-500`.

### `LicencaDispositivo` (estado visual apenas, sem lógica nesta etapa)
Card de perfil mostrando plano da licença e lista de dispositivos conectados
com ação "desconectar". Reservado para quando a integração de autenticação/
venda (Kiwify ou similar) for implementada.

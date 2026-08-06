# Design System — Guia Digital do Obstetra

Referências de qualidade: Apple (HIG, clareza tátil), Linear (densidade sem
peso visual), Notion (blocos modulares legíveis), Stripe Docs (leitura técnica
que não cansa). Nenhuma inspiração em PDF, apostila ou artigo científico —
zero colunas justificadas, zero serifado denso, zero parede de texto.

Princípio de ordem: **usabilidade > estética**. Todo token abaixo existe para
servir a regra dos 10 segundos, não para "parecer bonito" isoladamente.

## 1. Cor

Paleta clara, enxuta, com um único acento de cor forte (lavanda) e um acento
de prestígio usado com escassez (dourado). Cores semânticas são versões
dessaturadas da mesma família — nunca cores de alerta "gritantes" tipo
vermelho puro ou amarelo semáforo, que destoariam do tom premium.

### 1.1 Base

| Token | Hex | Uso |
|---|---|---|
| `--bg-base` | `#FFFFFF` | fundo padrão de tela |
| `--bg-subtle` | `#FAFAFA` | fundo de seções secundárias, referências |
| `--bg-sunken` | `#F5F5F7` | inputs, chips inativos |
| `--ink-900` | `#1C1B1F` | texto principal |
| `--ink-700` | `#45444B` | texto secundário |
| `--ink-500` | `#6F6E76` | legendas, metadados |
| `--ink-300` | `#A9A8B0` | placeholder, ícones inativos |
| `--ink-100` | `#E7E6EA` | bordas hairline |

### 1.2 Lavanda (acento primário — ação, foco, identidade)

| Token | Hex |
|---|---|
| `--lav-100` | `#F1EEFC` |
| `--lav-300` | `#C9C0F2` |
| `--lav-500` | `#8B7AE0` |
| `--lav-700` | `#5B4BB8` |

### 1.3 Dourado (acento de prestígio — usar com escassez: badges, aula express, licença)

| Token | Hex |
|---|---|
| `--gold-100` | `#FBF4E6` |
| `--gold-300` | `#E8D9B5` |
| `--gold-500` | `#C6A15B` |
| `--gold-700` | `#9C7C3E` |

### 1.4 Semânticas (desaturadas, dentro do mesmo tom premium)

| Papel | Bg tint | Acento | Componente que usa |
|---|---|---|---|
| Sucesso / confiança | `#EAF3EE` | `#6E9C82` | ✅ Próximo passo, 🤝 Confiança |
| Atenção | `#FBF1E6` | `#C98A46` | ⚠️ Erro comum |
| Empatia / reflexão | `#F7EAEB` | `#B98B90` | ❤️ Paciente pensando |
| Urgência | `#FBEAE8` | `#B85C52` | 🚩 Quando encaminhar |

Regra: nunca mais de duas cores semânticas visíveis na mesma tela ao mesmo
tempo além do neutro — evita "efeito arco-íris" que lembra apostila didática.

## 2. Tipografia

Fonte de sistema (nativa no iPhone, zero custo de carregamento, máxima
legibilidade): `-apple-system, "SF Pro Text", "Inter", sans-serif`.

| Estilo | Tamanho / linha | Peso | Uso |
|---|---|---|---|
| Display | 28 / 34 | 700 | — (reservado, não usado em Tema) |
| Título | 22 / 28 | 700 | título-pergunta do Tema |
| Headline | 17 / 24 | 600 | cabeçalho de cada componente |
| Body | 16 / 24 | 400 | corpo de texto dos blocos |
| Callout | 15 / 20 | 500 | itens de checklist, referência ativa |
| Caption (eyebrow) | 12 / 16 | 600, +6% tracking, uppercase | rótulo do tipo de bloco |
| Footnote | 12 / 16 | 400 | referências, metadados |

Largura de leitura confortável: `max-width: 640px` mesmo em telas maiores —
nunca deixar o texto esticar full-width fora do iPhone.

## 3. Espaçamento

Escala em múltiplos de 4, prevista para toque confortável:
`4, 8, 12, 16, 20, 24, 32, 40, 56, 72`.

- Padding interno de card: `20` (mobile) / `24` (≥ 431px)
- Espaço entre blocos da sequência: `16`
- Margem lateral de tela: `20`
- Área mínima de toque: `44×44` (padrão Apple HIG)

## 4. Raio e elevação

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | 12px | chips, badges |
| `--radius-md` | 16px | botões, inputs |
| `--radius-lg` | 20px | cards de componente |
| `--radius-xl` | 28px | sheets, modais, cabeçalho de tela |

Sombra suave e efeito 3D leve — nunca sombra dura ou "flat design" sem
profundidade:

```
--shadow-1: 0 1px 2px rgba(28,27,31,.04), 0 1px 1px rgba(28,27,31,.03);
--shadow-2: 0 6px 16px rgba(28,27,31,.07), 0 2px 4px rgba(28,27,31,.04);
--shadow-3: 0 16px 40px rgba(28,27,31,.12), 0 4px 10px rgba(28,27,31,.05);
```

Efeito 3D discreto em cards: gradiente quase imperceptível
`linear-gradient(180deg, #ffffff 0%, #fbfaff 100%)` + `--shadow-2` +
highlight interno `inset 0 1px 0 rgba(255,255,255,.6)`. O card deve parecer
"levemente pousado" sobre o fundo, nunca flutuando alto ou com sombra colorida.

## 5. Movimento

| Token | Valor |
|---|---|
| `--ease-standard` | `cubic-bezier(.22,1,.36,1)` |
| `--dur-fast` | 120ms |
| `--dur-base` | 200ms |
| `--dur-slow` | 320ms |

- Toque em card/botão: `scale(0.97)` no `:active`, retorno em `--dur-fast`.
- Transição entre Temas (próximo/anterior): slide horizontal sutil, nunca fade
  cru — reforça a sensação de "virar página" de um guia contínuo.
- Abertura de overlay de busca: sheet de baixo pra cima, `--dur-base`.

## 6. Grid e breakpoints

| Faixa | Largura | Comportamento |
|---|---|---|
| Base (iPhone) | 0–430px | 1 coluna, tab bar inferior |
| Phablet | 431–767px | 1 coluna, mais padding lateral |
| Tablet (iPad) | 768–1023px | conteúdo centralizado em 640px + índice lateral fixo |
| Desktop (retaguarda/admin, futuro) | ≥1024px | fora de escopo do PWA de consulta |

## 7. Acessibilidade e legibilidade clínica

- Contraste mínimo AA (4.5:1) em todo texto sobre tint colorido — tints foram
  calibrados para permitir `--ink-900` por cima sem ficar "lavado".
- Nunca comunicar urgência só por cor: 🚩 Quando encaminhar sempre tem ícone +
  rótulo textual, nunca depende de o usuário perceber "está vermelho".
- Tamanho de fonte nunca abaixo de 12px; toque nunca abaixo de 44px — em
  consulta, o profissional pode estar com luva, pressa ou tela em baixo brilho.

## 8. Iconografia

Ícones do sistema como identidade de bloco (não decoração): os emojis
definidos no briefing (🎯 ✅ ⚠️ 💬 ❤️ 🤝 💜 🎥 📚 💡 🚩 ➜) funcionam como
"assinatura visual" fixa de cada tipo de bloco — o obstetra deve reconhecer o
tipo de informação pela forma/cor do ícone antes de ler o rótulo. Para
elementos de interface (voltar, buscar, favoritar, menu) usar um set de
outline icons neutro e fino (peso 1.5px), nunca emoji — mantém distinção clara
entre "conteúdo" (emoji colorido) e "interface" (ícone de sistema).

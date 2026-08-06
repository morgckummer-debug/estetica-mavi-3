# Guia Digital do Obstetra — Etapa 1: Arquitetura, UX, UI e Design System

> Este módulo é um produto independente, sem relação com o app de estética
> deste repositório. Vive isolado em `guia-digital-obstetra/` para não
> interferir no restante do projeto. Recomenda-se migrar para um repositório
> próprio antes de evoluir para produção (ver conversa para decisão).

Sem conteúdo médico e sem autenticação implementada nesta etapa — apenas
estrutura, navegação e sistema visual, prontos para receber conteúdo e
integração futura com plataforma de venda/licenciamento (ex.: Kiwify).

## Conteúdo desta entrega

1. **Arquitetura da informação** → [`docs/01-arquitetura-informacao.md`](docs/01-arquitetura-informacao.md)
   Modelo de conteúdo (Tema/Módulo), mapa de navegação, template de página,
   modelo de acesso (licença vitalícia + ponto de integração com checkout
   externo), atualização automática, e o que fica reservado para depois
   (favoritos, histórico, comunidade, novos módulos).

2. **Design System** → [`docs/02-design-system.md`](docs/02-design-system.md)
   Cor, tipografia, espaçamento, elevação/sombra, raio, movimento, grid e
   acessibilidade — paleta clara (branco, lavanda, cinzas, dourado discreto).

3. **Biblioteca de componentes** → [`docs/03-biblioteca-componentes.md`](docs/03-biblioteca-componentes.md)
   Anatomia e regras visuais dos 10 blocos fixos da sequência + 2 blocos
   contextuais (💡 Você sabia?, 🚩 Quando encaminhar) + componentes de
   navegação (índice, busca, tab bar, navegação sequencial).

4. **Protótipo interativo (estático, sem build)** → [`prototype/index.html`](prototype/index.html)
   Abra o arquivo direto no navegador. Contém: showcase dos tokens do design
   system, showcase dos componentes, e as **3 propostas de layout** para uma
   mesma página, dentro de uma moldura de iPhone:
   - **Layout A — Pilha de Cards:** cards distintos com tinta de cor por
     tipo, ritmo vertical generoso (referência Notion).
   - **Layout B — Fluxo Editorial:** menos "caixas", separação por borda
     colorida e tipografia, leitura mais rápida e leve (referência Linear).
   - **Layout C — Índice Fixo:** trilho de âncoras no topo da página que
     permite pular direto para o bloco desejado sem rolar tudo (referência
     Stripe Docs) — proposta pensada especificamente para a meta de resposta
     em menos de 10 segundos quando a dúvida não é "o essencial", e sim um
     bloco específico (ex. só "como explicar para a paciente").

   O conteúdo de exemplo usado no protótipo é institucional (explica como
   usar o próprio Guia) — nenhuma linha de conteúdo clínico foi escrita
   nesta etapa, por instrução explícita do escopo.

## Próximos passos sugeridos (fora do escopo desta entrega)

- Decidir se o produto migra para repositório próprio (recomendado).
- Escolher stack de implementação real (o protótipo é HTML/CSS/JS puro,
  propositalmente framework-agnóstico nesta fase de validação visual).
- Popular o modelo de conteúdo com os primeiros Temas.
- Especificar a integração de checkout/licenciamento (ex. Kiwify) via webhook.

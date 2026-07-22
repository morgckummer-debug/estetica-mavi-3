## Objetivo

Permitir que a Marina envie **um único link de WhatsApp** que confirme várias sessões pendentes do mesmo dia da mesma cliente, mesmo que sejam de procedimentos diferentes (ex.: depilação axila + abdome + queixo, ou depilação + drenagem no mesmo dia).

## Fluxo pensado

No painel da cliente, no histórico de sessões, quando existir **mais de uma sessão pendente na mesma data** (somando todos os cards de procedimento), aparece um botão no topo do dia:

> **Enviar confirmação do dia (3)**

Ao clicar:
1. Abre uma checklist listando as pendentes daquele dia agrupadas por procedimento, todas marcadas por padrão. Marina desmarca o que não quer incluir.
2. Ao confirmar, o sistema gera **um token de lote** cobrindo as sessões marcadas e abre o WhatsApp com uma mensagem única + um único link `/confirmar/lote/<token>`.

Na página `/confirmar/lote/<token>`:
- A cliente vê a data e a lista dos procedimentos ("Depilação — axila, abdome, queixo · Drenagem — 1 sessão").
- **Um único botão "Confirmar tudo"** marca todas como confirmadas.

Os links individuais por sessão (comportamento atual) continuam funcionando — o botão novo só aparece quando faz sentido (2+ pendências no mesmo dia).

## Escopo técnico

**Backend (Supabase — apenas novas funções, sem alterar tabelas/RLS existentes):**
- Nova tabela leve `sessao_lote` (id, token, criado_em) e `sessao_lote_item` (lote_id, sessao_id) — ou reaproveitar coluna `lote_token` na própria `sessoes` se já existir. Verificar antes qual das duas abordagens cabe na estrutura atual.
- RPCs:
  - `criar_lote_confirmacao(p_sessao_ids uuid[])` → retorna token
  - `lote_por_token(p_token)` → devolve lista de sessões com procedimento/áreas/data
  - `confirmar_lote(p_token)` → marca todas as sessões do lote como confirmadas (reutiliza a mesma lógica de `confirmar_sessao`)

**Frontend:**
- `src/components/HistoricoSessoes.tsx`: agrupar pendências por data considerando todos os cards, renderizar o botão "Enviar confirmação do dia (n)" quando houver 2+, abrir modal de checklist e disparar `criar_lote_confirmacao`.
- `src/lib/api/sessoes.functions.ts`: adicionar `criarLoteConfirmacao`, `obterLotePublico`, `confirmarLote`.
- `src/lib/whatsapp.ts`: adicionar `linkConfirmacaoLote` e `linkWhatsappConfirmacaoLote` (mensagem única listando os procedimentos).
- Nova rota `src/routes/confirmar.lote.$token.tsx`: mesma estética da tela atual `/confirmar/$token`, com lista dos itens e botão único.

## Fora do escopo

- Não mexe no fluxo de link individual existente.
- Não mexe no envio de relatório de pacote.
- Não altera tabelas/RLS existentes de `sessoes`, `fichas` etc. — só adiciona as novas estruturas de lote.
- Não ativa Lovable Cloud.

## Passo 1 antes de codar

Ao entrar em build mode, primeiro leio o schema atual de `sessoes` (e migrations em `supabase/migrations/`) para decidir entre "tabela de lote separada" vs "coluna `lote_token` na própria sessão", e te mostro qual escolhi antes de aplicar a migration.
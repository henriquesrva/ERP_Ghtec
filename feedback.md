# Feedback — Passo 3.5.9: Migrar kanban para Prisma

## O que foi feito

**3 arquivos de produção reescritos:**

1. **`src/modules/kanban/kanban.repository.js`** — reescrita completa para Prisma async. Mappers `mapKanbanTask()` e `mapKanbanComment()` (camelCase→snake_case). `listCards()` substituiu o `UNION ALL` SQLite por duas queries paralelas (`Promise.all`) + merge JS com sort por `created_at`. Filtro de proposals antigas (enviado >30 dias, faturado >7 dias) traduzido para Prisma `NOT` filter. Relação polimórfica de `kanban_comments` preservada (sem FK real — apenas `cardType` + `cardId`).

2. **`src/modules/kanban/kanban.service.js`** — totalmente convertido para async/await. Usa `const repo = require("./kanban.repository")` (não destructuring) para compatibilidade com `vi.spyOn`. Todas as chamadas ao repository com `await`. Lógica de negócio (permissões, validações) preservada identicamente.

3. **`src/modules/kanban/kanban.controller.js`** — todos os 8 handlers convertidos para `async function` com `await`.

**1 arquivo de produção atualizado:**

4. **`src/modules/proposal/proposal.service.js`** — `await` adicionado nos 4 `kanbanRepo.addComment(...)` (auto-comentários em `markProposalExecuted`, `removeProposalExecution`, `registerApproval`, `registerBilling`). Try/catch do auto-comentário preservado — falha do comentário loga e não propaga para o fluxo principal.

**1 arquivo de testes criado:**

5. **`tests/services/kanban.service.test.js`** — 24 testes com vi.spyOn. Cobre: getAllCards, createTask (validação + sucesso), updateTask (NOT_FOUND + VALIDATION + sucesso), moveTask (NOT_FOUND + INVALID_STATUS + FORBIDDEN por 'enviado' + FORBIDDEN por role + sucesso para admin/comercial/tecnico/financeiro), deleteTask (FORBIDDEN + NOT_FOUND + sucesso com deleteCommentsByCard), linkTaskToProposal (NOT_FOUND task + NOT_FOUND proposal + sucesso), getComments, addComment (VALIDATION + sucesso + snapshot user_nome).

**Scripts e docs atualizados:**

- `scripts/check-prisma-connection.js` — seção 11: criar task, mover status, comentário em task, comentário polimórfico em proposal (sem FK), listar comentários, deletar tudo.
- `docs/PRISMA_SETUP.md` — estado atualizado para Passo 3.5.9.
- `docs/POSTGRES_CUTOVER_PLAN.md` — Fase 5 marcada como ✅ CONCLUÍDA.

---

## Resultados de validação

- `npm run prisma:status` → `Database schema is up to date!`
- `npm test` → **330 testes passando, 0 falhas** (306 anteriores + 24 novos)
- `node scripts/check-prisma-connection.js` → ✅ 11 seções

---

## Decisão técnica: UNION ALL → 2 queries + merge JS

A query SQLite usava `UNION ALL` entre proposals e kanban_tasks com `julianday()` para filtrar proposals antigas. Em Prisma, a tradução mais limpa foi:
1. `prisma.proposal.findMany` com filtro `NOT` para excluir proposals enviadas >30d ou faturadas >7d
2. `prisma.kanbanTask.findMany` sem filtro
3. Merge em JS com `sort((a, b) => new Date(a.created_at) - new Date(b.created_at))`

Equivalente funcional exato ao UNION original.

---

## Bridge restante

Apenas 1 ponto de bridge SQLite no sistema:
- `part.repository.deletePart` → `itens_nota_recebida` nulificação via SQLite (aguarda Fase 7 — nota_recebida)

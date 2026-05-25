# Feedback — Passo 3.4.1: Finalizar migration e corrigir auto-comment

## 1. Migration revisada

**Arquivo:** `prisma/migrations/20260525153903_init_schema/migration.sql`

✅ Revisada e aprovada. Resumo do que foi criado:

| Categoria | Detalhe |
|---|---|
| Enums | 6: `Role`, `KanbanStatus`, `MovementType`, `ContaStatus`, `NotaStatus`, `TipoNota` |
| Tabelas | 19: todas as entidades da aplicação |
| Decimal | Correto: `DECIMAL(15,2)` para monetários, `DECIMAL(15,4)` / `DECIMAL(6,4)` para fiscais |
| ON DELETE CASCADE | `proposal_items.proposal_id`, `price_history.proposal_id`, `itens_nota_recebida.nota_recebida_id` |
| Unique críticos | `proposals.numero_proposta`, `parts.codigo_interno`, `parts(nome,marca,modelo)`, `part_client_price_references(part_id,client_id)`, `notas_recebidas(fornecedor_id,numero_nota,serie)` |
| Indexes | Todos presentes: clienteId, kanbanStatus, dataProposta em proposals; clientId+partId, clientId+descricaoNormalizada em price_history; etc. |
| KanbanComment | Sem FK em `card_id` — apenas `@@index([card_type, card_id])` (relação polimórfica, correto) |
| Responsavel | Tabela `responsaveis` criada (legado mantido, sem FKs externas) |

Nenhuma divergência encontrada. Migration não alterada.

## 2. Causa dos warnings de auto-comment

**Warnings observados durante testes:**
```
[markProposalExecuted] auto-comment falhou: NOT NULL constraint failed: kanban_comments.user_id
[removeProposalExecution] auto-comment falhou: NOT NULL constraint failed: kanban_comments.user_id
[registerBilling] auto-comment falhou: NOT NULL constraint failed: kanban_comments.user_id
```

**Causa:** Bug de teste — não de produção.

- Os testes chamavam `markProposalExecuted(proposalId, {}, "admin", null, "Admin")` com `userId = null`
- As funções concluem a operação principal com sucesso, depois tentam gravar um comentário automático em `kanban_comments`
- `kanban_comments.user_id` é `NOT NULL` no schema
- O INSERT falha; o `try/catch` do service captura e loga o aviso em vez de re-throw
- Os testes passavam porque as asserções verificavam outros campos, não os comentários

**Em produção:** `userId` sempre vem de `req.user.id` (sessão autenticada) — nunca é `null`. O bug nunca ocorre em produção.

## 3. Correção aplicada

**Arquivo:** `tests/integration/proposal-flow.test.js`

1. Adicionado `createTestUser` no import de fixtures
2. Adicionado `let userId;` nos describe blocks de `markProposalExecuted`, `removeProposalExecution` e `registerBilling`
3. Adicionado `({ id: userId } = createTestUser());` em cada `beforeEach` dos blocos afetados
4. Substituído `null` por `userId` em todas as chamadas que alcançam `addKanbanComment`:
   - `markProposalExecuted(proposalId, {}, "admin", userId, "Admin")`
   - `markProposalExecuted(proposalId, {}, "tecnico", userId, "Tec")`
   - Chamada multi-linha com dados de execução
   - Todas as `removeProposalExecution(proposalId, "admin", userId, "Admin")` (4 ocorrências)
   - `registerBilling(proposalId, { invoice_number: "NF-9999", ... }, userId, "Admin")`

**Casos que NÃO foram alterados** (não alcançam addKanbanComment, pois lançam exceção antes):
- Casos FORBIDDEN: `"user"`, `"comercial"`, `"financeiro"` em `markProposalExecuted`
- Caso FORBIDDEN: `"user"` em `removeProposalExecution`
- Casos VALIDATION/NOT_FOUND em `registerBilling`

**Por que é seguro:** `createTestUser()` cria um usuário com `username = "usuario_teste"` no banco em memória. O `clearAllTables()` do `beforeEach` externo garante que a tabela `users` está limpa antes de cada teste — sem conflito de unique constraint.

## 4. Validações pós-correção

- `npm run prisma:status` — ✅ `Database schema is up to date!` (1 migration, `20260525153903_init_schema`)
- `npm run prisma:generate` — ✅ `Generated Prisma Client (7.8.0) to ./src/generated/prisma in 212ms`
- `npm test` — ✅ **137/137 passando, 0 warnings de auto-comment**

## 5. Documentação atualizada

- `docs/PRISMA_SETUP.md` — atualizado para refletir: Passo 3.4 concluído, migration aplicada, estrutura de migrations/, estado atual do banco (tabela resumo do que foi criado), próximos passos com ordem recomendada para Passo 3.5
- `docs/SYSTEM_CONTEXT.md` — nota Prisma atualizada: migration aplicada, PostgreSQL com schema completo, próximo passo 3.5

## 6. Estado do runtime (confirmado)

- ✅ Aplicação continua 100% SQLite/better-sqlite3
- ✅ Nenhum repository, service ou controller foi alterado
- ✅ `database.sqlite` intacto

## 7. Próximo passo

**Passo 3.5** — Migrar repositories módulo por módulo de `better-sqlite3` para Prisma Client.

Ordem recomendada (mais simples → mais complexo):
1. `category` (PartCategory) — CRUD simples, sem dependências complexas
2. `responsavel` / `objeto` / `condition` — CRUD simples
3. `client` — deduplicação fica no service, repository é simples
4. `part` — com PartClientPriceRef
5. `auth` / `user` — cuidado com bcrypt e sessão
6. `fornecedor` / `categoria_despesa` — financeiro simples
7. `stock` — movimentações
8. `kanban` — polimórfico
9. `nota_recebida` / `conta_pagar` — financeiro complexo
10. `proposal` — por último (transação atômica, PDF, price_history, tudo junto)

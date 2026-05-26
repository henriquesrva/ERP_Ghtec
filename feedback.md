# Feedback — Passo 3.5.7: Migrar proposal + proposal_items + price_history para Prisma

## O que foi feito

**6 arquivos de produção reescritos/atualizados:**

1. **`src/modules/proposal/proposal.repository.js`** — reescrita completa para Prisma async. Mappers `mapProposal()` e `mapProposalItem()` para camelCase→snake_case. `createProposalAtomic` via `prisma.$transaction`. Cascade delete via PostgreSQL (`deleteProposalAndRelated` só chama `prisma.proposal.delete`). Todas as funções CRUD async.

2. **`src/modules/proposal/proposal.service.js`** — totalmente convertido para async/await. Usa referências de módulo (`proposalRepo.fn()`) em vez de destructuring para compatibilidade com `vi.spyOn`. `findOrCreateClient` async via `clientRepo`. `createProposalFlow` captura erro P2002 para `numero_proposta` duplicado. Auto-registro de peças via `partRepo.findPartByComposition` + `partRepo.createPart` (async).

3. **`src/modules/proposal/proposal.controller.js`** — todos os handlers async. Fix: `findClientsByName` movido para `clientRepo` (não mais importado de `proposal.repository`).

4. **`src/modules/condition/condition.repository.js`** — bridge 1 removida. `deleteCondition` agora usa `prisma.$transaction([updateMany, delete])` — atômico.

5. **`src/modules/client/client.repository.js`** — bridges 2 e 3 removidas. `countClientProposals` → `prisma.proposal.count`. `getProfitAnalysis` → `prisma.$queryRaw` com JOIN real entre proposals, clients, proposal_items, price_history, parts.

6. **`src/modules/part/part.repository.js`** — bridges de price_history removidas. `getPartPriceHistory`, `getPartPriceHistoryByClient`, `getPartLastPricePerClient`, `getClientPriceRefs` → Prisma async. `findPartByComposition` → async Prisma. `deletePart`: bridge de price_history removida (`prisma.priceHistory.updateMany`); bridges de stock_movements e itens_nota_recebida permanecem (tabelas ainda não migradas).

**2 arquivos de testes reescritos:**

- `tests/services/proposal.service.test.js` — 24 testes com vi.spyOn. Sem SQLite, sem PostgreSQL real.
- `tests/integration/proposal-flow.test.js` — convertido de SQLite in-memory para vi.spyOn em todos os módulos. Helper `setupCreateSpies()` para isolar spies por teste.

**Scripts atualizados:**

- `scripts/check-prisma-connection.js` — seção 9 adicionada: criação de proposta com 2 itens e price_history via `prisma.$transaction`, verificação de cascade delete.

**Documentação atualizada:**

- `docs/PRISMA_SETUP.md` — estado atual atualizado para Passo 3.5.7 concluído.
- `docs/POSTGRES_CUTOVER_PLAN.md` — Fase 3 marcada como ✅ CONCLUÍDA; tabela de módulos SQLite/Prisma atualizada; seção 8 (próxima ação) atualizada para Fase 4 (stock).

---

## Resultados de validação

- `npm run prisma:status` → `Database schema is up to date!`
- `npm run prisma:generate` → client gerado sem erros
- `npm test` → **282 testes passando, 0 falhas**
- `node scripts/check-prisma-connection.js` → ✅ 9 seções (incluindo fluxo completo de proposta)

---

## Decisão técnica relevante: vi.mock() vs vi.spyOn()

`vi.mock()` com factory functions contendo `vi.fn()` não funciona em CommonJS + Vitest v4.1.7 com `isolate: true` por arquivo. As funções mockadas não são instâncias de `vi.fn()` e chamadas como `.mockResolvedValue()` falham com `TypeError`.

Solução: converter o service para usar referências de módulo (`proposalRepo.fn()`) em vez de destructuring, e usar `vi.spyOn(proposalRepo, "fn")` nos testes. Ambos os lados (service e teste) apontam para o mesmo objeto de módulo no cache CommonJS — o spy intercepta corretamente.

---

## Bridges restantes no sistema

Só restam 2 pontos de bridge SQLite, ambos em `part.repository.deletePart`:
- `stock_movements` check (aguarda Fase 4 — migração de stock)
- `itens_nota_recebida` nulificação (aguarda Fase 7 — migração de nota_recebida)

Todas as bridges relacionadas a proposals foram removidas.

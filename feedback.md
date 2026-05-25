# Feedback — Passo 3.5.3

## O que foi feito

Migração do módulo `client` de better-sqlite3 para Prisma Client (PostgreSQL).

**3 arquivos migrados:**
- `src/modules/client/client.repository.js` — Prisma async + SQLite bridges síncronas para `countClientProposals` e `getProfitAnalysis`
- `src/modules/client/client.service.js` — async/await, `const repo = require(...)`, sem `await` nas bridges síncronas
- `src/modules/client/client.controller.js` — async/await, `const service = require(...)`

**1 arquivo de bridge atualizado:**
- `src/modules/proposal/proposal.repository.js` — removeu import de 6 funções do `client.repository`; substituiu por implementações SQLite locais idênticas ao comportamento pré-migração

**1 arquivo de teste criado:**
- `tests/services/client.service.test.js` — 23 testes

**2 arquivos atualizados:**
- `scripts/check-prisma-connection.js` — CRUD de clientes (seção 6)
- `docs/PRISMA_SETUP.md` — estado atual e estrutura de arquivos

## Decisões técnicas

**Bridges síncronas em `client.repository.js`:** `countClientProposals` e `getProfitAnalysis` permanecem como funções síncronas SQLite. O primeiro consulta `proposals WHERE cliente_id = ?` (tabela ainda em SQLite); o segundo faz JOIN entre `proposals`, `proposal_items`, `price_history`, `parts` e `clients` — tabelas que ainda não foram migradas. O service chama `repo.countClientProposals(id)` sem `await` — sem Promise, sem bloqueio.

**Bridges locais em `proposal.repository.js`:** As 6 funções de cliente (`findClientByCnpj`, `findClientsByName`, `findClientsByExactName`, `findClientById`, `createClient`, `searchClients`) foram movidas para implementações SQLite locais no próprio `proposal.repository.js`. Isso mantém `findOrCreateClient` (chamado em `proposal.service.js`) completamente síncrono, preservando:
1. O fluxo de criação de propostas (que mistura sync/async mas não pode ser facilmente convertido sem migrar proposals para Prisma).
2. Os testes de integração que usam `createTestClient()` — que insere via SQLite em memória.

**`has_parts_contract` nas bridges:** A coluna foi adicionada via migration ao SQLite (`ALTER TABLE clients ADD COLUMN has_parts_contract INTEGER DEFAULT 0`). As bridges a incluem no INSERT, mantendo consistência com o Prisma.

**`getProfitAnalysis` — limitação conhecida:** O JOIN `clients c ON c.id = p.cliente_id` consulta a tabela SQLite `clients`. Clientes criados após a migração (apenas no PostgreSQL) não aparecerão nessa análise. Documentado; aceitável durante a fase híbrida.

## npm test

227 testes, 12 arquivos — todos passando.

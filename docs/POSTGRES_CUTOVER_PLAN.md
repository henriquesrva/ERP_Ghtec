# POSTGRES_CUTOVER_PLAN.md

## Premissa confirmada

**Dados atuais podem ser sacrificados.** Não há necessidade de migração de dados do SQLite para o PostgreSQL. O sistema pode partir de banco limpo.

Isso muda fundamentalmente a estratégia.

---

## 1. Estado Híbrido Atual

### Módulos em Prisma/PostgreSQL

| Módulo | Tabela(s) |
|--------|-----------|
| `category` | `part_categories` |
| `responsavel` | `responsaveis` |
| `objeto` | `objetos` |
| `condition` | `commercial_conditions` |
| `client` | `clients` |
| `auth/user` ✅ | `users` |
| `part` ✅ | `parts`, `part_client_price_references` |
| `proposal` ✅ | `proposals`, `proposal_items`, `price_history` |
| `stock` ✅    | `stock_movements` |
| `kanban` ✅   | `kanban_tasks`, `kanban_comments` |
| `fornecedor` ✅ | `fornecedores` |
| `categoria_despesa` ✅ | `categorias_despesa` |

### Módulos em SQLite/better-sqlite3

| Módulo | Tabela(s) | Linhas no repository |
|--------|-----------|---------------------|
| ~~`proposal`~~ | ~~`proposals`, `proposal_items`, `price_history`~~ | ~~429~~ → migrado Fase 3 |
| ~~`stock`~~ | ~~`stock_movements`~~ | ~~224~~ → migrado Fase 4 |
| ~~`kanban`~~ | ~~`kanban_tasks`, `kanban_comments`~~ | ~~284~~ → migrado Fase 5 |
| ~~`fornecedor`~~ | ~~`fornecedores`~~ | ~~154~~ → migrado Fase 6 |
| ~~`categoria_despesa`~~ | ~~`categorias_despesa`~~ | ~~48~~ → migrado Fase 6 |
| `nota_recebida` | `notas_recebidas`, `itens_nota_recebida` | 322 |
| `conta_pagar` | `contas_pagar` | 207 |

---

## 2. Bridges Temporárias Existentes

Cada bridge é um ponto onde código já migrado para Prisma precisa consultar SQLite (ou vice-versa) porque os dois lados da relação estão em bancos diferentes.

### Bridge 1 — `condition.repository.js → proposals (SQLite)`

**Localização:** `src/modules/condition/condition.repository.js:73`

```javascript
db.prepare("UPDATE proposals SET commercial_condition_id = NULL WHERE commercial_condition_id = ?").run(id);
await prisma.commercialCondition.delete({ where: { id } });
```

**Risco:** Não atômico. Se o `prisma.delete` falhar após o `db.prepare.run`, a condição desaparece do PostgreSQL mas a nulificação no SQLite já ocorreu. Baixo risco em produção (falha de delete é rara), mas tecnicamente incorreto.

**Remove quando:** `proposal` migrar para Prisma.

---

### Bridge 2 — `client.repository.js → proposals (SQLite)` — `countClientProposals`

**Localização:** `src/modules/client/client.repository.js:149`

```javascript
function countClientProposals(clientId) {
  return db.prepare("SELECT COUNT(*) AS count FROM proposals WHERE cliente_id = ?").get(clientId).count;
}
```

**Risco:** Funciona apenas para clientes que ainda existem no SQLite. Clientes criados após a migração (somente no PostgreSQL) retornarão count = 0 — permitindo deletar clientes com propostas vinculadas.

**Remove quando:** `proposal` migrar para Prisma.

---

### Bridge 3 — `client.repository.js → proposals+parts+price_history (SQLite)` — `getProfitAnalysis`

**Localização:** `src/modules/client/client.repository.js:155`

```javascript
function getProfitAnalysis() {
  return db.prepare(`SELECT ... FROM proposals p JOIN clients c ... JOIN parts pt ...`).all();
}
```

**Risco:** JOINs entre tabelas que agora estão em bancos diferentes (clients no PostgreSQL, proposals/parts no SQLite). A query usa a tabela `clients` do SQLite, que não reflete clientes criados após a migração. **Esta função está quebrada em produção para novos clientes desde o Passo 3.5.3.** A análise de lucro retorna zero propostas para qualquer cliente criado após a migração.

**Remove quando:** `proposal` e `part` migrarem para Prisma.

---

### Bridge 4 — `proposal.repository.js → clients (SQLite)` — 6 funções

**Localização:** `src/modules/proposal/proposal.repository.js:8-72`

```javascript
function findClientByCnpj(cnpj) { ... db.prepare("SELECT * FROM clients ...") ... }
function findClientsByName(nome) { ... db.prepare("SELECT ... FROM clients ...") ... }
function findClientsByExactName(nome) { ... db.prepare("SELECT * FROM clients") ... }
function findClientById(id) { ... db.prepare("SELECT * FROM clients WHERE id = ?") ... }
function createClient(data) { ... db.prepare("INSERT INTO clients ...") ... }
function searchClients(q) { ... db.prepare("SELECT ... FROM clients ...") ... }
```

**Risco:** Dupla fonte de verdade para clientes. Clientes criados via `client.service.js` vão para o PostgreSQL. Clientes criados via `findOrCreateClient` no fluxo de proposta vão para o SQLite. Os dois bancos têm dados de clientes divergentes. **Esta é a bridge mais perigosa.** Em produção, um cliente criado pela tela de Clientes não seria encontrado pelo fluxo de criação de proposta (e seria duplicado no SQLite).

**Remove quando:** `proposal` migrar para Prisma — toda a lógica de `findOrCreateClient` passa a usar Prisma async.

---

## 3. Grafo de Dependências (SQLite-side)

```
users ──────────────────────→ proposals (responsible_user_id, billed_by_user_id, etc.)
                             → stock_movements (created_by_user_id)
                             → kanban_tasks (created_by)
                             → notas_recebidas (created_by)
                             → contas_pagar (created_by, paid_by, cancelled_by)

parts ──────────────────────→ price_history (part_id)
                             → part_client_price_references (part_id)
                             → stock_movements (part_id)
                             → itens_nota_recebida (produto_id)
                             → proposal.service.js (findPartByComposition, createPart)

proposals ──────────────────→ proposal_items (proposal_id ON DELETE CASCADE)
                             → price_history (proposal_id ON DELETE CASCADE)
                             → stock_movements (proposal_id, opcional)

# Já em PostgreSQL, mas proposals ainda referencia via SQLite:
commercial_conditions ─────→ proposals.commercial_condition_id (FK, tratado via bridge 1)
clients ────────────────────→ proposals.cliente_id (FK, tratado via bridge 4)
```

**Módulos com menor acoplamento (candidatos a migrar sozinhos):**
- `fornecedor` — depende apenas de `users` (FK created_by — não enforced explicitamente em SQLite)
- `categoria_despesa` — sem FK cruzada relevante
- `kanban_tasks/comments` — depende de `users`
- `auth/user` — sem dependências de outros módulos SQLite

**Módulos com alto acoplamento (não podem migrar isolados limpo):**
- `part` — `price_history` no SQLite tem `part_id` FK. Se `part` migrar antes de `proposal`, os registros de `price_history` ficam com FK fantasma.
- `proposal` — referencia `users`, `parts`, `clients`, `commercial_conditions`, e é pai de `proposal_items` + `price_history`.
- `stock` — referencia `parts`, `proposals`, `clients`, `users`.
- `nota_recebida` — referencia `fornecedor`, `categoria_despesa`, `users`, `parts`.
- `conta_pagar` — referencia `fornecedor`, `nota_recebida`, `categoria_despesa`, `users`.

---

## 4. Comparação: Gradual vs Corte Limpo

### Caminho A — Continuar gradual (módulo a módulo)

**Ordem estimada:** `part` → `auth/user` → `fornecedor/categoria_despesa` → `stock` → `kanban` → `nota_recebida/conta_pagar` → `proposal`

**Vantagens:**
- Cada passo é menor e mais verificável
- Risco de regressão isolado por módulo
- Pode pausar e retomar a qualquer ponto
- Testes unitários (vi.spyOn) continuam passando após cada passo sem grandes adaptações

**Desvantagens:**
- Bridges se multiplicam. Estimativa conservadora:
  - Migrar `part`: `price_history` continua no SQLite com `part_id` FK para o PostgreSQL. FK fantasma sem enforcement. `proposal.service.js` chama `findPartByComposition`/`createPart` de forma síncrona dentro de `createProposalAtomic` — que usa `db.transaction()`. Migrar `part` obriga a quebrar a transação atômica OU converter toda a lógica de proposta para async antes da migração de proposal.
  - Migrar `auth/user`: `responsible_user_id`, `billed_by_user_id`, `execution_marked_by_user_id`, `approval_registered_by_user_id` em `proposals` (SQLite) apontariam para `users` no PostgreSQL. Sem FK enforcement no SQLite, os dados ficam órfãos sem sinalização. Idem para `stock_movements`, `kanban_tasks`, `notas_recebidas`, `contas_pagar`.
  - Migrar `fornecedor`: 2 novas bridges em `nota_recebida` e `conta_pagar`.
  - Cada passo depois de `part` ou `user` cria 2-5 novos pontos de inconsistência silenciosa.
- A Bridge 4 (clientes duplicados no SQLite e PostgreSQL) torna o fluxo de criação de proposta factualmente incorreto em produção. Um admin pode criar um cliente via tela de Clientes (PostgreSQL), mas o fluxo de proposta vai criar um duplicado no SQLite.
- **A Bridge 3 já está quebrada hoje:** `getProfitAnalysis` retorna dados incorretos para qualquer cliente criado após o Passo 3.5.3.
- Migrar `proposal` por último (como previsto) significa que todas essas inconsistências ficam vivas por mais 7-8 passos.
- **Risco mais crítico:** a combinação `part` migrado + `proposal` ainda em SQLite torna `createProposalAtomic` impossível de manter como transação única. Se o `part.repository.js` virar Prisma async, `findPartByComposition` e `createPart` dentro do fluxo síncrono exigirão refatoração parcial do `proposal.service.js` antes do tempo.
- **Estimativa de bridges acumuladas ao final (antes de migrar proposal):** 12-18 pontos de bridge.

**Tempo relativo:** 7-8 passos adicionais, cada um gerando débito técnico que o passo de `proposal` terá que limpar.

---

### Caminho B — Corte limpo controlado em grupos

**Sequência proposta:**

```
Grupo 1: auth/user
Grupo 2: part + part_client_price_references
Grupo 3: proposal + proposal_items + price_history   ← maior passo
Grupo 4: stock
Grupo 5: kanban
Grupo 6: fornecedor + categoria_despesa
Grupo 7: nota_recebida + itens_nota_recebida
Grupo 8: conta_pagar
```

**Racional da ordem:**
- `auth/user` primeiro: sem dependências dos outros SQLite. Desbloqueia todos os demais.
- `part` segundo: depende de `part_categories` (já Prisma) e `clients` (já Prisma). Remove `findCategoryByIdSync`. Sem bridges novas.
- `proposal` terceiro: com `users`, `parts`, `clients`, `commercial_conditions` todos em Prisma, a migração de `proposal` é limpa. Remove todas as 4 bridges existentes. `createProposalAtomic` vira uma transação Prisma real. `findOrCreateClient` vira async. `getProfitAnalysis` passa a funcionar corretamente.
- `stock`, `kanban`, `fornecedor/categoria_despesa`, `nota/conta` em ordem: cada um encontra suas dependências já em Prisma.

**Vantagens:**
- Após cada grupo migrado, o sistema fica mais limpo (sem bridges acumuladas).
- As 4 bridges atuais são eliminadas no Grupo 3.
- `createProposalAtomic` vira uma transação PostgreSQL real (ACID cross-tables).
- `getProfitAnalysis` funciona corretamente para todos os clientes.
- Fluxo de criação de proposta tem fonte única de verdade para clientes.
- Código final sem nenhuma bridge SQLite.

**Desvantagens:**
- O Grupo 3 (`proposal`) é o maior e mais arriscado: 429 linhas de repository, transações atômicas, geração de PDF, deduplicação de cliente assíncrona, adaptação de `createProposalAtomic`, adaptação dos testes de integração.
- Os testes de integração (`proposal-flow.test.js`) usam `createTestClient()` via SQLite in-memory. Após a migração de `proposal`, esses testes precisarão ser adaptados. Opções:
  1. Reescrever os testes de integração para usar Prisma com banco de teste (PostgreSQL de teste separado) — mais correto, mas mais trabalho.
  2. Converter `createTestClient` para usar Prisma Client mockado — simula o banco, não testa integração real.
  3. Manter os testes de integração como testes unitários com `vi.spyOn` no service — menos cobertura de integração real, mas sem dependência de banco externo.
- `kanban` ainda estará em SQLite quando `proposal` migrar. O `proposal.service.js` chama `addKanbanComment()` (kanban.repository, SQLite sync) de dentro de funções async. Isso funciona — uma função async pode chamar código síncrono sem await. Não é uma bridge perigosa.

**Tempo relativo:** 8 grupos, mas cada grupo é mais limpo. O Grupo 3 é denso — estimativa de 2-3x o trabalho do Grupo 1 ou 2. Porém evita 12-18 bridges que o Caminho A geraria.

---

## 5. Recomendação

### **Caminho B — Corte limpo por grupos sequenciais**

**Por quê:**

1. **As bridges atuais já estão causando inconsistência real em produção.** A Bridge 4 (cliente criado pela tela de Clientes não é encontrado pelo fluxo de proposta — cria duplicata no SQLite) é um bug funcional ativo, não uma dívida técnica futura. A Bridge 3 (`getProfitAnalysis` retornando dados incorretos) é outra inconsistência já ativa.

2. **O custo de continuar cresce com cada passo.** O Caminho A acumula bridges exponencialmente. Migrar `part` antes de `proposal` em particular cria uma inconsistência estrutural: `price_history.part_id` aponta para PostgreSQL enquanto `price_history` permanece no SQLite, sem FK enforcement. Isso é tecnicamente inaceitável para uma tabela que é o "diferencial central do sistema" (conforme SYSTEM_CONTEXT.md).

3. **A premissa mudou.** A estratégia de bridges foi adotada para preservar dados. Com dados descartáveis, bridges são dívida técnica sem benefício.

4. **O Grupo 3 (proposal) é trabalhoso mas único.** Em vez de pagar o custo em 8 parcelas menores com bridges, paga-se em um único passo maior e limpa-se tudo de uma vez.

5. **Os testes unitários (vi.spyOn) sobrevivem intactos.** Os 227 testes atuais são todos unitários mockados — nenhum deles vai quebrar com a mudança de estratégia. Apenas os testes de integração (`proposal-flow.test.js`) precisam de adaptação no Grupo 3.

---

## 6. Plano de Execução por Fases

### Fase 0 — Antes de começar (pré-requisito)

- Confirmar que `docker compose up -d postgres` está rodando
- Confirmar `npm run prisma:status` → `Database schema is up to date!`
- Criar seed mínimo em `scripts/seed-postgres.js`:
  ```javascript
  // admin padrão (admin / admin123)
  // Opcionalmente: 1-2 categorias, 1-2 condições comerciais de exemplo
  ```
- Validar: `npm test` → 227 passando

---

### Fase 1 — Migrar `auth/user` ✅ CONCLUÍDA

**Escopo:** `src/modules/auth/auth.repository.js`, `auth.service.js`, `auth.controller.js`

**Dependências Prisma já migradas:** nenhuma (auth é standalone)

**Bridges criadas:** nenhuma

**Arquivos alterados:**
- `src/modules/auth/auth.repository.js` — reescrito para Prisma async; `findUserById` sem `password_hash`; `countUsers`/`countAdmins` assíncronos
- `src/modules/auth/auth.service.js` — todas as funções async/await
- `src/modules/auth/auth.controller.js` — todos os handlers async
- `src/modules/proposal/proposal.controller.js` — fix: `await findAuthUserById` (uma linha)
- `tests/services/auth.service.test.js` — reescrito para vi.spyOn (33 testes, sem SQLite)
- `scripts/seed-postgres.js` — criado (idempotente, cria admin/admin123)
- `scripts/check-prisma-connection.js` — seção 7 adicionada (CRUD de usuário)

**Resultado:** `npm test` → 248 passando. `node scripts/seed-postgres.js` → admin criado. `node scripts/check-prisma-connection.js` → ✅ 7 seções.

---

### Fase 2 — Migrar `part` + `part_client_price_references` ✅ CONCLUÍDA

**Escopo:** `src/modules/part/part.repository.js`, `part.service.js`, `part.controller.js`

**Dependências Prisma já migradas:** `part_categories` (category), `clients` (client), `users` (Fase 1)

**Arquivos alterados:**
- `src/modules/part/part.repository.js` — reescrito Prisma async; mappers `mapPart()` e `mapPartRef()`; `findCategoryById` async; bridges SQLite para price_history e `findPartByComposition`
- `src/modules/part/part.service.js` — todas as funções async; `const repo = require(...)`; `buildInternalCode` async; sem `findCategoryByIdSync`
- `src/modules/part/part.controller.js` — todos os handlers async
- `src/modules/proposal/proposal.repository.js` — adicionada bridge sync `createPart` (auto-registro no fluxo de proposta)
- `src/modules/proposal/proposal.service.js` — importa `createPart` de `proposal.repository` (bridge sync) em vez de `part.repository`
- `tests/services/part.service.test.js` — reescrito para vi.spyOn (52 testes, sem SQLite)
- `scripts/check-prisma-connection.js` — seção 8 adicionada (CRUD de peça e ref de preço)

**Bridges temporárias criadas:**
- `findPartByComposition` (sync SQLite) em `part.repository.js` — usada por `proposal.service.js` e `migrate.js`; remover quando `proposal` migrar para Prisma
- `createPart` (sync SQLite) em `proposal.repository.js` — auto-registro de peças no fluxo de proposta; remover quando `proposal` migrar para Prisma
- `getPartPriceHistory`, `getPartPriceHistoryByClient`, `getPartLastPricePerClient` (sync SQLite) em `part.repository.js` — `price_history` não migrado; remover quando `proposal` migrar
- `getClientPriceRefs` em `part.repository.js` — híbrido: refs manuais de PostgreSQL + histórico de SQLite; remover quando `proposal` migrar

**Risco temporário — manual price refs vs proposal price suggestion:**
- `proposal.repository.js` → `getLastItemPriceForClient` consulta `part_client_price_references` no SQLite
- Novos refs criados via UI de Peças (Prisma) ficam no PostgreSQL — **não aparecerão na sugestão de preço** durante criação de proposta enquanto `proposal` não migrar
- Workaround: criar refs via API diretamente atualizará PostgreSQL; sugestão de preço continuará usando `price_history` do SQLite

**Resultado:** `npm test` → 281 passando. `node scripts/check-prisma-connection.js` → ✅ 8 seções.

---

### Fase 3 — Migrar `proposal` + `proposal_items` + `price_history` ✅ CONCLUÍDA

**Escopo:**
- `src/modules/proposal/proposal.repository.js` — reescrita completa para Prisma async
- `src/modules/proposal/proposal.service.js` — totalmente async; módulo-ref para vi.spyOn
- `src/modules/proposal/proposal.controller.js` — todos os handlers async; import fix findClientsByName
- `src/modules/client/client.repository.js` — bridges 2, 3 removidas (`countClientProposals`, `getProfitAnalysis` → Prisma)
- `src/modules/condition/condition.repository.js` — bridge 1 removida (`deleteCondition` → `prisma.$transaction`)
- `src/modules/part/part.repository.js` — bridges price_history, findPartByComposition → Prisma async

**Dependências Prisma já migradas:** `clients`, `commercial_conditions`, `users` (Fase 1), `parts` (Fase 2)

**Bridges removidas nesta fase:** todas as 4 bridges existentes (+ bridges price_history de part)

**Resultado:**
- `createProposalAtomic` usa `prisma.$transaction` — transação PostgreSQL real, ACID completa.
- `findOrCreateClient` completamente async via Prisma.
- `getProfitAnalysis` via `prisma.$queryRaw` — funciona para todos os clientes.
- `countClientProposals` via `prisma.proposal.count`.
- `findPartByComposition` async Prisma; `createPart` async Prisma via `partRepo`.
- `tests/integration/proposal-flow.test.js` reescrito com vi.spyOn (sem PostgreSQL real em testes).
- `tests/services/proposal.service.test.js` reescrito com vi.spyOn (24 testes, sem SQLite).
- `scripts/check-prisma-connection.js` — seção 9 adicionada (fluxo completo de proposta).
- `npm test` → **282 passando**. `node scripts/check-prisma-connection.js` → ✅ 9 seções.

**Bridges restantes após esta fase:**
- `part.repository.deletePart` → `stock_movements` check + `itens_nota_recebida` nulificação via SQLite (tabelas ainda não migradas — aguarda Fases 4 e 7)

---

### Fase 4 — Migrar `stock` ✅ CONCLUÍDA

**Escopo:** `src/modules/stock/stock.repository.js`, `stock.service.js`, `stock.controller.js`

**Dependências Prisma já migradas:** `parts` (Fase 2), `proposals` (Fase 3), `clients` (Passo 3.5.3), `users` (Fase 1)

**Arquivos alterados:**
- `src/modules/stock/stock.repository.js` — reescrito Prisma async; `mapStockMovement()`; `createMovement` e `createInventoryCount` via `prisma.$transaction`
- `src/modules/stock/stock.service.js` — totalmente async; `const repo = require(...)`
- `src/modules/stock/stock.controller.js` — todos os handlers async
- `src/modules/part/part.repository.js` — bridge `stock_movements` em `deletePart` removida → `prisma.stockMovement.count`
- `tests/services/stock.service.test.js` — 24 testes vi.spyOn (criado)
- `scripts/check-prisma-connection.js` — seção 10 adicionada (entrada, saída, contagem, filtro chart)

**Decisão técnica — movement_type 'contagem'**: O enum Prisma `MovementType` tem só `entrada`/`saida`. Movimentos de contagem são armazenados com `movementType: entrada|saida` + `entryType: 'contagem'`. O mapper `mapStockMovement()` restaura `movement_type: 'contagem'` na resposta, preservando o contrato com o frontend. `getMovementsByDate` filtra `entry_type != 'contagem'` para manter dados do gráfico corretos.

**Bridges removidas:** bridge `stock_movements` em `part.repository.deletePart`

**Bridges restantes após esta fase:**
- `part.repository.deletePart` → `itens_nota_recebida` nulificação via SQLite (aguarda Fase 7 — nota_recebida)

**Resultado:** `npm test` → **306 testes passando**. `node scripts/check-prisma-connection.js` → ✅ 10 seções.

---

### Fase 5 — Migrar `kanban` ✅ CONCLUÍDA

**Escopo:** `src/modules/kanban/kanban.repository.js`, `kanban.service.js`, `kanban.controller.js`

**Dependências Prisma já migradas:** `users` (Fase 1), `proposals` (Fase 3)

**Arquivos alterados:**
- `src/modules/kanban/kanban.repository.js` — reescrito Prisma async; `mapKanbanTask()` + `mapKanbanComment()`; `listCards()` via 2 queries paralelas (proposals + tasks) + merge JS com sort por `created_at`; relação polimórfica de `kanban_comments` preservada (sem FK)
- `src/modules/kanban/kanban.service.js` — totalmente async; `const repo = require(...)`
- `src/modules/kanban/kanban.controller.js` — todos os handlers async
- `src/modules/proposal/proposal.service.js` — `await` adicionado nos 4 `kanbanRepo.addComment(...)` (auto-comentários do sistema)
- `tests/services/kanban.service.test.js` — 24 testes vi.spyOn (criado)
- `scripts/check-prisma-connection.js` — seção 11 adicionada (task, mover status, comentário task, comentário polimórfico, limpeza)

**Decisão técnica — listCards (UNION)**: A query SQLite usava `UNION ALL` com `julianday()` para filtrar proposals antigas. Na versão Prisma, duas queries paralelas com `Promise.all` substituem o UNION — proposals com `NOT` filter para exclusão por data, tasks sem filtro. Merge em JS com `sort` por `created_at`. Equivalente funcional completo.

**Decisão técnica — kanban_comments polimórfico**: `cardId` não tem FK. Um comentário com `cardType: 'proposal'` e `cardId: proposta.id` não tem constraint de integridade no banco — validação de existência permanece no service (comportamento idêntico ao SQLite).

**Bridges removidas:** nenhuma (kanban não tinha bridges — era puro SQLite)

**Ajuste em proposal.service.js:** 4 chamadas `kanbanRepo.addComment(...)` receberam `await`. Try/catch do auto-comentário preservado. Comportamento idêntico ao anterior (falha do comentário loga e não propaga para o fluxo principal).

**Resultado:** `npm test` → **330 testes passando**. `node scripts/check-prisma-connection.js` → ✅ 11 seções.

---

### Fase 6 — Migrar `fornecedor` + `categoria_despesa` ✅ CONCLUÍDA

**Escopo:** `src/modules/fornecedor/`, `src/modules/categoria_despesa/`

**Dependências Prisma já migradas:** sem FKs problemáticas para outros módulos SQLite

**Arquivos alterados:**
- `src/modules/fornecedor/fornecedor.repository.js` — reescrito Prisma async; `mapFornecedor()`; `findFornecedorByCnpj` via `$queryRaw` (REPLACE); `listAllFornecedores`/`countVinculos`/`getFornecedorDetalhes` com SQLite bridges para notas/contas
- `src/modules/fornecedor/fornecedor.service.js` — totalmente async; `const repo = require(...)`; `checkDupCnpj` async
- `src/modules/fornecedor/fornecedor.controller.js` — todos os 7 handlers async
- `src/modules/categoria_despesa/categoria_despesa.repository.js` — reescrito Prisma async; `mapCategoriaDespesa()`; `countUsoCategoria` com SQLite bridge para notas/contas
- `src/modules/categoria_despesa/categoria_despesa.service.js` — totalmente async; `const repo = require(...)`
- `src/modules/categoria_despesa/categoria_despesa.controller.js` — todos os 4 handlers async
- `tests/services/fornecedor.service.test.js` — 15 testes vi.spyOn (criado)
- `tests/services/categoria_despesa.service.test.js` — 10 testes vi.spyOn (criado)
- `scripts/check-prisma-connection.js` — seções 12+13 adicionadas (CRUD fornecedor + findByCnpj via $queryRaw; CRUD categoria)

**Decisão técnica — findFornecedorByCnpj**: CNPJ pode ter formatação variável. A query usa `REPLACE` aninhado para normalizar (igual ao comportamento SQLite). Prisma não suporta `REPLACE` em WHERE nativo — `$queryRaw` com tagged template. Resultado já em snake_case (colunas do PostgreSQL). Service lê apenas `id` e `razao_social` da resposta.

**Bridges mantidas** (notas e contas ainda em SQLite):
- `fornecedor.repository.listAllFornecedores` — counts de notas/contas via `db.prepare(...).get(id)` por linha
- `fornecedor.repository.countVinculos` — counts diretos via SQLite
- `fornecedor.repository.getFornecedorDetalhes` — detalhe de notas (com JOIN categorias_despesa) e contas via SQLite
- `categoria_despesa.repository.countUsoCategoria` — counts diretos via SQLite

**Bridges removidas:** nenhuma (módulos eram puros SQLite sem bridges pré-existentes)

**Resultado:** `npm test` → **355 testes passando**. `node scripts/check-prisma-connection.js` → ✅ 13 seções.

**Dependências Prisma já migradas:** sem FKs problemáticas para outros módulos SQLite

---

### Fase 7 — Migrar `nota_recebida` + `itens_nota_recebida`

**Dependências Prisma já migradas:** `fornecedor` (Fase 6), `categoria_despesa` (Fase 6), `users` (Fase 1), `parts` (Fase 2)

---

### Fase 8 — Migrar `conta_pagar`

**Dependências Prisma já migradas:** `fornecedor` (Fase 6), `nota_recebida` (Fase 7), `categoria_despesa` (Fase 6), `users` (Fase 1)

---

### Fase Final — Limpeza

Após todas as fases:
- Remover `src/db/init.js` e `src/db/migrate.js` (substituídos por Prisma migrations)
- Remover chamadas a `init.js`/`migrate.js` em `src/server.js`
- Atualizar `src/db/connection.js` — manter apenas para `sessionStore.js` (sessions.sqlite)
- Remover `better-sqlite3` de `dependencies` (manter apenas para `sessionStore.js` ou migrar sessions para outro store)
- Apagar `database.sqlite`

---

## 7. Riscos Identificados

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Fase 3 (proposal) introduz regressão no fluxo de PDF | Média | Alto | Testar manualmente geração de proposta antes de declarar sucesso |
| Testes de integração quebram após Fase 3 | Alta | Médio | Adaptar fixtures para usar Prisma mock ou criar banco de teste |
| `createProposalAtomic` Prisma não tem o mesmo comportamento de rollback que SQLite | Baixa | Alto | Testar criação de proposta com falha forçada intermediária |
| `findOrCreateClient` async muda comportamento de race condition | Baixa | Médio | Sem mudança funcional — apenas await em chamadas já existentes |
| Sessions perdidas se `sessionStore.js` for migrado incorretamente | Alta | Baixo | Não migrar sessionStore — manter em SQLite separado |

---

## 8. Próxima Ação Recomendada

**Executar a Fase 6: migrar `fornecedor` + `categoria_despesa` para Prisma.**

Ambos são simples (sem dependências cruzadas problemáticas). Desbloqueiam a Fase 7 (`nota_recebida`) que depende dos dois. Após migrar `nota_recebida`, a bridge restante em `part.repository.deletePart` (nulificação de `itens_nota_recebida`) também pode ser removida.

Ordem recomendada das fases restantes: `fornecedor + categoria_despesa` → `nota_recebida + itens_nota_recebida` → `conta_pagar` → Limpeza Final.

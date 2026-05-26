# Prisma — Setup e Guia de Uso

## Estado atual (Passo 3.6 — Fase Final concluída)

Prisma 7.x instalado, PostgreSQL local via Docker Compose, schema Prisma completo migrado (`20260525153903_init_schema`). **Todos os módulos de negócio migrados para Prisma**. **Limpeza SQLite concluída**: `src/db/init.js`, `src/db/migrate.js` e `src/db/connection.js` removidos. `src/db/` contém apenas `prisma.js`. `better-sqlite3` mantido exclusivamente para `sessionStore.js`.

`npm run prisma:status` → `Database schema is up to date!`
`node scripts/check-prisma-connection.js` → ✅ 15 seções (inclui CRUD real de conta_pagar + aggregate + groupBy)
`node scripts/seed-postgres.js` → cria usuário admin inicial no PostgreSQL (idempotente)

**Runtime PostgreSQL/Prisma** (fonte única de verdade — todos os módulos de negócio): `category`, `responsavel`, `objeto`, `condition`, `client`, `auth/user`, `part`, `proposal`, `proposal_items`, `price_history`, `stock_movements`, `kanban_tasks`, `kanban_comments`, `fornecedores`, `categorias_despesa`, `notas_recebidas`, `itens_nota_recebida`, `contas_pagar`

**Runtime SQLite/better-sqlite3** (infraestrutura apenas): `session` (sessionStore.js → `sessions.sqlite`)

**Bridges restantes**: Nenhuma. `src/db/connection.js` removido. O único uso de `better-sqlite3` é:
- `src/middleware/sessionStore.js` → armazenamento de sessões (não migrar)

**`/health` endpoint**: usa `prisma.$queryRaw\`SELECT 1\`` para checar PostgreSQL. Resposta: `{ ok, db: "postgres", prisma: true, sessionStore: "sqlite" }`.

**Nota sobre movement_type 'contagem'**: O enum Prisma `MovementType` tem apenas `entrada` e `saida`. Movimentos de contagem de estoque são armazenados com `movementType: entrada|saida` + `entryType: 'contagem'`. O mapper `mapStockMovement()` converte de volta para `movement_type: 'contagem'` na resposta da API, preservando o contrato com o frontend.

**Nota sobre kanban_comments (relação polimórfica)**: `kanban_comments` usa `card_type` + `card_id` sem FK real. `cardId` não tem FK no schema (campo polimórfico — pode apontar para proposal ou task). Validação de integridade permanece no `kanban.service.js`.

---

## Estrutura criada

```
prisma/
  schema.prisma                              # generator prisma-client-js + datasource PostgreSQL + 19 models
  migrations/
    20260525153903_init_schema/
      migration.sql                          # DDL completo: enums, tabelas, constraints, indexes, FKs
prisma.config.ts                             # config Prisma 7 — datasource URL via DATABASE_URL
docker-compose.yml                           # PostgreSQL 16-alpine local para desenvolvimento
src/generated/prisma/                        # client gerado por `prisma generate` (gitignored)
src/db/prisma.js                             # singleton PrismaClient com @prisma/adapter-pg + pg.Pool
src/modules/category/
  category.repository.js                     # migrado para Prisma (async)
  category.service.js                        # async/await — usa const repo = require(...)
  category.controller.js                     # async/await
src/modules/responsavel/
  responsavel.repository.js                  # migrado para Prisma (async)
  responsavel.service.js                     # async/await — usa const repo = require(...)
  responsavel.controller.js                  # async/await
src/modules/objeto/
  objeto.repository.js                       # migrado para Prisma (async)
  objeto.service.js                          # async/await — usa const repo = require(...)
  objeto.controller.js                       # async/await
src/modules/condition/
  condition.repository.js                    # migrado para Prisma (async) + SQLite para proposals
  condition.service.js                       # async/await — usa const repo = require(...)
  condition.controller.js                    # async/await
src/modules/client/
  client.repository.js                       # migrado para Prisma (async) + SQLite bridges para countClientProposals/getProfitAnalysis
  client.service.js                          # async/await — usa const repo = require(...)
  client.controller.js                       # async/await — usa const service = require(...)
src/modules/auth/
  auth.repository.js                         # migrado para Prisma (async) — findUserById sem password_hash
  auth.service.js                            # async/await — usa const repo = require(...)
  auth.controller.js                         # async/await
src/modules/part/
  part.repository.js                         # migrado para Prisma (async) + SQLite bridges price_history + bridge findPartByComposition
  part.service.js                            # async/await — usa const repo = require(...)
  part.controller.js                         # async/await
src/modules/kanban/
  kanban.repository.js                       # migrado para Prisma (async) + mapKanbanTask() + mapKanbanComment()
  kanban.service.js                          # async/await — const repo = require(...)
  kanban.controller.js                       # async/await
src/modules/fornecedor/
  fornecedor.repository.js                   # migrado para Prisma (async) + mapFornecedor() — sem bridges
  fornecedor.service.js                      # async/await — const repo = require(...)
  fornecedor.controller.js                   # async/await
src/modules/categoria_despesa/
  categoria_despesa.repository.js            # migrado para Prisma (async) + mapCategoriaDespesa() — sem bridges
  categoria_despesa.service.js               # async/await — const repo = require(...)
  categoria_despesa.controller.js            # async/await
src/modules/nota_recebida/
  nota_recebida.repository.js                # migrado para Prisma (async) + mapNotaRecebida() + mapItemNotaRecebida() — sem bridges
  nota_recebida.service.js                   # async/await — const repo = require(...)
  nota_recebida.controller.js                # async/await
src/modules/conta_pagar/
  conta_pagar.repository.js                  # migrado para Prisma (async) + mapContaPagar() + getResumoFinanceiro (aggregate + groupBy)
  conta_pagar.service.js                     # async/await — const repo = require(...)
  conta_pagar.controller.js                  # async/await
src/modules/stock/
  stock.repository.js                        # migrado para Prisma (async) + mapStockMovement()
  stock.service.js                           # async/await — const repo = require(...)
  stock.controller.js                        # async/await
src/modules/proposal/
  proposal.repository.js                     # migrado para Prisma (async) — sem bridges
  proposal.controller.js                     # async/await — import fix findClientsByName
  proposal.service.js                        # async/await — module-ref para vi.spyOn
tests/services/category.service.test.js      # 18 testes — mock via vi.spyOn
tests/services/responsavel.service.test.js   # 11 testes — mock via vi.spyOn
tests/services/objeto.service.test.js        # 16 testes — mock via vi.spyOn
tests/services/condition.service.test.js     # 20 testes — mock via vi.spyOn
tests/services/client.service.test.js        # 23 testes — mock via vi.spyOn
tests/services/auth.service.test.js          # 33 testes — mock via vi.spyOn (reescrito para Prisma)
tests/services/part.service.test.js          # 52 testes — mock via vi.spyOn (reescrito para Prisma)
tests/services/stock.service.test.js         # 24 testes — mock via vi.spyOn (criado para Prisma)
tests/services/kanban.service.test.js        # 24 testes — mock via vi.spyOn (criado para Prisma)
tests/services/fornecedor.service.test.js    # 15 testes — mock via vi.spyOn (criado para Prisma)
tests/services/categoria_despesa.service.test.js # 10 testes — mock via vi.spyOn (criado para Prisma)
tests/services/nota_recebida.service.test.js # 25 testes — mock via vi.spyOn (criado para Prisma)
tests/services/conta_pagar.service.test.js   # 28 testes — mock via vi.spyOn (criado para Prisma)
scripts/check-prisma-connection.js           # validação de conexão real (seções 1-15)
scripts/seed-postgres.js                     # cria usuário admin inicial no PostgreSQL (idempotente)
```

---

## Subindo o banco local (recomendado: Docker Compose)

O `docker-compose.yml` já está na raiz do projeto. Para iniciar:

```bash
# Subir apenas o PostgreSQL em background
docker compose up -d postgres

# Verificar status
docker compose ps

# Ver logs se necessário
docker compose logs postgres
```

Configurações do banco local:

| Parâmetro | Valor |
|-----------|-------|
| Usuário | `ghtec` |
| Senha | `ghtec123` |
| Banco | `ghtec_propostas` |
| Porta | `5432` |
| Container | `ghtec-postgres` |
| Volume | `postgres_data` (persistente) |

O `.env` já tem o `DATABASE_URL` correspondente:
```env
DATABASE_URL="postgresql://ghtec:ghtec123@localhost:5432/ghtec_propostas"
```

---

## Alternativa manual (docker run)

Se preferir sem o `docker-compose.yml`:

```bash
docker run -d \
  --name ghtec-postgres \
  -e POSTGRES_USER=ghtec \
  -e POSTGRES_PASSWORD=ghtec123 \
  -e POSTGRES_DB=ghtec_propostas \
  -p 5432:5432 \
  postgres:16-alpine
```

O recomendado é usar `docker compose` porque o arquivo fica versionado no projeto e garante consistência entre desenvolvedores.

---

## Scripts disponíveis

| Script | Comando | Quando usar |
|--------|---------|-------------|
| `npm run prisma:generate` | `prisma generate` | Após alterar `schema.prisma` |
| `npm run prisma:migrate` | `prisma migrate dev` | Para criar/aplicar migrations (PostgreSQL deve estar rodando) |
| `npm run prisma:status` | `prisma migrate status` | Verificar estado das migrations |
| `npm run prisma:studio` | `prisma studio` | Interface visual do banco |

---

## Estado atual do banco

Migration `20260525153903_init_schema` aplicada. O PostgreSQL (via Docker Compose) tem todas as 19 tabelas, 6 enums, indexes e foreign keys da aplicação.

Verificar status (após `docker compose up -d postgres`):
```bash
npm run prisma:status
# Resultado: "Database schema is up to date!"
```

### O que a migration criou

| Categoria | Conteúdo |
|-----------|----------|
| Enums | `Role`, `KanbanStatus`, `MovementType`, `ContaStatus`, `NotaStatus`, `TipoNota` |
| Tabelas | 19 — todas as entidades do sistema |
| Cascades | `proposal_items`, `price_history` e `itens_nota_recebida` com `ON DELETE CASCADE` |
| Uniques críticos | `proposals.numero_proposta`, `parts.codigo_interno`, `parts(nome,marca,modelo)`, `part_client_price_references(part_id,client_id)`, `notas_recebidas(fornecedor_id,numero_nota,serie)` |
| FKs | `proposals` → `clients` com `ON DELETE RESTRICT` (não apaga cliente com propostas) |
| Sem FK | `kanban_comments.card_id` (relação polimórfica — validação no service) |

---

## Workflow de desenvolvimento

1. Editar `prisma/schema.prisma` com os models desejados
2. `npm run prisma:generate` — atualiza o client em `src/generated/prisma/`
3. `npm run prisma:migrate` — cria arquivo SQL em `prisma/migrations/` e aplica ao PostgreSQL
4. Usar o client: `const { PrismaClient } = require('../generated/prisma')`

---

## Arquivos que NÃO devem ser commitados

- `.env` (credenciais reais)
- `src/generated/prisma/` (código gerado — já no `.gitignore`)

---

## Próximos passos

- ~~**Passo 3.3:** Definir schema completo~~ — **concluído**
- ~~**Passo 3.4:** Criar primeira migration (`20260525153903_init_schema`)~~ — **concluído**
- ~~**Passo 3.5.1:** Migrar módulo `category`~~ — **concluído**
- ~~**Passo 3.5.1.1:** Configurar driver adapter PostgreSQL (`@prisma/adapter-pg` + `pg`)~~ — **concluído**
- ~~**Passo 3.5.2:** Migrar `responsavel`, `objeto`, `condition`~~ — **concluído**
- ~~**Passo 3.5.3:** Migrar `client`~~ — **concluído**
- ~~**Passo 3.5.5:** Migrar `auth/user`~~ — **concluído**
- ~~**Passo 3.5.6:** Migrar `part` + `part_client_price_references`~~ — **concluído**
- ~~**Passo 3.5.x:** Migrar demais repositories de better-sqlite3 para Prisma Client~~ — **concluído**
  - ~~`proposal`~~ ✅ — ~~`stock`~~ ✅ — ~~`kanban`~~ ✅ — ~~`fornecedor`~~ ✅ — ~~`categoria_despesa`~~ ✅ — ~~`nota_recebida`~~ ✅ — ~~`conta_pagar`~~ ✅
- ~~**Passo 3.6:** Fase Final de limpeza~~ — **concluído** (`init.js`, `migrate.js`, `connection.js` removidos; `/health` usa Prisma; `errorHandler` com P2002/P2003/P2025)
- ~~**Passo 3.7:** Atualizar `errorHandler.js` para códigos de erro Prisma (`P2002`, `P2003`, `P2025`)~~ — **concluído junto com Passo 3.6**
- **Passo 3.8:** Deploy com PostgreSQL em produção — próximo passo

# Prisma — Setup e Guia de Uso

## Estado atual (Passo 3.5.3 — concluído)

Prisma 7.x instalado, PostgreSQL local via Docker Compose, schema Prisma completo migrado (`20260525153903_init_schema`). **Módulos `category`, `responsavel`, `objeto`, `condition` e `client` migrados para Prisma** — repositories, services e controllers todos async/await. **Runtime Prisma configurado com driver adapter `@prisma/adapter-pg` + `pg`.**

`npm run prisma:status` → `Database schema is up to date!`
`node scripts/check-prisma-connection.js` → ✅ SELECT 1, CRUD de categorias, responsáveis, objetos, condições comerciais e clientes

**Runtime híbrido**: `category`, `responsavel`, `objeto`, `condition`, `client` → Prisma/PostgreSQL. Os demais módulos ainda usam `better-sqlite3` via `src/db/connection.js`.

**Nota crítica — `deleteCondition`**: ao deletar uma condição comercial, o código primeiro nulifica `commercial_condition_id` nas propostas via SQLite (tabela `proposals` ainda não migrada), depois deleta do PostgreSQL via Prisma. Isso preserva integridade referencial durante a fase híbrida.

**Nota crítica — bridges em `proposal.repository.js`**: as 6 funções de cliente (`findClientByCnpj`, `findClientsByName`, `findClientsByExactName`, `findClientById`, `createClient`, `searchClients`) foram movidas para implementações SQLite locais no próprio `proposal.repository.js`. Isso mantém o fluxo de criação de propostas síncrono e preserva os testes de integração (que inserem clientes via SQLite em memória). Ao migrar `proposals` para Prisma, substituir essas bridges por chamadas async ao `client.repository`.

**Nota crítica — `countClientProposals` e `getProfitAnalysis`**: permanecem como bridges SQLite síncronas em `client.repository.js`. O service chama `repo.countClientProposals(id)` sem `await`. O `getProfitAnalysis` faz JOIN com `proposals`, `proposal_items`, `price_history` e `parts` — todos ainda em SQLite. Quando `proposals` migrar, essas funções devem ser reescritas em Prisma.

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
src/modules/proposal/
  proposal.repository.js                     # SQLite bridges locais para 6 funções de cliente (proposal flow síncrono)
tests/services/category.service.test.js      # 18 testes — mock via vi.spyOn
tests/services/responsavel.service.test.js   # 11 testes — mock via vi.spyOn
tests/services/objeto.service.test.js        # 16 testes — mock via vi.spyOn
tests/services/condition.service.test.js     # 20 testes — mock via vi.spyOn
tests/services/client.service.test.js        # 23 testes — mock via vi.spyOn
scripts/check-prisma-connection.js           # validação de conexão real (rodar manualmente)
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
- **Passo 3.5.x:** Migrar demais repositories de better-sqlite3 para Prisma Client
  - Ordem recomendada: `part` → `auth` → `fornecedor`/`categoria_despesa` → `stock` → `kanban` → `nota_recebida`/`conta_pagar` → `proposal` (por último)
  - Ao migrar `part.repository`, remover `findCategoryByIdSync` de `part.service.js` e usar o category repository async
  - Ao migrar `proposal`, substituir as 6 bridges locais de client em `proposal.repository.js` por chamadas async ao `client.repository`, e migrar `countClientProposals`/`getProfitAnalysis` de `client.repository.js` para Prisma
  - Padrão obrigatório: services usam `const repo = require(...)` (não destructuring) para que `vi.spyOn` funcione nos testes
  - Cada módulo: repository async + service com `await` + atualizar testes
- **Passo 3.6:** Atualizar `errorHandler.js` para códigos de erro Prisma (`P2002`, `P2003`, `P2025`)
- **Passo 3.7:** Deploy com PostgreSQL em produção

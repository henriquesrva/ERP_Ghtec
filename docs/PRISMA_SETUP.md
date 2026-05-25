# Prisma — Setup e Guia de Uso

## Estado atual (Passo 3.4 — concluído)

Prisma 7.x instalado, PostgreSQL local via Docker Compose, schema Prisma completo (19 models, 6 enums) definido **e migrado**. Primeira migration criada e aplicada: `20260525153903_init_schema`. PostgreSQL agora tem todas as tabelas da aplicação.

`npm run prisma:status` → `Database schema is up to date!`

**O runtime da aplicação ainda usa `better-sqlite3` via `src/db/connection.js`** — nenhum repository ou service foi alterado.

---

## Estrutura criada

```
prisma/
  schema.prisma                          # datasource PostgreSQL + generator + 19 models completos
  migrations/
    20260525153903_init_schema/
      migration.sql                      # DDL completo: enums, tabelas, constraints, indexes, FKs
prisma.config.ts                         # config Prisma 7 — datasource URL via DATABASE_URL
docker-compose.yml                       # PostgreSQL 16-alpine local para desenvolvimento
src/generated/prisma/                    # client gerado por `prisma generate` (gitignored)
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
- **Passo 3.5:** Migrar repositories de better-sqlite3 para Prisma Client (módulo por módulo — mais simples primeiro)
  - Ordem recomendada: `category` → `responsavel`/`objeto`/`condition` → `client` → `part` → `auth` → `fornecedor`/`categoria_despesa` → `stock` → `kanban` → `nota_recebida`/`conta_pagar` → `proposal` (por último)
  - Cada módulo: repository async + service com `await` + atualizar testes
- **Passo 3.6:** Atualizar `errorHandler.js` para tratar códigos de erro Prisma (`P2002`, `P2003`, `P2025`)
- **Passo 3.7:** Deploy com PostgreSQL em produção

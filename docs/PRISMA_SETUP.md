# Prisma — Setup e Guia de Uso

## Estado atual (Passo 3.2)

Prisma 7.x instalado e configurado. PostgreSQL local configurado via Docker Compose.
**O runtime da aplicação ainda usa `better-sqlite3` via `src/db/connection.js`** — nenhum repository ou service foi alterado.

---

## Estrutura criada

```
prisma/
  schema.prisma        # datasource PostgreSQL + generator (sem models ainda)
  migrations/          # criado por `prisma migrate dev` quando models forem adicionados
prisma.config.ts       # config Prisma 7 — datasource URL via DATABASE_URL
docker-compose.yml     # PostgreSQL 16-alpine local para desenvolvimento
src/generated/prisma/  # client gerado por `prisma generate` (gitignored)
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

Neste momento (Passo 3.2), o banco PostgreSQL está acessível via Docker Compose mas **não tem tabelas da aplicação** — o schema Prisma ainda está mínimo (sem models). As tabelas serão criadas quando o schema completo for definido e `prisma migrate dev` for executado (Passo 3.3+).

Verificar status:
```bash
docker compose up -d postgres
npm run prisma:status
# Esperado: "No migrations found" — normal neste passo
```

---

## Workflow de desenvolvimento (quando schema tiver models)

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

- **Passo 3.3:** Definir schema completo em `prisma/schema.prisma` (todos os models)
- **Passo 3.4:** Criar primeira migration a partir do schema (`prisma migrate dev --name init_schema`)
- **Passo 3.5:** Migrar repositories de better-sqlite3 para Prisma Client (módulo por módulo)
- **Passo 3.6:** Migrar services para async/await e atualizar errorHandler para erros Prisma
- **Passo 3.7:** Deploy com PostgreSQL em produção

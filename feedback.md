# Feedback — Passo 3.7 (Checklist Pré-Deploy PostgreSQL)

## O que foi feito

Revisão e preparação do projeto para deploy em produção com PostgreSQL.

## Auditoria — estado encontrado

| Item | Estado |
|------|--------|
| `server.js` | ✅ Limpo — sem migrate, sem init, sem SQLite |
| `scripts/seed-postgres.js` | ✅ Idempotente, avisa sobre senha admin123 |
| `src/middleware/sessionStore.js` | ✅ Conexão própria com `sessions.sqlite` |
| `/health` | ✅ Usa `prisma.$queryRaw`, retorna `{ db: "postgres", prisma: true, sessionStore: "sqlite" }` |
| `errorHandler.js` | ✅ P2002/P2003/P2025 mapeados |
| `.env.example` | ⚠️ Comentário desatualizado sobre SQLite → corrigido |
| `package.json` | ⚠️ Sem `start` e sem `prisma:deploy` → adicionados |
| `docs/DEPLOY_POSTGRES.md` | ❌ Não existia → criado |

## Arquivos alterados

- `.env.example` — comentário desatualizado sobre SQLite removido; comentário sobre DATABASE_URL atualizado
- `package.json` — adicionados scripts `start` e `prisma:deploy`
- `docs/DEPLOY_POSTGRES.md` — criado (checklist completo de deploy)
- `docs/SYSTEM_CONTEXT.md` — referência ao DEPLOY_POSTGRES.md adicionada no how-to
- `docs/POSTGRES_CUTOVER_PLAN.md` — próximos passos apontam para DEPLOY_POSTGRES.md

## Scripts de produção confirmados

| Script | Comando | Uso |
|--------|---------|-----|
| `npm start` | `node src/server.js` | Iniciar servidor em produção |
| `npm run prisma:deploy` | `prisma migrate deploy` | Aplicar migrations em produção (sem interatividade) |
| `npm run prisma:generate` | `prisma generate` | Gerar client antes de subir |
| `npm test` | `vitest run` | Testes (não precisam de banco) |

## Pontos documentados no DEPLOY_POSTGRES.md

- SessionStore em `sessions.sqlite` local — aviso sobre armazenamento efêmero em nuvem
- Seed idempotente + aviso de troca de senha
- `prisma:deploy` vs `prisma migrate dev` (nunca usar dev em produção)
- `check-prisma-connection.js` cria e remove dados de teste (aviso explícito)
- Infraestrutura recomendada (PM2, nginx, volume persistente)
- Troubleshooting dos erros mais comuns

## Validações

- `npm run prisma:status` → `Database schema is up to date!`
- `npm run prisma:generate` → OK
- `npm test` → **408 testes passando** (18 arquivos)
- `node scripts/check-prisma-connection.js` → **15 seções OK**

## Próximo passo

Executar o deploy em produção seguindo `docs/DEPLOY_POSTGRES.md`.

# Feedback — Passo 3.5.1.1

## O que foi feito

- `npm install @prisma/adapter-pg pg` — instalados
- `src/db/prisma.js` — reescrito com `pg.Pool` + `PrismaPg` adapter; removido guard `NODE_ENV=test`
- `prisma/schema.prisma` — comentário desatualizado corrigido (provider era dito "prisma-client", agora "prisma-client-js" + nota sobre adapter)
- `scripts/check-prisma-connection.js` — script de validação de conexão real (rodar manualmente)
- `docs/PRISMA_SETUP.md` — atualizado: Passo 3.5.1.1 concluído, estrutura atualizada, pendência de runtime removida
- `docs/SYSTEM_CONTEXT.md` — atualizado: Prisma em uso no runtime (category), DATABASE_URL agora afeta runtime

**Validações:**
- `npm test` → ✅ 157/157
- `npm run prisma:generate` → ✅ Prisma Client gerado
- `npm run prisma:status` → ✅ Database schema is up to date!
- `node scripts/check-prisma-connection.js` → ✅ SELECT 1 + CRUD categorias no PostgreSQL real

---

## Decisões tomadas

### Adapter `@prisma/adapter-pg` em vez de `accelerateUrl`

O approach anterior (`PrismaClient({ accelerateUrl: DATABASE_URL })`) exige que a DATABASE_URL seja no formato `prisma+postgres://` (via `prisma dev`). O projeto usa `postgresql://` diretamente — isso funcionou para o CLI mas nunca para o runtime. O driver adapter é o caminho correto para produção com PostgreSQL real.

### Remoção do guard `NODE_ENV=test`

Com o adapter, `pg.Pool` e `PrismaClient` têm construção lazy — não conectam ao banco na importação. Os testes de unidade mockam o repository via `vi.spyOn`, nunca acionando uma query real. Guardar `NODE_ENV=test → {}` era desnecessário e impedia testes de integração reais no futuro.

### Script separado, não teste vitest

O teste de conexão real requer PostgreSQL rodando. Se incluído no `npm test`, quebraria CI/CD sem banco disponível. O script `scripts/check-prisma-connection.js` é a solução correta — manual, explicito, sem risco.

---

## Estado de runtime confirmado

- `DATABASE_URL=postgresql://ghtec:ghtec123@localhost:5432/ghtec_propostas` → funciona
- Prisma conecta ao banco, executa SELECT 1, cria e deleta categorias reais
- Módulo `category` está pronto para uso em produção via Prisma/PostgreSQL

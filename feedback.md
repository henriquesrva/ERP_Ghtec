# Feedback — Passo 3.3.1: Revisão técnica do schema

## 1. Revisão dos 5 pontos pendentes

### Ponto 1 — `@@unique([nome, marca, modelo])` em Part

**Decisão: manter como está.**

Verificado: `marca` e `modelo` são `String?` (nullable). O `createPart` e `updatePart` do `part.repository.js` não incluem `marca` e `modelo` no INSERT/UPDATE — esses campos nunca são escritos pela aplicação atual. O `findPartByComposition` coerce explicitamente para `null` com `marca || null, modelo || null`.

PostgreSQL e SQLite se comportam identicamente: em constraints UNIQUE multi-coluna, NULLs são tratados como distintos, então múltiplas linhas `(nome='X', marca=NULL, modelo=NULL)` são permitidas em ambos. `@@unique([nome, marca, modelo])` é semanticamente correto e produz comportamento equivalente.

Não há risco na migration. Campos deixados como `String?`.

---

### Ponto 2 — `NotaRecebida.dataEntrada DateTime` obrigatório

**Decisão: manter como `DateTime` obrigatório.**

Verificado no `nota_recebida.service.js`: `if (!data.data_entrada) { throw error }` — campo sempre validado antes de chegar ao repository. Valores vêm do frontend como strings ISO 8601 (`"2026-05-25"` ou `"2026-05-25T..."`). Prisma aceita ambos os formatos.

Dado que os dados atuais serão sacrificados e a aplicação já garante o campo, `DateTime NOT NULL` é correto. Sem mudança.

---

### Ponto 3 — Campos monetários Decimal

**Decisão: schema correto, com uma nota de atenção futura.**

Verificado: todos os campos de dinheiro estão como `Decimal @db.Decimal(15, 2)`. Alíquotas e quantidades fiscais usam `@db.Decimal(6, 4)` ou `@db.Decimal(15, 4)` — adequado.

**Atenção futura (não é bloqueio):** `formatCurrency()` usa `Intl.NumberFormat.format(value)` que espera `number`, não `Decimal`. Quando os repositories forem migrados para Prisma, os campos Decimal precisarão ser convertidos (`Number(decimal)` ou `decimal.toNumber()`) antes de chamar `formatCurrency()`. Isso é concern da Fase 4, não do schema.

Sem mudança no schema.

---

### Ponto 4 — `KanbanComment.userId` sem FK

**Decisão: manter sem FK.**

Verificado: `user_id` nos comentários automáticos do `proposal.service.js` usa `user_id: userId` — sempre o ID do usuário logado, nunca 0. `user_nome: "Sistema"` é apenas um override de exibição.

Tecnicamente uma FK seria possível. Mas mantemos sem FK por consistência com o design polimórfico do model (o `card_id` também não tem FK). Adicionar FK ao `userId` criaria assimetria e adicionaria `KanbanComment[]` ao User model sem utilidade prática (não há query que liste todos os comentários de um usuário). Sem mudança.

---

### Ponto 5 — `Part.precoCompra Decimal NOT NULL`

**Decisão: manter NOT NULL.**

Verificado: o `part.service.js` valida `preco === null || preco < 0` → erro de VALIDATION antes de qualquer INSERT. O repository passa `preco_compra: data.preco_compra ?? null` mas isso é dead path — o service já garante que preco é válido.

O SQLite adicionou a coluna via ALTER TABLE sem DEFAULT e sem NOT NULL — então dados legados podem ter NULL. Como os dados serão sacrificados e a migration parte do zero, `NOT NULL` é a decisão correta. Sem mudança.

---

## 2. Bug corrigido no schema

**`Proposal.client` apontava para `CommercialCondition` com nome errado.**

Renomeado para `Proposal.commercialCondition CommercialCondition?` — nome semanticamente correto. O campo anterior `client` era confuso por parecer que apontava para `Client`.

## 3. Arquivos alterados

- `prisma/schema.prisma` — bug corrigido: `client CommercialCondition?` → `commercialCondition CommercialCondition?`
- `docs/PRISMA_SETUP.md` — corrigidas duas inconsistências textuais:
  - Seção "Estado atual do banco" ainda dizia "Neste momento (Passo 3.2)" — corrigido para refletir estado atual (schema completo, migration pendente)
  - Linha "migrations/ criado quando models forem adicionados" — atualizada para "ainda não executado"

## 4. Validações

- `npm run prisma:generate` — ✅ sucesso após correção do bug de naming
- `npm run prisma:status` — não executado (Docker não disponível)
- `npm test` — ✅ 137/137 passando em 594ms

## 5. Estado do runtime

- Aplicação continua 100% SQLite/better-sqlite3
- Nenhum repository, service ou controller foi alterado

## 6. Próximo passo

**Schema aprovado para migration.** Nenhum bloqueio técnico identificado.

Próximo passo: **Passo 3.4 — criar a primeira migration** (`docker compose up -d postgres` + `npm run prisma:migrate` com nome `init_schema`).

Antes de rodar: confirmar com o usuário que os dados do `database.sqlite` atual podem ser sacrificados, conforme previsto no plano.

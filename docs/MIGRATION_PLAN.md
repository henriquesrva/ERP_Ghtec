# MIGRATION_PLAN.md — GHTec Propostas

**Data da análise:** 2026-05-25  
**Objetivo:** Diagnóstico técnico profundo e plano de migração SQLite + better-sqlite3 + migrate.js → PostgreSQL + Prisma + migrations versionadas.

> **Contexto:** Esta análise foi produzida por 5 subagentes especializados (arquitetura, banco de dados, backend, frontend/UX, documentação/testes) que leram todos os arquivos relevantes do projeto. Os dados atuais podem ser sacrificados para uma migração mais limpa.

---

## Índice

1. [Diagnóstico Geral](#1-diagnóstico-geral)
2. [Inventário de Entidades](#2-inventário-de-entidades)
3. [Decisões de Limpeza Estrutural](#3-decisões-de-limpeza-estrutural)
4. [Diferenças Críticas SQLite → PostgreSQL](#4-diferenças-críticas-sqlite--postgresql)
5. [Proposta Inicial de Schema Prisma](#5-proposta-inicial-de-schema-prisma)
6. [Plano de Execução Recomendado](#6-plano-de-execução-recomendado)
7. [Riscos e Pontos de Atenção](#7-riscos-e-pontos-de-atenção)
8. [O Que Corrigir Antes de Migrar](#8-o-que-corrigir-antes-de-migrar)
9. [Prompt de Execução para Implementar](#9-prompt-de-execução-para-implementar)

---

## 1. Diagnóstico Geral

### Estado atual do sistema

O sistema é um ERP leve em Node.js + Express com SQLite via `better-sqlite3`. Está em uso com dados reais, embora a decisão seja aceitar sacrificar os dados atuais para uma migração estrutural mais limpa.

### Pontos fortes

- Padrão `controller → service → repository` bem seguido em ~80% do código
- `createProposalAtomic()` já usa transação única — boa base para Prisma
- Session store persistente (`sessions.sqlite`)
- Infraestrutura de testes com Vitest (banco em `:memory:`, isolamento entre testes)
- Índices críticos já existem em `price_history`
- Triggers de `updated_at` bem distribuídos

### Problemas encontrados

| Problema | Classificação | Arquivo principal |
|---|---|---|
| Acoplamento bidirecional Kanban ↔ Proposal | **CRÍTICO** | `kanban.service.js` ↔ `proposal.service.js` |
| `migrate.js` monolítico sem versionamento | **CRÍTICO** | `src/db/migrate.js` (734 linhas) |
| `proposal.service.js` com 656 linhas (PDF + Kanban + orquestração) | **ALTO** | `proposal.service.js` |
| `app.js` com 73 linhas de Multer + 60+ rotas (405 linhas total) | **ALTO** | `src/app.js` |
| Cobertura de testes: ~8-10% (0 testes para `createProposalFlow()`) | **ALTO** | `tests/` |
| `REAL` no SQLite para valores monetários (deve ser `Decimal`) | **ALTO** | `init.js`, `migrate.js` |
| Sem paginação em listagens (`listAllClients()`, `listAllParts()`) | **MÉDIO** | múltiplos repositories |
| CSS inline duplicado em múltiplas páginas HTML (~1.150 linhas inline) | **MÉDIO** | `public/*.html` |
| Proposta criada, PDF falha → estado inconsistente (`pdf_path = null`) | **MÉDIO** | `proposal.service.js:447` |
| `responsaveis` legada coexistindo com assinatura do usuário | **MÉDIO** | módulo `responsavel` |
| Campo `parts.categoria` (TEXT legado) coexistindo com `category_id` | **MÉDIO** | `src/db/init.js:29` |
| Session fixation (sem `req.session.regenerate()` pós-login) | **MÉDIO** | `auth.service.js` |
| Sem validação de `numero_proposta` para evitar path traversal | **MÉDIO** | `proposal.service.js` |
| N+1 queries em vários listRepositories | **MÉDIO** | múltiplos repositories |
| Sem rate limiting em `/auth/login` | **MÉDIO** | `app.js` |

### Riscos de escala

1. `LIKE %...%` em todos os fulltext searches → full table scan acima de 10k registros
2. Puppeteer sem fila: cada PDF abre um Chrome headless — múltiplas gerações consomem memória
3. Listagens sem paginação: `listAllClients()` retorna todos os registros em memória
4. `migrate.js` roda backfill em toda subida do servidor — cresce indefinidamente

---

## 2. Inventário de Entidades

### 2.1 `clients` — Clientes

| Campo | Tipo SQLite | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | → `Int @id @default(autoincrement())` |
| `nome` | TEXT NOT NULL | obrigatório |
| `razao_social` | TEXT | |
| `nome_fantasia` | TEXT | |
| `cnpj` | TEXT | único quando preenchido; sem validação de checksum |
| `inscricao_estadual` | TEXT | |
| `endereco` | TEXT | |
| `cidade` | TEXT | |
| `estado` | TEXT | |
| `cep` | TEXT | |
| `email` | TEXT | sem validação de formato |
| `telefone` | TEXT | |
| `contato_responsavel` | TEXT | |
| `observacoes` | TEXT | |
| `has_parts_contract` | INTEGER DEFAULT 0 | → `Boolean @default(false)` |
| `created_at` | TEXT | → `DateTime @default(now())` |
| `updated_at` | TEXT | → `DateTime @updatedAt` |

**Relações:** `proposals`, `price_history`, `part_client_price_references`, `stock_movements`

**Regras críticas:** deduplicação por CNPJ exato e por nome normalizado antes de criar proposta

**Observações Prisma:** `cnpj` pode ser `@unique` mas precisa de índice condicional (quando não NULL). No Prisma, usar `cnpj String? @unique` e confiar na validação de aplicação para NULLs.

---

### 2.2 `parts` — Peças

| Campo | Tipo SQLite | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `nome` | TEXT NOT NULL | |
| `descricao` | TEXT | |
| `marca` | TEXT | |
| `modelo` | TEXT | |
| `categoria` | TEXT | **LEGADO** — remover na migração |
| `category_id` | INTEGER FK | → relação com `part_categories` |
| `identity_code` | TEXT | sufixo sequencial (ex: `"001"`) |
| `codigo_interno` | TEXT | gerado: `{category.code}-{identity_code}` |
| `ncm` | TEXT | sem validação de formato (deveria ser 8 dígitos) |
| `preco_compra` | REAL | obrigatório; → `Decimal` no Prisma |
| `stock_quantity` | INTEGER DEFAULT 0 | → `Int @default(0)` |
| `observacoes` | TEXT | |
| `created_at` | TEXT | → `DateTime @default(now())` |
| `updated_at` | TEXT | → `DateTime @updatedAt` |

**Constraints:** `UNIQUE(nome, marca, modelo)` e índice único em `codigo_interno` WHERE NOT NULL

**Relações:** `part_categories`, `price_history`, `part_client_price_references`, `stock_movements`, `proposal_items`, `itens_nota_recebida`

**Regras críticas:** campo `categoria` legado deve ser ignorado; usar apenas `category_id`

**Observações Prisma:** `UNIQUE(nome, marca, modelo)` → `@@unique([nome, marca, modelo])`. Para `codigo_interno`, usar `@unique` com `?` — o Prisma não suporta índice único parcial nativamente; validação deve ficar no service.

---

### 2.3 `part_categories` — Categorias de Peças

| Campo | Tipo SQLite | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `name` | TEXT NOT NULL | |
| `code` | TEXT NOT NULL UNIQUE | ex: `"MOT"`, `"ELE"` |
| `created_at` | TEXT | → `DateTime @default(now())` |
| `updated_at` | TEXT | → `DateTime @updatedAt` |

**Relações:** `parts`

---

### 2.4 `proposals` — Propostas Comerciais

| Campo | Tipo SQLite | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `numero_proposta` | TEXT NOT NULL UNIQUE | validar caracteres permitidos |
| `cliente_id` | INTEGER FK NOT NULL | → `client` relation |
| `cidade_emissao` | TEXT NOT NULL | |
| `data_emissao` | TEXT NOT NULL | gerada pelo servidor; → `DateTime` |
| `objeto_proposta` | TEXT NOT NULL | |
| `forma_pagamento` | TEXT NOT NULL | candidato a `enum` |
| `prazo_pagamento` | TEXT NOT NULL | |
| `prazo_entrega` | TEXT NOT NULL | |
| `garantia` | TEXT NOT NULL | |
| `validade` | TEXT NOT NULL | |
| `valor_total` | REAL NOT NULL | → `Decimal` |
| `valor_total_extenso` | TEXT NOT NULL | calculado no backend |
| `responsavel_nome` | TEXT NOT NULL | snapshot |
| `responsavel_cargo` | TEXT NOT NULL | snapshot |
| `responsavel_email` | TEXT NOT NULL | snapshot |
| `responsavel_telefone` | TEXT NOT NULL | snapshot |
| `responsible_user_id` | INTEGER | FK users |
| `responsible_name` | TEXT | snapshot novo |
| `responsible_role` | TEXT | snapshot novo |
| `responsible_phone` | TEXT | snapshot novo |
| `commercial_condition_id` | INTEGER FK | → `commercial_conditions` (nullable) |
| `pdf_path` | TEXT | pode ser NULL se falhou |
| `kanban_status` | TEXT | → `enum KanbanStatus` |
| `kanban_status_updated_at` | TEXT | → `DateTime?` |
| *colunas execution_* | variadas | ver subseção abaixo |
| *colunas approval_* | variadas | ver subseção abaixo |
| *colunas billing_* | variadas | ver subseção abaixo |
| `created_at` | TEXT | → `DateTime @default(now())` |

**Colunas de execução:** `execution_completed` (bool), `execution_date`, `executed_by`, `execution_os`, `execution_details`, `execution_marked_by_user_id`, `execution_marked_at`

**Colunas de aprovação:** `approval_date`, `approval_notes`, `approval_attachment_path`, `approval_registered_by_user_id`, `approval_registered_at`

**Colunas de faturamento:** `billing_date`, `invoice_number`, `billing_notes`, `billed_by_user_id`, `billed_at`

**Regras críticas:**
- `numero_proposta` único
- `data_emissao` sempre gerada pelo servidor
- `valor_total_extenso` calculado no backend, nunca aceitar do frontend
- Deleção cascateia em `proposal_items` e `price_history`
- Execução obrigatória antes de ir para `faturar`
- `kanban_status` tem 8 estados válidos: `pendente_envio`, `enviado`, `aguardando_compra`, `comprado`, `pendente_execucao`, `faturar`, `faturado`

**Observações Prisma:** Considerar separar colunas de execução/aprovação/faturamento em tabelas próprias (`ProposalExecution`, `ProposalApproval`, `ProposalBilling`) para normalização — mas apenas se for conveniente para queries existentes.

---

### 2.5 `proposal_items` — Itens da Proposta

| Campo | Tipo SQLite | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `proposal_id` | INTEGER FK NOT NULL | `onDelete: Cascade` |
| `item_ordem` | INTEGER NOT NULL | |
| `quantidade` | INTEGER NOT NULL | validar > 0 |
| `descricao` | TEXT NOT NULL | texto livre |
| `valor_unitario` | REAL NOT NULL | → `Decimal` |
| `ncm` | TEXT | texto livre, sem validação |

**Relações:** `proposals`

**Regras críticas:** `proposal_id` com `onDelete: Cascade` — ao deletar proposta, itens são deletados

---

### 2.6 `price_history` — Histórico de Preços

| Campo | Tipo SQLite | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `client_id` | INTEGER FK NOT NULL | |
| `part_id` | INTEGER FK | nullable (find-or-create assíncrono) |
| `proposal_id` | INTEGER FK NOT NULL | `onDelete: Cascade` |
| `descricao_original` | TEXT NOT NULL | |
| `descricao_normalizada` | TEXT NOT NULL | sem acentos, lowercase |
| `quantidade` | INTEGER NOT NULL | |
| `valor_unitario` | REAL NOT NULL | → `Decimal` |
| `data_proposta` | TEXT NOT NULL | → `DateTime` |
| `numero_proposta` | TEXT NOT NULL | desnormalizado para referência |
| `observacoes` | TEXT | |
| `created_at` | TEXT | → `DateTime @default(now())` |

**Índices:** `(client_id, part_id)` e `(client_id, descricao_normalizada)` — **críticos para performance**

**Regras críticas:** gravação automática a cada proposta — nunca pode ser desativado; `proposal_id` com `onDelete: Cascade`

---

### 2.7 `part_client_price_references` — Preço Fixo por Peça/Cliente

| Campo | Tipo SQLite | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `part_id` | INTEGER FK NOT NULL | |
| `client_id` | INTEGER FK NOT NULL | |
| `reference_price` | REAL NOT NULL | → `Decimal` |
| `source` | TEXT DEFAULT `'manual'` | |
| `notes` | TEXT | |
| `created_by_user_id` | INTEGER FK | |
| `updated_by_user_id` | INTEGER FK | |
| `created_at` | TEXT | → `DateTime @default(now())` |
| `updated_at` | TEXT | → `DateTime @updatedAt` |

**Constraints:** `UNIQUE(part_id, client_id)` — operação via UPSERT

**Regras críticas:** tem prioridade sobre `price_history` na sugestão de preço

---

### 2.8 `users` — Usuários

| Campo | Tipo SQLite | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `nome` | TEXT NOT NULL | |
| `username` | TEXT NOT NULL UNIQUE | |
| `password_hash` | TEXT NOT NULL | bcryptjs |
| `role` | TEXT NOT NULL DEFAULT `'user'` | → `enum Role` |
| `signature_cargo` | TEXT | obrigatório para criar proposta |
| `signature_telefone` | TEXT | obrigatório para criar proposta |
| `created_at` | TEXT | → `DateTime @default(now())` |
| `updated_at` | TEXT | → `DateTime @updatedAt` |

**Roles:** `admin`, `user`, `comercial`, `tecnico`, `financeiro`

**Regras críticas:** não pode deletar último admin; não pode deletar próprio usuário; mínimo 1 usuário

---

### 2.9 `responsaveis` — Responsáveis Legados

| Campo | Tipo SQLite | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `nome` | TEXT NOT NULL | |
| `telefone` | TEXT | |
| `cargo` | TEXT | |
| `created_at` | TEXT | → `DateTime @default(now())` |

**Status:** LEGADO. Desde a decisão técnica 20, a assinatura vem do usuário logado (`users.signature_cargo`, `users.signature_telefone`). Esta tabela não deve mais ser fonte principal e pode ser removida gradualmente.

---

### 2.10 `objetos` — Templates de Objeto

| Campo | Tipo SQLite | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `nome` | TEXT NOT NULL | |
| `descricao` | TEXT | |
| `created_at` | TEXT | → `DateTime @default(now())` |

---

### 2.11 `commercial_conditions` — Condições Comerciais

| Campo | Tipo SQLite | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `name` | TEXT NOT NULL | |
| `forma_pagamento` | TEXT NOT NULL | |
| `prazo_pagamento` | TEXT NOT NULL | |
| `prazo_entrega` | TEXT NOT NULL | |
| `garantia` | TEXT | |
| `validade` | TEXT NOT NULL | |
| `created_at` | TEXT | → `DateTime @default(now())` |
| `updated_at` | TEXT | → `DateTime @updatedAt` |

**Relações:** `proposals` (FK nullificado antes de deletar condição, em transação)

---

### 2.12 `kanban_tasks` — Tarefas Manuais

| Campo | Tipo SQLite | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `title` | TEXT NOT NULL | |
| `description` | TEXT | |
| `kanban_status` | TEXT NOT NULL DEFAULT `'pendente_envio'` | → `enum KanbanStatus` |
| `kanban_status_updated_at` | TEXT DEFAULT CURRENT_TIMESTAMP | → `DateTime` |
| `created_by` | INTEGER FK REFERENCES users | |
| `created_at` | TEXT | → `DateTime @default(now())` |
| `updated_at` | TEXT | → `DateTime @updatedAt` |

---

### 2.13 `kanban_comments` — Comentários

| Campo | Tipo SQLite | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `card_type` | TEXT NOT NULL | `'proposal'` ou `'task'` |
| `card_id` | INTEGER NOT NULL | polimórfico |
| `user_id` | INTEGER NOT NULL | ID do usuário ou 0 para "Sistema" |
| `user_nome` | TEXT NOT NULL | snapshot do nome |
| `comment` | TEXT NOT NULL | |
| `created_at` | TEXT | → `DateTime @default(now())` |

**Índice:** `(card_type, card_id)`

**Observações Prisma:** relação polimórfica não é nativa no Prisma. Manter como campos `card_type` + `card_id` sem FK formal, validação no service.

---

### 2.14 `stock_movements` — Movimentações de Estoque

| Campo | Tipo SQLite | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `part_id` | INTEGER FK NOT NULL | |
| `movement_type` | TEXT NOT NULL | → `enum MovementType` |
| `quantity` | INTEGER NOT NULL | |
| `entry_type` | TEXT | |
| `proposal_id` | INTEGER FK | nullable |
| `client_id` | INTEGER FK | nullable |
| `returns_to_stock` | INTEGER | → `Boolean` |
| `notes` | TEXT | |
| `created_by_user_id` | INTEGER FK NOT NULL | |
| `previous_quantity` | INTEGER | snapshot |
| `new_quantity` | INTEGER | snapshot |
| `created_at` | TEXT | → `DateTime @default(now())` |

**Índices:** `(part_id)`, `(movement_type)`

---

### 2.15 `fornecedores` — Fornecedores

| Campo | Tipo SQLite | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `razao_social` | TEXT NOT NULL | |
| `nome_fantasia` | TEXT | |
| `cnpj` | TEXT | índice WHERE NOT NULL |
| `inscricao_estadual` | TEXT | |
| `email` | TEXT | |
| `telefone` | TEXT | |
| `endereco` | TEXT | |
| `cidade` | TEXT | |
| `estado` | TEXT | |
| `cep` | TEXT | |
| `observacoes` | TEXT | |
| `ativo` | INTEGER NOT NULL DEFAULT 1 | → `Boolean @default(true)` |
| `created_at` | TEXT | → `DateTime @default(now())` |
| `updated_at` | TEXT | → `DateTime @updatedAt` |

---

### 2.16 `categorias_despesa` — Categorias de Despesa

| Campo | Tipo SQLite | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `nome` | TEXT NOT NULL | |
| `descricao` | TEXT | |
| `ativo` | INTEGER NOT NULL DEFAULT 1 | → `Boolean @default(true)` |
| `created_at` | TEXT | → `DateTime @default(now())` |
| `updated_at` | TEXT | → `DateTime @updatedAt` |

---

### 2.17 `notas_recebidas` — Notas Fiscais de Entrada

Tabela com campos fiscais completos: `valor_total`, `valor_bc_icms`, `valor_icms`, `valor_ipi`, `valor_pis`, `valor_cofins`, `valor_iss`, `valor_frete`, `valor_seguro`, `valor_desconto`, `valor_outras_despesas`.

**Constraint de deduplicação:** `UNIQUE(fornecedor_id, numero_nota, serie)` WHERE NOT NULL

**Status:** `'lancada'` ou `'cancelada'`

**Campos de arquivo:** `arquivo_pdf`, `arquivo_xml` (paths relativos salvos no banco)

**Observações Prisma:** Todos os campos `REAL` monetários → `Decimal?` no Prisma

---

### 2.18 `itens_nota_recebida` — Itens de Nota Fiscal

Tabela com campos tributários completos por item: ICMS, ICMS-ST, IPI, PIS, COFINS, ISS, CST, CSOSN, CFOP, NCM, CEST.

**Relações:** `notas_recebidas` (FK, `onDelete: Cascade`), `parts` (FK opcional via `produto_id`)

**Observações Prisma:** Todos os campos `REAL` monetários/alíquotas → `Decimal?`

---

### 2.19 `contas_pagar` — Contas a Pagar

| Campo | Tipo SQLite | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `fornecedor_id` | INTEGER FK NOT NULL | |
| `nota_recebida_id` | INTEGER FK | nullable |
| `categoria_despesa_id` | INTEGER FK | nullable |
| `descricao` | TEXT NOT NULL | |
| `valor` | REAL NOT NULL | → `Decimal` |
| `data_emissao` | TEXT NOT NULL | → `DateTime` |
| `data_vencimento` | TEXT NOT NULL | → `DateTime` |
| `forma_pagamento` | TEXT | |
| `status` | TEXT NOT NULL DEFAULT `'em_aberto'` | → `enum ContaStatus` |
| `data_pagamento` | TEXT | → `DateTime?` |
| `valor_pago` | REAL | → `Decimal?` |
| `comprovante_pagamento` | TEXT | path do arquivo |
| `paid_by` | INTEGER FK | → users |
| `cancelled_by` | INTEGER FK | → users |
| `cancelled_at` | TEXT | → `DateTime?` |
| `cancel_reason` | TEXT | |
| `observacoes` | TEXT | |
| `parcela_numero` | INTEGER | |
| `parcela_total` | INTEGER | |
| `created_by` | INTEGER FK NOT NULL | |
| `created_at` | TEXT | → `DateTime @default(now())` |
| `updated_at` | TEXT | → `DateTime @updatedAt` |

**Status:** `'em_aberto'`, `'pago'`, `'cancelado'`

---

## 3. Decisões de Limpeza Estrutural

> Estas são propostas para implementar na migração, não implementações imediatas.

### 3.1 Remover campo `parts.categoria` (TEXT legado)

**O quê:** Campo `categoria TEXT` na tabela `parts` (coexiste com `category_id FK`).

**Por quê:** Introduz dados inconsistentes. O campo correto é `category_id`. Parte das peças pode ter dados em `categoria` texto e nada em `category_id`, ou vice-versa.

**Como:** Na criação do schema Prisma, não incluir `categoria`. Fazer backfill antes (para peças que tenham `categoria` mas sem `category_id`, tentar encontrar categoria correspondente e vincular).

---

### 3.2 Aposentar a entidade `responsaveis`

**O quê:** Tabela `responsaveis` ainda existe e tem página de gestão, mas desde a decisão técnica 20, a assinatura vem do usuário logado.

**Por quê:** Manter a tabela gera confusão sobre qual é a fonte da assinatura.

**Como:** No schema Prisma, incluir `responsaveis` apenas como tabela de leitura legada (sem relações ativas). A longo prazo, remover o módulo e a página `responsaveis.html`.

---

### 3.3 Usar `Decimal` para todos os valores monetários

**O quê:** Atualmente `REAL` (float de 64 bits) em: `valor_total`, `valor_unitario`, `preco_compra`, `reference_price`, todos os campos `valor_*` fiscais, `valor` em `contas_pagar`.

**Por quê:** `REAL`/`Float` causa erros de arredondamento em operações financeiras (ex: `0.1 + 0.2 = 0.30000000000000004`). Em um sistema financeiro, Decimal é obrigatório.

**Como:** No Prisma, usar `@db.Decimal(15, 2)` ou `Decimal` em todos os campos monetários. No PostgreSQL isso mapeia para `NUMERIC(15,2)`.

---

### 3.4 Transformar `kanban_status` em enum

**O quê:** `kanban_status` em `proposals` e `kanban_tasks` é TEXT livre no SQLite.

**Por quê:** Evita valores inválidos no banco. Prisma suporta `enum` nativamente no PostgreSQL.

**Como:**
```prisma
enum KanbanStatus {
  pendente_envio
  enviado
  aguardando_compra
  comprado
  pendente_execucao
  faturar
  faturado
}
```

---

### 3.5 Transformar `role` em enum

**O quê:** `users.role` é TEXT no SQLite.

**Por quê:** Evita roles inválidos no banco.

**Como:**
```prisma
enum Role {
  admin
  user
  comercial
  tecnico
  financeiro
}
```

---

### 3.6 Transformar status de `contas_pagar` em enum

```prisma
enum ContaStatus {
  em_aberto
  pago
  cancelado
}
```

---

### 3.7 Transformar status de `notas_recebidas` em enum

```prisma
enum NotaStatus {
  lancada
  cancelada
}
```

---

### 3.8 Avaliar separação de colunas de execução/aprovação/faturamento em `proposals`

**O quê:** `proposals` tem ~25 colunas de metadados (execution_*, approval_*, billing_*).

**Por quê:** A tabela `proposals` tem pelo menos 35 colunas no total, o que dificulta leitura e queries.

**Proposta (opcional):** Criar `ProposalExecution`, `ProposalApproval`, `ProposalBilling` como tabelas 1:1.

**Decisão:** Manter na mesma tabela por simplicidade. O volume de propostas é pequeno (< 10k/ano), não justifica normalização extra agora.

---

### 3.9 Definir `created_at` e `updated_at` uniformemente

Tabelas que devem ter ambos: `clients`, `parts`, `part_categories`, `proposals`, `users`, `commercial_conditions`, `part_client_price_references`, `fornecedores`, `categorias_despesa`, `notas_recebidas`, `itens_nota_recebida`, `contas_pagar`, `kanban_tasks`, `stock_movements`.

Tabelas que só precisam de `created_at` (imutáveis): `price_history`, `proposal_items`, `kanban_comments`, `responsaveis`, `objetos`.

---

### 3.10 Padronizar nomes de campos

Inconsistências identificadas:
- `nome` vs `razao_social` vs `nome_fantasia` → manter, são campos distintos com semântica diferente
- `created_by` vs `created_by_user_id` → padronizar para `created_by_user_id` ou `createdById` (Prisma camelCase)
- `paid_by` vs `billed_by_user_id` → padronizar para `paidByUserId`, `billedByUserId`
- `produto_id` em `itens_nota_recebida` → renomear para `part_id` para consistência

---

### 3.11 Avaliar `audit_log` e `proposal_events`

**`proposal_events`:** Registrar cada evento de proposta (criação, envio, execução, aprovação, faturamento) com timestamp, user_id, dados anteriores e novos. Útil para auditoria e relatórios.

**`audit_log`:** Registrar ações sensíveis de qualquer módulo (login, exclusão de proposta, mudança de role, cancelamento de nota).

**Decisão para a migração:** Incluir estrutura de `audit_log` no schema como placeholder, mas não popular no MVP.

---

### 3.12 Separar o módulo financeiro do comercial

Considerar, no longo prazo, separar em schemas ou módulos distintos:
- **Comercial:** `clients`, `parts`, `part_categories`, `proposals`, `proposal_items`, `price_history`, `part_client_price_references`, `commercial_conditions`, `objetos`, `responsaveis`
- **Estoque:** `stock_movements`, `kanban_tasks`, `kanban_comments`
- **Financeiro:** `fornecedores`, `categorias_despesa`, `notas_recebidas`, `itens_nota_recebida`, `contas_pagar`

Para a migração atual, manter tudo em um schema público do PostgreSQL.

---

## 4. Diferenças Críticas SQLite → PostgreSQL

### 4.1 Tipos de dado

| SQLite | PostgreSQL/Prisma | Impacto |
|---|---|---|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL` / `Int @id @default(autoincrement())` | Sem impacto funcional |
| `REAL` | `FLOAT8` / `Float` | **CRÍTICO para dinheiro** — usar `NUMERIC`/`Decimal` |
| `TEXT` (datas) | `TIMESTAMP WITH TIME ZONE` / `DateTime` | Parsing de datas: `"2025-01-31"` vs ISO 8601 |
| `INTEGER` (booleans: 0/1) | `BOOLEAN` / `Boolean` | `has_parts_contract`, `ativo`, `execution_completed`, `returns_to_stock` |
| `NULL` em TEXT UNIQUE | `NULL` em UNIQUE em PG | Postgres permite múltiplos NULLs em UNIQUE; SQLite também — sem diferença |
| Índice parcial `WHERE col IS NOT NULL` | Suportado em PG com `@@index` + filter | Prisma não suporta diretamente — usar `raw` migration |

### 4.2 `PRAGMA` vs configuração de conexão

```javascript
// SQLite (atual)
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

// PostgreSQL + Prisma — não há equivalente
// FKs são sempre aplicadas
// WAL é o padrão
// Timeout configurado no pool de conexão
```

### 4.3 Síncrono vs assíncrono

`better-sqlite3` é **100% síncrono** — nenhum `async/await` nos repositories.

Prisma é **100% assíncrono** — todas as funções retornam `Promise`.

**Impacto:** Todas as funções de `repository.js` precisam virar `async`. Todos os `service.js` que chamam repositories precisam de `await`. Todos os `controller.js` precisam de `await` nas chamadas de service.

Estimativa: ~100+ funções afetadas.

### 4.4 Transações

```javascript
// SQLite (atual) — síncrono
const createProposalAtomic = db.transaction((data) => {
  const id = insertProposal.run(data).lastInsertRowid;
  insertItems(id, data.items);
  insertPriceHistory(id, data.items, data.clientId);
  return id;
});
createProposalAtomic(proposalData);

// Prisma — assíncrono
const createProposalAtomic = async (data) => {
  return prisma.$transaction(async (tx) => {
    const proposal = await tx.proposal.create({ data: { ... } });
    await tx.proposalItem.createMany({ data: items.map(...) });
    await tx.priceHistory.createMany({ data: items.map(...) });
    return proposal;
  });
};
```

### 4.5 Tratamento de erros de constraint

```javascript
// SQLite (atual) — codes: SQLITE_CONSTRAINT_UNIQUE, SQLITE_CONSTRAINT_FOREIGNKEY
// errorHandler.js mapeia esses códigos

// Prisma — codes: P2002 (unique), P2003 (FK), P2025 (not found)
// errorHandler.js precisa ser atualizado para mapear os novos códigos
```

### 4.6 Triggers de `updated_at`

No SQLite, há triggers explícitos em `init.js`/`migrate.js`.

No Prisma, `@updatedAt` gera automaticamente o `UPDATE updated_at = NOW()` em cada update. **Os triggers SQLite devem ser removidos — o Prisma cuida disso.**

### 4.7 Índice único parcial (`codigo_interno`)

```sql
-- SQLite (atual)
CREATE UNIQUE INDEX IF NOT EXISTS idx_parts_internal_code_unique
  ON parts(codigo_interno) WHERE codigo_interno IS NOT NULL;
```

O Prisma não suporta índices parciais nativamente em `schema.prisma`. Solução: usar migration SQL raw para criar o índice após o `prisma migrate`:

```sql
-- Em migration manual após prisma generate
CREATE UNIQUE INDEX IF NOT EXISTS idx_parts_internal_code_unique
  ON parts("codigoInterno") WHERE "codigoInterno" IS NOT NULL;
```

### 4.8 `lastInsertRowid` vs Prisma `create()`

```javascript
// SQLite (atual)
const id = db.prepare("INSERT INTO ...").run(...).lastInsertRowid;

// Prisma
const record = await prisma.table.create({ data: { ... } });
const id = record.id;
```

### 4.9 Backfills no migrate.js

O `migrate.js` atual roda backfills a cada subida (de forma idempotente). No Prisma, cada migration roda uma única vez. Os backfills precisam virar migrations numeradas com verificação explícita se já rodaram.

---

## 5. Proposta Inicial de Schema Prisma

> Este schema é ponto de partida, não definitivo. Deve ser validado antes de aplicar.

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

enum Role {
  admin
  user
  comercial
  tecnico
  financeiro
}

enum KanbanStatus {
  pendente_envio
  enviado
  aguardando_compra
  comprado
  pendente_execucao
  faturar
  faturado
}

enum MovementType {
  entrada
  saida
}

enum ContaStatus {
  em_aberto
  pago
  cancelado
}

enum NotaStatus {
  lancada
  cancelada
}

enum TipoNota {
  produto
  servico
  misto
}

// ─────────────────────────────────────────────────────────────────────────────
// USUÁRIOS E AUTENTICAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

model User {
  id                Int      @id @default(autoincrement())
  nome              String
  username          String   @unique
  passwordHash      String   @map("password_hash")
  role              Role     @default(user)
  signatureCargo    String?  @map("signature_cargo")
  signatureTelefone String?  @map("signature_telefone")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  proposals                 Proposal[]              @relation("ResponsibleUser")
  billedProposals           Proposal[]              @relation("BilledByUser")
  approvedProposals         Proposal[]              @relation("ApprovalRegisteredBy")
  executedProposals         Proposal[]              @relation("ExecutionMarkedBy")
  partPriceReferenceCreated PartClientPriceRef[]    @relation("CreatedByUser")
  partPriceReferenceUpdated PartClientPriceRef[]    @relation("UpdatedByUser")
  stockMovements            StockMovement[]
  kanbanTasks               KanbanTask[]
  notasRecebidas            NotaRecebida[]
  contasPagarCreated        ContaPagar[]            @relation("CreatedByUser")
  contasPagarPaid           ContaPagar[]            @relation("PaidByUser")
  contasPagarCancelled      ContaPagar[]            @relation("CancelledByUser")

  @@map("users")
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTES
// ─────────────────────────────────────────────────────────────────────────────

model Client {
  id                  Int      @id @default(autoincrement())
  nome                String
  razaoSocial         String?  @map("razao_social")
  nomeFantasia        String?  @map("nome_fantasia")
  cnpj                String?  @unique
  inscricaoEstadual   String?  @map("inscricao_estadual")
  endereco            String?
  cidade              String?
  estado              String?
  cep                 String?
  email               String?
  telefone            String?
  contatoResponsavel  String?  @map("contato_responsavel")
  observacoes         String?
  hasPartsContract    Boolean  @default(false) @map("has_parts_contract")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  proposals         Proposal[]
  priceHistory      PriceHistory[]
  priceReferences   PartClientPriceRef[]
  stockMovements    StockMovement[]

  @@index([nome])
  @@map("clients")
}

// ─────────────────────────────────────────────────────────────────────────────
// PEÇAS E CATEGORIAS
// ─────────────────────────────────────────────────────────────────────────────

model PartCategory {
  id        Int      @id @default(autoincrement())
  name      String
  code      String   @unique
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  parts Part[]

  @@map("part_categories")
}

model Part {
  id            Int          @id @default(autoincrement())
  nome          String
  descricao     String?
  marca         String?
  modelo        String?
  // campo `categoria` TEXT legado REMOVIDO
  categoryId    Int?         @map("category_id")
  identityCode  String?      @map("identity_code")
  codigoInterno String?      @map("codigo_interno")
  // Nota: unique parcial em codigoInterno (WHERE NOT NULL) requer migration raw
  ncm           String?
  precoCompra   Decimal      @db.Decimal(15, 2) @map("preco_compra")
  stockQuantity Int          @default(0) @map("stock_quantity")
  observacoes   String?
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")

  category        PartCategory?        @relation(fields: [categoryId], references: [id])
  priceHistory    PriceHistory[]
  priceReferences PartClientPriceRef[]
  stockMovements  StockMovement[]
  notaItems       ItemNotaRecebida[]

  @@unique([nome, marca, modelo])
  @@map("parts")
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPOSTAS
// ─────────────────────────────────────────────────────────────────────────────

model Proposal {
  id                  Int          @id @default(autoincrement())
  numeroProposta      String       @unique @map("numero_proposta")
  clienteId           Int          @map("cliente_id")
  cidadeEmissao       String       @map("cidade_emissao")
  dataEmissao         DateTime     @map("data_emissao")
  objetoProposta      String       @map("objeto_proposta")
  formaPagamento      String       @map("forma_pagamento")
  prazoPagamento      String       @map("prazo_pagamento")
  prazoEntrega        String       @map("prazo_entrega")
  garantia            String
  validade            String
  valorTotal          Decimal      @db.Decimal(15, 2) @map("valor_total")
  valorTotalExtenso   String       @map("valor_total_extenso")
  // Snapshot de assinatura
  responsavelNome     String       @map("responsavel_nome")
  responsavelCargo    String       @map("responsavel_cargo")
  responsavelEmail    String       @map("responsavel_email")
  responsavelTelefone String       @map("responsavel_telefone")
  responsibleUserId   Int?         @map("responsible_user_id")
  responsibleName     String?      @map("responsible_name")
  responsibleRole     String?      @map("responsible_role")
  responsiblePhone    String?      @map("responsible_phone")
  commercialConditionId Int?       @map("commercial_condition_id")
  pdfPath             String?      @map("pdf_path")
  kanbanStatus        KanbanStatus @default(pendente_envio) @map("kanban_status")
  kanbanStatusUpdatedAt DateTime?  @map("kanban_status_updated_at")
  // Execução
  executionCompleted  Boolean      @default(false) @map("execution_completed")
  executionDate       DateTime?    @map("execution_date")
  executedBy          String?      @map("executed_by")
  executionOs         String?      @map("execution_os")
  executionDetails    String?      @map("execution_details")
  executionMarkedByUserId Int?     @map("execution_marked_by_user_id")
  executionMarkedAt   DateTime?    @map("execution_marked_at")
  // Aprovação
  approvalDate        DateTime?    @map("approval_date")
  approvalNotes       String?      @map("approval_notes")
  approvalAttachmentPath String?   @map("approval_attachment_path")
  approvalRegisteredByUserId Int?  @map("approval_registered_by_user_id")
  approvalRegisteredAt DateTime?   @map("approval_registered_at")
  // Faturamento
  billingDate         DateTime?    @map("billing_date")
  invoiceNumber       String?      @map("invoice_number")
  billingNotes        String?      @map("billing_notes")
  billedByUserId      Int?         @map("billed_by_user_id")
  billedAt            DateTime?    @map("billed_at")
  createdAt           DateTime     @default(now()) @map("created_at")

  client              Client           @relation(fields: [clienteId], references: [id])
  responsibleUser     User?            @relation("ResponsibleUser", fields: [responsibleUserId], references: [id])
  billedByUser        User?            @relation("BilledByUser", fields: [billedByUserId], references: [id])
  approvalRegisteredBy User?           @relation("ApprovalRegisteredBy", fields: [approvalRegisteredByUserId], references: [id])
  executionMarkedBy   User?            @relation("ExecutionMarkedBy", fields: [executionMarkedByUserId], references: [id])
  commercialCondition CommercialCondition? @relation(fields: [commercialConditionId], references: [id])
  items               ProposalItem[]
  priceHistory        PriceHistory[]
  stockMovements      StockMovement[]

  @@index([clienteId])
  @@index([kanbanStatus])
  @@index([dataEmissao])
  @@map("proposals")
}

model ProposalItem {
  id           Int     @id @default(autoincrement())
  proposalId   Int     @map("proposal_id")
  itemOrdem    Int     @map("item_ordem")
  quantidade   Int
  descricao    String
  valorUnitario Decimal @db.Decimal(15, 2) @map("valor_unitario")
  ncm          String?

  proposal Proposal @relation(fields: [proposalId], references: [id], onDelete: Cascade)

  @@map("proposal_items")
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTÓRICO DE PREÇOS
// ─────────────────────────────────────────────────────────────────────────────

model PriceHistory {
  id                   Int      @id @default(autoincrement())
  clientId             Int      @map("client_id")
  partId               Int?     @map("part_id")
  proposalId           Int      @map("proposal_id")
  descricaoOriginal    String   @map("descricao_original")
  descricaoNormalizada String   @map("descricao_normalizada")
  quantidade           Int
  valorUnitario        Decimal  @db.Decimal(15, 2) @map("valor_unitario")
  dataProposta         DateTime @map("data_proposta")
  numeroProposta       String   @map("numero_proposta")
  observacoes          String?
  createdAt            DateTime @default(now()) @map("created_at")

  client   Client   @relation(fields: [clientId], references: [id])
  part     Part?    @relation(fields: [partId], references: [id])
  proposal Proposal @relation(fields: [proposalId], references: [id], onDelete: Cascade)

  @@index([clientId, partId])
  @@index([clientId, descricaoNormalizada])
  @@index([clientId, dataProposta(sort: Desc)])
  @@map("price_history")
}

model PartClientPriceRef {
  id               Int      @id @default(autoincrement())
  partId           Int      @map("part_id")
  clientId         Int      @map("client_id")
  referencePrice   Decimal  @db.Decimal(15, 2) @map("reference_price")
  source           String   @default("manual")
  notes            String?
  createdByUserId  Int?     @map("created_by_user_id")
  updatedByUserId  Int?     @map("updated_by_user_id")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  part            Part  @relation(fields: [partId], references: [id])
  client          Client @relation(fields: [clientId], references: [id])
  createdByUser   User? @relation("CreatedByUser", fields: [createdByUserId], references: [id])
  updatedByUser   User? @relation("UpdatedByUser", fields: [updatedByUserId], references: [id])

  @@unique([partId, clientId])
  @@map("part_client_price_references")
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

model CommercialCondition {
  id              Int      @id @default(autoincrement())
  name            String
  formaPagamento  String   @map("forma_pagamento")
  prazoPagamento  String   @map("prazo_pagamento")
  prazoEntrega    String   @map("prazo_entrega")
  garantia        String?
  validade        String
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  proposals Proposal[]

  @@map("commercial_conditions")
}

model Objeto {
  id        Int      @id @default(autoincrement())
  nome      String
  descricao String?
  createdAt DateTime @default(now()) @map("created_at")

  @@map("objetos")
}

model Responsavel {
  id        Int      @id @default(autoincrement())
  nome      String
  telefone  String?
  cargo     String?
  createdAt DateTime @default(now()) @map("created_at")

  @@map("responsaveis")
}

// ─────────────────────────────────────────────────────────────────────────────
// KANBAN
// ─────────────────────────────────────────────────────────────────────────────

model KanbanTask {
  id                    Int          @id @default(autoincrement())
  title                 String
  description           String?
  kanbanStatus          KanbanStatus @default(pendente_envio) @map("kanban_status")
  kanbanStatusUpdatedAt DateTime     @default(now()) @map("kanban_status_updated_at")
  createdById           Int?         @map("created_by")
  createdAt             DateTime     @default(now()) @map("created_at")
  updatedAt             DateTime     @updatedAt @map("updated_at")

  createdBy User? @relation(fields: [createdById], references: [id])

  @@map("kanban_tasks")
}

model KanbanComment {
  id        Int      @id @default(autoincrement())
  cardType  String   @map("card_type")
  cardId    Int      @map("card_id")
  userId    Int      @map("user_id")
  userNome  String   @map("user_nome")
  comment   String
  createdAt DateTime @default(now()) @map("created_at")

  // Relação polimórfica — sem FK formal; validação no service
  @@index([cardType, cardId])
  @@map("kanban_comments")
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTOQUE
// ─────────────────────────────────────────────────────────────────────────────

model StockMovement {
  id               Int           @id @default(autoincrement())
  partId           Int           @map("part_id")
  movementType     MovementType  @map("movement_type")
  quantity         Int
  entryType        String?       @map("entry_type")
  proposalId       Int?          @map("proposal_id")
  clientId         Int?          @map("client_id")
  returnsToStock   Boolean?      @map("returns_to_stock")
  notes            String?
  createdByUserId  Int           @map("created_by_user_id")
  previousQuantity Int?          @map("previous_quantity")
  newQuantity      Int?          @map("new_quantity")
  createdAt        DateTime      @default(now()) @map("created_at")

  part        Part      @relation(fields: [partId], references: [id])
  proposal    Proposal? @relation(fields: [proposalId], references: [id])
  client      Client?   @relation(fields: [clientId], references: [id])
  createdBy   User      @relation(fields: [createdByUserId], references: [id])

  @@index([partId])
  @@index([movementType])
  @@map("stock_movements")
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO FINANCEIRO
// ─────────────────────────────────────────────────────────────────────────────

model Fornecedor {
  id                Int      @id @default(autoincrement())
  razaoSocial       String   @map("razao_social")
  nomeFantasia      String?  @map("nome_fantasia")
  cnpj              String?
  inscricaoEstadual String?  @map("inscricao_estadual")
  email             String?
  telefone          String?
  endereco          String?
  cidade            String?
  estado            String?
  cep               String?
  observacoes       String?
  ativo             Boolean  @default(true)
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  notasRecebidas NotaRecebida[]
  contasPagar    ContaPagar[]

  @@index([cnpj])
  @@map("fornecedores")
}

model CategoriaDespesa {
  id        Int      @id @default(autoincrement())
  nome      String
  descricao String?
  ativo     Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  notasRecebidas NotaRecebida[]
  contasPagar    ContaPagar[]

  @@map("categorias_despesa")
}

model NotaRecebida {
  id                  Int        @id @default(autoincrement())
  fornecedorId        Int        @map("fornecedor_id")
  numeroNota          String?    @map("numero_nota")
  serie               String?
  chaveAcesso         String?    @map("chave_acesso")
  tipoNota            TipoNota   @default(produto) @map("tipo_nota")
  dataEmissao         DateTime?  @map("data_emissao")
  dataEntrada         DateTime   @map("data_entrada")
  valorTotal          Decimal    @db.Decimal(15, 2) @map("valor_total")
  descricao           String?
  categoriaDespesaId  Int?       @map("categoria_despesa_id")
  arquivoPdf          String?    @map("arquivo_pdf")
  arquivoXml          String?    @map("arquivo_xml")
  status              NotaStatus @default(lancada)
  observacoes         String?
  // Campos fiscais
  naturezaOperacao    String?    @map("natureza_operacao")
  cfopPrincipal       String?    @map("cfop_principal")
  modalidadeFrete     Int?       @map("modalidade_frete")
  valorFrete          Decimal?   @db.Decimal(15, 2) @map("valor_frete")
  valorSeguro         Decimal?   @db.Decimal(15, 2) @map("valor_seguro")
  valorDesconto       Decimal?   @db.Decimal(15, 2) @map("valor_desconto")
  valorOutrasDespesas Decimal?   @db.Decimal(15, 2) @map("valor_outras_despesas")
  valorBcIcms         Decimal?   @db.Decimal(15, 2) @map("valor_bc_icms")
  valorIcms           Decimal?   @db.Decimal(15, 2) @map("valor_icms")
  valorIpi            Decimal?   @db.Decimal(15, 2) @map("valor_ipi")
  valorPis            Decimal?   @db.Decimal(15, 2) @map("valor_pis")
  valorCofins         Decimal?   @db.Decimal(15, 2) @map("valor_cofins")
  valorIss            Decimal?   @db.Decimal(15, 2) @map("valor_iss")
  numeroProtocolo     String?    @map("numero_protocolo")
  dataAutorizacao     DateTime?  @map("data_autorizacao")
  createdById         Int        @map("created_by")
  createdAt           DateTime   @default(now()) @map("created_at")
  updatedAt           DateTime   @updatedAt @map("updated_at")

  fornecedor       Fornecedor       @relation(fields: [fornecedorId], references: [id])
  categoriaDespesa CategoriaDespesa? @relation(fields: [categoriaDespesaId], references: [id])
  createdBy        User             @relation(fields: [createdById], references: [id])
  itens            ItemNotaRecebida[]
  contasPagar      ContaPagar[]

  @@unique([fornecedorId, numeroNota, serie], name: "dedup_nota")
  @@index([fornecedorId])
  @@index([chaveAcesso])
  @@map("notas_recebidas")
}

model ItemNotaRecebida {
  id                     Int      @id @default(autoincrement())
  notaRecebidaId         Int      @map("nota_recebida_id")
  produtoId              Int?     @map("produto_id")
  numeroItem             Int      @map("numero_item")
  codigoProduto          String?  @map("codigo_produto")
  descricao              String
  ncm                    String?
  cfop                   String?
  unidade                String?
  quantidade             Decimal? @db.Decimal(15, 4)
  valorUnitario          Decimal? @db.Decimal(15, 4) @map("valor_unitario")
  valorTotal             Decimal? @db.Decimal(15, 2) @map("valor_total")
  valorDesconto          Decimal? @db.Decimal(15, 2) @map("valor_desconto")
  origemMercadoria       String?  @map("origem_mercadoria")
  cstIcms                String?  @map("cst_icms")
  csosn                  String?
  modalidadeBcIcms       Int?     @map("modalidade_bc_icms")
  reducaoBaseIcms        Decimal? @db.Decimal(6, 4) @map("reducao_base_icms")
  valorBcIcms            Decimal? @db.Decimal(15, 2) @map("valor_bc_icms")
  aliquotaIcms           Decimal? @db.Decimal(6, 4) @map("aliquota_icms")
  valorIcms              Decimal? @db.Decimal(15, 2) @map("valor_icms")
  valorBcIcmsSt          Decimal? @db.Decimal(15, 2) @map("valor_bc_icms_st")
  aliquotaIcmsSt         Decimal? @db.Decimal(6, 4) @map("aliquota_icms_st")
  valorIcmsSt            Decimal? @db.Decimal(15, 2) @map("valor_icms_st")
  cstIpi                 String?  @map("cst_ipi")
  codigoEnquadramentoIpi String?  @map("codigo_enquadramento_ipi")
  valorBcIpi             Decimal? @db.Decimal(15, 2) @map("valor_bc_ipi")
  aliquotaIpi            Decimal? @db.Decimal(6, 4) @map("aliquota_ipi")
  valorIpi               Decimal? @db.Decimal(15, 2) @map("valor_ipi")
  cstPis                 String?  @map("cst_pis")
  valorBcPis             Decimal? @db.Decimal(15, 2) @map("valor_bc_pis")
  aliquotaPis            Decimal? @db.Decimal(6, 4) @map("aliquota_pis")
  valorPis               Decimal? @db.Decimal(15, 2) @map("valor_pis")
  cstCofins              String?  @map("cst_cofins")
  valorBcCofins          Decimal? @db.Decimal(15, 2) @map("valor_bc_cofins")
  aliquotaCofins         Decimal? @db.Decimal(6, 4) @map("aliquota_cofins")
  valorCofins            Decimal? @db.Decimal(15, 2) @map("valor_cofins")
  aliquotaIss            Decimal? @db.Decimal(6, 4) @map("aliquota_iss")
  valorIss               Decimal? @db.Decimal(15, 2) @map("valor_iss")
  cest                   String?
  informacoesAdicionais  String?  @map("informacoes_adicionais")
  createdAt              DateTime @default(now()) @map("created_at")
  updatedAt              DateTime @updatedAt @map("updated_at")

  nota     NotaRecebida @relation(fields: [notaRecebidaId], references: [id], onDelete: Cascade)
  produto  Part?        @relation(fields: [produtoId], references: [id])

  @@index([notaRecebidaId])
  @@map("itens_nota_recebida")
}

model ContaPagar {
  id                  Int         @id @default(autoincrement())
  fornecedorId        Int         @map("fornecedor_id")
  notaRecebidaId      Int?        @map("nota_recebida_id")
  categoriaDespesaId  Int?        @map("categoria_despesa_id")
  descricao           String
  valor               Decimal     @db.Decimal(15, 2)
  dataEmissao         DateTime    @map("data_emissao")
  dataVencimento      DateTime    @map("data_vencimento")
  formaPagamento      String?     @map("forma_pagamento")
  status              ContaStatus @default(em_aberto)
  dataPagamento       DateTime?   @map("data_pagamento")
  valorPago           Decimal?    @db.Decimal(15, 2) @map("valor_pago")
  comprovantePagamento String?    @map("comprovante_pagamento")
  paidById            Int?        @map("paid_by")
  cancelledById       Int?        @map("cancelled_by")
  cancelledAt         DateTime?   @map("cancelled_at")
  cancelReason        String?     @map("cancel_reason")
  observacoes         String?
  parcelaNumero       Int?        @map("parcela_numero")
  parcelaTotal        Int?        @map("parcela_total")
  createdById         Int         @map("created_by")
  createdAt           DateTime    @default(now()) @map("created_at")
  updatedAt           DateTime    @updatedAt @map("updated_at")

  fornecedor       Fornecedor        @relation(fields: [fornecedorId], references: [id])
  notaRecebida     NotaRecebida?     @relation(fields: [notaRecebidaId], references: [id])
  categoriaDespesa CategoriaDespesa? @relation(fields: [categoriaDespesaId], references: [id])
  paidBy           User?             @relation("PaidByUser", fields: [paidById], references: [id])
  cancelledBy      User?             @relation("CancelledByUser", fields: [cancelledById], references: [id])
  createdBy        User              @relation("CreatedByUser", fields: [createdById], references: [id])

  @@index([fornecedorId])
  @@index([notaRecebidaId])
  @@index([dataVencimento, status])
  @@index([status])
  @@map("contas_pagar")
}
```

---

## 6. Plano de Execução Recomendado

### Fase 1 — Preparação (Pré-Prisma)

**Objetivo:** Deixar o código atual mais limpo antes da migração para reduzir o esforço e o risco.

**Arquivos afetados:** `proposal.service.js`, `kanban.service.js`, `app.js`, `tests/`

**Ações:**

1. **Extrair lógica de PDF para `proposal-pdf.service.js`**
   - Mover `renderProposalPdf()`, `buildTemplateData()`, `assetDataUri()`, `renderHtmlToPdfBytes()`, `mergePdfLayers()` do `proposal.service.js`
   - Resultado: `proposal.service.js` cai de 656 para ~250 linhas

2. **Extrair `KANBAN_STATUSES` e `canMoveKanban()` para `src/shared/domain/kanban.js`**
   - Remove a dependência circular entre `kanban.service.js` ↔ `proposal.service.js`

3. **Escrever testes críticos antes de migrar** (ver seção 8)
   - Sem esses testes, qualquer migração é perigosa

4. **Criar `src/middleware/upload.js`** extraindo as 73 linhas de Multer do `app.js`

**Riscos:** Baixo — refatoração interna sem alterar contratos de API

**Critério de sucesso:** `npm test` continua verde; proposal.service.js < 300 linhas; kanban.service.js sem import de proposal.service.js

---

### Fase 2 — Instalação do Prisma e PostgreSQL

**Objetivo:** Configurar a infraestrutura sem tocar no código atual.

**Arquivos afetados:** `package.json`, `prisma/` (novo), `.env`

**Comandos:**
```bash
# Instalar Prisma
npm install @prisma/client
npm install prisma --save-dev

# Inicializar
npx prisma init

# Docker para PostgreSQL local
docker run --name ghtec-pg \
  -e POSTGRES_USER=ghtec \
  -e POSTGRES_PASSWORD=ghtec123 \
  -e POSTGRES_DB=ghtec_propostas \
  -p 5432:5432 \
  -d postgres:16

# .env
DATABASE_URL="postgresql://ghtec:ghtec123@localhost:5432/ghtec_propostas"
```

**Riscos:** Nenhum — ainda não altera o código Node.js

**Critério de sucesso:** `npx prisma studio` abre; `npx prisma db push` cria o schema

---

### Fase 3 — Criação do Schema e Primeira Migration

**Objetivo:** Criar o schema.prisma com base no inventário desta análise e gerar a migration inicial.

**Arquivos afetados:** `prisma/schema.prisma` (novo), `prisma/migrations/` (novo)

**Ações:**

1. Copiar o schema da seção 5 para `prisma/schema.prisma`
2. Ajustar conforme validação do schema real do banco
3. Criar migration inicial:
   ```bash
   npx prisma migrate dev --name init_schema
   ```
4. Criar migration manual para índice parcial de `codigo_interno`:
   ```sql
   -- Em arquivo de migration SQL após o init
   CREATE UNIQUE INDEX IF NOT EXISTS idx_parts_internal_code_unique
     ON parts("codigoInterno") WHERE "codigoInterno" IS NOT NULL;
   ```
5. Seed inicial:
   ```bash
   npx prisma db seed
   ```

**Riscos:**
- Schema Prisma pode não representar fielmente todas as constraints do SQLite
- `@@unique` com campos nullable pode ter comportamento diferente

**Critério de sucesso:** `npx prisma migrate status` mostra "Database schema is up to date"

---

### Fase 4 — Refatoração dos Repositories

**Objetivo:** Converter os repositories de `better-sqlite3` para Prisma Client, módulo por módulo.

**Ordem recomendada (menor para maior dependência):**

1. `category.repository.js` — mais simples, sem dependências
2. `responsavel.repository.js`, `objeto.repository.js`, `condition.repository.js`
3. `client.repository.js`
4. `part.repository.js`
5. `auth.repository.js` / `user.repository.js`
6. `fornecedor.repository.js`, `categoria_despesa.repository.js`
7. `stock.repository.js`
8. `kanban.repository.js`
9. `nota_recebida.repository.js`
10. `conta_pagar.repository.js`
11. `proposal.repository.js` — mais complexo, por último

**Padrão de conversão:**
```javascript
// Antes
function findClientById(id) {
  return db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
}

// Depois
async function findClientById(id) {
  return prisma.client.findUnique({ where: { id } });
}
```

**Arquivos afetados:** todos os `*.repository.js` em `src/modules/`

**Riscos:**
- Queries com JOIN complexo podem ser difíceis de traduzir para Prisma fluente — usar `prisma.$queryRaw` quando necessário
- `createProposalAtomic()` com `db.transaction()` → `prisma.$transaction()` requer cuidado especial
- Funções que retornavam `{id, nome, ...}` agora retornam objeto Prisma com campos em camelCase — adaptar services

**Critério de sucesso:** `npm test` passa com Prisma substituindo SQLite nos repositories migrados

---

### Fase 5 — Adaptação dos Services

**Objetivo:** Adicionar `async/await` em todas as funções que chamam repositories.

**Arquivos afetados:** todos os `*.service.js`

**Ações:**
1. Transformar todas as funções de service em `async function`
2. Adicionar `await` em todas as chamadas de repository
3. Atualizar tratamento de erros para mapear erros Prisma (`P2002`, `P2003`, `P2025`)
4. Atualizar `errorHandler.js` com os novos códigos de erro do Prisma

```javascript
// errorHandler.js — adicionar ao switch
import { Prisma } from '@prisma/client';

if (err instanceof Prisma.PrismaClientKnownRequestError) {
  if (err.code === 'P2002') return res.status(409).json({ ... }); // unique violation
  if (err.code === 'P2025') return res.status(404).json({ ... }); // not found
  if (err.code === 'P2003') return res.status(409).json({ ... }); // FK violation
}
```

**Riscos:**
- Funções `createProposalAtomic()` e transações no `nota_recebida.service.js` requerem atenção especial
- Erros silenciosos que eram ignorados podem começar a aparecer com Prisma (bom, mas inesperado)

**Critério de sucesso:** Servidor sobe com PostgreSQL; fluxo de criação de proposta funciona end-to-end

---

### Fase 6 — Testes

**Objetivo:** Garantir que tudo funciona antes de qualquer deploy.

**Ações:**
1. Criar banco de teste PostgreSQL separado (`ghtec_test`)
2. Configurar `vitest.config.mjs` para usar `DATABASE_URL` apontando para banco de teste
3. Rodar suite completa: `npm test`
4. Testes de integração manuais:
   - Criar proposta completa
   - Gerar PDF
   - Mover proposta no Kanban
   - Lançar nota recebida
   - Baixar conta a pagar

**Critério de sucesso:** 74+ testes passando; teste manual do fluxo de proposta completo

---

### Fase 7 — Deploy com PostgreSQL

**Objetivo:** Colocar em produção com PostgreSQL.

**Ações:**
1. Configurar PostgreSQL no servidor de produção (ou serviço gerenciado: Supabase, Neon, Railway)
2. Configurar variáveis de ambiente: `DATABASE_URL`
3. Rodar `npx prisma migrate deploy` (não `dev` — `deploy` é para produção)
4. Fazer seed de dados iniciais se necessário
5. Remover `better-sqlite3` do `package.json`
6. Remover `src/db/connection.js`, `src/db/init.js`, `src/db/migrate.js`
7. Remover arquivo `database.sqlite`

**Riscos:**
- Latência de rede para banco remoto vs local SQLite — medir antes e depois
- Pool de conexões: Prisma usa pool automático, configurar `connection_limit` adequado

**Critério de sucesso:** Sistema funcionando em produção por 48h sem regressões

---

## 7. Riscos e Pontos de Atenção

### 7.1 Geração de PDF (Puppeteer)

**Risco:** `createProposalFlow()` em `proposal.service.js` (linha ~447) cria a proposta no banco **antes** de gerar o PDF. Se o Puppeteer falhar, a proposta fica criada sem PDF (`pdf_path = null`).

**Agravante:** Zero testes cobrem este fluxo completo.

**Mitigação recomendada antes da migração:**
- Envolver a geração de PDF em `try/catch` com delete da proposta se PDF falhar, **ou**
- Gerar PDF antes de fazer commit no banco

**Risco adicional:** `browser.close()` sem `try/finally` pode vazar processo Chromium em caso de erro.

---

### 7.2 Histórico de Preços

**Risco:** `price_history` é o diferencial central do sistema. A migração para Prisma muda o comportamento de `createProposalAtomic()`. Se a transação Prisma falhar no meio, o `price_history` pode ficar inconsistente com `proposals`.

**Mitigação:** `prisma.$transaction()` deve incluir criação de proposta, itens E price_history em um único bloco.

---

### 7.3 Parsing Monetário Brasileiro

**Risco:** O sistema usa o padrão BR (`1.234,56` — ponto = milhar, vírgula = decimal). O `parsePrecoCompra()` em `part.service.js` faz o parsing correto. Se, na migração, algum valor float do SQLite (`REAL`) for lido e reescrito sem o parsing correto, pode haver corrupção.

**Mitigação:** Durante migração, não usar `parseFloat()` diretamente em nenhum campo monetário. Sempre usar o padrão:
```javascript
parseFloat(str.replace(/\./g, '').replace(',', '.'))
```

**Prisma adiciona risco:** Prisma retorna `Decimal` (objeto), não `number`. O código existente de formatação (`formatCurrency()`) pode precisar de ajuste para aceitar `Decimal` do Prisma.

---

### 7.4 Permissões de Kanban

**Risco:** As permissões de Kanban (`canMoveKanban()`) dependem de `KANBAN_STATUSES` definidos em `proposal.service.js`. Se esse array mudar durante a migração, o sistema pode permitir movimentos inválidos.

**Mitigação:** Extrair para `src/shared/domain/kanban.js` na Fase 1 antes de qualquer migração.

---

### 7.5 Sessão e Autenticação

**Risco:** O session store atual usa `better-sqlite3` com `sessions.sqlite`. Ao migrar para PostgreSQL, o session store precisa ser atualizado também.

**Opções:**
- Criar tabela `sessions` no PostgreSQL e adaptar `sessionStore.js`
- Usar `connect-pg-simple` para session store em PostgreSQL
- Usar Redis (nova dependência)

**Mitigação recomendada:** Usar `connect-pg-simple` — sem nova dependência além do PostgreSQL já instalado.

```bash
npm install connect-pg-simple
```

---

### 7.6 Upload de Arquivos

**Risco:** Paths de arquivos são salvos no banco como strings (ex: `'notas-recebidas/arquivo.pdf'`). Na migração, esses paths existentes em SQLite vão para PostgreSQL. Se a estrutura de diretórios mudar, os paths quebram.

**Mitigação:** Não alterar a estrutura de `output/` durante a migração. Manter os mesmos paths relativos.

**Risco adicional:** Path traversal em `numero_proposta` → `proposta-{numero}.pdf`. Se `numero_proposta` contiver `/`, o arquivo seria criado fora do diretório. Validar antes de gerar o PDF.

---

### 7.7 Diferença Síncrono → Assíncrono

**Risco:** `better-sqlite3` é completamente síncrono. Ao migrar para Prisma, todos os repositories e services viram `async`. Qualquer código que chame um repository sem `await` vai retornar `Promise<...>` em vez de dados — erro silencioso difícil de detectar.

**Mitigação:** Usar TypeScript ou eslint-plugin-promise para detectar Promises não aguardadas. Durante a migração, testar cada função manualmente.

---

### 7.8 Impacto nos Testes com Vitest

**Risco:** Atualmente, `connection.js` usa `:memory:` quando `NODE_ENV=test`. Com Prisma, não há banco em memória — precisa de um banco PostgreSQL de test real.

**Mitigação:**
```bash
# .env.test
DATABASE_URL="postgresql://ghtec:ghtec123@localhost:5432/ghtec_test"
```

O Vitest precisará de um banco PostgreSQL disponível para rodar os testes. Considerar `docker-compose` no repositório para facilitar o setup.

---

### 7.9 Índice Parcial de `codigo_interno`

**Risco:** SQLite suporta `CREATE UNIQUE INDEX WHERE col IS NOT NULL`. Prisma não suporta índice parcial nativo — o `@@unique` no schema cria um índice único completo (incluindo NULLs no PostgreSQL). Como PostgreSQL trata múltiplos NULLs como distintos em UNIQUE, o comportamento pode ser diferente.

**Mitigação:** Criar o índice parcial via migration SQL manual após o `prisma migrate`.

---

### 7.10 Backfill do migrate.js

**Risco:** O `migrate.js` atual tem dois backfills importantes:
1. Importar `proposal_items` existentes para `price_history`
2. Criar peças em `parts` a partir do `price_history` sem `part_id`

Como os dados atuais serão sacrificados, esses backfills não precisam rodar. Mas se no futuro precisar de backfill, a lógica está em `migrate.js` e precisará ser portada para uma migration Prisma.

---

### 7.11 Relação Polimórfica em `kanban_comments`

**Risco:** `kanban_comments` usa `card_type` + `card_id` sem FK formal. O Prisma não tem suporte nativo a relações polimórficas — precisará continuar como campos livres.

**Mitigação:** Manter como `String` + `Int` sem `@relation` no schema Prisma. Validação de integridade continua no service.

---

### 7.12 Assets do PDF

**Risco:** `assetDataUri()` lê `marcatopo.png`, `marcabaixo.jpg`, `marca_fixa.png`, `LogoGHTEC.png` de `src/assets/`. Se o nome ou extensão de qualquer arquivo mudar, a geração de proposta falha completamente com erro genérico 500.

**Mitigação:** Não renomear ou mover esses arquivos durante a migração. Adicionar verificação explícita de existência no boot do servidor.

---

### 7.13 Impacto no Deploy

**Risco:** SQLite é um arquivo local — zero configuração de infraestrutura. PostgreSQL requer servidor de banco separado, conexão, variáveis de ambiente, backup.

**Mitigação:**
- Para ambiente simples: usar Supabase ou Neon (PostgreSQL serverless com tier gratuito)
- Para ambiente próprio: PostgreSQL em Docker com volume persistente
- Backup automático: `pg_dump` em cron

---

## 8. O Que Corrigir Antes de Migrar

### Testes obrigatórios a criar (bloqueia migração segura)

**Prioridade máxima:**

1. **Teste completo de `createProposalFlow()`**
   - Criar proposta com cliente novo + itens
   - Verificar `price_history` tem todos os itens
   - Verificar `numero_proposta` duplicado retorna 409
   - Verificar `data_emissao` gerada pelo servidor
   - Verificar `valor_total_extenso` calculado no backend

2. **Teste de deduplicação de cliente**
   - CNPJ idêntico → reutiliza
   - Nome exato idêntico → reutiliza
   - CNPJ igual, nome conflitante → erro bloqueante
   - Múltiplos clientes com mesmo nome → erro bloqueante

3. **Teste de Kanban transitions (8 estados)**
   - Fluxo correto por role
   - Execução obrigatória antes de `faturar`
   - Auto-revert ao remover execução

4. **Teste de atomicidade com rollback**
   - FK inválida → rollback completo (proposta NÃO criada)
   - UNIQUE violation → rollback completo

5. **Teste de `price_history` com índices**
   - Prioridade `part_client_price_references` > `price_history`
   - Último preço por `(client_id, descricao_normalizada)` retorna corretamente

### Correções de código obrigatórias

1. **Extrair `KANBAN_STATUSES` e `canMoveKanban()` para `shared/domain/kanban.js`**
   - Elimina dependência circular entre `kanban.service.js` e `proposal.service.js`

2. **PDF: envolver `renderProposalPdf()` em try/finally**
   - `browser.close()` deve estar no `finally`, não apenas no caminho feliz

3. **Validar `numero_proposta` para evitar path traversal**
   - Adicionar regex: `/^[a-zA-Z0-9\-_]+$/`

4. **`errorHandler.js`: adicionar mapeamento de erros Prisma**
   - `P2002` → 409, `P2025` → 404, `P2003` → 409

---

## 9. Prompt de Execução para Implementar

Após revisar este MIGRATION_PLAN.md e confirmar o caminho, use este prompt para iniciar a implementação da Fase 1:

---

**PROMPT — Fase 1: Preparação estrutural pré-migração**

```
Você está no sistema GHTec Propostas. Leia o SYSTEM_CONTEXT.md e o MIGRATION_PLAN.md antes de começar.

Execute a Fase 1 do plano de migração. Não instale Prisma, não toque no banco, não altere nenhuma rota.

Tarefa 1: Criar src/shared/domain/kanban.js
- Mover KANBAN_STATUSES e canMoveKanban() de proposal.service.js para este arquivo
- Atualizar proposal.service.js e kanban.service.js para importar de shared/domain/kanban.js
- Verificar que npm test continua passando

Tarefa 2: Criar src/modules/proposal/proposal-pdf.service.js
- Mover renderProposalPdf(), buildTemplateData(), assetDataUri(), renderHtmlToPdfBytes(), mergePdfLayers() de proposal.service.js
- proposal.service.js deve importar do novo arquivo
- Adicionar try/finally em renderProposalPdf() para garantir browser.close()
- Verificar que npm test continua passando

Tarefa 3: Criar src/middleware/upload.js
- Mover as 73 linhas de configuração Multer de app.js para este arquivo
- Exportar uploadApproval, uploadComprovante, uploadNota
- Atualizar app.js para importar deste arquivo
- Verificar que npm test continua passando

Tarefa 4: Adicionar validação de numero_proposta em proposal.service.js
- Antes de qualquer processamento, validar que numero_proposta só contém caracteres alfanuméricos, hífen e underscore
- Erro: { code: 'VALIDATION', message: 'Número de proposta contém caracteres inválidos.' }

Para cada tarefa: faça a mudança, rode npm test, confirme que passa antes de avançar.
Ao final, atualize docs/current_task.md com o status das tarefas.
```

---

**PROMPT — Fase 2+3: Prisma + PostgreSQL**

```
Você está no sistema GHTec Propostas. Leia o SYSTEM_CONTEXT.md e o MIGRATION_PLAN.md (especialmente as seções 5, 6.2 e 6.3).

As refatorações estruturais da Fase 1 já estão concluídas.

Execute as Fases 2 e 3:

1. Instalar Prisma: npm install @prisma/client && npm install prisma --save-dev
2. Executar: npx prisma init
3. Criar prisma/schema.prisma a partir do schema proposto na seção 5 do MIGRATION_PLAN.md
4. Adaptar o schema conforme necessário (validar tipos, relações)
5. Executar: npx prisma migrate dev --name init_schema
6. Criar migration SQL manual para índice parcial de codigo_interno
7. Verificar: npx prisma studio abre sem erro

Não altere nenhum repository.js ainda.
Ao final, documente o que foi feito e se há diferenças do schema proposto.
```

---

**PROMPT — Fase 4: Migração dos repositories**

```
Você está no sistema GHTec Propostas. Leia o SYSTEM_CONTEXT.md e o MIGRATION_PLAN.md (seção 6.4).

O schema Prisma está criado e o banco PostgreSQL está rodando.

Execute a Fase 4 em ordem:
1. category.repository.js
2. responsavel.repository.js, objeto.repository.js, condition.repository.js
3. client.repository.js
4. part.repository.js
5. user.repository.js
6. kanban.repository.js
7. stock.repository.js
8. nota_recebida.repository.js, conta_pagar.repository.js, fornecedor.repository.js
9. proposal.repository.js (por último — mais complexo)

Para cada repository:
- Converter para Prisma Client com async/await
- Atualizar o service correspondente com await
- Rodar npm test e confirmar que passa
- Só avançar para o próximo após confirmar

Atenção especial em proposal.repository.js:
- createProposalAtomic() deve usar prisma.$transaction()
- Incluir proposal + proposal_items + price_history no mesmo bloco de transação

Não altere controllers nem rotas.
```

---

*Análise produzida por fan-out de 5 subagentes especializados em 2026-05-25.*
*Próximo passo: revisar este documento com o responsável técnico e confirmar quais decisões de limpeza estrutural serão implementadas antes de avançar para execução.*

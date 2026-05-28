# SYSTEM_CONTEXT.md — GHTec ERP

> **Última atualização:** 2026-05-28
> **Gerado por análise completa do repositório** — código-fonte, schema, middlewares, serviços, frontend e documentação existente.

---

## 1. Visão Geral do Sistema

**Nome:** GHTec ERP (internamente chamado de "propostas-automaticas" no `package.json`, mas a aplicação se apresenta como "GHTec ERP — Sistema de Gestão Comercial")

**Empresa:** GHTec Manutenção e Vendas de Equipamentos Hospitalares Ltda

**Usuários esperados:** Equipes internas da GHTec — comercial, técnica, financeira e administrativa.

**Problema que resolve:** A GHTec precisava de um sistema interno para gerenciar o ciclo completo de atendimento comercial: criação de propostas comerciais formais com geração de PDF, acompanhamento de status via Kanban, controle de clientes, peças, estoque, fornecedores, notas fiscais recebidas e contas a pagar.

**Resultado esperado no dia a dia:** Um colaborador comercial cria uma proposta (PDF gerado automaticamente com marca da empresa), acompanha o ciclo no Kanban (envio → compra → execução → faturamento), enquanto a área financeira controla entradas de notas fiscais e contas a pagar.

---

## 2. Intenção Estratégica do Sistema

O sistema nasceu para substituir um processo manual ou baseado em planilhas/documentos Word/PDF gerados à mão. O ganho central é:

- **Padronização e velocidade:** PDF de proposta gerado com template corporativo em segundos.
- **Rastreabilidade:** Histórico de preços por peça/cliente, status de cada proposta no Kanban, registro de quem executou, aprovou e faturou.
- **Controle financeiro:** Notas recebidas de fornecedores vinculadas a contas a pagar, com rastreamento de pagamentos e comprovantes.
- **Profissionalização:** Assinatura do responsável no PDF, condições comerciais reutilizáveis, número sequencial de proposta.

O sistema ocupa o papel de ERP leve focado no ciclo comercial/operacional de uma empresa de manutenção de equipamentos hospitalares.

---

## 3. Stack Técnica Atual

### Backend
- **Runtime:** Node.js (CommonJS — `"type": "commonjs"`)
- **Framework:** Express 4.x
- **ORM:** Prisma 7.x com adapter PostgreSQL (`@prisma/adapter-pg` + `pg`)
- **Banco principal:** PostgreSQL 16 (local via Docker, produção via `DATABASE_URL`)
- **Autenticação:** `express-session` + `better-sqlite3` (store de sessões em `sessions.sqlite`)
- **Geração de PDF:** Puppeteer 24 (Chromium headless) + Handlebars 4 (template HTML → PDF) + pdf-lib 1.x (merge de camadas de marca d'água)
- **Upload de arquivos:** Multer 2.x
- **Hashing de senha:** bcryptjs

### Frontend
- **Framework:** React 18+ com Vite
- **Roteamento:** React Router DOM (basename `/app`)
- **HTTP client:** `fetch` nativo com camada centralizada em `frontend/src/api/http.js`
- **Gráficos:** Chart.js + react-chartjs-2 (tela Financeiro)
- **CSS:** CSS global (`frontend/src/styles.css`) bundlado pelo Vite — sem framework CSS externo
- **Estratégia de carregamento:** Code splitting com `React.lazy` + `Suspense`

### Ferramentas de build/dev
- **Build frontend:** `npm run frontend:build` (Vite)
- **Dev frontend:** `npm run frontend:dev` (Vite dev server)
- **Testes:** Vitest 4.x (`npm test` / `npm run test:watch`)
- **Prisma CLI:** `npm run prisma:generate`, `prisma:migrate`, `prisma:studio`, etc.

### Ambiente
- **Desenvolvimento:** Docker Compose com PostgreSQL 16-alpine local
- **Sessões:** SQLite via `sessions.sqlite` (separado do banco de domínio)
- **Variáveis de ambiente:** `.env` (não commitado) com `DATABASE_URL`, `SESSION_SECRET`, `PORT`, `NODE_ENV`

### Scripts importantes (`package.json` raiz)
| Script | O que faz |
|---|---|
| `npm start` / `npm run dev` | Inicia o servidor Express |
| `npm test` | Roda todos os testes Vitest |
| `npm run prisma:generate` | Gera o Prisma Client em `src/generated/prisma/` |
| `npm run prisma:migrate` | Cria e aplica migrations (dev) |
| `npm run prisma:deploy` | Aplica migrations em produção |
| `npm run frontend:build` | Builda o React para `frontend/dist/` |
| `npm run frontend:dev` | Inicia Vite dev server |

---

## 4. Arquitetura Geral

O sistema é uma **SPA React servida por uma API Express JSON**. O frontend consome exclusivamente o backend via `fetch`. Não há SSR nem template engine no frontend.

**Fluxo geral:**

```
Usuário (browser)
  → GET /app/* → Express serve frontend/dist/index.html (React SPA)
  → React Router renderiza a tela correta
  → Componente faz fetch para /api-endpoint
  → Express → requireAuth (middleware) → Route Handler → Controller → Service → Repository → Prisma → PostgreSQL
  → JSON de resposta → frontend atualiza estado React
```

**Camadas:**
1. **Rotas:** Definidas em `src/app.js` (arquivo único, sem arquivo de rotas separado)
2. **Controllers:** Recebem `req/res`, extraem dados, chamam o service, retornam JSON
3. **Services:** Lógica de negócio — validações, orquestração, regras de domínio
4. **Repositories:** Acesso ao banco via Prisma (queries, mappers)
5. **Domain:** Regras compartilhadas sem efeito colateral (ex: `src/shared/domain/kanban.js`)
6. **Utils:** Formatação, normalização, conversão (ex: `extensao.js`, `currency.js`)

**Onde ficam as regras de negócio:** Em `service.js` de cada módulo e em `src/shared/domain/kanban.js`.

**Onde ficam validações:** Nos services (validação de domínio) e nos controllers (quando trivial).

**Onde ficam tipos/schemas:** No `prisma/schema.prisma` (fonte de verdade do banco) e nos mappers dos repositories.

---

## 5. Mapa de Pastas e Arquivos Importantes

```
/
├── src/                         # Backend Node.js/Express
│   ├── app.js                   # ★ Ponto central: todas as rotas, middlewares globais, SPA fallback
│   ├── server.js                # Entrypoint: cria o servidor HTTP, ouve na porta
│   ├── db/
│   │   └── prisma.js            # Singleton PrismaClient com adapter-pg
│   ├── middleware/
│   │   ├── requireAuth.js       # Guarda de autenticação por sessão
│   │   ├── sessionStore.js      # Store de sessão SQLite customizado
│   │   ├── upload.js            # Multer: 3 instâncias (approval, nota, comprovante)
│   │   ├── errorHandler.js      # Handler global de erros HTTP
│   │   └── notFoundHandler.js   # 404 handler
│   ├── modules/                 # Módulos de negócio (cada um: controller + service + repository)
│   │   ├── auth/                # Login, logout, usuários, assinatura
│   │   ├── proposal/            # ★ Módulo mais complexo: criação, PDF, Kanban de proposta
│   │   │   ├── proposal.service.js        # Fluxo completo de criação
│   │   │   ├── proposal-pdf.service.js    # Geração de PDF (Puppeteer + Handlebars + pdf-lib)
│   │   │   ├── proposal.repository.js     # Queries Prisma + mappers
│   │   │   ├── proposal.template.hbs      # ★ Template HTML da proposta comercial
│   │   │   └── proposal.css               # CSS injetado inline no template PDF
│   │   ├── client/              # CRUD de clientes + análise de lucro
│   │   ├── part/                # CRUD de peças + categorias + histórico de preços
│   │   ├── stock/               # Movimentações de estoque
│   │   ├── kanban/              # Tarefas avulsas + comentários do Kanban
│   │   ├── responsavel/         # CRUD de responsáveis (entidade legada)
│   │   ├── objeto/              # Objetos de proposta (textos de "objeto")
│   │   ├── condition/           # Condições comerciais reutilizáveis
│   │   ├── category/            # Categorias de peças
│   │   ├── fornecedor/          # CRUD de fornecedores
│   │   ├── categoria_despesa/   # Categorias de despesa financeira
│   │   ├── nota_recebida/       # Notas fiscais recebidas (NF-e)
│   │   └── conta_pagar/         # Contas a pagar
│   ├── shared/
│   │   ├── domain/
│   │   │   └── kanban.js        # ★ Regras de domínio do Kanban (statuses, permissões por role)
│   │   └── utils/
│   │       ├── extensao.js      # Converte valor numérico para texto por extenso (pt-BR)
│   │       ├── currency.js      # Formatação de moeda BRL
│   │       ├── date.js          # Utilitários de data
│   │       └── normalize.js     # Normalização de texto (acento, maiúsculas)
│   └── assets/                  # Imagens embutidas no PDF (logo, marcas d'água)
│       ├── LogoGHTEC.png
│       ├── marcatopo.png
│       ├── marcabaixo.jpg
│       └── marca_fixa.png
│
├── frontend/                    # Frontend React + Vite
│   ├── src/
│   │   ├── App.jsx              # BrowserRouter + AuthProvider + AppRouter
│   │   ├── router.jsx           # Todas as rotas React (lazy loading)
│   │   ├── main.jsx             # Entrypoint React
│   │   ├── styles.css           # CSS global (design system único)
│   │   ├── api/                 # Módulos de chamada HTTP por domínio
│   │   │   ├── http.js          # ★ Camada base: fetch + credentials + error handling
│   │   │   ├── proposals.js     # Chamadas de proposta
│   │   │   ├── clients.js       # Chamadas de clientes
│   │   │   └── ...              # Um arquivo por módulo de domínio
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx  # Estado de autenticação global
│   │   ├── hooks/
│   │   │   └── useAuth.js       # Acesso ao AuthContext
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.jsx      # Layout principal (nav + outlet)
│   │   │   │   ├── Navbar.jsx         # Navbar com menus agrupados
│   │   │   │   └── ProtectedRoute.jsx # Redireciona para /login se não autenticado
│   │   │   └── shared/
│   │   │       ├── Toast.jsx          # Notificações temporárias
│   │   │       ├── ConfirmModal.jsx   # Modal de confirmação
│   │   │       └── Loading.jsx        # Indicador de carregamento
│   │   └── pages/               # Uma página por tela do sistema
│   │       ├── Login.jsx
│   │       ├── Dashboard.jsx
│   │       ├── NovaProposta.jsx  # ★ Tela mais complexa do frontend
│   │       ├── Proposals.jsx
│   │       ├── Kanban.jsx
│   │       ├── Clients.jsx
│   │       ├── Parts.jsx
│   │       ├── Stock.jsx
│   │       ├── Fornecedores.jsx
│   │       ├── NotasRecebidas.jsx
│   │       ├── ContasPagar.jsx
│   │       ├── Financeiro.jsx
│   │       ├── Objetos.jsx
│   │       ├── Responsaveis.jsx
│   │       └── Usuarios.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json             # Dependências do frontend (separado do backend)
│
├── prisma/
│   ├── schema.prisma            # ★ Schema completo: 19 models, 5 enums
│   └── migrations/
│       └── 20260525153903_init_schema/migration.sql  # DDL completo
│
├── output/                      # Arquivos gerados em runtime (não commitados)
│   ├── proposals/               # PDFs de propostas
│   ├── approvals/               # Imagens de comprovante de aprovação
│   ├── notas-recebidas/         # PDFs/XMLs de notas fiscais recebidas
│   └── comprovantes/            # Comprovantes de pagamento
│
├── tests/                       # Testes Vitest
│   ├── services/                # Testes unitários de services (com mocks)
│   ├── integration/             # Testes de integração (fluxo completo)
│   └── unit/                    # Testes unitários de domínio/utils
│
├── scripts/
│   ├── seed-postgres.js         # Cria usuário admin inicial (idempotente)
│   └── check-prisma-connection.js  # Valida 15 operações Prisma
│
├── docs/                        # Documentação técnica
├── docker-compose.yml           # PostgreSQL 16-alpine para dev local
├── prisma.config.ts             # Config Prisma 7 (aponta para DATABASE_URL)
├── .env.example                 # Modelo de variáveis de ambiente
├── database.sqlite              # ⚠ Banco SQLite antigo (legado — não usado pelo backend atual)
└── sessions.sqlite              # Store de sessões HTTP (em uso — não migrar)
```

---

## 6. Funcionalidades Atuais do Sistema

### Login / Autenticação

- **O que faz:** Autentica usuário com username/senha. Mantém sessão via cookie HTTPOnly.
- **Quem usa:** Todos os usuários.
- **Fluxo:** POST `/auth/login` → service valida senha com bcrypt → salva `userId/userRole` na sessão → frontend armazena estado em `AuthContext`.
- **Arquivos:** `auth.controller.js`, `auth.service.js`, `AuthContext.jsx`, `Login.jsx`
- **Status:** Funcional.

### Gestão de Usuários

- **O que faz:** Admin cria, lista, altera role e exclui usuários. Qualquer usuário muda sua própria senha e dados de assinatura.
- **Roles disponíveis:** `admin`, `user`, `comercial`, `tecnico`, `financeiro`.
- **Regras:** Não pode excluir o único admin. Não pode excluir a si mesmo.
- **Assinatura:** Campos `signature_cargo` e `signature_telefone` no model `User` — usados para preencher a assinatura do PDF da proposta.
- **Arquivos:** `auth.*`, `Usuarios.jsx`
- **Endpoints:** `GET /users`, `POST /users`, `PUT /users/me/password`, `PUT /users/me/signature`, `PUT /users/:id/role`, `DELETE /users/:id`
- **Status:** Funcional.

### Nova Proposta / Criação de Proposta

- **O que faz:** Cria uma proposta comercial completa e gera o PDF automaticamente.
- **Quem usa:** Comercial, Admin.
- **Fluxo básico:**
  1. Usuário preenche número da proposta, seleciona cliente (ou digita novo), seleciona objeto, condição comercial e responsável.
  2. Adiciona itens (peças ou serviços) com quantidade, descrição e valor.
  3. Clica em "Gerar Proposta" → `POST /proposals`.
  4. Backend: valida dados → resolve/cria cliente → salva proposta e itens → registra histórico de preços → gera PDF via Puppeteer → salva path no banco.
- **Arquivos:** `NovaProposta.jsx`, `proposal.service.js`, `proposal-pdf.service.js`, `proposal.template.hbs`, `proposal.css`
- **Status:** Funcional.

### Listagem de Propostas

- **O que faz:** Lista todas as propostas com filtro client-side por número ou cliente. Permite visualizar o PDF e excluir a proposta.
- **Arquivos:** `Proposals.jsx`, `proposal.controller.js`
- **Endpoints:** `GET /proposals`, `DELETE /proposals/:id`
- **Status:** Funcional.

### Kanban de Propostas

- **O que faz:** Visualização em colunas do pipeline de propostas. Permite mover propostas entre status, adicionar comentários, registrar execução, aprovação e faturamento.
- **Colunas:** Pendente Envio → Enviado → Aguardando Compra → Comprado → Pendente Execução → Faturar → Faturado.
- **Permissões por role:** Admin move tudo. Comercial: até "Faturar" (exceto "Faturado"). Técnico: de "Aguardando Compra" em diante (exceto "Faturado"). Financeiro: apenas entre "Faturar" e "Faturado". `user`: não move.
- **Regra especial:** Para ir para "Faturar", a proposta precisa estar marcada como executada.
- **Tarefas avulsas:** É possível criar tasks (cards) avulsos no Kanban que podem ser vinculados a propostas existentes.
- **Arquivos:** `Kanban.jsx`, `kanban.service.js`, `kanban.controller.js`, `shared/domain/kanban.js`
- **Status:** Funcional.

### Gestão de Clientes

- **O que faz:** CRUD de clientes + análise de lucratividade por cliente.
- **Deduplicação:** O service de proposta busca cliente por CNPJ ou nome exato antes de criar um novo, evitando duplicatas.
- **Arquivos:** `Clients.jsx`, `client.*`
- **Endpoints:** `GET /clients`, `GET /clients/search`, `GET /clients/profit-analysis`, `GET /clients/:id`, `POST /clients`, `PUT /clients/:id`, `DELETE /clients/:id`
- **Status:** Funcional.

### Gestão de Peças

- **O que faz:** CRUD de peças com categorias, código interno, histórico de preços por cliente e referências de preço por cliente.
- **Código interno:** Gerado automaticamente como `[CATEGORIA_CODE]-[identity_code]` quando ambos são informados.
- **Unicidade:** `(nome, marca, modelo)` é único. `codigo_interno` é único (PostgreSQL trata NULLs como distintos).
- **Arquivos:** `Parts.jsx`, `part.*`, `category.*`
- **Endpoints:** `GET /parts`, `GET /parts/search`, `GET /parts/:id`, `POST /parts`, `PUT /parts/:id`, `DELETE /parts/:id`, `GET /parts/:id/price-history`, `GET /parts/:id/price-comparison`, `GET /parts/:id/client-price-references`, `POST /parts/:id/client-price-references`
- **Status:** Funcional.

### Estoque

- **O que faz:** Registra entradas e saídas de peças. Controla quantidade atual. Tipos de entrada: `compra_nova`, `devolucao_tecnicos`, `devolucao_conserto`, `guardar_alguem`. Saída: vinculada a proposta ou não.
- **Regras:** Saída não pode ultrapassar estoque disponível. Saída vinculada a proposta não pode ultrapassar quantidade da peça na proposta.
- **Arquivos:** `Stock.jsx`, `stock.*`
- **Endpoints:** `GET /stock`, `GET /stock/movements`, `POST /stock/movements`, `GET /stock/contract-spend`, `GET /stock/movements-by-date`, `POST /stock/inventory-count`
- **Status:** Funcional.

### Fornecedores

- **O que faz:** CRUD de fornecedores. Soft-delete (campo `ativo`). Tela de detalhes mostra notas recebidas e contas a pagar relacionadas.
- **Arquivos:** `Fornecedores.jsx`, `fornecedor.*`
- **Status:** Funcional.

### Notas Recebidas (NF-e)

- **O que faz:** Lançamento de notas fiscais recebidas de fornecedores. Suporta upload de PDF e XML. Campos fiscais completos (ICMS, IPI, PIS, COFINS, ISS). Itens da nota podem ser vinculados a peças do cadastro.
- **Deduplicação:** `(fornecedor_id, numero_nota, serie)` é único (PostgreSQL trata NULLs como distintos).
- **Arquivos:** `NotasRecebidas.jsx`, `nota_recebida.*`
- **Endpoints:** `GET /notas-recebidas`, `GET /notas-recebidas/:id`, `POST /notas-recebidas`, `PUT /notas-recebidas/:id`, `POST /notas-recebidas/:id/cancelar`
- **Status:** Funcional.

### Contas a Pagar

- **O que faz:** CRUD de contas a pagar. Pode ser originada de uma nota recebida. Baixa com upload de comprovante. Cancelamento com motivo.
- **Status da conta:** `em_aberto`, `pago`, `cancelado`.
- **Regras:** Só é possível editar contas em aberto. Formas de pagamento: `pix`, `boleto`, `transferencia`, `cartao`, `dinheiro`, `outro`.
- **Arquivos:** `ContasPagar.jsx`, `conta_pagar.*`
- **Endpoints:** `GET /contas-pagar`, `GET /contas-pagar/resumo`, `GET /contas-pagar/:id`, `POST /contas-pagar`, `PUT /contas-pagar/:id`, `POST /contas-pagar/:id/baixar`, `POST /contas-pagar/:id/cancelar`
- **Status:** Funcional.

### Financeiro (Dashboard)

- **O que faz:** Dashboard financeiro com KPIs (contas a pagar no mês, em aberto, vencidas) e gráfico de distribuição por categoria de despesa.
- **Arquivos:** `Financeiro.jsx`, `api/financeiro.js`
- **Endpoint:** `GET /contas-pagar/resumo`
- **Status:** Funcional.

### Objetos de Proposta

- **O que faz:** Biblioteca de textos de "objeto" reutilizáveis para preencher o campo "Objeto da Proposta" na criação de propostas.
- **Arquivos:** `Objetos.jsx`, `objeto.*`
- **Status:** Funcional.

### Condições Comerciais

- **O que faz:** Templates de condições comerciais (forma de pagamento, prazo, entrega, garantia, validade) reutilizáveis na criação de propostas.
- **Arquivos:** `conditions.*`, parte de `Objetos.jsx` (A CONFIRMAR se existe página dedicada)
- **Status:** Funcional.

### Responsáveis (Entidade Legada)

- **O que faz:** CRUD de responsáveis externos (nome, cargo, telefone). Mantido para compatibilidade histórica.
- **IMPORTANTE — Legado:** A assinatura oficial do PDF agora vem do usuário logado (`users.signature_cargo` + `users.signature_telefone`). A entidade `Responsavel` não é mais a fonte principal. O próprio schema Prisma documenta: *"Legado: responsaveis ainda existem no DB mas a assinatura oficial vem do User logado"*.
- **Arquivos:** `Responsaveis.jsx`, `responsavel.*`
- **Status:** Funcional mas legado. Pode causar confusão.

### Categorias de Peças

- **O que faz:** CRUD de categorias de peças com código alfanumérico único. Usado para gerar `codigo_interno` das peças.
- **Arquivos:** `category.*`
- **Endpoint:** `GET /part-categories`, `POST /part-categories`, etc.
- **Status:** Funcional.

### Categorias de Despesa

- **O que faz:** CRUD de categorias de despesa financeira. Usadas em notas recebidas e contas a pagar.
- **Arquivos:** `categoria_despesa.*`
- **Status:** Funcional.

### Busca de Itens / Histórico de Preços

- **O que faz:** Busca itens de propostas anteriores para sugerir descrição e preço na criação de nova proposta.
- **Endpoints:** `GET /items/search`, `GET /items/last-price`
- **Status:** Funcional.

### Geração e Acesso a PDFs

- **O que faz:** PDF gerado automaticamente na criação de proposta. Salvo em `output/proposals/`. Acessível via `/files/proposta-{numero}.pdf`.
- **Status:** Funcional.

---

## 7. Regras de Negócio

### Regras confirmadas pelo código

- Uma proposta deve ter pelo menos um item.
- Itens: descrição obrigatória, quantidade inteira > 0, valor unitário >= 0.
- O número da proposta é único (constraint `@unique` no DB).
- Para mover proposta para "Faturar" no Kanban, ela precisa estar marcada como executada.
- Para marcar proposta como executada, o usuário deve ter role `admin` ou `tecnico`.
- Só o role `financeiro` (e `admin`) pode mover para "Faturado".
- Role `user` não pode mover cards no Kanban.
- Não é possível excluir o único usuário do sistema.
- Não é possível remover ou rebaixar o último admin.
- Um usuário não pode excluir a si mesmo.
- Senha mínima de 6 caracteres.
- Saída de estoque não pode ultrapassar estoque disponível.
- Contas a pagar: só podem ser editadas se estiverem em `em_aberto`.
- A assinatura do responsável no PDF é um **snapshot** no momento da criação — nunca recalculado retroativamente.
- Deduplicação de cliente na criação de proposta: busca por CNPJ ou nome exato; conflito entre múltiplos resultados lança erro `CLIENT_DATA_CONFLICT`.
- Tarefas avulsas no Kanban não podem ir para status "enviado" sem estarem vinculadas a uma proposta.
- Ao remover selo de execução de proposta que estava em "faturar" ou "faturado", o status retorna automaticamente para "pendente_execucao".

### Regras inferidas

- O campo `cidade_emissao` é preenchido na proposta como texto livre (INFERIDO: provavelmente a cidade da empresa emissora).
- O número da proposta é definido manualmente pelo usuário no frontend (não é gerado automaticamente pelo sistema).
- O `responsible_user_id` na proposta aponta para o usuário logado que criou; os campos `responsavel_nome/cargo/email/telefone` são o snapshot da assinatura.

### Regras a confirmar

- **A CONFIRMAR:** O número da proposta deve seguir algum padrão obrigatório (ex: `AAAA-NNN`) ou é totalmente livre?
- **A CONFIRMAR:** Existe algum processo de aprovação formal que bloqueie a edição de propostas aprovadas?
- **A CONFIRMAR:** A entidade `Responsavel` (legada) deve ser mantida ou pode ser removida?
- **A CONFIRMAR:** O campo `hasPartsContract` em `Client` indica contrato de fornecimento de peças — quais regras ele ativa?

---

## 8. Entidades Principais e Modelo de Dados

### User (usuarios)
Representa um usuário interno do sistema. Campos principais: `id`, `nome`, `username`, `password_hash`, `role`, `signature_cargo`, `signature_telefone`. Roles: `admin`, `user`, `comercial`, `tecnico`, `financeiro`.

### Client (clients)
Representa um cliente externo (empresa ou pessoa). Campos: `nome`, `razao_social`, `cnpj`, `endereco`, `cidade`, `estado`, `email`, `telefone`, `has_parts_contract`. **Sem `@unique` no CNPJ** — deduplicação é feita via `proposal.service.js`.

### Part (parts)
Peça ou componente. Campos: `nome`, `descricao`, `marca`, `modelo`, `category_id`, `codigo_interno`, `ncm`, `preco_compra`, `stock_quantity`. Uniqueness: `(nome, marca, modelo)`.

### PartCategory (part_categories)
Categoria de peça. Campos: `name`, `code` (único). Usado para gerar `codigo_interno`.

### Proposal (proposals)
Proposta comercial. Campos: dados do cabeçalho, snapshot do responsável, status Kanban, dados de execução, aprovação e faturamento. É a entidade central do sistema.

### ProposalItem (proposal_items)
Itens de uma proposta. Campos: `proposal_id`, `item_ordem`, `quantidade`, `descricao`, `valor_unitario`, `ncm`. Cascade delete com a proposta.

### CommercialCondition (commercial_conditions)
Condição comercial reutilizável. Campos: `name`, `forma_pagamento`, `prazo_pagamento`, `prazo_entrega`, `garantia`, `validade`.

### Objeto (objetos)
Texto de "objeto da proposta" reutilizável. Campos: `nome`, `descricao`.

### Responsavel (responsaveis)
**LEGADO.** Responsável externo. Campos: `nome`, `telefone`, `cargo`. A assinatura do PDF agora vem de `User.signature_cargo` + `User.signature_telefone`.

### PriceHistory (price_history)
Histórico de preços de itens por cliente/proposta. Alimentado automaticamente na criação de proposta. Usado para sugerir preços em novas propostas.

### PartClientPriceRef (part_client_price_references)
Preço de referência de uma peça para um cliente específico. Único por `(part_id, client_id)`.

### KanbanTask (kanban_tasks)
Tarefa avulsa no Kanban (não vinculada a proposta). Campos: `title`, `description`, `kanban_status`.

### KanbanComment (kanban_comments)
Comentário em card do Kanban. **Relação polimórfica** (`card_type: 'proposal' | 'task'` + `card_id`). Sem FK real no banco — integridade mantida no service.

### StockMovement (stock_movements)
Movimentação de estoque. Campos: `part_id`, `movement_type (entrada/saida)`, `quantity`, `entry_type`, `proposal_id`, `client_id`, `returns_to_stock`.

### Fornecedor (fornecedores)
Fornecedor de peças/serviços. Campos: `razao_social`, `cnpj`, `email`, `telefone`, `ativo`. Soft-delete via campo `ativo`.

### CategoriaDespesa (categorias_despesa)
Categoria de despesa financeira. Soft-delete via campo `ativo`.

### NotaRecebida (notas_recebidas)
Nota fiscal recebida. Campos fiscais completos (ICMS, IPI, PIS, COFINS, ISS). Deduplicação por `(fornecedor_id, numero_nota, serie)`.

### ItemNotaRecebida (itens_nota_recebida)
Item de nota fiscal. FK para `parts` (via `produto_id`). Campos fiscais detalhados por item.

### ContaPagar (contas_pagar)
Conta a pagar. Pode ser originada de nota recebida. Status: `em_aberto`, `pago`, `cancelado`. Suporte a parcelamento.

### Relações resumidas

```
User → proposalsAsResponsible (Proposal[])
User → proposalsBilled (Proposal[])
User → stockMovements, kanbanTasks, notasRecebidas, contasPagar

Client → proposals (Proposal[])
Client → priceHistory, priceReferences, stockMovements

Proposal → items (ProposalItem[])  — cascade delete
Proposal → priceHistory (PriceHistory[])
Proposal → stockMovements (StockMovement[])
Proposal → commercialCondition (CommercialCondition)
Proposal → cliente (Client)

Part → category (PartCategory)
Part → priceHistory, priceReferences, stockMovements, notaItems

NotaRecebida → fornecedor (Fornecedor)
NotaRecebida → itens (ItemNotaRecebida[])  — cascade delete
NotaRecebida → contasPagar (ContaPagar[])

ContaPagar → fornecedor, notaRecebida, categoriaDespesa
```

---

## 9. Fluxos Principais do Sistema

### Fluxo de Login

1. Usuário acessa `/app/login` → React renderiza `Login.jsx`.
2. Usuário preenche username/senha → `POST /auth/login`.
3. `auth.controller.js` → `auth.service.js` → bcrypt.compare → se OK, salva `userId` e `userRole` em `req.session`.
4. Frontend: `AuthContext.login(userData)` → atualiza estado → redireciona para `/`.

### Fluxo de Criação de Proposta

1. Usuário acessa `/app/nova-proposta` → `NovaProposta.jsx`.
2. Seleciona/digita cliente, objeto, condição comercial, responsável.
3. Adiciona itens com descrição, quantidade e valor.
4. Clica em "Gerar" → `POST /proposals` com JSON completo.
5. Backend (`proposal.controller.js` → `proposal.service.js`):
   a. Valida número e itens.
   b. Resolve cliente: busca por CNPJ/nome → cria se não existir, lança erro se houver conflito.
   c. Calcula total e total por extenso.
   d. Salva proposta + itens + price_history em transação PostgreSQL (`createProposalAtomic`).
   e. Auto-registra peças no cadastro se não existirem.
   f. Gera PDF: Puppeteer renderiza template Handlebars → pdf-lib mescla conteúdo + marca d'água página 1 + marca d'água demais páginas.
   g. Salva path do PDF no banco.
6. Resposta JSON com `proposalId` e `pdfPath`.
7. Frontend exibe toast de sucesso e link para o PDF.

### Fluxo de Geração de PDF

1. `proposal-pdf.service.js` recebe dados da proposta.
2. Lê `proposal.template.hbs` e `proposal.css` do disco.
3. Converte assets (logo, marcas d'água) para Data URI em base64.
4. `buildTemplateData()` formata itens, valores e monta objeto de dados.
5. Handlebars compila o template com os dados.
6. Puppeteer lança Chromium, renderiza 3 HTMLs em paralelo: conteúdo + marca d'água p.1 + marca d'água pN.
7. `pdf-lib` mescla as 3 camadas por página → salva arquivo final em `output/proposals/`.

### Fluxo de Kanban

1. Usuário acessa `/app/kanban` → `Kanban.jsx` carrega `GET /proposals/kanban`.
2. Cards exibidos em colunas. Usuário arrasta ou clica para mover.
3. `PUT /proposals/:id/kanban-status` → `proposal.service.js` → `canMoveKanban(userRole, from, to)`.
4. Se permitido, `proposalRepo.setProposalKanbanStatus()`.
5. Para "Faturar": verifica `execution_completed === true` antes de permitir.

### Fluxo de Assinatura/Responsável

1. Usuário atualiza `signature_cargo` e `signature_telefone` via `PUT /users/me/signature`.
2. Na criação de proposta, o frontend envia `responsavel.nome`, `responsavel.cargo`, `responsavel.telefone`.
3. Esses dados são salvos como snapshot na proposta (`responsavel_nome`, `responsavel_cargo`, `responsavel_telefone`).
4. O PDF usa esses valores diretamente — nunca recalcula a partir do usuário atual.

### Fluxo de Nota Recebida

1. Usuário acessa `/app/notas-recebidas`.
2. Cria nota: preenche fornecedor, datas, valor, itens e faz upload de PDF/XML.
3. `POST /notas-recebidas` com `multipart/form-data`.
4. Backend: valida, salva nota, salva itens, move arquivos para `output/notas-recebidas/`.

### Fluxo de Baixa de Conta a Pagar

1. Usuário acessa conta em aberto.
2. `POST /contas-pagar/:id/baixar` com `multipart/form-data` (comprovante + data pagamento + valor pago).
3. Backend: atualiza status para `pago`, salva comprovante em `output/comprovantes/`.

---

## 10. Rotas e Endpoints

### Autenticação
| Método | Rota | O que faz |
|---|---|---|
| POST | `/auth/login` | Login com username/senha |
| POST | `/auth/logout` | Encerra sessão |
| GET | `/auth/me` | Retorna usuário da sessão atual |

### Usuários
| Método | Rota | O que faz |
|---|---|---|
| GET | `/users` | Lista usuários (sem password_hash) |
| POST | `/users` | Cria usuário (admin only — A CONFIRMAR se validado no backend) |
| PUT | `/users/me/password` | Muda própria senha |
| PUT | `/users/me/signature` | Atualiza cargo/telefone de assinatura |
| PUT | `/users/:id/role` | Altera role de outro usuário |
| DELETE | `/users/:id` | Exclui usuário |

### Propostas
| Método | Rota | O que faz |
|---|---|---|
| GET | `/proposals` | Lista propostas com dados de cliente |
| GET | `/proposals/kanban` | Lista para view Kanban |
| GET | `/proposals/:id` | Detalhe de uma proposta com itens |
| POST | `/proposals` | Cria proposta + gera PDF |
| DELETE | `/proposals/:id` | Exclui proposta e PDFs relacionados |
| PUT | `/proposals/:id/kanban-status` | Move no Kanban |
| PUT | `/proposals/:id/execution` | Marca como executada |
| DELETE | `/proposals/:id/execution` | Remove selo de execução |
| PUT | `/proposals/:id/approval` | Registra aprovação (com upload de comprovante) |
| PUT | `/proposals/:id/billing` | Registra faturamento (NF obrigatória) |

### Clientes
| Método | Rota | O que faz |
|---|---|---|
| GET | `/clients` | Lista clientes |
| GET | `/clients/search` | Busca por query |
| GET | `/clients/profit-analysis` | Análise de lucratividade |
| GET | `/clients/:id` | Detalhe do cliente |
| POST | `/clients` | Cria cliente |
| PUT | `/clients/:id` | Atualiza cliente |
| DELETE | `/clients/:id` | Exclui cliente |

### Peças e Categorias
| Método | Rota | O que faz |
|---|---|---|
| GET | `/parts` | Lista peças |
| GET | `/parts/search` | Busca por query |
| GET | `/parts/:id` | Detalhe da peça |
| POST | `/parts` | Cria peça |
| PUT | `/parts/:id` | Atualiza peça |
| DELETE | `/parts/:id` | Exclui peça |
| GET | `/parts/:id/price-history` | Histórico de preços da peça |
| GET | `/parts/:id/price-history-client` | Histórico por cliente |
| GET | `/parts/:id/price-comparison` | Comparação de preços |
| GET | `/parts/:id/client-price-references` | Referências de preço por cliente |
| POST | `/parts/:id/client-price-references` | Cria/atualiza referência de preço |
| GET | `/part-categories` | Lista categorias de peças |
| POST | `/part-categories` | Cria categoria |
| PUT | `/part-categories/:id` | Atualiza categoria |
| DELETE | `/part-categories/:id` | Exclui categoria |

### Estoque
| Método | Rota | O que faz |
|---|---|---|
| GET | `/stock` | Lista peças com quantidade atual |
| GET | `/stock/movements` | Lista movimentações |
| POST | `/stock/movements` | Registra entrada ou saída |
| GET | `/stock/contract-spend` | Gasto por contrato de cliente |
| GET | `/stock/movements-by-date` | Movimentações filtradas por data |
| POST | `/stock/inventory-count` | Contagem de inventário |

### Kanban
| Método | Rota | O que faz |
|---|---|---|
| GET | `/kanban/cards` | Lista todos os cards (propostas + tarefas) |
| POST | `/kanban/tasks` | Cria tarefa avulsa |
| PUT | `/kanban/tasks/:id` | Atualiza tarefa |
| PUT | `/kanban/tasks/:id/status` | Move tarefa no Kanban |
| DELETE | `/kanban/tasks/:id` | Exclui tarefa (admin only) |
| POST | `/kanban/tasks/:id/link-proposal` | Vincula tarefa a proposta |
| GET | `/kanban/comments/:type/:id` | Lista comentários de um card |
| POST | `/kanban/comments` | Adiciona comentário |

### Itens / Histórico
| Método | Rota | O que faz |
|---|---|---|
| GET | `/items/search` | Busca itens de propostas anteriores |
| GET | `/items/last-price` | Último preço de um item para um cliente |

### Módulo Financeiro
| Endpoint | Módulo |
|---|---|
| `/fornecedores/*` | CRUD de fornecedores |
| `/categorias-despesa/*` | CRUD de categorias de despesa |
| `/notas-recebidas/*` | CRUD de notas recebidas (com upload) |
| `/contas-pagar/*` | CRUD de contas a pagar (com baixa e cancelamento) |

### Outros
| Método | Rota | O que faz |
|---|---|---|
| GET | `/health` | Verifica conexão com PostgreSQL |
| GET | `/responsaveis/*` | CRUD de responsáveis (legado) |
| GET | `/objetos/*` | CRUD de objetos de proposta |
| GET | `/commercial-conditions/*` | CRUD de condições comerciais |
| GET | `/files/:filename` | Serve PDFs de propostas |
| GET | `/files/approvals/*` | Serve comprovantes de aprovação |
| GET | `/files/notas/*` | Serve arquivos de notas recebidas |
| GET | `/files/comprovantes/*` | Serve comprovantes de pagamento |

---

## 11. Frontend

### Estrutura
- **Framework:** React 18+ com Vite
- **Roteamento:** React Router DOM com `basename="/app"` — toda a SPA vive em `/app/*`
- **CSS:** Global único (`styles.css`) sem CSS Modules ou styled-components
- **Estado de autenticação:** `AuthContext` com `user`, `loading`, `login`, `logout`

### Páginas
| Componente | Rota | Descrição |
|---|---|---|
| `Login.jsx` | `/login` | Pública |
| `Dashboard.jsx` | `/` | Página inicial com links rápidos |
| `NovaProposta.jsx` | `/nova-proposta` | ★ Mais complexa: formulário completo de proposta |
| `Proposals.jsx` | `/proposals` | Listagem de propostas |
| `Kanban.jsx` | `/kanban` | Board Kanban com drag-and-drop visual |
| `Clients.jsx` | `/clients` | CRUD de clientes |
| `Parts.jsx` | `/parts` | CRUD de peças |
| `Stock.jsx` | `/stock` | Controle de estoque |
| `Fornecedores.jsx` | `/fornecedores` | CRUD de fornecedores |
| `NotasRecebidas.jsx` | `/notas-recebidas` | Notas fiscais recebidas |
| `ContasPagar.jsx` | `/contas-pagar` | Contas a pagar |
| `Financeiro.jsx` | `/financeiro` | Dashboard financeiro com gráfico |
| `Objetos.jsx` | `/objetos` | Objetos e condições comerciais |
| `Responsaveis.jsx` | `/responsaveis` | Responsáveis legados |
| `Usuarios.jsx` | `/usuarios` | Gestão de usuários |

### Componentes compartilhados
- `AppLayout.jsx`: Layout com `<Navbar>` + `<Outlet>`
- `Navbar.jsx`: Menu agrupado em Comercial / Operacional / Financeiro + logout
- `ProtectedRoute.jsx`: Redireciona para `/login` se não autenticado
- `Toast.jsx`: Notificação temporária (sucesso/erro)
- `ConfirmModal.jsx`: Modal de confirmação antes de ações destrutivas
- `Loading.jsx`: Indicador de carregamento (Suspense fallback)

### Chamadas de API
- Centralizadas em `frontend/src/api/http.js` com `credentials: 'include'` em todas as requisições.
- Cada módulo tem seu arquivo `api/xxx.js` com funções nomeadas.
- Erros HTTP são convertidos em `Error` com `err.status` e `err.data`.

### Formulários
- Controlados com `useState` do React.
- Sem biblioteca de formulários (Formik, react-hook-form) — controle manual.
- Validações feitas no submit antes de chamar a API.

### Code splitting
- Login e Dashboard carregados imediatamente.
- Demais páginas carregadas via `React.lazy` + `Suspense`.

### Pontos frágeis
- `NovaProposta.jsx` é uma tela muito complexa e de longo estado — qualquer alteração requer atenção.
- A lógica de permissões do Kanban é **duplicada** entre `Kanban.jsx` e `shared/domain/kanban.js` — se a regra mudar no backend, precisa ser atualizada também no frontend.

---

## 12. Backend

### Estrutura
- Arquivo principal: `src/app.js` — todas as rotas registradas diretamente nele (sem arquivos de rotas separados).
- Módulos organizados como `controller → service → repository`.
- Sem framework web além do Express puro.

### Middlewares (em ordem)
1. `express-session` com `BetterSQLiteStore` (TTL 8h, sessões em `sessions.sqlite`)
2. `requireAuth` — bloqueia rotas não autenticadas (libera `/auth/login`, `/auth/logout`, `/health`, `/assets/`, `/app/`)
3. `express.json()` — parse de body JSON
4. `express.static()` — serve `public/`, PDFs em `/files/`, uploads em `/files/approvals/`, `/files/notas/`, `/files/comprovantes/`

### Organização por módulos
Cada módulo em `src/modules/{nome}/` tem:
- `{nome}.controller.js` — recebe `req`, extrai dados, chama service, retorna JSON
- `{nome}.service.js` — lógica de negócio e validações de domínio
- `{nome}.repository.js` — queries Prisma, mappers de `camelCase` (Prisma) para `snake_case` (API)

### Tratamento de erros
- `errorHandler.js` (global): captura erros lançados pelos controllers. Códigos especiais: `VALIDATION` → 400, `NOT_FOUND` → 404, `CONFLICT` → 409, `FORBIDDEN` → 403.
- Erros do Prisma: código `P2002` (violação de unique) tratado no `proposal.service.js`.

### Conexão com banco
- `src/db/prisma.js`: singleton `PrismaClient` com `@prisma/adapter-pg` + `pg.Pool`.
- URL: variável `DATABASE_URL` do `.env`.

### Upload de arquivos
- `src/middleware/upload.js`: 3 instâncias de Multer com destinos e filtros diferentes:
  - `uploadApproval`: imagens até 5MB → `output/approvals/`
  - `uploadNota`: PDF/XML até 10MB → `output/notas-recebidas/`
  - `uploadComprovante`: imagens/PDF até 5MB → `output/comprovantes/`

### Validações
- Feitas nos services com `throw Object.assign(new Error(msg), { code: 'VALIDATION' })`.
- Sem biblioteca de validação de schema (Zod, Joi, etc.) — validações manuais.

---

## 13. Banco de Dados

### Tipo e ORM
- **Banco:** PostgreSQL 16 (produção e desenvolvimento)
- **ORM:** Prisma 7.x com adapter `@prisma/adapter-pg`
- **Config:** `prisma.config.ts` + `DATABASE_URL` no `.env`

### Banco de sessões (separado)
- **Tipo:** SQLite via `better-sqlite3`
- **Arquivo:** `sessions.sqlite` (na raiz do projeto)
- **Motivo:** Infraestrutura de sessão separada dos dados de domínio.

### Models (tabelas)
| Model | Tabela | Descrição |
|---|---|---|
| User | users | Usuários do sistema |
| Client | clients | Clientes externos |
| Part | parts | Peças e componentes |
| PartCategory | part_categories | Categorias de peças |
| Proposal | proposals | Propostas comerciais |
| ProposalItem | proposal_items | Itens de proposta |
| CommercialCondition | commercial_conditions | Condições reutilizáveis |
| Objeto | objetos | Textos de objeto de proposta |
| Responsavel | responsaveis | **Legado** — responsáveis externos |
| PriceHistory | price_history | Histórico de preços por cliente |
| PartClientPriceRef | part_client_price_references | Referência de preço peça-cliente |
| KanbanTask | kanban_tasks | Tarefas avulsas do Kanban |
| KanbanComment | kanban_comments | Comentários polimórficos do Kanban |
| StockMovement | stock_movements | Movimentações de estoque |
| Fornecedor | fornecedores | Fornecedores |
| CategoriaDespesa | categorias_despesa | Categorias de despesa |
| NotaRecebida | notas_recebidas | Notas fiscais recebidas |
| ItemNotaRecebida | itens_nota_recebida | Itens de nota fiscal |
| ContaPagar | contas_pagar | Contas a pagar |

### Enums
- `Role`: `admin`, `user`, `comercial`, `tecnico`, `financeiro`
- `KanbanStatus`: `pendente_envio`, `enviado`, `aguardando_compra`, `comprado`, `pendente_execucao`, `faturar`, `faturado`
- `MovementType`: `entrada`, `saida`
- `ContaStatus`: `em_aberto`, `pago`, `cancelado`
- `NotaStatus`: `lancada`, `cancelada`
- `TipoNota`: `produto`, `servico`, `misto`

### Migrations
- Única migration: `20260525153903_init_schema` — DDL completo.
- Índices parciais do SQLite original foram adaptados para PostgreSQL (NULLs tratados como distintos em constraints UNIQUE).

### Arquivo de banco antigo
- `database.sqlite` ainda existe na raiz — **é o banco SQLite legado, não usado pelo backend atual**. Pode ser removido com segurança após confirmação.

### Pontos de risco
- `KanbanComment` não tem FK real para `kanban_tasks` ou `proposals` — integridade polimórfica mantida apenas no código.
- CNPJ de cliente não tem constraint `@unique` — deduplicação é responsabilidade do service.
- Sem migrations incrementais — apenas o schema inicial. Qualquer alteração futura exige nova migration.

---

## 14. Autenticação, Usuários e Permissões

### Login
- POST `/auth/login` com `{ username, password }`.
- Backend: `bcrypt.compare(password, user.password_hash)`.
- Sessão: `req.session.userId`, `req.session.userRole`, `req.session.userNome`.
- Cookie: HTTPOnly, SameSite=Lax, MaxAge=8h, Secure em produção.

### Cadastro
- Somente via `POST /users` (não há auto-cadastro público).
- **A CONFIRMAR:** Se existe validação de role no backend para proteger esta rota (apenas admins poderiam criar usuários).

### Sessão
- Store: `BetterSQLiteStore` em `sessions.sqlite`.
- TTL: 8 horas. Limpeza automática a cada 15 minutos.

### Permissões
- Verificadas no service, não no middleware de rota (sem RBAC estruturado por rota).
- Regras por role estão em `auth.service.js` (usuários) e `shared/domain/kanban.js` (Kanban).

### Assinatura do usuário
- Campos `signature_cargo` e `signature_telefone` em `users`.
- Atualizados via `PUT /users/me/signature`.
- Usados como dado padrão do responsável na criação de proposta.

### O que acontece sem assinatura
- A CONFIRMAR: o frontend pode enviar assinatura vazia. O backend não valida obrigatoriedade de `responsavel.cargo` ou `responsavel.telefone` explicitamente no service (apenas `responsavel.nome` é verificado indiretamente via `data.responsavel.nome`).

---

## 15. Propostas e Geração de PDF

### Criação
- Endpoint: `POST /proposals` com payload JSON completo.
- Campos obrigatórios: `numero_proposta`, `items` (com ao menos 1 item válido), `cliente` (objeto ou `cliente_id`), `condicoes` (forma_pagamento, prazo_pagamento, prazo_entrega, garantia, validade), `responsavel` (nome, cargo, telefone).

### Itens
- Descrição obrigatória, quantidade inteira > 0, valor unitário >= 0.
- NCM é opcional.
- `part_id` é opcional — se não fornecido, o sistema tenta encontrar ou criar a peça automaticamente.

### Cálculo de valores
- `valor_total = soma(quantidade * valor_unitario)` — calculado no backend, não aceito do frontend.
- `valor_total_extenso` gerado por `valorPorExtenso()` em `shared/utils/extensao.js`.

### Número da proposta
- Informado manualmente pelo usuário no frontend.
- Único no banco (`@unique` no schema).
- Sem formato obrigatório definido no código. Os PDFs existentes em `output/proposals/` mostram formatos variados usados durante o desenvolvimento (teste).

### Cliente e responsável
- Cliente: resolve por `cliente_id` (selecionado) ou por dados digitados (cria/reutiliza via `findOrCreateClient`).
- Responsável: snapshot copiado para a proposta no momento da criação.

### Geração do PDF
- Template: `proposal.template.hbs` (Handlebars).
- CSS: `proposal.css` injetado inline no HTML.
- Assets (logo, marcas d'água): convertidos para Data URI em base64 (`assetDataUri()`).
- Puppeteer renderiza 3 HTMLs em paralelo, pdf-lib mescla camadas.
- Primeira página: conteúdo + marca d'água p.1 (topo + rodapé específicos).
- Demais páginas: conteúdo + marca d'água fixa.

### Onde o arquivo é salvo
- `output/proposals/proposta-{numero_proposta}.pdf`
- Path salvo em `proposals.pdf_path`.

### Como o arquivo é acessado
- Via `/files/{filename}` → Express serve `output/proposals/` como estático.

### Problemas conhecidos
- Os muitos PDFs de teste em `output/proposals/` (proposta-TESTE-*.pdf etc.) indicam desenvolvimento iterativo intenso nesta área.

---

## 16. Assinatura / Responsável

### Onde ficam os dados
- **Atual (correto):** `users.signature_cargo` e `users.signature_telefone` — pertence ao usuário logado.
- **Legado:** tabela `responsaveis` — entidade separada que era usada anteriormente.

### Como aparecem na criação de proposta
- O frontend envia `responsavel: { nome, cargo, email, telefone }` no payload.
- O backend salva esses valores como snapshot na proposta (`responsavel_nome`, `responsavel_cargo`, `responsavel_email`, `responsavel_telefone`).
- Também salva `responsible_user_id`, `responsible_name`, `responsible_role`, `responsible_phone` como campos de referência.

### Como deveriam aparecer
- O usuário logado preenche `signature_cargo` e `signature_telefone` em "Meu Perfil".
- Ao criar proposta, o frontend pré-preenche o campo de responsável com os dados da assinatura do usuário logado (INFERIDO — a confirmar comportamento atual do `NovaProposta.jsx`).

### O que acontece sem assinatura
- A CONFIRMAR: se os campos estiverem vazios, o PDF será gerado sem cargo/telefone do responsável.

### Entidade legada
- `Responsavel` (tabela `responsaveis`) existe no banco e na API, mas o schema Prisma documenta explicitamente: *"Legado: responsaveis ainda existem no DB mas a assinatura oficial vem do User logado"*.
- A tela `Responsaveis.jsx` ainda existe e é acessível pelo menu (em Usuários/configurações).

---

## 17. Estados Conhecidos do Sistema

### Funciona
- Login e gestão de sessão.
- Criação de proposta com geração de PDF.
- Listagem e exclusão de propostas.
- Kanban com permissões por role.
- CRUD completo de clientes, peças, estoque, fornecedores.
- Módulo financeiro (notas recebidas + contas a pagar).
- Frontend React migrado completamente (15 telas).
- 408 testes backend passando.
- Build React sem warnings.
- Prisma/PostgreSQL como única fonte de verdade para dados de domínio.

### Parcial / A verificar
- Tela de Financeiro: dashboard com KPIs e gráfico — funcional mas sem filtros avançados.
- Análise de lucratividade por cliente (`/clients/profit-analysis`): implementada no backend, mas integração com frontend a verificar.
- Busca de histórico de preços na nova proposta: lógica complexa, verificar UX no estado atual.

### Legado
- `database.sqlite` na raiz — banco SQLite antigo, não usado, pode ser removido.
- Entidade `Responsavel` — mantida por compatibilidade, mas a assinatura oficial é do usuário.
- `Redirects de compatibilidade` em `app.js`: `/` → `/app/`, `/index.html` → `/app/`, `/proposals.html` → `/app/proposals` — intencionais.

### A confirmar
- Comportamento do campo `hasPartsContract` em clientes.
- Se existe validação de role para `POST /users` (quem pode criar usuários?).
- Como o número de proposta é gerado/sugerido ao usuário no frontend.

---

## 18. Problemas Técnicos e Riscos

### 1. Regras de Kanban duplicadas no frontend
- **Problema:** `canMoveKanban()` existe em `src/shared/domain/kanban.js` (backend) **e** reimplementada em `Kanban.jsx` (frontend).
- **Impacto:** Se a regra mudar no backend, o frontend precisa ser atualizado manualmente. Risco de divergência silenciosa.
- **Sugestão futura:** Expor as regras via API (ex: `GET /kanban/permissions`) ou manter frontend apenas como UI sem duplicar a lógica de autorização.

### 2. Sem validação de role em todas as rotas críticas
- **Problema:** `requireAuth.js` verifica apenas se há sessão ativa — não valida `userRole` por rota (exceto via service interno).
- **Impacto:** Um usuário autenticado com role `user` pode tentar `POST /proposals` — o bloqueio acontece apenas dentro do service se houver verificação explícita.
- **A CONFIRMAR:** Se existe verificação de role fora do Kanban.

### 3. KanbanComment sem FK real
- **Problema:** `kanban_comments.card_id` não tem FK para `proposals` ou `kanban_tasks`. Integridade mantida apenas no código.
- **Impacto:** Se uma tarefa ou proposta for deletada sem passar pelo service correto, comentários órfãos podem permanecer no banco.

### 4. CNPJ de cliente sem constraint unique
- **Problema:** `clients.cnpj` não tem `@unique` no schema. Deduplicação feita apenas no fluxo `findOrCreateClient()`.
- **Impacto:** Inserção direta no banco (Prisma Studio, seed, migration) pode criar clientes duplicados por CNPJ.

### 5. Formulários sem biblioteca de validação
- **Problema:** Validações manuais nos services (strings de erro hardcoded, sem schema tipado).
- **Impacto:** Dificuldade de manutenção e consistência. Mensagens de erro podem ser inconsistentes entre módulos.

### 6. Sem testes de integração de API HTTP
- **Problema:** Testes existentes testam services com mocks de repository. Não há teste que suba o servidor Express e faça requisições HTTP reais.
- **Impacto:** Problemas de middleware, roteamento ou serialização JSON podem passar despercebidos.

### 7. Número da proposta manual
- **Problema:** O número é definido pelo usuário sem formato obrigatório nem geração automática.
- **Impacto:** Inconsistência no formato dos PDFs gerados (histórico de desenvolvimento mostra formatos variados: `2026-001`, `TESTE-001`, `1011-2026`, etc.).

### 8. `database.sqlite` na raiz
- **Problema:** Banco SQLite antigo ainda presente na raiz do projeto.
- **Impacto:** Confusão para novos desenvolvedores. Risco de alguém tentar usar ou migrar dados deste arquivo.

### 9. Sem rate limiting ou proteção contra força bruta
- **Problema:** `POST /auth/login` não tem rate limiting.
- **Impacto:** Vulnerabilidade a ataques de força bruta em produção.

### 10. Puppeteer em produção
- **Problema:** Puppeteer instala Chromium no servidor. Requer `--no-sandbox` nas args (visível em `proposal-pdf.service.js`).
- **Impacto:** Aumento de consumo de memória na geração de PDFs. Requer ambiente de produção compatível (Linux com libs de Chromium).

---

## 19. Dívidas Técnicas

### Alta prioridade
- [ ] Remover `database.sqlite` (banco SQLite legado) da raiz após confirmação.
- [ ] Adicionar rate limiting no `POST /auth/login`.
- [ ] Documentar e centralizar validação de role por rota (ou garantir que todas as rotas sensíveis verificam role no service).

### Média prioridade
- [ ] Eliminar duplicação da lógica `canMoveKanban` entre backend e frontend.
- [ ] Adicionar constraint `@unique` ou trigger de deduplicação para CNPJ de cliente no banco.
- [ ] Implementar geração automática de número de proposta (ou validar formato obrigatório).
- [ ] Adicionar testes de integração HTTP (supertest ou similar).
- [ ] Avaliar e definir o futuro da entidade `Responsavel` (manter ou deprecar oficialmente).

### Baixa prioridade
- [ ] Mover `public/assets/logoGHTEC.png` para `frontend/public/` e remover `express.static(public)` do backend.
- [ ] Adicionar biblioteca de validação de schema (Zod) nos services.
- [ ] Criar índice de full-text search para busca de clientes/peças.
- [ ] Implementar paginação nas listagens (atualmente todas as listagens retornam todos os registros).

---

## 20. Padrões Atuais do Projeto

### Convenções de nome
- **Arquivos backend:** `snake_case` (ex: `proposal.service.js`, `nota_recebida.controller.js`)
- **Arquivos frontend:** `PascalCase` para componentes (ex: `NovaProposta.jsx`), `camelCase` para módulos de API (ex: `proposals.js`)
- **Banco de dados:** `snake_case` para tabelas e colunas (mapeado do camelCase Prisma)
- **API responses:** `snake_case` (os mappers dos repositories convertem de Prisma camelCase para snake_case)

### Como criar nova rota
1. Adicionar o handler em `src/app.js` na seção correta.
2. Criar `{modulo}.controller.js` com `async function handler(req, res)`.
3. Controller chama service e retorna JSON.
4. Usar o `errorHandler.js` global para erros (não capturar manualmente, deixar propagar).

### Como criar novo service
1. Criar `{modulo}.service.js` com funções async.
2. Validações: `throw Object.assign(new Error(msg), { code: 'VALIDATION' })`.
3. Não usar Prisma diretamente — usar repository.

### Como criar novo repository
1. Criar `{modulo}.repository.js`.
2. Importar `const prisma = require('../../db/prisma')`.
3. Criar mapper que converte camelCase Prisma para snake_case para a API.

### Como acessar banco
- Sempre via Prisma. Nunca SQL raw (exceto `/health` com `$queryRaw`).
- Instância singleton em `src/db/prisma.js`.

### Como tratar erros
- Services lançam erros com `code` (string): `VALIDATION`, `NOT_FOUND`, `CONFLICT`, `FORBIDDEN`.
- `errorHandler.js` mapeia esses codes para status HTTP.
- Erros Prisma `P2002` (unique violation) tratados explicitamente onde necessário.

### Como criar novo componente React
1. Criar arquivo `.jsx` em `pages/` (página) ou `components/` (compartilhado).
2. Para página nova, adicionar rota em `router.jsx` com `lazy()`.
3. Criar módulo de API em `frontend/src/api/{nome}.js` usando funções de `http.js`.
4. Usar `useState` para estado local, `useEffect` para carregamentos.

### Padrões inconsistentes identificados
- FK de usuário em `KanbanTask` usa `created_by` (sem sufixo `_user_id`), enquanto `StockMovement` usa `created_by_user_id` — inconsistência documentada no schema.
- Alguns modules usam `nota_recebida`, outros `notaRecebida` — normalizado no schema Prisma mas pode gerar confusão.

---

## 21. Como Desenvolver Novas Funcionalidades sem Quebrar o Sistema

### Antes de começar
1. Ler este `SYSTEM_CONTEXT.md` completamente.
2. Ler o `prisma/schema.prisma` para entender as entidades afetadas.
3. Identificar qual módulo em `src/modules/` é responsável pela funcionalidade.
4. Verificar se existe entidade legada similar (ex: `Responsavel` vs assinatura do User).

### Onde colocar regras de negócio
- **Em:** `{modulo}.service.js`
- **Não em:** controllers (devem ser finos), repositories (devem ser apenas queries), `app.js` (apenas roteamento)
- **Regras de domínio compartilhadas:** `src/shared/domain/`

### Como evitar duplicação
- Antes de criar uma função, verificar se existe algo similar em outro service ou em `shared/utils/`.
- Regras de Kanban: **sempre** usar `src/shared/domain/kanban.js`, não reimplementar.
- Não duplicar lógica de permissão entre frontend e backend.

### Como preservar compatibilidade
- Não renomear campos de resposta da API sem verificar o frontend.
- Não remover campos de `mapProposal()` sem verificar quais telas os usam.
- Se alterar o schema Prisma, criar migration e atualizar `src/generated/prisma/` com `npm run prisma:generate`.
- Após alterar schema: rodar `npm run prisma:migrate` (dev) ou `npm run prisma:deploy` (produção).

### Como testar manualmente
1. `npm start` para subir o backend.
2. `npm run frontend:dev` para o frontend em desenvolvimento.
3. Testar o fluxo completo: criação → listagem → edição → exclusão.
4. Testar geração de PDF se a funcionalidade afeta propostas.
5. Rodar `npm test` para garantir que os 408 testes passam.

---

## 22. Checklist Antes de Qualquer Alteração Futura

```
- [ ] Li o SYSTEM_CONTEXT.md completo
- [ ] Identifiquei qual fluxo será afetado
- [ ] Li o schema Prisma das entidades envolvidas
- [ ] Localizei os arquivos: controller + service + repository + página React + api/*.js
- [ ] Verifiquei se existe entidade legada similar (Responsavel, database.sqlite)
- [ ] Não dupliquei regra de negócio (especialmente Kanban)
- [ ] Se alterei o schema: criei migration e regenerei o client Prisma
- [ ] Se alterei response da API: verifiquei o impacto no frontend
- [ ] Rodei npm test e todos os 408 testes passaram
- [ ] Rodei npm run frontend:build sem erros
- [ ] Testei o fluxo principal manualmente no browser
- [ ] Atualizei este SYSTEM_CONTEXT.md se algo estrutural mudou
```

---

## 23. Glossário do Sistema

| Termo | Definição |
|---|---|
| **Proposta** | Documento comercial formal (PDF) apresentado a um cliente com descrição de itens, valores e condições. |
| **Cliente** | Empresa ou pessoa externa que recebe propostas da GHTec. |
| **Responsável** | (1) **Atual:** Usuário logado com cargo/telefone de assinatura. (2) **Legado:** Entidade `Responsavel` separada — não mais a fonte principal. |
| **Assinatura** | Conjunto de dados (nome, cargo, telefone) que aparece no rodapé do PDF da proposta, identificando quem emitiu. |
| **Item** | Linha da proposta com quantidade, descrição, valor unitário e NCM. Pode ou não ser vinculado a uma peça do cadastro. |
| **Peça** | Componente físico cadastrado com código interno, categoria, preço de compra e estoque. |
| **Equipamento** | Não é uma entidade própria no sistema atual. Aparece como texto livre nos campos "objeto" ou "descrição dos itens". |
| **Objeto** | Texto curto que descreve o propósito da proposta (ex: "Manutenção preventiva em monitor Draeger"). Template reutilizável. |
| **Condição Comercial** | Template reutilizável de forma de pagamento, prazo, entrega, garantia e validade. |
| **Kanban** | Quadro de acompanhamento do ciclo de vida das propostas, da emissão ao faturamento. |
| **Card** | Um item no Kanban — pode ser uma proposta ou uma tarefa avulsa. |
| **Tarefa avulsa** | Card do Kanban que não é proposta — criado manualmente, pode ser vinculado a uma proposta. |
| **Execução** | Marco que indica que o serviço/entrega da proposta foi realizado. Pré-requisito para ir para "Faturar". |
| **Aprovação** | Registro de que o cliente aprovou a proposta. Pode incluir comprovante de aprovação (imagem). |
| **Faturamento** | Emissão de nota fiscal para a proposta executada e aprovada. Requer número de NF. |
| **Nota Recebida** | Nota fiscal recebida de um fornecedor (NF-e). |
| **Conta a Pagar** | Obrigação financeira com um fornecedor, podendo ou não ser originada de uma nota recebida. |
| **Baixa** | Registro do pagamento de uma conta a pagar. |
| **Role** | Papel/perfil do usuário no sistema (`admin`, `user`, `comercial`, `tecnico`, `financeiro`). |
| **Snapshot** | Cópia de dados no momento da criação de proposta (responsável, preços) que não se altera mesmo se o dado original mudar. |
| **PDF** | Arquivo gerado via Puppeteer + Handlebars + pdf-lib a partir de um template HTML. |
| **Marca d'água** | Imagens sobrepostas ao conteúdo do PDF (topo da página 1, rodapé da página 1, fundo das demais páginas). |
| **Código interno** | Código único da peça, gerado como `[CATEGORIA_CODE]-[identity_code]`. |
| **NCM** | Nomenclatura Comum do Mercosul — código fiscal de classificação de produto. Opcional nos itens. |
| **Entidade legada** | Estrutura do sistema que existia antes e foi substituída, mas ainda está presente por compatibilidade (ex: `Responsavel`). |
| **Price History** | Tabela que registra o preço cobrado de cada item/peça para cada cliente em cada proposta. |
| **Price Reference** | Preço de referência de uma peça específica para um cliente específico — atualizado manualmente. |

---

## 24. Perguntas em Aberto

```
- [ ] O número da proposta deve seguir algum padrão obrigatório (ex: AAAA-NNN)?
      Ou pode ser completamente livre? Se livre, como evitar inconsistências?

- [ ] A entidade Responsavel (tabela responsaveis) ainda tem algum uso ativo?
      Pode ser removida ou deve ser mantida?

- [ ] Existe verificação de role no POST /users?
      Qualquer usuário autenticado pode criar usuários, ou apenas admins?

- [ ] O campo hasPartsContract em Client ativa alguma lógica no sistema atual?
      Qual comportamento especial ele deveria ter?

- [ ] O que deve acontecer se o usuário logado não tiver signature_cargo/telefone
      preenchidos ao criar uma proposta? O sistema deve bloquear ou apenas gerar
      o PDF com campos vazios?

- [ ] Existe processo de aprovação que deveria bloquear edição/exclusão
      de propostas depois de aprovadas?

- [ ] O database.sqlite na raiz do projeto pode ser removido com segurança?
      Os dados históricos nele são necessários?

- [ ] A tela de Financeiro deve ter filtros por período?
      Atualmente exibe apenas o mês atual.

- [ ] Existe intenção de expor o sistema para clientes (portal do cliente)?
      Isso afetaria a arquitetura de autenticação significativamente.

- [ ] Como deve funcionar o parcelamento em ContaPagar?
      Os campos parcela_numero e parcela_total existem, mas não há lógica
      de geração automática de parcelas identificada no código.
```

---

## 25. Resumo Executivo Final

### O que o sistema é hoje
O **GHTec ERP** é um sistema web interno completo para a GHTec Manutenção e Vendas de Equipamentos Hospitalares. O backend é uma API Express/Node.js com PostgreSQL (via Prisma), e o frontend é uma SPA React (Vite), servida pelo próprio Express em `/app/`. A migração do frontend vanilla para React foi concluída em maio de 2026.

### O que ele já faz
- Criação e geração automática de PDFs de propostas comerciais com marca da empresa.
- Acompanhamento do ciclo de vida das propostas via Kanban com controle de permissões por role.
- CRUD completo de clientes, peças, categorias, objetos e condições comerciais.
- Controle de estoque com movimentações de entrada e saída.
- Módulo financeiro: fornecedores, notas fiscais recebidas (NF-e) e contas a pagar com baixa e cancelamento.
- Gestão de usuários com 5 roles e assinatura de proposta por usuário.
- 408 testes automatizados de backend passando.

### Qual é a intenção
Ser o ERP operacional central da GHTec — desde a proposta comercial até o faturamento e controle de despesas —  reduzindo processos manuais, eliminando inconsistências de informação e permitindo rastreabilidade completa do atendimento ao cliente.

### Maiores riscos hoje
1. **Regras de Kanban duplicadas** entre backend e frontend — risco de divergência silenciosa ao alterar permissões.
2. **Sem rate limiting no login** — vulnerabilidade em produção.
3. **Número da proposta manual e sem formato** — inconsistência crescente no histórico.
4. **Nenhum teste de integração HTTP** — erros de middleware ou roteamento podem escapar.

### Próximo passo técnico mais lógico
Deploy em ambiente de staging/produção para smoke test completo, seguido da implementação de **geração automática do número de proposta** (elimina o principal ponto de inconsistência operacional) e **rate limiting no endpoint de login** (elimina o principal risco de segurança identificado).

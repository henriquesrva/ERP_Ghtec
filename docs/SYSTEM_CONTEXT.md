# SYSTEM_CONTEXT.md

## Função deste arquivo

Este arquivo representa a verdade estrutural atual do sistema.

Ele deve explicar o que o sistema é, qual problema resolve, como está organizado, quais são suas entidades principais, quais regras de negócio são permanentes e quais decisões técnicas já foram consolidadas.

Este arquivo deve ser usado por humanos e por IAs como referência principal antes de propor mudanças relevantes no sistema.

---

## Instruções para humanos e IA

Use este arquivo como fonte principal para entender o sistema.

Não transforme este arquivo em diário de bordo.

Não registre aqui bugs pontuais, ideias soltas, prompts, logs de terminal ou pequenas alterações visuais.

Só atualize este arquivo quando uma mudança alterar a estrutura permanente do sistema:
- novo módulo importante
- nova entidade central
- nova regra de negócio permanente
- mudança arquitetural
- mudança relevante no fluxo principal
- mudança relevante em permissões
- mudança relevante no modelo de dados

---

## O que deve entrar neste arquivo

- Objetivo do sistema
- Contexto de uso
- Stack principal
- Arquitetura geral
- Entidades principais
- Fluxos centrais
- Regras de negócio permanentes
- Permissões importantes
- Decisões técnicas consolidadas
- Integrações relevantes

---

## O que NÃO deve entrar neste arquivo

- Bugs pontuais
- Features ainda incertas
- Ideias soltas
- Ajustes pequenos de UI
- Histórico completo de alterações
- Prompts de IA
- Logs de terminal
- Senhas, tokens, chaves de API
- Dados sensíveis de clientes
- Preços reais desnecessários
- Informações fiscais sensíveis sem necessidade

---

# Sistema GHTec Propostas

## 1. Visão Geral do Projeto

**Nome:** GHTec Propostas

**Empresa:** GHTec Manutenção e Vendas de Equipamentos Hospitalares Ltda — empresa localizada em Nova Esperança/MG, atuante na manutenção e venda de equipamentos hospitalares.

**Objetivo principal:** Organizar, automatizar e profissionalizar o processo de criação, controle e emissão de propostas comerciais da GHTec, abrangendo desde o cadastro de clientes e peças até a geração de PDF com identidade visual da empresa, passando por controle de estoque, módulo financeiro e acompanhamento de negociações.

**Tipo de sistema:** Aplicação web interna (intranet). ERP leve com foco principal em propostas comerciais, evoluindo para cobrir processos financeiros e operacionais.

**Usuários esperados:** Equipe interna da GHTec. Perfis distintos por função: administrativo (admin), comercial, técnico, financeiro. Volume estimado: menos de 10 usuários simultâneos.

**Valor prático:** Elimina o processo manual de criação de propostas em Word/Excel, preserva histórico de preços praticados por cliente, padroniza o layout do documento comercial, centraliza o pipeline de negociações e oferece visibilidade do processo desde a proposta até o faturamento.

---

## 2. Intenção Estratégica do Sistema

**Por que foi construído:** Antes do sistema, as propostas eram montadas manualmente, sem histórico de preços, sem rastreamento do andamento das negociações e sem padronização de layout. Isso gerava inconsistência nos preços ofertados, trabalho repetitivo, falta de visibilidade do pipeline comercial e ausência de controle financeiro integrado às vendas.

**Processos manuais que substitui:**
- Criação de proposta em Word/Excel com layout manual
- Consulta histórica de preços praticados por cliente (feita de memória ou em planilhas)
- Controle do status de cada negociação (e-mail, anotações, etc.)
- Lançamento manual de contas a pagar e notas de entrada

**Ganho operacional:**
- Proposta gerada em minutos com dados pré-preenchidos e PDF formatado
- Preço sugerido automaticamente com base no histórico por cliente
- Pipeline visual (Kanban) com responsabilidades claras por role
- Rastreabilidade de aprovação, execução e faturamento de cada proposta

**Como pode escalar no futuro:**
- Expansão para módulo fiscal completo (integração com SEFAZ/NF-e)
- Integração automática entre estoque e execução de propostas
- Relatórios e dashboards de conversão e lucratividade
- Possibilidade de transformar em produto SaaS multi-tenant para outras empresas do setor de manutenção de equipamentos

**Decisões de produto importantes:**
- Foco inicial em propostas, com módulos de suporte (financeiro, estoque) crescendo de forma incremental
- Usabilidade operacional priorizada sobre aparência — é uma ferramenta de uso diário
- Histórico inteligente de preços é diferencial crítico do sistema

---

## 3. Stack Técnica

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js (CommonJS) |
| Framework backend | Express 4 |
| Banco de dados principal | PostgreSQL via Prisma 7.x + `@prisma/adapter-pg` |
| Banco de dados de sessão | SQLite via `better-sqlite3` (`sessions.sqlite`) |
| Autenticação | `express-session` + `bcryptjs` |
| Template de PDF | Handlebars (`.hbs`) |
| Renderização de PDF | Puppeteer (headless Chrome) |
| Merge de PDF | `pdf-lib` |
| Upload de arquivos | Multer |
| Frontend | React 18 + Vite 5 + React Router v6 em `frontend/` — servido em `/app/` (migração concluída em 2026-05) |
| Gerenciador de pacotes | npm |

**Dependências (`package.json`):**
```
@prisma/adapter-pg — driver adapter Prisma para PostgreSQL
@prisma/client     — cliente Prisma gerado
bcryptjs           — hash de senhas
better-sqlite3     — banco de sessões (sessions.sqlite via sessionStore.js)
dotenv             — carregamento de .env
express            — framework HTTP
express-session    — gerenciamento de sessão
handlebars         — template para PDF
multer             — upload de arquivos
pdf-lib            — manipulação e merge de PDFs
pg                 — driver PostgreSQL nativo
puppeteer          — renderização headless do PDF
```

**Dependências de desenvolvimento (`devDependencies`):**
```
prisma            — CLI do Prisma (migrações, introspect, studio)
vitest            — runner de testes
```

> **Migração Prisma/PostgreSQL concluída (Passo 3.6).** Todos os módulos de negócio usam Prisma/PostgreSQL. `src/db/` contém apenas `prisma.js` (singleton com `@prisma/adapter-pg`). `better-sqlite3` permanece exclusivamente para `sessionStore.js` (`sessions.sqlite`). PostgreSQL local via `docker-compose.yml`. Migration `20260525153903_init_schema` aplicada. Ver `docs/PRISMA_SETUP.md` e `docs/POSTGRES_CUTOVER_PLAN.md` para detalhes.

**Variáveis de ambiente (`.env`):**
```
SESSION_SECRET    — segredo do cookie de sessão (obrigatório em produção)
PORT              — porta do servidor (padrão: 3000)
NODE_ENV          — development | production
DATABASE_URL      — PostgreSQL (usado por Prisma CLI e runtime)
```

**Como rodar (desenvolvimento):**
```bash
npm install
docker compose up -d postgres    # sobe PostgreSQL local
npm run prisma:generate           # gera client Prisma
npm run prisma:migrate            # aplica migrations (apenas na primeira vez)
node scripts/seed-postgres.js     # cria usuário admin (run once, idempotente)
npm run dev                       # sobe o servidor Express (porta 3000)
npm run frontend:dev              # Vite dev server com HMR (porta 5173) — opcional
```

**Frontend React (build de produção):**
```bash
npm run frontend:build            # gera frontend/dist/ (servido pelo Express em /app/)
```

**Como fazer deploy em produção:** ver `docs/DEPLOY_POSTGRES.md`.

**Acesso Express:** `http://localhost:3000` (API + legado)
**Acesso React (dev):** `http://localhost:5173/app/` (Vite dev server com proxy)
**Acesso React (prod):** `http://localhost:3000/app/` (build servido pelo Express)

**Credenciais padrão (primeira execução):** `admin / admin123` — deve ser trocada imediatamente.

---

## 4. Arquitetura Geral

### Estrutura de Pastas

```
propostas_automaticas/
├── src/
│   ├── server.js              # Entry point — carrega .env, roda migrate, sobe Express
│   ├── app.js                 # Express app — middlewares globais, registro de rotas
│   ├── assets/                # Imagens para geração do PDF (logo, marcas d'água)
│   │   ├── LogoGHTEC.png
│   │   ├── marcatopo.png      # Marca d'água: topo da página 1
│   │   ├── marcabaixo.jpg     # Marca d'água: rodapé da página 1
│   │   └── marca_fixa.png     # Marca d'água: páginas 2+
│   ├── db/
│   │   ├── connection.js      # Instância única do SQLite (better-sqlite3)
│   │   ├── init.js            # Criação inicial das tabelas core (clientes, peças, propostas)
│   │   └── migrate.js         # Migrações incrementais: ALTER TABLE, novos índices, backfills
│   ├── middleware/
│   │   ├── requireAuth.js     # Proteção de rotas (libera login, assets)
│   │   ├── errorHandler.js    # Handler global de erros HTTP
│   │   ├── notFoundHandler.js # 404 padrão
│   │   ├── sessionStore.js    # Session store persistente (better-sqlite3)
│   │   └── upload.js          # Multer: 3 instâncias (approval, nota, comprovante)
│   ├── modules/               # Um módulo por domínio/entidade
│   │   ├── auth/              # Login, usuários, roles, assinatura pessoal
│   │   ├── proposal/          # Propostas: criação, PDF, kanban status
│   │   ├── client/            # Clientes e análise de lucratividade
│   │   ├── part/              # Peças, histórico de preços, referências por cliente
│   │   ├── category/          # Categorias de peças
│   │   ├── condition/         # Condições comerciais (templates)
│   │   ├── responsavel/       # Responsáveis comerciais
│   │   ├── objeto/            # Objetos de proposta (templates de escopo)
│   │   ├── kanban/            # Tarefas manuais e comentários do kanban
│   │   ├── stock/             # Estoque e movimentações
│   │   ├── fornecedor/        # Fornecedores
│   │   ├── categoria_despesa/ # Categorias de despesa
│   │   ├── nota_recebida/     # Notas fiscais de entrada
│   │   └── conta_pagar/       # Contas a pagar
│   └── shared/utils/
│       ├── currency.js        # Formatação monetária (R$ 1.234,56 via Intl)
│       ├── date.js            # Utilitários de data
│       ├── extensao.js        # Valor por extenso (limitado: só 0–10)
│       └── normalize.js       # Remove acentos, converte para lowercase, colapsa espaços
├── public/                    # Assets estáticos servidos pelo Express
│   └── assets/logoGHTEC.png   # Logo do frontend (referenciada por URL em /assets/logoGHTEC.png)
├── frontend/                  # Aplicação React + Vite
│   ├── index.html             # Entry point HTML (sem link externo de CSS — bundlado pelo Vite)
│   ├── vite.config.js         # Vite: base="/app/", proxy para Express, build → dist/
│   ├── package.json           # Dependências React (react, react-dom, react-router-dom)
│   ├── dist/                  # Build de produção — servido em /app/ pelo Express
│   └── src/
│       ├── main.jsx           # Render root — importa styles.css
│       ├── styles.css         # Design system global (tokens CSS, componentes) — bundlado pelo Vite
│       ├── App.jsx            # BrowserRouter (basename="/app") + AuthProvider
│       ├── router.jsx         # Rotas: todas as 15 telas React (migração concluída)
│       ├── contexts/AuthContext.jsx  # Estado global de auth (GET /auth/me)
│       ├── hooks/useAuth.js   # Shortcut para AuthContext
│       ├── api/               # Módulos fetch por domínio (http.js, auth.js, proposals.js)
│       ├── components/layout/ # Navbar, AppLayout, ProtectedRoute
│       ├── components/shared/ # Toast, ConfirmModal, Loading
│       └── pages/             # Login, Dashboard, Proposals, LegacyRedirect
└── output/                    # Gerado em runtime (não versionado no git)
    ├── proposals/             # PDFs gerados das propostas
    ├── approvals/             # Comprovantes de aprovação (imagens)
    ├── comprovantes/          # Comprovantes de pagamento (imagens/PDFs)
    └── notas-recebidas/       # PDFs e XMLs de notas fiscais de entrada
```

### Padrão de Módulo

Cada módulo segue rigorosamente a separação em três camadas:

```
controller.js   → Parse HTTP (req/res), sem lógica de negócio
service.js      → Regras de negócio, validações, orquestração
repository.js   → Queries SQL diretas, sem lógica de negócio
```

**Regra importante:** Todos os `repository.js` são **async** (usam Prisma Client). O padrão `async/await` permeia controller → service → repository.

### Comunicação Frontend ↔ Backend

REST API pura. O frontend faz `fetch()` para endpoints JSON do Express. Não há SSR — o Express serve o build React (`frontend/dist/`) em `/app/` e toda a lógica de interface roda no browser como SPA React. `public/` serve apenas assets estáticos (`assets/logoGHTEC.png`).

### Fluxo de Dados

```
Usuário → HTML/JS do browser → fetch() → Express (app.js)
    → requireAuth middleware
    → controller (parse req, responde res)
    → service (regras de negócio, async/await)
    → repository (Prisma Client async)
    → PostgreSQL (Docker/produção)
    → resposta JSON → frontend → DOM
```

Para geração de PDF, o fluxo diverge:

```
service → Handlebars (compila template .hbs) → HTML string
        → Puppeteer (3 abas paralelas: conteúdo + 2 marcas d'água)
        → 3 buffers de PDF
        → pdf-lib (merge das 3 camadas por página)
        → arquivo .pdf em output/proposals/
        → URL retornada ao frontend
```

---

## 5. Entidades Principais do Domínio

### `clients` — Clientes
Quem compra peças/serviços da GHTec. Identificados preferencialmente pelo CNPJ.

**Campos principais:** `id`, `nome`, `razao_social`, `nome_fantasia`, `cnpj` (único quando preenchido), `inscricao_estadual`, `endereco`, `cidade`, `estado`, `cep`, `email`, `telefone`, `contato_responsavel`, `observacoes`, `has_parts_contract` (flag: tem contrato de peças).

**Relacionamentos:** `proposals`, `price_history`, `part_client_price_references`, `stock_movements`.

---

### `parts` — Peças
Catálogo de peças e componentes. Cada peça é identificada pela tripla `(nome, marca, modelo)`, que é única.

**Campos principais:** `id`, `nome`, `descricao`, `marca`, `modelo`, `categoria` (texto legado — não usar), `category_id` (FK para `part_categories`), `identity_code` (sufixo sequencial), `codigo_interno` (gerado: `{category.code}-{identity_code}`), `ncm`, `preco_compra` (obrigatório), `stock_quantity`, `observacoes`.

**Constraints:** `UNIQUE(nome, marca, modelo)` e índice único em `codigo_interno` quando não nulo.

**Relacionamentos:** `part_categories`, `price_history`, `part_client_price_references`, `stock_movements`, `proposal_items`, `itens_nota_recebida`.

---

### `part_categories` — Categorias de Peças
Classificações com código prefixo para geração do código interno das peças.

**Campos:** `id`, `name`, `code` (único, ex: `"MOT"`, `"ELE"`).

**Uso:** Código interno = `{category.code}-{identity_code}`, ex: `"MOT-001"`.

---

### `proposals` — Propostas Comerciais
Coração do sistema. Cada proposta é um documento comercial formal com PDF associado.

**Campos base:** `id`, `numero_proposta` (único), `cliente_id`, `cidade_emissao`, `data_emissao` (gerada pelo servidor), `objeto_proposta`, `forma_pagamento`, `prazo_pagamento`, `prazo_entrega`, `garantia`, `validade`, `valor_total`, `valor_total_extenso`, `pdf_path`.

**Responsável (snapshot):** `responsavel_nome`, `responsavel_cargo`, `responsavel_email`, `responsavel_telefone`, `responsible_user_id`, `responsible_name`, `responsible_role`, `responsible_phone`. Os dados são gravados como snapshot para que o PDF nunca mude retroativamente.

**Condição comercial:** `commercial_condition_id` (FK para `commercial_conditions`).

**Kanban:** `kanban_status`, `kanban_status_updated_at`.

**Execução:** `execution_completed`, `execution_date`, `executed_by`, `execution_os`, `execution_details`, `execution_marked_by_user_id`, `execution_marked_at`.

**Aprovação:** `approval_date`, `approval_notes`, `approval_attachment_path`, `approval_registered_by_user_id`, `approval_registered_at`.

**Faturamento:** `billing_date`, `invoice_number`, `billing_notes`, `billed_by_user_id`, `billed_at`.

---

### `proposal_items` — Itens da Proposta
Linhas da tabela de itens de cada proposta.

**Campos:** `id`, `proposal_id`, `item_ordem`, `quantidade`, `descricao`, `valor_unitario`, `ncm`.

**Nota:** `descricao` é texto livre. Pode ou não estar vinculada a uma peça do catálogo. O vínculo acontece via `price_history.part_id`.

---

### `price_history` — Histórico de Preços
Registra automaticamente o preço praticado por item, por cliente, por proposta. Gerado no momento da criação de cada proposta.

**Campos:** `id`, `client_id`, `part_id` (opcional), `proposal_id`, `descricao_original`, `descricao_normalizada` (sem acentos, lowercase — para busca fuzzy), `quantidade`, `valor_unitario`, `data_proposta`, `numero_proposta`.

**Índices:** `(client_id, part_id)` e `(client_id, descricao_normalizada)` — chave para performance da sugestão de preço.

**Uso:** Na tela de nova proposta, ao digitar um item, o sistema busca o último preço usado para aquele cliente + item e sugere automaticamente.

---

### `part_client_price_references` — Preço de Referência por Peça/Cliente
Preço fixo de referência definido manualmente por um admin para um par `(peça, cliente)`. Tem prioridade sobre o `price_history` na sugestão de preço.

**Campos:** `id`, `part_id`, `client_id`, `reference_price`, `source` (default `'manual'`), `notes`, `created_by_user_id`, `updated_by_user_id`.

**Constraint:** `UNIQUE(part_id, client_id)` — um único registro por par. Operação via UPSERT.

---

### `responsaveis` — Responsáveis Comerciais
Profissionais da GHTec que assinam as propostas. Podem diferir do usuário logado.

**Campos:** `id`, `nome`, `telefone`, `cargo`.

**Nota:** Se o usuário logado tiver `signature_cargo` e `signature_telefone` configurados, esses dados são auto-preenchidos no formulário de proposta.

---

### `objetos` — Objetos de Proposta
Templates de texto para o campo "Objeto da Proposta" (descrição do escopo do fornecimento).

**Campos:** `id`, `nome`, `descricao`.

---

### `commercial_conditions` — Condições Comerciais
Templates reutilizáveis de condições comerciais para preencher uma proposta rapidamente.

**Campos:** `id`, `name`, `forma_pagamento`, `prazo_pagamento`, `prazo_entrega`, `garantia`, `validade`.

---

### `users` — Usuários do Sistema
**Campos:** `id`, `nome`, `username` (único), `password_hash`, `role`, `signature_cargo`, `signature_telefone`.

**Roles disponíveis:** `admin`, `user`, `comercial`, `tecnico`, `financeiro`.

---

### `kanban_tasks` — Tarefas Manuais no Kanban
Cards livres (não ligados a propostas) para o board kanban interno.

**Campos:** `id`, `title`, `description`, `kanban_status`, `created_by`.

---

### `kanban_comments` — Comentários do Kanban
Comentários em cards (propostas ou tarefas manuais). Inclui comentários automáticos gerados pelo sistema a cada evento.

**Campos:** `id`, `card_type` (`'proposal'` ou `'task'`), `card_id`, `user_id`, `user_nome`, `comment`, `created_at`.

---

### `stock_movements` — Movimentações de Estoque
Entradas e saídas de peças do estoque.

**Campos:** `id`, `part_id`, `movement_type`, `quantity`, `entry_type`, `proposal_id`, `client_id`, `notes`, `created_by_user_id`, `previous_quantity`, `new_quantity`.

---

### Módulo Financeiro

**`fornecedores`** — Fornecedores: `razao_social`, `nome_fantasia`, `cnpj`, `ativo`.

**`categorias_despesa`** — Categorias de despesa: `nome`, `descricao`, `ativo`.

**`notas_recebidas`** — Notas fiscais de entrada: fornecedor, número, série, chave de acesso, tipo, valores totais, campos fiscais completos (ICMS, IPI, PIS, COFINS, ISS, frete, seguro, desconto), arquivo PDF e XML, status (`lancada`/`cancelada`).

**`itens_nota_recebida`** — Itens da NF com todos os campos tributários por linha: CST, CSOSN, CFOP, NCM, base de cálculo, alíquotas e valores por tributo.

**`contas_pagar`** — Contas a pagar vinculadas a fornecedores e notas: vencimento, status (`em_aberto`/`pago`/`cancelado`), valor pago, comprovante de pagamento, parcelamento (`parcela_numero`/`parcela_total`), cancelamento com motivo.

---

## 6. Fluxos Principais do Sistema

### 6.1 Cadastro de Clientes

Acesso via `/app/clients`. CRUD completo. Campos: razão social, nome fantasia, CNPJ, inscrição estadual, endereço, contato, observações, flag de contrato de peças.

Busca por nome (autocomplete) e por CNPJ. Não há validação de formato de CNPJ — é armazenado como texto.

### 6.2 Cadastro de Peças

Acesso via `/app/parts`. CRUD completo com validação de unicidade por `(nome, marca, modelo)`. Campos obrigatórios: nome e preço de compra.

Ao cadastrar, seleciona a categoria e preenche o `identity_code` (ex: `001`). O sistema gera automaticamente o `codigo_interno` como `{category.code}-{identity_code}` (ex: `MOT-001`). O código é único — o sistema bloqueia duplicatas.

A tela de peças também exibe histórico de preços por peça e referências de preço por cliente, além da comparação entre clientes.

### 6.3 Cadastro de Categorias de Peças

Acesso implícito dentro do módulo de peças (`/part-categories`). Categoria tem `name` e `code` único. O `code` é o prefixo do código interno.

### 6.4 Cadastro de Responsáveis

Acesso via `/app/responsaveis`. CRUD simples: nome, cargo, telefone. Usado para selecionar rapidamente o responsável que assina a proposta, sem ter que digitar tudo toda vez.

Se o usuário logado tiver `signature_cargo` e `signature_telefone` configurados (via `/app/usuarios`), esses dados são auto-preenchidos no campo de responsável da proposta.

### 6.5 Criação de Nova Proposta

Acesso via `/app/nova-proposta`. Fluxo:

1. Usuário informa o número da proposta (ex: `2024-001`)
2. Seleciona o cliente (autocomplete busca clientes existentes; pode cadastrar novo inline)
3. Seleciona o objeto da proposta (autocomplete com templates ou digita livremente)
4. Seleciona condição comercial (template ou preenche manualmente)
5. Preenche o responsável (auto-preenchido se usuário tem assinatura cadastrada)
6. Adiciona os itens:
   - Digita descrição → autocomplete busca no catálogo de peças
   - Ao selecionar uma peça, o NCM é preenchido automaticamente
   - Ao informar quantidade/preço, o sistema sugere o último preço praticado para aquele cliente + item
   - Pode adicionar múltiplos itens
7. Clica em "Gerar Proposta"
8. Backend processa:
   a. Resolve cliente (find-or-create com deduplicação)
   b. Persiste proposta em `proposals` com `kanban_status = 'pendente_envio'`
   c. Persiste itens em `proposal_items`
   d. Grava histórico em `price_history` para todos os itens
   e. Vincula `part_id` no `price_history` (find-or-create automático na tabela `parts`)
   f. Gera PDF com 3 camadas (veja seção 11)
   g. Salva PDF em `output/proposals/proposta-{numero}.pdf`
9. PDF fica disponível para download

### 6.6 Geração de PDF

Detalhada na seção 11.

### 6.7 Histórico de Propostas

Acesso via `/app/proposals`. Lista todas as propostas com dados principais. Cada proposta pode ser visualizada (detalhes + itens), ter o PDF baixado ou ser excluída (cascateia em `proposal_items` e `price_history`).

Não há edição de proposta depois de criada — apenas exclusão e recriação.

### 6.8 Histórico de Preços por Cliente

Funciona em duas camadas:

1. **`price_history`:** Registrado automaticamente a cada proposta. Consultado pela tela de peças (histórico por peça) e usado na sugestão automática de preço durante a criação de proposta.

2. **`part_client_price_references`:** Preço fixo manual, definido por admin. Tem prioridade sobre o histórico na sugestão.

A consulta durante criação de proposta usa a rota `/items/last-price?client_id=X&descricao=Y`, que busca primeiro em `part_client_price_references`, depois em `price_history` (ordenado por data decrescente).

### 6.9 Condições Comerciais

Templates de condições comerciais cadastrados via `/app/nova-proposta` (ou diretamente via API). Ao selecionar um template, os campos `forma_pagamento`, `prazo_pagamento`, `prazo_entrega`, `garantia` e `validade` são preenchidos automaticamente. Pode ser sobrescrito manualmente.

### 6.10 Permissões de Usuário

Sistema de 5 roles. Veja seção detalhada em Regras de Negócio (item 7).

**Kanban:**
- `user` — não pode mover nenhum card
- `admin` — pode mover qualquer card para qualquer status
- `comercial` — range `pendente_envio → faturar` (não pode mover para `faturado`)
- `tecnico` — range `aguardando_compra → faturar` (não pode mover para `faturado`)
- `financeiro` — apenas `faturar ↔ faturado`

**Execução de proposta:**
- Apenas `admin` e `tecnico` podem marcar/desmarcar

**Gestão de usuários:** Apenas `admin` pode criar, alterar role e excluir usuários.

---

## 7. Regras de Negócio Importantes

### Preços e Histórico

- **Gravação automática:** ao salvar qualquer proposta, todos os itens são gravados no `price_history` vinculados ao cliente e à proposta. Isso é inegociável — não pode ser desativado.
- **Prioridade na sugestão:** `part_client_price_references` (preço fixo manual) > `price_history` (último preço praticado). Se não há nenhum dos dois, o campo fica em branco.
- **Normalização para busca:** as descrições são normalizadas via `normalizeText()` (sem acentos, lowercase, espaços colapsados) antes de serem salvas em `price_history.descricao_normalizada` e antes de qualquer consulta fuzzy.
- **Valores monetários:** sempre use `formatCurrency()` (`src/shared/utils/currency.js`) para exibição. Para parsing, respeite o formato brasileiro: `1.234,56` — ponto é separador de milhar, vírgula é decimal. O `part.service.js` tem o padrão correto de parsing em `parsePrecoCompra()`.

### Propostas

- `numero_proposta` é `UNIQUE` no banco — tentativa de duplicata retorna erro.
- A `data_emissao` é sempre gerada pelo servidor no momento da criação, ignorando qualquer valor enviado pelo frontend.
- O PDF é gerado de forma síncrona durante o `POST /proposals` — se falhar, a proposta é criada mas sem PDF. O `pdf_path` fica `null` nesses casos.
- `valor_total_extenso` é calculado pelo backend (não mais enviado pelo frontend). O PDF exibe o valor por extenso abaixo do total em itálico.
- Deleção de proposta cascateia em `proposal_items` e `price_history`.
- Não há edição de proposta criada — apenas exclusão e recriação.

### Deduplicação de Clientes

- Ao criar uma proposta com dados inline de cliente, o sistema verifica por CNPJ (campo mais confiável) e por nome exato normalizado.
- Se os dados batem com **múltiplos** clientes distintos → **erro bloqueante**.
- Se os dados batem com **um** cliente mas campos conflitam → **erro bloqueante** com detalhes dos conflitos.
- Se os dados são consistentes com um cliente existente → reutiliza sem criar duplicata.
- Se nenhum cliente é encontrado → cria novo.

### Peças

- Unicidade por `(nome, marca, modelo)` — permite a mesma peça de marcas diferentes.
- `preco_compra` é obrigatório ao cadastrar.
- `codigo_interno` único quando preenchido (índice com `WHERE codigo_interno IS NOT NULL`).
- Ao criar proposta com item sem `part_id`, o sistema faz find-or-create na tabela `parts` pela descrição e vincula automaticamente no `price_history`.
- Campo `categoria` (TEXT livre) existe por legado — o campo correto é `category_id`.

### Kanban e Pipeline

- **Estados válidos:** `pendente_envio` → `enviado` → `aguardando_compra` → `comprado` → `pendente_execucao` → `faturar` → `faturado`.
- **Execução obrigatória antes de faturar:** proposta só pode ir para `faturar` se `execution_completed = 1`. O service valida isso — não depende do frontend.
- **Remoção de execução:** se a execução for removida e a proposta estiver em `faturar` ou `faturado`, ela volta automaticamente para `pendente_execucao`.
- **Cards ocultos automaticamente:** propostas em `enviado` há mais de 30 dias e em `faturado` há mais de 7 dias somem do board kanban.
- **Auto-comentários:** cada evento (execução, aprovação, faturamento) gera um comentário automático com `user_nome = "Sistema"` no card.
- **Permissões verificadas no service** (`canMoveKanban`, `canMarkExecution`) — nunca confiar apenas no frontend.

### Usuários e Autenticação

- Senha mínima de 6 caracteres.
- Não é possível excluir o último admin.
- Não é possível excluir o próprio usuário logado.
- Não é possível ter zero usuários no sistema.
- Sessão expira em 8 horas.
- Em produção, `SESSION_SECRET` não definido impede o servidor de subir.
- Usuário padrão `admin / admin123` é criado automaticamente apenas se `COUNT(*) = 0` em `users`.

### Financeiro

- Notas recebidas têm deduplicação por `(fornecedor_id, numero_nota, serie)` — índice único parcial.
- Contas a pagar têm parcelamento via `parcela_numero` e `parcela_total`.
- Baixa de conta com upload de comprovante de pagamento.
- Contas e notas podem ser canceladas com motivo registrado.
- Fornecedores têm flag `ativo` — desativação lógica, não exclusão física.

---

## 8. Estado Atual da Interface

### Páginas Existentes

| Página | Rota React | Função |
|---|---|---|
| Login | `/app/login` | Autenticação |
| Dashboard | `/app/` | Visão geral / atalhos |
| Nova Proposta | `/app/nova-proposta` | Criação de proposta (formulário principal) |
| Propostas | `/app/proposals` | Listagem e download de PDFs |
| Clientes | `/app/clients` | CRUD de clientes |
| Peças | `/app/parts` | CRUD de peças + histórico + referências de preço |
| Kanban | `/app/kanban` | Board de acompanhamento de propostas e tarefas |
| Estoque | `/app/stock` | Movimentações de estoque |
| Financeiro | `/app/financeiro` | Dashboard financeiro |
| Contas a Pagar | `/app/contas-pagar` | Gestão de contas |
| Notas Recebidas | `/app/notas-recebidas` | Lançamento de NFs de entrada |
| Fornecedores | `/app/fornecedores` | Cadastro de fornecedores |
| Usuários | `/app/usuarios` | Gestão de usuários (admin only) |
| Responsáveis | `/app/responsaveis` | Cadastro de responsáveis |
| Objetos | `/app/objetos` | Templates de objeto de proposta |

### Layout Geral

- **Navbar lateral** com navegação por módulos
- **Cor primária:** verde GHTec (`#2e7d32`)
- **Fontes:** `system-ui` — sem dependência de webfont externo
- **Design:** flat, sem gradientes forçados, bordas sutis, sombras leves
- **Densidade:** tabelas compactas, formulários de 2 colunas onde cabe
- **Feedback:** mensagens de erro/sucesso inline, loading states visíveis

### Pontos Fortes

- Autocomplete funcional para clientes, peças e itens
- Sugestão de preço integrada no formulário de proposta
- Kanban visual com pipeline completo
- Comentários por card com histórico de eventos automáticos

### Pontos Fracos / Inconsistências

- CSS misturado: design system global em `styles.css` mas cada página tem `<style>` inline adicional
- Redesign UI/UX em andamento — Fases 1 e 2 concluídas (design tokens, navbar), Fases 3-5 pendentes (formulários, modais, mobile)
- Sem feedback de progresso na geração do PDF (pode demorar alguns segundos)
- Não há responsividade mobile consolidada
- Sem autosave de rascunho na tela de nova proposta

---

## 9. Estado Atual do Backend

### Rotas (app.js)

Todas as rotas em `src/app.js`. Padrão: rotas específicas antes das genéricas (`/parts/search` antes de `/parts/:id`).

**Módulos com rotas:**

| Prefixo | Módulo |
|---|---|
| `/auth` | Autenticação e usuários |
| `/users` | CRUD de usuários |
| `/clients` | Clientes |
| `/parts` | Peças |
| `/part-categories` | Categorias de peças |
| `/items` | Busca de itens e preço histórico |
| `/responsaveis` | Responsáveis |
| `/commercial-conditions` | Condições comerciais |
| `/objetos` | Objetos de proposta |
| `/proposals` | Propostas e pipeline |
| `/kanban` | Tarefas e comentários do kanban |
| `/stock` | Estoque |
| `/fornecedores` | Fornecedores |
| `/categorias-despesa` | Categorias de despesa |
| `/notas-recebidas` | Notas fiscais de entrada |
| `/contas-pagar` | Contas a pagar |
| `/files` | Acesso estático aos arquivos gerados |
| `/health` | Health check |

### Upload de Arquivos

Multer com 3 destinos:
- `output/approvals/` — comprovantes de aprovação de proposta (imagens, 5MB máx)
- `output/notas-recebidas/` — PDFs e XMLs de notas fiscais (10MB máx)
- `output/comprovantes/` — comprovantes de pagamento de contas (imagens/PDF, 5MB máx)

### Validações Existentes

- Campos obrigatórios no service (nome, preço de compra, dados de proposta)
- Unicidade no banco com tratamento de `SQLITE_CONSTRAINT_UNIQUE`
- Deduplicação de cliente no service de proposta
- Permissões de Kanban verificadas no service
- Regras de usuário (último admin, auto-exclusão, mínimo de usuários)

### Pontos Frágeis

- ~~`valor_total_extenso` vem do payload do frontend~~ — **resolvido**: gerado pelo backend via `valorPorExtenso(total)`
- ~~Sessão armazenada em memória~~ — **resolvido**: `sessionStore.js` com `sessions.sqlite`
- ~~`migrate.js` cresce linearmente sem versionamento~~ — **resolvido**: substituído por Prisma migrations
- Puppeteer sem fila: múltiplas gerações simultâneas podem consumir muita memória

### Validações e Proteções Implementadas (2026-05)

- `validateProposalItems()` no `proposal.service.js` — valida array não vazio, descrição obrigatória por item, quantidade inteira > 0, preço não negativo. Retorna 400 antes de tocar o banco.
- `createProposalAtomic()` no `proposal.repository.js` — proposta + itens + price_history em uma única transação. Qualquer falha reverte tudo.
- FKs e constraints garantidas pelo PostgreSQL — erros Prisma P2002/P2003/P2025 mapeados em `errorHandler.js` para 409/409/404.
- `deleteCondition` no `condition.repository.js` — nulifica o FK em `proposals` antes de deletar, em transação Prisma.
- Cookie de sessão com `httpOnly: true`, `sameSite: "lax"`, `secure: true` em produção.
- `/health` usa `prisma.$queryRaw\`SELECT 1\`` — retorna 503 se PostgreSQL estiver inacessível.

---

## 10. Estado Atual do Banco de Dados

### Tabelas Principais

| Tabela | Função |
|---|---|
| `clients` | Clientes |
| `parts` | Catálogo de peças |
| `part_categories` | Categorias de peças |
| `proposals` | Propostas comerciais |
| `proposal_items` | Itens de cada proposta |
| `price_history` | Histórico de preços por item/cliente |
| `part_client_price_references` | Preços fixos de referência por peça/cliente |
| `responsaveis` | Responsáveis comerciais |
| `objetos` | Templates de objeto de proposta |
| `commercial_conditions` | Templates de condições comerciais |
| `users` | Usuários do sistema |
| `kanban_tasks` | Tarefas manuais do kanban |
| `kanban_comments` | Comentários de cards |
| `stock_movements` | Movimentações de estoque |
| `fornecedores` | Fornecedores |
| `categorias_despesa` | Categorias de despesa |
| `notas_recebidas` | Notas fiscais de entrada |
| `itens_nota_recebida` | Itens das notas fiscais |
| `contas_pagar` | Contas a pagar |

### Relacionamentos Principais

```
proposals → clients (cliente_id)
proposals → commercial_conditions (commercial_condition_id)
proposals → users (responsible_user_id, billed_by_user_id, etc.)
proposal_items → proposals (proposal_id)
price_history → clients, parts, proposals
part_client_price_references → parts, clients, users
stock_movements → parts, proposals, clients, users
notas_recebidas → fornecedores, categorias_despesa, users
itens_nota_recebida → notas_recebidas, parts
contas_pagar → fornecedores, notas_recebidas, categorias_despesa, users
kanban_comments → users
kanban_tasks → users
```

### Triggers de `updated_at`

Presentes em: `clients`, `parts`, `part_categories`, `users`, `commercial_conditions`, `part_client_price_references`, `fornecedores`, `categorias_despesa`, `notas_recebidas`, `itens_nota_recebida`, `contas_pagar`.

### Estratégia de Migração

O schema é gerenciado por Prisma Migrations (`prisma/migrations/`). Migration `20260525153903_init_schema` contém o DDL completo (19 tabelas, 6 enums, índices, FKs). Para aplicar em novo ambiente: `npm run prisma:migrate`. Para produção: `prisma migrate deploy`.

Os arquivos legados `src/db/init.js` e `src/db/migrate.js` foram removidos no Passo 3.6.

### Riscos de Inconsistência

- Campo `categoria` em `parts` é legado (TEXT livre) e coexiste com `category_id` (FK). Pode conter dados divergentes.
- ~~`createProposalFlow` não era atômico~~ — **corrigido em 2026-05** com `createProposalAtomic()`: proposta + itens + price_history em uma única transação.
- Não há soft-delete em propostas — exclusão remove fisicamente da base.

---

## 11. Geração de Propostas e PDF

### Origem dos Dados

O payload do `POST /proposals` contém:
- Número da proposta
- `cliente_id` (se selecionado da lista) ou `cliente` (objeto com dados para cadastro inline)
- `objeto_proposta`
- `condicoes` (objeto com `forma_pagamento`, `prazo_pagamento`, `prazo_entrega`, `garantia`, `validade`)
- `responsavel` (objeto com `nome`, `cargo`, `email`, `telefone`)
- `items` (array com `descricao`, `quantidade`, `valor_unitario`, `ncm`, `part_id` opcional)
- ~~`valor_total_extenso` (gerado pelo frontend — ponto fraco)~~ — gerado pelo backend (ver seção 14 item 18)
- `cidade_emissao`, `commercial_condition_id`, dados de assinatura do usuário logado

### Template Usado

`src/modules/proposal/proposal.template.hbs` — Handlebars com as seções:
- Header com logo GHTec
- Bloco de cliente e data de emissão
- Parágrafo de apresentação (texto fixo da empresa)
- Objeto da proposta
- Tabela de itens (item, qty, descrição, NCM, valor unitário, subtotal)
- Valor total em moeda e por extenso
- Condições comerciais
- Observações (se houver)
- Assinatura do responsável

O CSS da proposta (`proposal.css`) é lido como string e injetado inline no `<style>` do HTML para garantir que o Puppeteer renderize corretamente (sem dependência de arquivo externo).

### Assets (Imagens)

Todos os assets são convertidos para **Data URI (base64)** antes de ir para o template, evitando dependência de paths externos durante a renderização do Puppeteer:
- `LogoGHTEC.png` → logo no header do PDF
- `marcatopo.png` → marca d'água no topo da página 1
- `marcabaixo.jpg` → marca d'água no rodapé da página 1
- `marca_fixa.png` → marca d'água full-page nas páginas 2+

### Geração em 3 Camadas (pdf-lib + Puppeteer)

1. **Camada de conteúdo:** HTML compilado do template, renderizado pelo Puppeteer com `omitBackground: true` → PDF
2. **Camada de marca d'água da página 1:** HTML simples com `marcatopo.png` no topo e `marcabaixo.jpg` no rodapé → PDF
3. **Camada de marca d'água das páginas 2+:** HTML simples com `marca_fixa.png` cobrindo a página → PDF

As 3 renderizações rodam em paralelo (`Promise.all`). O `pdf-lib` então mescla as camadas: para cada página do conteúdo, embute a marca d'água correta como camada de fundo e depois o conteúdo por cima.

**Motivo do design em 3 camadas:** Puppeteer não renderiza backgrounds e conteúdo de forma confiável em uma única passagem para todos os casos de CSS de impressão. A separação em camadas garante resultado visual consistente.

### Nome e Destino do PDF

```
output/proposals/proposta-{numero_proposta}.pdf
```

O `pdf_path` (caminho absoluto) é salvo na tabela `proposals` após a geração. O PDF é servido estaticamente via `/files/{nome-do-arquivo}.pdf`.

### Cálculo de Totais

O `calculateTotal()` soma `quantidade * valor_unitario` de todos os itens. O total é formatado via `formatCurrency()` (Intl.NumberFormat pt-BR, BRL).

### Valor por Extenso

~~**Ponto fraco crítico:** `extensao.js` implementa o valor por extenso apenas para inteiros de 0 a 10.~~ **Resolvido:** `extensao.js` reescrito com suporte completo a BRL. O backend gera o extenso — ver seção 14 item 18.

---

## 12. Histórico Inteligente de Preços

### Como a Referência é Criada

A cada proposta salva, o `proposal.service.js` chama `insertPriceHistoryItems()`, que grava um registro em `price_history` para cada item: `client_id`, `part_id`, `proposal_id`, `descricao_original`, `descricao_normalizada`, `quantidade`, `valor_unitario`, `data_proposta`, `numero_proposta`.

Em paralelo, `updatePriceHistoryPartId()` garante que o `part_id` seja preenchido no `price_history` — usando o `part_id` enviado pelo frontend (item selecionado do catálogo) ou fazendo find-or-create pela descrição como fallback.

### Quando é Atualizada

A cada nova proposta criada para aquele cliente com aquele item. O histórico é cumulativo — nunca sobrescreve, sempre adiciona.

Para o preço de referência fixo (`part_client_price_references`), a atualização é manual: um admin acessa a tela de peças, abre o modal de referências por cliente e define o valor via UPSERT.

### Como Aparece para o Usuário

Na tela de nova proposta, ao digitar uma descrição de item (ou selecionar do autocomplete), o sistema chama `GET /items/last-price?client_id=X&descricao=Y`. O retorno é o preço sugerido, que é auto-preenchido no campo de valor unitário. O usuário pode alterar livremente.

### Prioridade na Sugestão

1. `part_client_price_references.reference_price` (se existir para o par peça+cliente)
2. Último `price_history.valor_unitario` para `(client_id, descricao_normalizada)` — ordenado por `data_proposta DESC`

### Parsing de Valores Monetários

**Regra crítica:** valores monetários no formato brasileiro usam vírgula como decimal e ponto como milhar. O parsing correto é:
```javascript
parseFloat(str.replace(/\./g, "").replace(",", "."))
```
Nunca usar `parseFloat()` diretamente em strings brasileiras — `"67,50"` viraria `67` (incorreto) ou `NaN`.

O padrão correto está em `part.service.js:parsePrecoCompra()`.

---

## 13. Pontos Críticos Já Conhecidos

### 1. ~~Sessão Armazenada em Memória~~ — resolvido em 2026-05

**Solução:** Store personalizado em `src/middleware/sessionStore.js` usando `better-sqlite3` com arquivo separado `sessions.sqlite`. Sessões sobrevivem a restarts. O arquivo é gitignored (`*.sqlite`).
**Sem nova dependência** — reutiliza `better-sqlite3` já instalado.

### 2. `migrate.js` Sem Versionamento

**Problema:** Cresce linearmente sem controle de quais migrações já rodaram. Não há rollback. Backfills rodam desnecessariamente a cada start.
**Impacto:** Médio — funciona mas será difícil de manter com mais features.
**Caminho de correção:** Adotar migrações sequenciais numeradas com tabela de controle.

### 3. ~~Sem Autosave de Rascunho~~ — resolvido

**Solução implementada:** Autosave com `localStorage` em `nova-proposta.html`. Chave: `draft_new_proposal_user_{id}` (por usuário). Salva automaticamente com debounce de 800ms. Ao abrir a tela com rascunho, exibe modal perguntando se deseja continuar ou descartar. Rascunho é apagado automaticamente após proposta gerada com sucesso.

### 4. ~~`valor_total_extenso` Gerado pelo Frontend~~ — resolvido em 2026-05

**Solução:** `extensao.js` reescrito com suporte completo a valores monetários em pt-BR (reais, centavos, mil, milhão/milhões, singular/plural). O backend calcula `valor_total_extenso` a partir de `total` no `createProposalFlow()` — o payload do frontend é ignorado para este campo. O PDF exibe o valor por extenso abaixo do total em itálico.

### 5. Puppeteer Sem Fila de Processamento

**Problema:** Cada geração de PDF abre um Chrome headless. Gerações simultâneas multiplicam o consumo de memória.
**Impacto:** Médio — com menos de 10 usuários simultâneos raramente é problema, mas pode causar lentidão ou travamento.
**Caminho de correção:** Singleton do browser Puppeteer com fila de páginas.

### 6. Campo `categoria` Legado em `parts`

**Problema:** Coexistência de `categoria` (TEXT livre, legado) e `category_id` (FK para `part_categories`, correto). Pode haver dados nos dois campos.
**Impacto:** Baixo — confusão durante desenvolvimento, não afeta funcionalidade principal.
**Caminho de correção:** Migrar dados de `categoria` para `category_id` e ignorar o campo legado no frontend.

### 7. Senha Padrão `admin123` Sem Troca Forçada

**Problema:** Criada automaticamente na primeira execução sem mecanismo que force a troca.
**Impacto:** Segurança — crítico em produção se não for trocada manualmente.
**Caminho de correção:** Flag `password_changed` em `users` ou redirecionamento forçado na primeira sessão.

### 8. Sem Validação de Formato de NCM

**Problema:** Campo NCM é texto livre (deveria ser 8 dígitos numéricos).
**Impacto:** Baixo — dados inconsistentes no banco, pode afetar integração fiscal futura.
**Caminho de correção:** Validação de formato no service.

### 9. ~~Sem Testes Automatizados~~ — **Resolvido**

~~**Problema:** Nenhum teste unitário, de integração ou E2E.~~
**Status:** Primeira base de testes implementada com Vitest (74 testes, 4 arquivos). Ver seção 14 item 19 e diretório `tests/`.

---

## 14. Decisões Técnicas Já Tomadas

1. **Node.js + Express 4:** simplicidade, ecossistema amplo, sem overhead de frameworks maiores.
2. **SQLite (better-sqlite3):** deploy simples (arquivo único), sem necessidade de servidor de banco separado, adequado para volume de uso atual.
3. **Modo WAL no SQLite:** melhor performance para leituras concorrentes leves, sem risco de bloqueio.
4. **Migração para React + Vite concluída (2026-05, Passos 4.1–4.19):** React 18 + Vite 5 + React Router v6. React serve sob `/app/` (`basename="/app"`) para evitar conflito com rotas de API Express. Build de produção em `frontend/dist/`, servido estaticamente pelo Express. CSS global (`styles.css`) bundlado pelo Vite — em `frontend/src/styles.css`, importado em `main.jsx`. Todas as 15 telas migradas. `public/` contém apenas `assets/logoGHTEC.png`. `public/legacy/`, `public/auth.js`, `public/login.html` e `public/css/` removidos. `LegacyRedirect` removido.
5. **Geração de PDF em 3 camadas (Puppeteer + pdf-lib):** solução robusta para marcas d'água independentes do conteúdo, necessária porque Puppeteer tem limitações de renderização CSS de impressão.
6. **CSS da proposta injetado inline no HTML:** garante renderização correta pelo Puppeteer sem dependência de URLs externas.
7. **Assets do PDF em base64 Data URI:** evita problemas de path durante renderização headless.
8. ~~**Migrações por código em `migrate.js`:**~~ **Prisma Migrations** (Passo 3.6): schema gerenciado via `prisma/migrations/`. `src/db/init.js` e `src/db/migrate.js` removidos.
9. **Separação controller → service → repository:** garante que queries Prisma fiquem no repository e regras de negócio no service. Não misturar. Todos os layers são async.
10. ~~**Sessão em memória:**~~ **Session store persistente** implementada em `sessionStore.js` (ver item 17). Não há mais sessão em memória.
11. ~~**Backfill no `migrate.js`:**~~ histórico já consolidado. Backfills eram responsabilidade do `migrate.js` legado (removido no Passo 3.6).
12. **CommonJS (não ESM):** padrão do projeto. Não migrar para ESM sem necessidade.
13. **Prisma Client async:** todos os `repository.js` usam `async/await` com Prisma. `better-sqlite3` permanece apenas em `sessionStore.js` (síncrono, por design do express-session).
14. **FKs garantidas pelo PostgreSQL:** constraints de integridade aplicadas pelo banco. Erros Prisma P2002/P2003/P2025 tratados em `errorHandler.js`.
15. **`createProposalAtomic()`:** função no `proposal.repository.js` que agrupa criação de proposta, itens e price_history em `prisma.$transaction`. Operação central do sistema — não fragmentar.
16. **Cookie de sessão hardened:** `httpOnly: true`, `sameSite: "lax"`, `secure: isProd`. Não regredir esses atributos.
17. **Session store persistente (`sessionStore.js`):** store customizado usando `better-sqlite3` com arquivo `sessions.sqlite` separado do banco principal. `better-sqlite3` permanece em `dependencies` exclusivamente por causa desta dependência. Sessões sobrevivem a restarts do servidor. Limpeza automática a cada 15 minutos.
18. **`valor_total_extenso` gerado pelo backend:** `extensao.js` suporta qualquer valor monetário em BRL. O service ignora o campo do payload do frontend e gera o extenso a partir do `total` calculado. Valor aparece no PDF abaixo do total.
19. **Infraestrutura de testes com Vitest:** 408 testes em 18 arquivos, todos usando `vi.spyOn` para mockar os repositories. Sem dependência de banco de dados — nenhum teste toca PostgreSQL ou SQLite. Cada arquivo de teste tem isolamento de módulo garantido pelo Vitest. Rodar com `npm test`. `validateProposalItems` e `parsePrecoCompra` são exported dos respectivos services para testes unitários diretos.
20. **Assinatura da proposta vem do usuário logado:** a entidade `responsaveis` é legada e não deve ser usada como fonte principal para novas propostas. O `proposal.controller.js` monta o bloco `responsavel` a partir de `user.nome`, `user.signature_cargo` e `user.signature_telefone` do usuário da sessão — ignorando qualquer campo `responsavel` enviado pelo frontend. O backend bloqueia criação de proposta se o usuário não tiver `signature_cargo` nem `signature_telefone` configurados (`SIGNATURE_REQUIRED`). O snapshot da assinatura é salvo em `responsavel_nome/cargo/email/telefone` nas colunas da proposta e não é recalculado retroativamente.
21. **Regras de domínio do Kanban em `src/shared/domain/kanban.js`:** `KANBAN_STATUSES`, `KANBAN_LABELS`, `isValidKanbanStatus()`, `canMoveKanban()` e `assertCanMoveKanban()` estão centralizados neste módulo. Tanto `proposal.service.js` quanto `kanban.service.js` importam daqui — sem dependência cruzada entre os dois módulos.

---

## 15. Decisões de Produto Já Tomadas

1. **Sistema inicialmente interno:** sem multi-tenant, sem login por empresa, sem isolamento de dados.
2. **Foco central em propostas comerciais:** todos os outros módulos (estoque, financeiro) são suporte à operação comercial.
3. **Histórico de preços por cliente é diferencial crítico:** não pode ser removido ou simplificado sem discussão estratégica.
4. **Preço de referência fixo por peça/cliente (admin):** permite que a empresa estabeleça preços tabelados por contrato sem depender apenas do histórico.
5. **Pipeline visual (Kanban) para acompanhamento:** substitui planilhas e e-mails para controle do status de cada proposta.
6. **Roles distintos por função (comercial, técnico, financeiro):** garante que cada pessoa só veja e faça o que é da sua alçada.
7. **PDF com identidade visual forte:** documento deve ter aparência profissional de empresa — não um simples relatório.
8. **Objetivo futuro de expandir para ERP mais completo:** decisões técnicas devem preservar escalabilidade (não criar gambiarra que dificulte evolução).
9. **Possibilidade futura de SaaS:** visão de longo prazo, não prioritária agora.
10. **Usabilidade operacional priorizada sobre efeitos visuais:** a interface deve ser rápida e eficiente no uso diário.

---

## 16. Melhorias Planejadas ou Recomendadas

### 16.1 Melhorias Técnicas

- ~~Implementar session store persistente~~ — **implementado** (`sessionStore.js`)
- ~~Refatorar `extensao.js`~~ — **implementado** (suporte completo BRL, gerado no backend)
- ~~Autosave de rascunho~~ — **implementado** (`localStorage` em `nova-proposta.html`)
- ~~Adicionar testes automatizados nos services críticos~~ — **implementado** (Vitest, 74 testes, banco em memória, `tests/`)
- Implementar singleton do browser Puppeteer com fila para evitar múltiplas instâncias simultâneas
- ~~Adotar migrações sequenciais numeradas~~ — **implementado** (Prisma Migrations)
- Separar CSS específico de cada página do `styles.css` global de forma sistemática

### 16.2 Melhorias de UI/UX

- Concluir o redesign (Fases 3–5): formulários, modais, mobile
- Feedback de progresso durante geração do PDF (loader ou mensagem de espera)
- Filtros e busca avançada na listagem de propostas (por cliente, período, status)
- Filtros na listagem financeira (por fornecedor, vencimento, status)
- Responsividade mobile consolidada
- Página de dashboard com métricas reais (propostas do mês, valor em pipeline, etc.)

### 16.3 Melhorias de Regra de Negócio

- Forçar troca de senha no primeiro login do admin padrão
- Integração entre execução de proposta e baixa automática de estoque
- Cálculo de tributos na proposta (simulação de ICMS/IPI na venda)
- Relatório de lucratividade por cliente (receita vs. custo de peças)
- Histórico de edições/eventos por proposta (audit log)
- Validação de formato de NCM (8 dígitos)

### 16.4 Melhorias de Segurança

- ~~Session store persistente (evita sessões em memória)~~ — **implementado** (ver seção 14 item 17)
- Força de senha configurável
- Rate limiting no endpoint de login (proteção contra brute-force)
- Forçar troca de senha padrão
- HTTPS obrigatório em produção (reverse proxy com nginx/certbot)
- Registro de auditoria de ações sensíveis (login, exclusão de proposta, mudança de role)

### 16.5 Melhorias de Escalabilidade

- Fila de processamento de PDFs (evitar múltiplos Chrome headless simultâneos)
- Cache de templates Handlebars compilados (evitar recompilação a cada proposta)
- Migração do frontend para framework com build (Vite + Vue/React) se o volume de features crescer muito
- Avaliação de PostgreSQL se o volume de dados ou usuários concorrentes escalar significativamente

---

## 17. Como Rodar o Projeto

### Instalação

```bash
git clone <repo>
cd propostas_automaticas
npm install
```

### Configuração de Ambiente

```bash
cp .env.example .env
# Editar .env:
# SESSION_SECRET=<string longa e aleatória — obrigatório em produção>
# PORT=3000
# NODE_ENV=development
```

### Inicialização do Banco

```bash
npm run init-db    # cria tabelas base
```

### Execução em Desenvolvimento

```bash
npm run dev        # node src/server.js — migrate.js roda automaticamente
```

O servidor sobe em `http://localhost:3000`. O `migrate.js` é executado a cada start, garantindo que o banco esteja atualizado.

### Execução em Produção

> A confirmar: não há scripts ou configuração de PM2/systemd documentados no projeto.

Indicadores de uso em produção:
- `NODE_ENV=production` no `.env`
- `SESSION_SECRET` obrigatório (o servidor não sobe sem ele em produção)
- Recomendado: usar PM2 (`pm2 start src/server.js`) e nginx como reverse proxy

### Usuário Padrão (primeira execução)

Login: `admin` | Senha: `admin123` — **trocar imediatamente após o primeiro acesso**.

---

## 18. Convenções do Projeto

### Nomes de Arquivos

- `{modulo}.controller.js` / `{modulo}.service.js` / `{modulo}.repository.js`
- HTML em português (ex: `nova-proposta.html`, `contas-pagar.html`)
- Utilitários em camelCase (ex: `currency.js`, `normalize.js`)

### Organização de Rotas

- Todas as rotas em `src/app.js`
- Rotas específicas SEMPRE antes de rotas com parâmetros: `/parts/search` antes de `/parts/:id`
- Comentário de seção antes de cada grupo de rotas

### Valores Monetários

- **Exibição:** sempre usar `formatCurrency()` de `src/shared/utils/currency.js`
- **Parsing de string brasileira:** sempre usar `parseFloat(str.replace(/\./g, "").replace(",", "."))` — nunca `parseFloat()` diretamente em string com vírgula
- Nunca armazenar valores com formatação — banco recebe e retorna `REAL` (ponto decimal)

### Normalização de Texto

- Sempre usar `normalizeText()` de `src/shared/utils/normalize.js` para comparações e buscas de strings (nomes, descrições)

### Novas Colunas no Banco

```javascript
// Em migrate.js — padrão correto:
const cols = db.pragma("table_info(tabela)").map((c) => c.name);
if (!cols.includes("nova_coluna")) {
  db.exec(`ALTER TABLE tabela ADD COLUMN nova_coluna TEXT`);
}
```

### Novas Rotas

1. Adicionar handler no `controller.js` do módulo
2. Adicionar lógica no `service.js`
3. Adicionar query no `repository.js`
4. Registrar rota em `app.js` (específicas antes de genéricas)

### Padrão de Erro no Service

```javascript
const err = new Error("Mensagem descritiva.");
err.code = "CODIGO_UNICO"; // NOT_FOUND, FORBIDDEN, VALIDATION, etc.
throw err;
```

O `errorHandler.js` captura e responde com status adequado.

---

## 19. Orientações para Futuras IAs e Desenvolvedores

### O que não pode ser quebrado

1. **O sistema está em uso com dados reais.** Qualquer mudança de schema deve ser feita via `migrate.js` com `ALTER TABLE IF NOT EXISTS` — nunca recriar tabelas, nunca dropar colunas (SQLite < 3.35 não suporta `DROP COLUMN`).

2. **O histórico de preços é sagrado.** `price_history` nunca deve ser truncado, deletado em massa ou desvinculado do fluxo de criação de proposta. É o diferencial central do sistema.

3. **O fluxo de PDF tem 3 camadas por design** (conteúdo + 2 marcas d'água via pdf-lib). Não simplifique sem entender o motivo e testar com 1, 2 e 5+ páginas.

4. **Prisma é async.** Todas as funções de `repository.js` são `async`. Não remova `await` de chamadas ao Prisma Client. O único uso de `better-sqlite3` (síncrono) é em `sessionStore.js`.

5. **O padrão controller → service → repository deve ser mantido.** Não coloque SQL no controller, não coloque regras de negócio no repository.

6. **Permissões de Kanban são verificadas no service**, não no frontend. Sempre valide no backend.

7. **A data de emissão da proposta é sempre gerada pelo servidor** no `createProposalFlow()`. Nunca aceite data do frontend para esse campo.

### Antes de alterar qualquer coisa

- Leia o fluxo completo do módulo (controller → service → repository) antes de propor mudanças
- Entenda se a alteração afeta `price_history`, `proposals` ou `parts` — essas tabelas têm dados críticos
- Verifique se há rotas em `app.js` que precisam ser atualizadas
- Para mudanças de schema, use `npm run prisma:migrate` (gera e aplica nova migration)

### Cuidados específicos

- **Valores monetários:** nunca use `parseFloat()` em strings brasileiras sem remover o ponto de milhar antes. Use o padrão de `parsePrecoCompra()`.
- **Deleção de proposta:** cascateia. Confirme que o cascade está funcionando antes de assumir que os dados foram removidos.
- **Geração de PDF:** sempre teste com propostas simples (1 item) e complexas (10+ itens, 2+ páginas) antes de declarar sucesso.
- **Assets do PDF:** os arquivos `marcatopo.png`, `marcabaixo.jpg`, `marca_fixa.png` e `LogoGHTEC.png` em `src/assets/` são críticos. Se o nome ou extensão mudar, o `assetDataUri()` vai lançar erro e a geração de proposta vai falhar completamente.
- **Autocomplete de itens:** respeite a prioridade `part_client_price_references > price_history` na sugestão de preço.
- **Banco é PostgreSQL/Prisma.** `better-sqlite3` permanece apenas para `sessionStore.js` — não expanda seu uso.
- **Frontend React:** novos módulos devem ser criados em `frontend/src/pages/`. Não criar telas HTML estáticas em `public/`.
- **Não adicione dependências** sem necessidade real — o `package.json` enxuto é intencional.

### Atualize este arquivo

Sempre que fizer uma mudança estrutural (novo módulo, nova entidade, nova regra de negócio, mudança arquitetural), atualize o `SYSTEM_CONTEXT.md` com a seção relevante.

---

## 20. Resumo Executivo Final

### O que o sistema é hoje

Um ERP interno leve para a GHTec, com foco central em propostas comerciais. Permite criar propostas com PDF profissional, sugere preços com base no histórico por cliente, acompanha o pipeline comercial em um Kanban com permissões por role, e tem módulos de suporte de estoque e financeiro (contas a pagar, notas recebidas). Está em uso com dados reais de produção.

### Qual é a direção futura

Expansão incremental: autosave de rascunho, relatórios de lucratividade, integração estoque-execução, fortalecimento fiscal (NF-e), e possivelmente transformação em produto SaaS para outras empresas do setor.

### O que não pode quebrar

1. Geração de `price_history` a cada proposta
2. Geração do PDF com 3 camadas
3. Deduplicação de clientes no fluxo de proposta
4. Permissões de Kanban verificadas no backend
5. Integridade dos assets do PDF (`src/assets/`)

### Prioridade técnica daqui pra frente

1. ~~**Imediato:** Corrigir `extensao.js`~~ — **feito**
2. ~~**Curto prazo:** Autosave e session store~~ — **feito**
3. ~~**Médio prazo:** Testes automatizados nos services críticos~~ — **feito** · Concluir redesign de UI (Fases 3-5)
4. **Longo prazo:** Relatórios de lucratividade, integração fiscal, Puppeteer com fila

---

*Atualizado em 2026-05-28 — Passo 4.16: migração React concluída. Todas as 15 telas em React. `public/legacy/` e `public/auth.js` removidos. React é a interface oficial do sistema. 408 testes backend passando.*

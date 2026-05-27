# REACT_MIGRATION_PLAN.md — GHTec ERP

**Data da análise:** 2026-05-27
**Objetivo:** Plano de migração do frontend atual (HTML + CSS + JS vanilla) para React + Vite, mantendo o backend Express intacto.

> **Status atual (2026-05-27 — Passo 4.1 concluído):** Base React + Vite criada e funcional. Telas migradas: **Login**, **Dashboard**, **Proposals**. Telas legadas movidas para `public/legacy/`. Build de produção em `frontend/dist/`, servido pelo Express em `/app/`. AuthContext, ProtectedRoute, Navbar, Toast, ConfirmModal implementados. 408 testes backend passando.

---

## Índice

1. [Contexto da Migração](#1-contexto-da-migração)
2. [Diagnóstico do Frontend Atual](#2-diagnóstico-do-frontend-atual)
3. [Por Que Migrar](#3-por-que-migrar)
4. [O Que Não Muda](#4-o-que-não-muda)
5. [Arquitetura Proposta](#5-arquitetura-proposta)
6. [Rotas — Separação Página vs. API](#6-rotas--separação-página-vs-api)
7. [Ordem de Migração](#7-ordem-de-migração)
8. [Tela Piloto](#8-tela-piloto)
9. [Riscos e Estratégias](#9-riscos-e-estratégias)
10. [Prompt de Implementação da Base](#10-prompt-de-implementação-da-base)

---

## 1. Contexto da Migração

### Por que este documento existe

O frontend atual funciona, mas tem limitações estruturais que se tornam mais custosas conforme o sistema cresce:

- **Navegação duplicada**: o bloco `<nav>` está copiado à mão em 14 arquivos HTML. Qualquer mudança no menu exige editar 14 arquivos.
- **Zero reuso de componentes**: toast, modal de confirmação, tabela, autocomplete — cada página tem sua própria implementação inline.
- **Estado não gerenciado**: variáveis globais soltas no script de cada página. À medida que as telas ficam mais complexas (nova-proposta tem 2007 linhas), o código fica difícil de manter.
- **Sem roteamento real**: navegar entre páginas é recarregar o browser. Não há transições, não há estado persistido entre páginas.

### O que favorece a migração agora

- O backend **já é uma API 100% JSON**. Não há SSR, não há template engine no frontend. Isso significa zero mudanças no backend.
- O design system já existe (`styles.css` com tokens CSS bem definidos). Não é necessário reescrever o visual.
- O volume atual (~12.000 linhas de frontend) ainda é administrável. Migrar agora é mais barato do que depois de dobrar o tamanho.
- A stack (Node.js + Express + Prisma/PostgreSQL) é madura. O risco é apenas no frontend.

### O que este documento não é

- Um cronograma com datas fixas
- Uma ordem de trabalho rígida
- Uma justificativa para parar tudo e fazer um big-bang rewrite

A migração é **incremental**: cada tela é migrada individualmente, a versão HTML original é mantida até o componente React estar validado, e o sistema continua funcionando durante todo o processo.

---

## 2. Diagnóstico do Frontend Atual

### Inventário de arquivos

| Arquivo | Linhas | fetch calls | Complexidade |
|---|---|---|---|
| `nova-proposta.html` | 2007 | 9 | 🔴 Alta |
| `stock.html` | 1360 | 10 | 🔴 Alta |
| `kanban.html` | 1281 | 13 | 🔴 Alta |
| `parts.html` | 1203 | 17 | 🔴 Alta |
| `notas-recebidas.html` | 1137 | 10 | 🟡 Média-alta |
| `objetos.html` | 698 | 8 | 🟡 Média |
| `clients.html` | 747 | 5 | 🟡 Média |
| `index.html` | 628 | 2 | 🟡 Média |
| `contas-pagar.html` | 519 | 10 | 🟡 Média |
| `usuarios.html` | 443 | 9 | 🟢 Simples |
| `fornecedores.html` | 389 | 7 | 🟢 Simples |
| `responsaveis.html` | 325 | 3 | 🟢 Simples |
| `proposals.html` | 302 | 2 | 🟢 Simples |
| `financeiro.html` | 250 | 3 | 🟢 Simples |
| `login.html` | 89 | 1 | 🟢 Simples |
| `css/styles.css` | 1003 | — | Design system global |
| `auth.js` | 83 | — | Sessão + nav ativa |
| **Total** | **~12.500** | | |

### Padrão estrutural de cada página

Toda página segue exatamente o mesmo padrão:

```
1. <link rel="stylesheet" href="/css/styles.css">
2. <style> bloco de CSS específico da página </style>
3. HTML da navbar (duplicado em cada arquivo)
4. HTML do conteúdo
5. <script> toda a lógica JS inline </script>
6. <script src="/auth.js"></script>  ← verifica sessão + marca nav ativa
```

### Dependências externas

| Dependência | Versão | Uso | Páginas afetadas |
|---|---|---|---|
| Chart.js | 4.4.4 (CDN) | Gráficos de barras/linhas | `clients.html`, `financeiro.html`, `stock.html`, `parts.html` |
| `/css/styles.css` | local | Design system | Todas |
| `/auth.js` | local | Sessão + navegação | Todas exceto `login.html` |

**Sem jQuery, sem Bootstrap, sem frameworks. Stack 100% vanilla.**

### Características especiais que afetam a migração

- **localStorage**: usado em `nova-proposta.html` para autosave de rascunho (chave: `draft_new_proposal_user_{id}`)
- **File upload via FormData**: `contas-pagar.html` (comprovante), `notas-recebidas.html` (PDF + XML), `kanban.html` (aprovação), `fornecedores.html`
- **Kanban sem drag-and-drop**: usa botões `◀ ▶` para mover cards — não precisa de biblioteca DnD
- **Autocomplete customizado**: implementado manualmente em `nova-proposta.html` (peças, clientes, objetos, condições) e `clients.html`
- **Modais criados dinamicamente**: alguns modais são criados por `document.createElement` inline no script

---

## 3. Por Que Migrar

### Problemas concretos hoje

| Problema | Impacto atual |
|---|---|
| Navbar duplicada em 14 arquivos | Toda mudança de menu = 14 edições |
| Toast, modal, confirm reimplementados em cada página | Bugs corrigidos em um lugar, existem em outros |
| Estado via variáveis globais soltas | `nova-proposta.html` com 2007 linhas é difícil de depurar |
| Sem roteamento real | Não há como passar estado entre páginas sem URL params ou localStorage |
| CSS específico inline em cada página | Difícil garantir consistência visual ao evoluir |

### O que React resolve diretamente

- **`<Navbar />`**: um componente, um lugar para editar
- **`<Toast />`, `<ConfirmModal />`**: implementados uma vez, usados em todos os lugares
- **Estado com hooks**: `useState`, `useEffect`, `useContext` — sem variáveis globais soltas
- **React Router**: navegação real com estado preservado, sem reload
- **`AuthContext`**: sessão disponível em qualquer componente sem fetch repetido

### O que React **não** resolve automaticamente

- Performance (o sistema atual é rápido o suficiente para o volume de uso)
- Design visual (os tokens CSS já existem — o visual não precisa mudar)
- Regras de negócio (ficam no backend — não mudam)

---

## 4. O Que Não Muda

Esta seção existe para evitar scope creep durante a migração.

### Backend: zero alterações necessárias

O Express já é uma API 100% JSON. Todas as rotas existentes continuam sendo usadas sem modificação. Não há:
- Novas rotas a criar
- Rotas a renomear ou reorganizar
- Alterações em autenticação ou middleware
- Mudanças no banco de dados

### CSS / Design Visual

Os tokens CSS de `styles.css` são preservados. O visual não muda. A identidade da GHTec (verde `#2e7d32`, tipografia, cards, tabelas) é mantida.

### Autenticação

O mecanismo de sessão (cookie httpOnly gerenciado pelo browser) não muda. O React apenas chama `GET /auth/me` uma vez no carregamento — exatamente o que `auth.js` já faz hoje. Não há novo sistema de autenticação.

### Regras de negócio

Continuam no backend (`service.js`, `repository.js`). O frontend React apenas consome a API — não implementa lógica de negócio.

---

## 5. Arquitetura Proposta

### Estrutura de pastas

```
ERP/
├── src/                          — backend Express (inalterado)
│   ├── app.js
│   ├── server.js
│   └── modules/
├── public/                       — frontend HTML atual (mantido durante a transição)
│   ├── css/styles.css
│   ├── auth.js
│   └── *.html
├── frontend/                     — NOVO: React + Vite
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx              — entry point, importa styles.css global, monta AuthProvider + Router
│       ├── App.jsx
│       ├── router.jsx            — React Router v6: define todas as rotas
│       ├── styles.css            — cópia ou import de public/css/styles.css
│       │
│       ├── contexts/
│       │   └── AuthContext.jsx   — estado de sessão: user, loading, logout
│       │
│       ├── hooks/
│       │   └── useAuth.js        — atalho para useContext(AuthContext)
│       │
│       ├── api/                  — módulos de fetch por domínio (substituem os fetch inline)
│       │   ├── auth.js
│       │   ├── proposals.js
│       │   ├── clients.js
│       │   ├── parts.js
│       │   ├── kanban.js
│       │   ├── stock.js
│       │   ├── financial.js
│       │   └── ...
│       │
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Navbar.jsx        — substitui o <nav> duplicado em 14 arquivos
│       │   │   ├── PageBar.jsx       — header de título de página
│       │   │   └── ProtectedRoute.jsx — redireciona para /login se não autenticado
│       │   └── shared/
│       │       ├── Toast.jsx         — feedback de sucesso/erro
│       │       ├── ConfirmModal.jsx  — modal de confirmação de ações destrutivas
│       │       ├── Table.jsx         — tabela reutilizável
│       │       ├── Autocomplete.jsx  — input com sugestões (usado em nova-proposta e clients)
│       │       └── BarChart.jsx      — wrapper react-chartjs-2
│       │
│       └── pages/
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── Proposals.jsx         — TELA PILOTO
│           ├── NovaPropostaPage.jsx  — última a ser migrada
│           ├── Clients.jsx
│           ├── Parts.jsx
│           ├── Kanban.jsx
│           ├── Stock.jsx
│           ├── Financeiro.jsx
│           ├── ContasPagar.jsx
│           ├── NotasRecebidas.jsx
│           ├── Fornecedores.jsx
│           ├── Usuarios.jsx
│           ├── Responsaveis.jsx
│           └── Objetos.jsx
│
├── package.json                  — backend (inalterado)
└── ...
```

### Como o Express serve o React

**Em desenvolvimento**: Vite roda em porta separada (ex: `localhost:5173`) com proxy configurado para o Express (`localhost:3000`). O dev acessa o Vite, que faz proxy das chamadas de API para o Express. Não precisa alterar `app.js` para desenvolvimento.

**Em produção**: após `npm run build` em `frontend/`, o diretório `frontend/dist/` é servido pelo Express como estático. Adicionar ao `app.js`:

```js
// Servir build React (produção)
const frontendDist = path.resolve(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));

// Fallback SPA: qualquer rota não reconhecida pelo Express devolve o index.html do React
// Deve vir APÓS todas as rotas de API e ANTES do notFoundHandler
app.get('*', (req, res, next) => {
  // Rotas de API passam para o próximo handler (404 padrão)
  const isApiRoute = [
    '/auth', '/users', '/clients', '/parts', '/part-categories',
    '/items', '/responsaveis', '/commercial-conditions', '/objetos',
    '/proposals', '/kanban', '/stock', '/fornecedores',
    '/categorias-despesa', '/notas-recebidas', '/contas-pagar',
    '/files', '/health'
  ].some(prefix => req.path.startsWith(prefix));

  if (isApiRoute) return next();
  res.sendFile(path.join(frontendDist, 'index.html'));
});
```

**Resultado**: mesmo origin → zero CORS. Cookie de sessão enviado automaticamente pelo browser.

### AuthContext

```jsx
// frontend/src/contexts/AuthContext.jsx
import { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => { setUser(data?.user ?? null); })
      .catch(() => { setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const logout = () =>
    fetch('/auth/logout', { method: 'POST' })
      .finally(() => { setUser(null); window.location.href = '/login'; });

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### vite.config.js (desenvolvimento)

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth':               'http://localhost:3000',
      '/users':              'http://localhost:3000',
      '/clients':            'http://localhost:3000',
      '/parts':              'http://localhost:3000',
      '/part-categories':    'http://localhost:3000',
      '/items':              'http://localhost:3000',
      '/responsaveis':       'http://localhost:3000',
      '/commercial-conditions': 'http://localhost:3000',
      '/objetos':            'http://localhost:3000',
      '/proposals':          'http://localhost:3000',
      '/kanban':             'http://localhost:3000',
      '/stock':              'http://localhost:3000',
      '/fornecedores':       'http://localhost:3000',
      '/categorias-despesa': 'http://localhost:3000',
      '/notas-recebidas':    'http://localhost:3000',
      '/contas-pagar':       'http://localhost:3000',
      '/files':              'http://localhost:3000',
      '/health':             'http://localhost:3000',
    },
  },
  build: {
    outDir: '../frontend/dist',   // ajustar conforme estrutura final
  },
});
```

### Dependências do frontend React

```json
// frontend/package.json — dependencies
{
  "react": "^18",
  "react-dom": "^18",
  "react-router-dom": "^6",
  "react-chartjs-2": "^5",
  "chart.js": "^4"
}

// devDependencies
{
  "@vitejs/plugin-react": "^4",
  "vite": "^5"
}
```

Sem Tailwind, sem UI library, sem Zustand, sem React Query na versão inicial. A ideia é manter o stack enxuto.

---

## 6. Rotas — Separação Página vs. API

### Rotas de página (hoje: arquivos estáticos; depois: React Router)

| URL atual | Componente React |
|---|---|
| `/login.html` | `<Login />` → rota `/login` |
| `/` | `<Dashboard />` → rota `/` |
| `/proposals.html` | `<Proposals />` → rota `/proposals` |
| `/nova-proposta.html` | `<NovaPropostaPage />` → rota `/nova-proposta` |
| `/clients.html` | `<Clients />` → rota `/clients` |
| `/parts.html` | `<Parts />` → rota `/parts` |
| `/kanban.html` | `<Kanban />` → rota `/kanban` |
| `/stock.html` | `<Stock />` → rota `/stock` |
| `/financeiro.html` | `<Financeiro />` → rota `/financeiro` |
| `/contas-pagar.html` | `<ContasPagar />` → rota `/contas-pagar` |
| `/notas-recebidas.html` | `<NotasRecebidas />` → rota `/notas-recebidas` |
| `/fornecedores.html` | `<Fornecedores />` → rota `/fornecedores` |
| `/usuarios.html` | `<Usuarios />` → rota `/usuarios` |
| `/responsaveis.html` | `<Responsaveis />` → rota `/responsaveis` |
| `/objetos.html` | `<Objetos />` → rota `/objetos` |

### Rotas de API (Express — todas permanecem inalteradas)

```
Auth:             GET /auth/me · POST /auth/login · POST /auth/logout
Usuários:         GET/POST /users · PUT/DELETE /users/:id · PUT /users/me/*
Clientes:         GET/POST /clients · GET /clients/search · GET /clients/profit-analysis · GET/PUT/DELETE /clients/:id
Peças:            GET/POST /parts · GET /parts/search · GET/PUT/DELETE /parts/:id · 4 sub-rotas
Categorias:       GET/POST /part-categories · PUT/DELETE /part-categories/:id
Itens/preço:      GET /items/search · GET /items/last-price
Responsáveis:     GET/POST /responsaveis · GET /responsaveis/search · GET/DELETE /responsaveis/:id
Cond. comerciais: GET/POST /commercial-conditions · GET/PUT/DELETE /commercial-conditions/:id + /search
Objetos:          GET/POST /objetos · GET/PUT/DELETE /objetos/:id + /search
Kanban:           GET /kanban/cards · GET /kanban/comments/:type/:id · POST/PUT/DELETE /kanban/tasks · POST /kanban/comments
Estoque:          GET /stock · GET /stock/movements · GET /stock/contract-spend · GET /stock/movements-by-date · POST /stock/movements · POST /stock/inventory-count
Propostas:        GET/POST /proposals · GET /proposals/kanban · GET/DELETE /proposals/:id · PUT /proposals/:id/kanban-status · PUT /proposals/:id/execution · DELETE /proposals/:id/execution · PUT /proposals/:id/approval · PUT /proposals/:id/billing
Fornecedores:     GET/POST /fornecedores · GET /fornecedores/search · GET/PUT /fornecedores/:id · GET /fornecedores/:id/detalhes · POST /fornecedores/:id/desativar
Cat. despesa:     GET/POST /categorias-despesa · PUT /categorias-despesa/:id · POST /categorias-despesa/:id/desativar
Notas recebidas:  GET/POST /notas-recebidas · GET/PUT /notas-recebidas/:id · POST /notas-recebidas/:id/cancelar
Contas a pagar:   GET/POST /contas-pagar · GET /contas-pagar/resumo · GET/PUT /contas-pagar/:id · POST /contas-pagar/:id/baixar · POST /contas-pagar/:id/cancelar
Arquivos:         GET /files/* · GET /files/approvals/* · GET /files/notas/* · GET /files/comprovantes/*
Health:           GET /health
```

---

## 7. Ordem de Migração

Critérios de ordenação: **simplicidade primeiro → valor para o negócio → risco de regressão**.

| Fase | Tela | Linhas | fetch | Notas |
|---|---|---|---|---|
| **0** | Setup base: Vite + React Router + AuthContext + Navbar + ProtectedRoute | — | — | Fundação — nada funciona sem isso |
| **1** | `login.html` | 89 | 1 | Obrigatório para o fluxo completo |
| **2** | `proposals.html` ← **PILOTO** | 302 | 2 | Core do sistema, simples, alto valor |
| **3** | `responsaveis.html` | 325 | 3 | CRUD simples — valida o padrão de componentes |
| **4** | `fornecedores.html` | 389 | 7 | CRUD simples |
| **5** | `financeiro.html` | 250 | 3 | Introduz `react-chartjs-2` |
| **6** | `usuarios.html` | 443 | 9 | CRUD com roles + proteção admin |
| **7** | `objetos.html` | 698 | 8 | CRUD com create/edit inline |
| **8** | `clients.html` | 747 | 5 | Core, médio, tem profit-analysis com chart |
| **9** | `contas-pagar.html` | 519 | 10 | Financeiro com file upload |
| **10** | `notas-recebidas.html` | 1137 | 10 | Upload de PDF + XML |
| **11** | `stock.html` | 1360 | 10 | Chart.js + múltiplas sub-views |
| **12** | `parts.html` | 1203 | 17 | Mais fetch calls do sistema; histórico e referências |
| **13** | `index.html` (dashboard) | 628 | 2 | Depende de outros módulos prontos para exibir stats |
| **14** | `kanban.html` | 1281 | 13 | Múltiplos modais, comentários, lógica de permissão |
| **15** | `nova-proposta.html` | 2007 | 9 | **ÚLTIMA** — mais crítica, mais complexa |

### Estratégia de coexistência durante a transição

Durante a migração, as versões HTML e React vão coexistir. A regra é simples:

1. Ao iniciar a migração de uma tela, criar o componente React.
2. Testar o componente React em paralelo com o HTML original.
3. Quando validado, remover o arquivo `.html` de `public/` e registrar a rota no React Router.
4. O Express passa a servir o React para aquela URL.

Enquanto um arquivo `.html` existir em `public/`, ele tem precedência sobre o fallback SPA do React (Express serve estático primeiro). Isso é intencional — garante que o HTML original continue funcionando enquanto o componente React não está pronto.

---

## 8. Tela Piloto

### Escolha: `proposals.html` → `pages/Proposals.jsx`

**Justificativa:**

| Critério | Por que proposals.html |
|---|---|
| Simplicidade | 302 linhas, 2 fetch calls (`GET /proposals` e `DELETE /proposals/:id`) |
| Valor de negócio | Entidade central do sistema — usada todos os dias |
| Padrões cobertos | Autenticação via AuthContext, lista com loading state, tabela, delete com modal, toast, filtro client-side |
| Sem dependências extras | Sem Chart.js, sem file upload, sem autocomplete, sem localStorage |
| Rollback trivial | Se falhar, basta manter o arquivo `.html` — zero impacto no sistema |

**Alternativa descartada**: `responsaveis.html` seria mais simples, mas tem menos valor estratégico para demonstrar a migração.

### O que o piloto deve provar

Ao finalizar o piloto, a base deve estar funcionando para:

- [ ] Sessão verificada via `AuthContext` ao carregar a página
- [ ] Redirecionamento para `/login` se não autenticado
- [ ] Fetch de lista com estado de loading
- [ ] Render de tabela com dados reais
- [ ] Filtro/busca client-side
- [ ] Modal de confirmação de exclusão (`<ConfirmModal />`)
- [ ] Delete via `DELETE /proposals/:id`
- [ ] Toast de feedback após ação (`<Toast />`)
- [ ] Navbar com item ativo correto
- [ ] CSS visual idêntico ao original

Se todos esses pontos estiverem funcionando, a base está pronta para migrar as demais telas.

---

## 9. Riscos e Estratégias

### 🔴 Alta atenção

**Coexistência de URLs durante a transição**

O Express serve `public/` como estático. Enquanto `public/proposals.html` existir, a URL `/proposals.html` serve o HTML — não o React. O React Router responderia em `/proposals` (sem `.html`).

- **Estratégia A (recomendada)**: Usar URLs sem `.html` no React Router (`/proposals`, `/clients`, etc.) desde o início. As URLs com `.html` continuam funcionando via estático até serem removidas. URLs diferentes = coexistência limpa.
- **Estratégia B**: Remover o arquivo `.html` de `public/` imediatamente ao migrar a tela. Mais limpo, mas sem fallback se o componente React tiver bug.

**`nova-proposta.html` — a tela mais crítica**

- 2007 linhas com: autocomplete customizado para clientes, peças, objetos e condições; sugestão de preço via `GET /items/last-price`; items dinâmicos (add/remove/editar); validação de cliente inline com find-or-create; autosave com `localStorage`; debounce nos inputs.
- Um bug nessa tela para a criação de propostas — função central do sistema.
- **Estratégia**: É a última a ser migrada (Fase 15). O arquivo HTML original é mantido em `public/nova-proposta.html` até o componente React estar 100% testado em staging com propostas reais.

### 🟡 Atenção moderada

**CSS legado com aliases duplicados**

`styles.css` tem variáveis antigas (`--green`, `--muted`, `--border`) ao lado dos tokens novos (`--color-primary`, `--color-muted`, `--color-border`). Algumas páginas usam os aliases antigos em estilos inline.

- **Estratégia**: Importar `styles.css` globalmente no React (`main.jsx`). Os aliases continuam funcionando. Normalizar para os tokens novos conforme cada componente for criado — sem pressa.

**File uploads (FormData)**

4 telas usam `multipart/form-data`. Em React, `new FormData()` + `fetch()` sem `Content-Type` header funciona igual ao vanilla JS — o browser define o `boundary` automaticamente. Não é um risco real, mas precisa ser testado explicitamente ao migrar cada tela afetada.

**localStorage para autosave**

`nova-proposta.html` usa `localStorage` com chave `draft_new_proposal_user_{id}`. Em React, `localStorage` funciona igual. A lógica de autosave pode ser extraída para um hook customizado `useDraftAutosave(key, state)`. Garantir que o `useEffect` de cleanup apague o draft ao submeter com sucesso.

### 🟢 Não são riscos reais

| Item | Motivo |
|---|---|
| CORS | Zero — Express serve o build React no mesmo origin |
| Autenticação | Cookie httpOnly, browser envia automaticamente em same-origin |
| Backend | Zero mudanças — API já é JSON pura |
| Chart.js | Trocar por `react-chartjs-2` (wrapper oficial, API quase idêntica) |
| Kanban | Usa botões para mover cards — sem drag-and-drop, sem biblioteca DnD necessária |
| Arquivos PDF | `/files/*.pdf` e subpastas continuam servidos pelo Express estático — React apenas linka |
| Deploy | Express + PM2 + nginx continuam iguais — apenas adiciona `npm run build` no CI/deploy |
| Testes backend | Os 408 testes existentes (Vitest) não são afetados — testam services e repositories, não o HTML |

---

## 10. Prompt de Implementação da Base

Quando quiser iniciar a implementação, use este prompt:

---

```
Implemente a base do React + Vite para o projeto GHTec ERP seguindo o plano em docs/REACT_MIGRATION_PLAN.md.

Fase 0 — Base (não migrar nenhuma tela ainda, apenas a fundação):

1. Criar pasta `frontend/` na raiz do projeto com Vite + React 18 (JavaScript, sem TypeScript)
2. Configurar `vite.config.js` com proxy para o Express em localhost:3000 (todos os prefixos listados na seção 5 do plano)
3. Criar `AuthContext.jsx` exatamente como descrito na seção 5
4. Criar `ProtectedRoute.jsx` que redireciona para `/login` se user for null
5. Criar `router.jsx` com React Router v6 com rotas apenas para: `/login`, `/`, `/proposals`
6. Criar `Navbar.jsx` usando `useLocation()` para marcar a rota ativa — deve ter a mesma estrutura visual do <nav> atual
7. Importar `public/css/styles.css` globalmente no `main.jsx` — não criar CSS novo ainda

Fase 1 — Login:
8. Criar `pages/Login.jsx` migrando `public/login.html` — mesmo visual, mesma lógica de fetch

Fase 2 — Tela piloto:
9. Criar `pages/Proposals.jsx` migrando `public/proposals.html` — inclui tabela, filtro, delete com ConfirmModal, Toast

Regras:
- Não alterar nenhum arquivo em src/ (backend)
- Não remover nenhum arquivo de public/ ainda
- Não instalar dependências desnecessárias: apenas react, react-dom, react-router-dom, @vitejs/plugin-react, vite
- O frontend/package.json é separado do package.json raiz
```

---

*Documento criado em 2026-05-27. Nenhum código foi alterado — este é um documento de planejamento.*

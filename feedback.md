# Feedback — Passo 4.1: Base React + Vite

## O que foi feito

Criação completa da base React + Vite e migração das telas Login, Dashboard e Proposals.

## Arquivos criados

**Frontend base:**
- `frontend/package.json` — React 18, react-dom, react-router-dom, Vite 5
- `frontend/index.html` — entry point com link para `/css/styles.css` do Express
- `frontend/vite.config.js` — base `/app/`, proxy para todas as rotas Express, build → dist/

**App shell:**
- `frontend/src/main.jsx` — render root
- `frontend/src/App.jsx` — BrowserRouter (basename="/app") + AuthProvider
- `frontend/src/router.jsx` — rotas públicas, ProtectedRoute, LegacyRedirect para 12 telas

**Auth:**
- `frontend/src/contexts/AuthContext.jsx` — GET /auth/me no mount, login, logout
- `frontend/src/hooks/useAuth.js`

**Layout:**
- `frontend/src/components/layout/ProtectedRoute.jsx`
- `frontend/src/components/layout/AppLayout.jsx`
- `frontend/src/components/layout/Navbar.jsx` — CSS hover, React Link para migrados, `<a>` para legados

**Shared:**
- `frontend/src/components/shared/Loading.jsx`
- `frontend/src/components/shared/Toast.jsx` — auto-dismiss 4s
- `frontend/src/components/shared/ConfirmModal.jsx`

**API:**
- `frontend/src/api/http.js` — fetch centralizado com credentials: include
- `frontend/src/api/auth.js`
- `frontend/src/api/proposals.js`

**Páginas migradas:**
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/Proposals.jsx`
- `frontend/src/pages/LegacyRedirect.jsx`

## Arquivos alterados

- `src/app.js` — serve `frontend/dist/` em `/app/`, SPA fallback, redirect `/` → `/app/`
- `src/middleware/requireAuth.js` — `/app/` e `/legacy/` adicionados ao PUBLIC_PREFIXES; ADMIN_PAGES atualizado
- `package.json` — scripts `frontend:dev`, `frontend:build`, `frontend:preview`
- `docs/REACT_MIGRATION_PLAN.md` — status atualizado para Passo 4.1 concluído
- `docs/SYSTEM_CONTEXT.md` — stack, arquitetura e decisões técnicas atualizados

## Movimentações de arquivo

14 HTMLs movidos de `public/` para `public/legacy/`:
proposals.html, clients.html, parts.html, kanban.html, stock.html, financeiro.html,
contas-pagar.html, notas-recebidas.html, fornecedores.html, usuarios.html,
responsaveis.html, objetos.html, nova-proposta.html, index.html

Permanecem em `public/`: `login.html`, `auth.js`, `css/`, `assets/`

## Validações executadas

- `npm run frontend:build` → ✅ build OK (179KB gzip: 58KB)
- `npm run prisma:status` → ✅ schema up to date
- `npm test` → ✅ 408/408 testes passando

## Decisão arquitetural registrada

React serve sob `/app/` (basename="/app") para evitar conflito com rotas de API Express
(`GET /proposals` é API, `GET /app/proposals` é página React). Decisão registrada no
SYSTEM_CONTEXT.md seção 14, item 4.

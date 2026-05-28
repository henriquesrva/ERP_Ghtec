# Feedback — Passo 4.21: Auditoria final de consistência pós-migração React

---

## 1. Resultado dos greps

| Busca | Achados | Classificação |
|---|---|---|
| `legacy` | `Navbar.jsx:6` — comentário "página legacy" | **Funcional obsoleto** → corrigido |
| `auth.js` | `Login.jsx:6`, `Proposals.jsx:8` | Comentário histórico — aceitável |
| `login.html` | `Login.jsx:6` | Comentário histórico — aceitável |
| `proposals.html` | `app.js:346` | Redirect de compatibilidade intencional — aceitável |
| `index.html` | `app.js:338` (SPA fallback), `app.js:345` (redirect), `styles.css:627` | Dois são necessários; CSS era comentário obsoleto → corrigido |
| `/css/` | Nenhuma referência funcional | Limpo |
| `public/css` | Nenhuma referência funcional | Limpo |

---

## 2. Referências funcionais corrigidas

### `frontend/src/components/layout/Navbar.jsx`

**Problema:** O componente tinha um padrão de coexistência legado (`react: true/false`) usado durante a migração para distinguir links React Router de links HTML antigos. Com 100% das telas em React, o código morto (`react: false → <a href>`) nunca executava mais.

**O que foi removido:**
- Comentário `// react: true → ... / react: false → <a href> para página legacy`
- Propriedade `react: true` de todos os 10 links de menu (sempre era `true`)
- Ramo morto no render: `link.react ? <Link> : <a href={link.href}>`
- Comentário `// /financeiro já é React`

**Resultado:** Render simplificado — todos os links são `<Link>` React Router diretamente.

### `frontend/src/styles.css:627`

**Problema:** Comentário CSS `/* Modal Overlay (entity picker — usado em index.html) */` referenciava arquivo legado.

**Corrigido para:** `/* Modal Overlay (entity picker) */`

---

## 3. Estado final do requireAuth.js

```js
const PUBLIC_PATHS   = new Set(["/auth/login", "/auth/logout", "/health"]);
const PUBLIC_PREFIXES = ["/assets/", "/app/"];
```

- Mínimo e correto
- `/app/` libera toda a SPA React (login incluído)
- `/assets/` libera o logo
- Redirect não autenticado aponta para `/app/login`
- Sem rastros de `/css/`, `/legacy`, `/auth.js`, `/login.html`

---

## 4. Estado final do app.js

- `express.static(public)` serve apenas `assets/logoGHTEC.png` — sem legado exposto
- SPA: `express.static(frontendDist)` + fallback `app.get(["/app", "/app/*"])`
- `/files/*` servem output de PDFs/uploads — intocados
- Redirects de compatibilidade mantidos e intencionais:
  - `/` → `/app/`
  - `/index.html` → `/app/`
  - `/proposals.html` → `/app/proposals`
- Nenhum redirect para `/legacy`, `/login.html`, `/css/` ou rotas mortas

---

## 5. Estado final do frontend/index.html e main.jsx

**`frontend/index.html`:**
- Sem `<link rel="stylesheet">` externo — CSS bundlado pelo Vite
- Entry point mínimo e limpo

**`frontend/src/main.jsx`:**
- `import './styles.css'` presente — CSS global bundlado via Vite
- Sem dependências externas desnecessárias

---

## 6. Documentação atualizada?

Não — nenhuma inconsistência estrutural encontrada na documentação que exigisse atualização neste passo (as limpezas de doc foram feitas nos Passos 4.19 e 4.20).

---

## 7. Validações executadas

| Validação | Resultado |
|---|---|
| `npm run frontend:build` | ✅ built in 1.26s |
| `npm test` | ✅ 408 passed (18 files) |
| `npm run prisma:status` | ✅ Database schema is up to date |
| `node scripts/check-prisma-connection.js` | ✅ 15 passos, todos OK |

---

## 8. Veredito: pronto para deploy/staging?

**Sim.** O sistema está consistente e limpo:

- Zero referências funcionais ao frontend legado
- `public/` expõe apenas o logo (`assets/logoGHTEC.png`)
- CSS global bundlado pelo Vite — sem dependência HTTP externa
- `requireAuth.js` mínimo e correto
- `app.js` com ordem de middlewares correta e sem código morto
- `Navbar.jsx` limpo — sem código de coexistência legado
- 408 testes backend passando
- Build React limpo sem warnings

---

## 9. Próximo passo recomendado

A migração está completa. Os próximos passos são operacionais:

- **Deploy/staging:** Rodar `npm run frontend:build` no servidor e reiniciar o processo PM2
- **Smoke test em staging:** Verificar `/app/login`, `/app/`, `/app/proposals`, upload de arquivos (notas recebidas, contas a pagar, aprovação de kanban) e geração de PDF
- **Opcional futuro:** Mover `public/assets/logoGHTEC.png` para `frontend/public/` e remover o `express.static(public)` — baixíssima prioridade, sem impacto funcional

# Feedback — Passo 4.18: Remover login HTML legado

---

## 1. Resultado da busca por login.html

Referências encontradas:
- `src/middleware/requireAuth.js` — `/login.html` em `PUBLIC_PATHS` e no redirect de não-autenticados **(alterado)**
- `docs/SYSTEM_CONTEXT.md` — menções à `login.html` como arquivo legado **(atualizado)**
- `contexto/REACT_MIGRATION_PLAN.md` — referências históricas do plano de migração (mantidas, são documentação histórica)
- `frontend/src/pages/Login.jsx` — apenas comentário de cabeçalho (mantido, sem impacto)
- `.claude/settings.local.json` — comandos de validação históricos (mantidos, sem impacto funcional)
- `feedback.md` — menção anterior neste arquivo (substituído)

---

## 2. Arquivos Removidos

- `public/login.html`

---

## 3. Arquivos Alterados

### `src/middleware/requireAuth.js`
- Removido `/login.html` de `PUBLIC_PATHS`
- Redirect de não-autenticados alterado de `/login.html` → `/app/login`

### `docs/SYSTEM_CONTEXT.md`
- Removida linha `login.html # Tela de login legado` da árvore de `public/`
- Atualizada tabela de páginas: `login.html` → `/app/login` (React)

---

## 4. Ajustes no requireAuth

```js
// Antes
const PUBLIC_PATHS = new Set(["/login.html", "/auth/login", "/auth/logout", "/health"]);
// redirect: res.redirect("/login.html")

// Depois
const PUBLIC_PATHS = new Set(["/auth/login", "/auth/logout", "/health"]);
// redirect: res.redirect("/app/login")
```

`/app/` já estava em `PUBLIC_PREFIXES`, portanto `/app/login` continua acessível sem autenticação.

---

## 5. Documentação atualizada

- `docs/SYSTEM_CONTEXT.md` atualizado (árvore de arquivos + tabela de páginas)

---

## 6. Validações executadas

| Validação | Resultado |
|---|---|
| `npm run frontend:build` | ✅ built in 1.25s |
| `npm test` | ✅ 408 passed (18 files) |
| `npm run prisma:status` | ✅ Database schema is up to date |
| `node scripts/check-prisma-connection.js` | ✅ 15 passos, todos OK |

---

## 7. Próximo passo recomendado

**Passo 4.19** — Limpeza final dos assets legados em `public/`:
- Verificar se `public/css/styles.css` e `public/assets/` ainda são referenciados pelo React ou se podem ser consolidados apenas em `frontend/`
- Revisar se o Express ainda precisa servir `public/` como estático ou se essa responsabilidade pode ser restrita ao `frontend/dist/`

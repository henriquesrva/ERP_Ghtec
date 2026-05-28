# Feedback — Passo 4.16: Remover Legado HTML Antigo

---

## 1. Arquivos/Pastas Removidos

| Item | Tipo |
|---|---|
| `public/legacy/` | Pasta com 14 HTMLs (clients, contas-pagar, financeiro, fornecedores, index, kanban, notas-recebidas, nova-proposta, objetos, parts, proposals, responsaveis, stock, usuarios) |
| `public/auth.js` | Script de autenticação do frontend legado |
| `frontend/src/pages/LegacyRedirect.jsx` | Componente React de redirecionamento (não mais necessário) |

---

## 2. Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| `src/middleware/requireAuth.js` | Removido `/auth.js` e `/legacy/` de `PUBLIC_PREFIXES`; `ADMIN_PAGES` esvaziado |
| `frontend/src/router.jsx` | Removido bloco `const LEGACY` e `LEGACY.map()`; router limpo com 14 rotas |
| `frontend/src/pages/Responsaveis.jsx` | JSDoc: removida linha "migrado de public/legacy/..." |
| `frontend/src/pages/Objetos.jsx` | JSDoc: removida linha "migrado de public/legacy/..." |
| `frontend/src/pages/Usuarios.jsx` | JSDoc: removida linha "migrado de public/legacy/..." |
| `frontend/src/pages/Clients.jsx` | JSDoc: removida linha "migrado de public/legacy/..." |
| `frontend/src/pages/Fornecedores.jsx` | JSDoc: removida linha "migrado de public/legacy/..." |
| `frontend/src/contexts/AuthContext.jsx` | Comentário: removida referência a "auth.js legado" |
| `docs/SYSTEM_CONTEXT.md` | Atualizado: stack, estrutura de pastas, decisão técnica 4, orientação frontend, rodapé |
| `contexto/REACT_MIGRATION_PLAN.md` | Status atualizado para Passo 4.16 concluído |

---

## 3. Resultado das Buscas

```
grep -Rn "/legacy"      frontend/src src  → 0 resultados
grep -Rn "legacy/"      frontend/src src  → 0 resultados
grep -Rn "auth\.js"     frontend/src src  → 0 resultados
grep -Rn "LegacyRedirect" frontend/src   → 0 resultados
```

Zero referências ativas em código. Legado completamente removido.

---

## 4. Ajustes em requireAuth

**Antes:**
```js
const PUBLIC_PREFIXES = ["/css/", "/assets/", "/auth.js", "/app/", "/legacy/"];
const ADMIN_PAGES     = new Set(["/legacy/usuarios.html"]);
```

**Depois:**
```js
const PUBLIC_PREFIXES = ["/css/", "/assets/", "/app/"];
const ADMIN_PAGES     = new Set();
```

- `/auth.js` removido (arquivo deletado)
- `/legacy/` removido (pasta deletada)
- `ADMIN_PAGES` esvaziado (proteção de rota legada não se aplica mais)
- `/app/` mantido — necessário para servir o SPA React sem autenticação

---

## 5. Ajustes em app.js

Nenhum. O `app.js` não tinha referências explícitas a `/legacy/` — a pasta era servida via `express.static(../public)` implicitamente. Com a pasta removida, ela simplesmente deixa de existir. Todos os outros serviços permanecem intactos:

- `express.static(../public)` → serve `css/`, `assets/`, `login.html`
- `/app` → serve `frontend/dist/` (React)
- `/files/` → serve `output/proposals/`
- `/health` → funcional

---

## 6. Documentação Atualizada

### SYSTEM_CONTEXT.md
- Stack: removida linha "Frontend (legado) — HTML vanilla em public/legacy/"
- Estrutura de pastas: `public/` simplificada (css, assets, login.html — sem legacy)
- `router.jsx`: descrição atualizada ("todas as 15 telas React")
- Decisão técnica 4: atualizada — migração concluída em Passo 4.16
- Orientação frontend: atualizada — sem mais menção a telas HTML legadas
- Rodapé: atualizado para 2026-05-28, Passo 4.16

### contexto/REACT_MIGRATION_PLAN.md
- Status atualizado para: "Migração React concluída. Todas as 15 telas migradas. public/legacy/ removido."

---

## 7. Validações Executadas

| Validação | Resultado |
|---|---|
| `npm run frontend:build` | ✅ 78 módulos, build limpo |
| `npm test` | ✅ 408/408 testes backend passando (18 suites) |
| `node scripts/check-prisma-connection.js` | ✅ Prisma + PostgreSQL OK |

---

## 8. Estado Final de public/

```
public/
├── assets/
│   └── logoGHTEC.png
├── css/
│   └── styles.css
└── login.html          ← mantido como fallback (não removido neste passo)
```

---

## 9. Próximo Passo Recomendado

**Migração React completa e legado removido.**

Próximos passos possíveis:

1. **Code splitting** — bundle está em 584 kB. Aplicar `React.lazy` por rota reduz TTI inicial. Baixo risco, ganho mensurável.
2. **Remover `public/login.html`** — a tela de login agora é `/app/login` (React). O HTML legado pode ser removido e `/login.html` retirado de `PUBLIC_PATHS` no requireAuth. Verificar se há bookmarks/links externos antes.
3. **Deploy** — sistema está estável para validação em produção.

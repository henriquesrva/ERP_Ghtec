# Feedback — Passo 4.19: Auditar e limpar assets públicos restantes

---

## 1. Resultado da auditoria de public/css

`public/css/styles.css` era carregado via `<link rel="stylesheet" href="/css/styles.css" />` em `frontend/index.html`.
No runtime de produção, o Express servia o arquivo a partir de `public/`. No dev, o Vite proxy encaminhava `/css` para o Express.

Nenhum componente React importava `styles.css` diretamente — o CSS era carregado como HTTP request externa ao bundle Vite.

---

## 2. Resultado da auditoria de public/assets

`public/assets/logoGHTEC.png` é referenciada via URL absoluta `/assets/logoGHTEC.png` em:
- `frontend/src/pages/Login.jsx`
- `frontend/src/components/layout/Navbar.jsx`

O Express serve `public/` como static, portanto `/assets/logoGHTEC.png` é resolvida corretamente tanto em dev quanto em produção. Nenhuma mudança necessária.

---

## 3. Decisão sobre styles.css

**Opção B executada — CSS movido para `frontend/src/styles.css`.**

- Copiado `public/css/styles.css` → `frontend/src/styles.css`
- Adicionado `import './styles.css'` em `frontend/src/main.jsx`
- Removida tag `<link rel="stylesheet" href="/css/styles.css" />` de `frontend/index.html`
- Deletado `public/css/` (diretório e arquivo)
- Removido `/css` da lista de proxy em `frontend/vite.config.js`
- Removido `/css/` de `PUBLIC_PREFIXES` em `src/middleware/requireAuth.js`

O CSS agora é bundlado pelo Vite e entregue como `/app/assets/index-<hash>.css` — zero dependência HTTP externa.

---

## 4. Decisão sobre logo/assets

**Mantido em `public/assets/logoGHTEC.png`.** Sem alteração.

Mover para `frontend/public/` quebraria as URLs em produção porque o Express serve `frontend/dist/` em `/app/`, alterando o path para `/app/assets/logoGHTEC.png`. Seria necessário atualizar os componentes e remover o proxy `/assets` — mais risco, sem ganho real.

---

## 5. Arquivos removidos/movidos

| Ação | Arquivo |
|---|---|
| Removido | `public/css/styles.css` |
| Removido | `public/css/` (diretório) |
| Adicionado | `frontend/src/styles.css` (copiado do anterior) |

---

## 6. Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `frontend/src/main.jsx` | Adicionado `import './styles.css'` |
| `frontend/index.html` | Removida tag `<link>` para `/css/styles.css` |
| `frontend/vite.config.js` | Removido `/css` e `/legacy` da lista de proxy |
| `src/middleware/requireAuth.js` | Removido `/css/` de `PUBLIC_PREFIXES` |

---

## 7. app.js precisou mudar?

Não. `app.use(express.static(... public ...))` continua necessário para servir `public/assets/logoGHTEC.png`.

---

## 8. Documentação atualizada?

Sim — `docs/SYSTEM_CONTEXT.md`:
- Árvore de `public/`: removida entrada `css/styles.css`; atualizada nota do logo
- Árvore de `frontend/`: atualizado `index.html` e adicionado `src/styles.css`
- Nota histórica (item 4): atualizada para Passos 4.1–4.19 com o novo status do CSS

---

## 9. Validações executadas

| Validação | Resultado |
|---|---|
| `npm run frontend:build` | ✅ built in 1.17s — CSS bundlado em `index-BJ4LAFma.css` |
| `dist/index.html` sem `<link>` externo | ✅ confirmado |
| `npm test` | ✅ 408 passed (18 files) |
| `npm run prisma:status` | ✅ Database schema is up to date |
| `node scripts/check-prisma-connection.js` | ✅ 15 passos, todos OK |

---

## 10. Próximo passo recomendado

**Passo 4.20** — Revisar e limpar `app.js`:
- Remover redirects de compatibilidade (`/index.html`, `/proposals.html`) se não forem mais necessários
- Confirmar que o fallback SPA (`/app/*`) está correto e que nenhuma rota HTML legada sobrou
- Verificar se `public/` pode eventualmente ser consolidado (logo movida para `frontend/public/`) em uma próxima etapa controlada

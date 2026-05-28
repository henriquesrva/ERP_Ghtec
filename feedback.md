# Feedback — Passo 4.20: Revisar e limpar app.js pós-migração React

---

## 1. Auditoria do app.js

`src/app.js` está limpo e correto para o estado pós-migração. Resumo da estrutura encontrada:

| Bloco | Linha | Estado |
|---|---|---|
| `requireAuth` middleware | 169 | ✅ Correto — roda antes de tudo |
| `express.static(public)` | 171 | ✅ Necessário — serve `assets/logoGHTEC.png` |
| `/files/*` static routes | 172–175 | ✅ Intocados — servem output de PDFs/uploads |
| Rotas de API | 177–332 | ✅ Sem alterações |
| `express.static(frontendDist)` | 336 | ✅ Serve bundle React em `/app` |
| SPA fallback `["/app", "/app/*"]` | 337–341 | ✅ Correto — serve `index.html` para rotas SPA |
| Redirects de compatibilidade | 344–346 | ✅ Mantidos (ver item 3) |
| `notFoundHandler` / `errorHandler` | 349–353 | ✅ Último na cadeia |

**Nenhuma alteração de código foi necessária em `app.js`.**

---

## 2. Redirects encontrados

```js
app.get("/",              (req, res) => res.redirect("/app/"));
app.get("/index.html",    (req, res) => res.redirect("/app/"));
app.get("/proposals.html",(req, res) => res.redirect("/app/proposals"));
```

Nenhum redirect para `/legacy`, `/login.html` ou rotas mortas.

---

## 3. Redirects mantidos/removidos e por quê

| Redirect | Decisão | Motivo |
|---|---|---|
| `/` → `/app/` | **Mantido** | Essencial — entrada principal do sistema |
| `/index.html` → `/app/` | **Mantido** | Bookmark compatibility — inofensivo, 1 linha |
| `/proposals.html` → `/app/proposals` | **Mantido** | Bookmark compatibility — rota React válida |

Não havia redirect `/login.html` em `app.js` (já tratado pelo `requireAuth` no Passo 4.18).

---

## 4. Estado do express.static public/

```js
app.use(express.static(path.resolve(__dirname, "../public")));
```

Mantido sem alteração. `public/` contém apenas `assets/logoGHTEC.png`, referenciada via URL `/assets/logoGHTEC.png` em `Login.jsx` e `Navbar.jsx`. Sem nenhum arquivo legado exposto.

---

## 5. Estado do fallback /app

```js
app.use("/app", express.static(frontendDist));
app.get(["/app", "/app/*"], (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"), ...);
});
```

Correto. `express.static` serve os assets do bundle (JS/CSS com hash). O `app.get` fallback serve `index.html` para qualquer rota SPA não encontrada como arquivo. Rotas de API não são interceptadas — todas estão declaradas antes deste bloco.

---

## 6. Arquivos alterados

`app.js` **não foi alterado**.

Documentação atualizada:

| Arquivo | Alterações |
|---|---|
| `docs/SYSTEM_CONTEXT.md` | Descrição de Comunicação Frontend ↔ Backend atualizada; tabela de páginas migrada de `.html` para rotas `/app/`; 7 referências "Acesso via `xxx.html`" atualizadas para rotas React |
| `contexto/REACT_MIGRATION_PLAN.md` | Status header atualizado para Passo 4.20 concluído |

---

## 7. Documentação atualizada?

Sim — limpeza ampla de referências `.html` obsoletas em `docs/SYSTEM_CONTEXT.md`:
- Seção "Comunicação Frontend ↔ Backend" corrigida
- Seção 6 (Fluxos Principais): 7 "Acesso via `xxx.html`" → rotas `/app/`
- Seção 8 (Estado Atual da Interface): tabela de 15 páginas atualizada de `.html` para rotas React

---

## 8. Validações executadas

| Validação | Resultado |
|---|---|
| `npm run frontend:build` | ✅ built in 1.17s |
| `npm test` | ✅ 408 passed (18 files) |
| `npm run prisma:status` | ✅ Database schema is up to date |
| `node scripts/check-prisma-connection.js` | ✅ 15 passos, todos OK |

---

## 9. Próximo passo recomendado

**Passo 4.21** — Auditoria final de consistência:
- Verificar se há alguma referência `.html` restante em código funcional (não documentação)
- Revisar `requireAuth.js` para confirmar que `PUBLIC_PREFIXES` e `PUBLIC_PATHS` estão mínimos e corretos
- Rodar um grep final por `legacy`, `auth.js`, `login.html`, `css/` para confirmar zero restos legados no código
- Opcional: consolidar logo em `frontend/public/` se fizer sentido no futuro (baixa prioridade)

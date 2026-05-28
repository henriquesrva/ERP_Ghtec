# Feedback — Passo 4.15: Corrigir Links Legados Ativos

---

## 1. Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| `frontend/src/pages/Dashboard.jsx` | 7 links `/legacy/*.html` → `<Link to="...">` React Router |
| `frontend/src/pages/Proposals.jsx` | Link `/legacy/nova-proposta.html` → `<Link to="/nova-proposta">`; import `Link` adicionado |
| `frontend/src/pages/NotasRecebidas.jsx` | `useSearchParams` importado; `useEffect` de deep-link adicionado |
| `frontend/src/pages/Fornecedores.jsx` | `Link` importado; link de nota `/legacy/notas-recebidas.html?id=` → `<Link to="/notas-recebidas?id=">` |
| `frontend/src/router.jsx` | Import morto de `LegacyRedirect` removido |

---

## 2. Links Corrigidos no Dashboard

| Link antigo | Link novo |
|---|---|
| `/legacy/nova-proposta.html` | `<Link to="/nova-proposta">` |
| `/legacy/kanban.html` | `<Link to="/kanban">` |
| `/legacy/clients.html` | `<Link to="/clients">` |
| `/legacy/parts.html` | `<Link to="/parts">` |
| `/legacy/stock.html` | `<Link to="/stock">` |
| `/legacy/fornecedores.html` | `<Link to="/fornecedores">` |
| `/legacy/financeiro.html` | `<Link to="/financeiro">` |

Todos os 8 itens do Dashboard agora usam React Router (`react: true`). Visual e classes preservados.

---

## 3. Link Corrigido no Proposals

```jsx
// Antes
<a className="section-card" href="/legacy/nova-proposta.html">

// Depois
<Link className="section-card" to="/nova-proposta">
```

Import de `Link` adicionado na linha 2 de Proposals.jsx.

---

## 4. Solução para Fornecedores → NotasRecebidas

**Opção B implementada** (deep-link funcional).

### Em Fornecedores.jsx

```jsx
// Antes
<a href={`/legacy/notas-recebidas.html?id=${n.id}`}>

// Depois
<Link to={`/notas-recebidas?id=${n.id}`}>
```

### Em NotasRecebidas.jsx

```jsx
// Import adicionado
import { useSearchParams } from 'react-router-dom';

// Estado adicionado no componente
const [searchParams, setSearchParams] = useSearchParams();

// useEffect adicionado após loadList
useEffect(() => {
  const id = searchParams.get('id');
  if (!id) return;
  setSearchParams({}, { replace: true }); // limpa a URL após usar
  openDetail(Number(id));
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

**Comportamento:** ao navegar para `/notas-recebidas?id=123`, o componente abre automaticamente o modal de detalhe da nota 123. Se a nota não existir, `openDetail` já trata o erro silenciosamente (estado `detailData = null`). A URL é limpa (`replace: true`) após abrir o modal para não manter o parâmetro na barra de endereços.

---

## 5. Resultado do Grep por /legacy

```
grep -Rn "/legacy" frontend/src
grep -Rn "legacy/" frontend/src
```

Todas as ocorrências restantes são **apenas comentários JSDoc** (ex: `* Fornecedores.jsx — migrado de public/legacy/fornecedores.html`).

**Nenhum link JSX ativo aponta para `/legacy`.**

---

## 6. Validações Executadas

| Validação | Resultado |
|---|---|
| `npm run frontend:build` | ✅ 78 módulos (era 79 — LegacyRedirect removido), build limpo |
| `npm test` | ✅ 408/408 testes passando (18 suites) |
| `node scripts/check-prisma-connection.js` | ✅ Prisma + PostgreSQL OK |

---

## 7. Próximo Passo Recomendado

**Migração React concluída.** Todos os links ativos apontam para rotas React. Nenhum clique normal dentro do SPA manda o usuário para `/legacy`.

**Passo 4.16 sugerido — Remover arquivos legacy**

Agora é seguro deletar:
- `public/legacy/` (todos os HTMLs)
- `public/auth.js` (lógica de sessão do legado — substituída pelo AuthContext)
- Comentários JSDoc de migração nos arquivos React (opcional, cosmético)
- Arquivo `frontend/src/pages/LegacyRedirect.jsx` (componente não mais referenciado)

Confirmar antes: verificar se alguma URL `/legacy/` ainda é acessada diretamente por bookmarks ou links externos antes de remover.

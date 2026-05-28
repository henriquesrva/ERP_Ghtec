# Feedback — Passo 4.14: Auditoria Final Pós-Migração React

---

## 1. Referências Legacy Encontradas

### 🔴 Crítico — Dashboard.jsx (linhas 5–12)

7 links ainda apontando para `/legacy/*.html`, sendo que **todas as telas já estão migradas**:

| Link antigo | Rota React correta |
|---|---|
| `/legacy/nova-proposta.html` | `/nova-proposta` |
| `/legacy/kanban.html` | `/kanban` |
| `/legacy/clients.html` | `/clients` |
| `/legacy/parts.html` | `/parts` |
| `/legacy/stock.html` | `/stock` |
| `/legacy/fornecedores.html` | `/fornecedores` |
| `/legacy/financeiro.html` | `/financeiro` |

Apenas `Propostas` usa `<Link to="/proposals">`. Todos os demais usam `<a href="/legacy/...">`.

**Impacto:** clicar em qualquer módulo no Dashboard leva para a versão HTML legada, não para o React.

### 🔴 Crítico — Proposals.jsx linha 118

```jsx
<a className="section-card" href="/legacy/nova-proposta.html">
```

NovaProposta já foi migrada para `/nova-proposta`. Deveria ser `<Link to="/nova-proposta">`.

### 🟡 Moderado — Fornecedores.jsx linha 517

```jsx
<a href={`/legacy/notas-recebidas.html?id=${n.id}`}>
```

NotasRecebidas está migrada (`/notas-recebidas`), mas a tela React **não tem deep-link por `?id=`** — a página legada abria com foco em uma nota específica via query param. **Opção:** trocar para `<Link to="/notas-recebidas">` aceitando a perda do deep-link, ou implementar `?id=` na tela React antes de trocar.

### ✅ Sem impacto — comentários em código

Referências a `public/legacy/` dentro de comentários JSDoc (Objetos, Usuarios, Responsaveis, etc.) — apenas documentação, sem impacto funcional.

---

## 2. Estado do Router

| Item | Status |
|---|---|
| Array `LEGACY` | Vazio ✅ — todos migrados |
| Rotas React definidas | 15/15 ✅ |
| `/nova-proposta` | ✅ |
| `/kanban` | ✅ |
| `/proposals` | ✅ |
| `/login` | ✅ |
| Rotas protegidas | Todas dentro de `<ProtectedRoute>` ✅ |
| Fallback `*` | Redireciona para `/` ✅ |
| `LegacyRedirect` importado | Import morto — componente não é usado pois `LEGACY` está vazio |

**Import morto:** `LegacyRedirect` (linha 19 do router.jsx) pode ser removido quando legacy for deletada.

---

## 3. Estado da Navbar

| Item | Status |
|---|---|
| Links para `/legacy` | Nenhum ✅ |
| Todos os links React Router | Sim, todos com `react: true` e `<Link>` ✅ |
| `/nova-proposta` em `activePaths` Comercial | ✅ — grupo Comercial fica ativo na NovaProposta |
| `/kanban` em `activePaths` Comercial | ✅ |
| Ícone admin | `/usuarios` e `/responsaveis` ativam ícone ⚙️ ✅ |

---

## 4. Auditoria da Nova Proposta

### Payload POST /proposals

| Campo | Implementado | Observação |
|---|---|---|
| `numero_proposta` | ✅ | `.trim()` aplicado |
| `observacoes` | ✅ | `null` quando vazio |
| `objeto_proposta` | ✅ | Pega `objetoData.descricao \|\| objetoData.nome` |
| `cliente_id` | ✅ | `clientId` direto |
| `items[].quantidade` | ✅ | `parseFloat` com fallback 1 |
| `items[].descricao` | ✅ | |
| `items[].part_id` | ✅ | `Number()` se existir, `null` se não |
| `items[].valor_unitario` | ✅ | `parseNumber()` normaliza BRL |
| `items[].ncm` | ✅ | `null` se ausente |
| `condicoes.forma_pagamento` | ✅ | 5 campos presentes |
| `condicoes.prazo_pagamento` | ✅ | |
| `condicoes.prazo_entrega` | ✅ | |
| `condicoes.garantia` | ✅ | |
| `condicoes.validade` | ✅ | |
| `commercial_condition_id` | ✅ | ID quando `condMode=catalog`, `null` em manual/new |

### Autosave

| Comportamento | Status |
|---|---|
| Não salva estado vazio | ✅ — `hasMeaningfulContent()` guarda |
| Bloqueia save durante restore | ✅ — `draftRestoringRef.current` |
| Limpa após submit com sucesso | ✅ — `clearDraft()` chamado após `createProposal()` |
| Chave do localStorage | `draft_new_proposal_user_${user.id}` ✅ — idêntico ao legado |

### Sugestão de Preço

- Usa `GET /items/last-price?descricao=&clientId=&partId=` ✅ (endpoint correto)
- Hint clicável aplica valor diretamente no input ✅
- Re-fetcha para todos os itens quando o cliente muda ✅

### Validação de Assinatura

- Bloqueia envio quando `userState !== 'loaded'` ✅
- Link "Criar assinatura" usa `<Link to="/usuarios">` ✅

### Link PDF

- Após sucesso: `/files/proposta-${numero}.pdf` ✅ — idêntico ao legado

### 🟡 Risco: dangerouslySetInnerHTML (linha 1106)

```jsx
<div dangerouslySetInnerHTML={{ __html: result.html }} />
```

`result.html` recebe `err.message` do servidor em caso de erro. Se o backend retornar uma mensagem contendo HTML de dados de entrada (CNPJ, razão social, etc.), há risco de XSS. Risco baixo no contexto atual (sistema interno), mas o padrão é frágil.

**Recomendação futura:** substituir por JSX estruturado ou sanitizar com DOMPurify.

---

## 5. Auditoria da API Layer

| Arquivo | Status | Observação |
|---|---|---|
| `http.js` | ✅ | Centralizado; FormData não recebe Content-Type manual |
| `proposals.js` | ✅ | `createProposal`, `listProposals`, `deleteProposal`, `getLastItemPrice` |
| `clients.js` | ✅ | CRUD completo + search + profit-analysis |
| `conditions.js` | ✅ | CRUD completo + search |
| `parts.js` | ✅ | CRUD + categorias + price refs |
| `kanban.js` | ✅ | `putAny()` local justificado — `http.put` não suporta FormData |
| `stock.js` | ✅ | |
| `fornecedores.js` | ✅ | |
| `notasRecebidas.js` | ✅ | FormData delegado ao `http.post` corretamente |
| `contasPagar.js` | ✅ | FormData delegado ao `http.post` corretamente |
| `financeiro.js` | ✅ | Suficiente para uso atual |
| `responsaveis.js` | ✅ | |
| `users.js` | ✅ | |
| `objetos.js` | ✅ | |
| `categoriasDespesa.js` | ⚠️ | Só exporta `listCategoriasDespesa`; backend tem POST/PUT/desativar — suficiente para uso atual |

**Inconsistência minor:** `kanban.js` tem `putAny()` que duplica parcialmente lógica do `http.js`. O correto seria `http.put` aceitar FormData. Não é bug.

**Fetch direto:** apenas em `kanban.js` via `putAny()` — justificado pela necessidade de FormData em PUT.

---

## 6. Tamanho do Bundle

```
dist/assets/index-Bb77oK8-.js   585.50 kB  (166.86 kB gzip)
dist/assets/index-BkmFyb0T.css   21.86 kB  (  4.36 kB gzip)
```

Bundle JS acima do limite de 500 kB do Vite. Tudo em um único chunk — todas as 15 páginas carregadas no primeiro acesso.

---

## 7. Recomendações de Code Splitting

Aplicar `React.lazy` por rota no `router.jsx`. Bundle inicial cairia para ~100–150 kB, com chunks das páginas pesadas carregados sob demanda.

**Páginas prioritárias para lazy:**

| Página | Motivo |
|---|---|
| `NovaProposta` | Maior lógica + CSS próprio |
| `Kanban` | CSS próprio + lógica pesada |
| `Parts` | Mais fetch calls do sistema |
| `Stock` | Charts + múltiplas sub-views |
| `Clients` | Charts + profit analysis |
| `NotasRecebidas` | Upload de arquivo |

**Padrão a aplicar:**

```jsx
const NovaProposta = React.lazy(() => import('./pages/NovaProposta'));
// ... demais páginas

<Suspense fallback={<div className="loading-page">Carregando...</div>}>
  <Routes>...</Routes>
</Suspense>
```

Implementar em tarefa dedicada.

---

## 8. Validações Executadas

| Validação | Resultado |
|---|---|
| `npm run frontend:build` | ✅ 79 módulos transformados, build OK |
| `npm test` | ✅ 408/408 testes backend passando (18 suites) |
| `node scripts/check-prisma-connection.js` | ✅ PostgreSQL OK — 15 cenários CRUD testados |

---

## 9. Pendências Antes de Remover Legacy

1. **[OBRIGATÓRIO] Dashboard.jsx** — 7 links apontam para `/legacy/*.html`. Substituir por `<Link to="...">`.
2. **[OBRIGATÓRIO] Proposals.jsx linha 118** — trocar `<a href="/legacy/nova-proposta.html">` por `<Link to="/nova-proposta">`.
3. **[DECIDIR] Fornecedores.jsx linha 517** — deep-link de nota específica perdido. Definir se aceita `/notas-recebidas` sem parâmetro ou implementa `?id=` na tela React.
4. **[OPCIONAL] Import morto** — remover `LegacyRedirect` do router.jsx.

---

## 10. Próximo Passo Recomendado

**Passo 4.15 — Corrigir links legados no Dashboard e Proposals**

Tarefas:
- `Dashboard.jsx`: converter os 7 `<a href="/legacy/...">` para `<Link to="...">` com as rotas React corretas
- `Proposals.jsx:118`: converter `<a href="/legacy/nova-proposta.html">` para `<Link to="/nova-proposta">`
- `Fornecedores.jsx:517`: decidir e aplicar tratamento para o link de nota recebida

Após isso, confirmar que nenhum link ativo aponta para `/legacy`. Com isso, a migração estará funcionalmente completa e os arquivos legacy poderão ser removidos com segurança.

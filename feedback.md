# Análise de Viabilidade: Migração para React + Vite

> Tarefa: diagnóstico do frontend atual e plano de migração. Nenhum código foi alterado.

---

## 1. Diagnóstico do Frontend Atual

### Estrutura de arquivos

```
public/
├── css/styles.css          — Design system global (tokens CSS, componentes), 1003 linhas
├── auth.js                 — Verificação de sessão + navegação ativa, 83 linhas
├── assets/logoGHTEC.png
├── login.html              — 89 linhas
├── index.html              — 628 linhas (dashboard)
├── nova-proposta.html      — 2007 linhas (tela mais complexa do sistema)
├── proposals.html          — 302 linhas
├── clients.html            — 747 linhas
├── parts.html              — 1203 linhas
├── kanban.html             — 1281 linhas
├── stock.html              — 1360 linhas
├── financeiro.html         — 250 linhas
├── contas-pagar.html       — 519 linhas
├── notas-recebidas.html    — 1137 linhas
├── fornecedores.html       — 389 linhas
├── usuarios.html           — 443 linhas
├── responsaveis.html       — 325 linhas
└── objetos.html            — 698 linhas
```

**Total: 15 páginas HTML · 12.464 linhas de frontend**

### Como o frontend está organizado

- **Sem template engine no frontend**: Express serve `public/` como arquivos estáticos puros. Não há SSR. Handlebars existe apenas para geração de PDF no backend — nada no frontend.
- **JS inline em cada página**: Todo o JavaScript de cada tela está em um único `<script>` inline dentro do próprio HTML. Não há módulos JS, sem `import`, sem bundler, zero toolchain.
- **CSS híbrido**: `styles.css` é o design system global com variáveis CSS (tokens). Cada página tem um único bloco `<style>` adicional para estilos específicos. Não há CSS modular.
- **Navegação duplicada**: O bloco `<nav>` completo está copiado manualmente em todas as 14 páginas autenticadas. Qualquer mudança no menu exige editar 14 arquivos.
- **auth.js compartilhado**: O único arquivo JS externo compartilhado. Verifica a sessão via `GET /auth/me` e marca o item ativo no menu.

### Dependências externas identificadas

| Dependência | Uso | Páginas |
|---|---|---|
| Chart.js 4.4.4 (CDN jsdelivr) | Gráficos de barras/linhas | `clients.html`, `financeiro.html`, `stock.html`, `parts.html` |
| `/css/styles.css` | Design system global | Todas |
| `/auth.js` | Verificação de sessão + nav ativa | Todas exceto `login.html` |

**Nenhuma outra dependência externa.** Sem jQuery, sem Bootstrap, sem Vue/Angular, sem date pickers, sem select2.

### Padrão de JS por página

Cada página segue este padrão:
```
1. Variáveis de estado locais (let all = [], let currentItem = null, etc.)
2. Funções de render() que manipulam DOM diretamente
3. Funções async para fetch() de cada endpoint
4. Listeners de eventos (inputs, botões, formulários)
5. Inicialização no final (load() ou chamada imediata)
6. <script src="/auth.js"> no final
```

### Características especiais

- **localStorage**: Usado em `nova-proposta.html` para autosave de rascunho (chave: `draft_new_proposal_user_{id}`)
- **File upload via FormData**: `contas-pagar.html`, `notas-recebidas.html`, `kanban.html`, `fornecedores.html`
- **Kanban sem drag-and-drop**: Usa botões de mover (`◀ ▶`) — sem drag. Mais simples de migrar.
- **Autocomplete customizado**: Implementado manualmente em `nova-proposta.html` e `clients.html`

---

## 2. Rotas Atuais — Separação Página vs. API

### Rotas de página (servem HTML)

O Express **não tem nenhuma rota de renderização de página**. Todo HTML é estático. As "páginas" são arquivos acessados diretamente via `express.static('public/')`:

| URL | Arquivo |
|---|---|
| `/login.html` | `public/login.html` |
| `/` | `public/index.html` |
| `/nova-proposta.html` | `public/nova-proposta.html` |
| `/proposals.html` | `public/proposals.html` |
| `/clients.html` | `public/clients.html` |
| `/parts.html` | `public/parts.html` |
| `/kanban.html` | `public/kanban.html` |
| `/stock.html` | `public/stock.html` |
| `/financeiro.html` | `public/financeiro.html` |
| `/contas-pagar.html` | `public/contas-pagar.html` |
| `/notas-recebidas.html` | `public/notas-recebidas.html` |
| `/fornecedores.html` | `public/fornecedores.html` |
| `/usuarios.html` | `public/usuarios.html` |
| `/responsaveis.html` | `public/responsaveis.html` |
| `/objetos.html` | `public/objetos.html` |

### Rotas de API (retornam JSON) — tudo que está no Express

Todos os endpoints já são JSON puros. Agrupados por domínio:

```
Auth:             POST /auth/login | POST /auth/logout | GET /auth/me
Usuários:         GET/POST /users | PUT /users/me/password | PUT /users/me/signature | PUT /users/:id/role | DELETE /users/:id
Clientes:         GET/POST /clients | GET /clients/search | GET /clients/profit-analysis | GET/PUT/DELETE /clients/:id
Peças:            GET/POST /parts | GET /parts/search | GET/PUT/DELETE /parts/:id | + 4 sub-rotas de histórico/referências
Categorias:       GET/POST /part-categories | PUT/DELETE /part-categories/:id
Itens/preço:      GET /items/search | GET /items/last-price
Responsáveis:     GET/POST /responsaveis | GET /responsaveis/search | GET/DELETE /responsaveis/:id
Cond. comerciais: GET/POST /commercial-conditions | GET /commercial-conditions/search | GET/PUT/DELETE /commercial-conditions/:id
Objetos:          GET/POST /objetos | GET /objetos/search | GET/PUT/DELETE /objetos/:id
Kanban:           GET /kanban/cards | GET /kanban/comments/:type/:id | POST/PUT/DELETE /kanban/tasks | POST /kanban/comments
Estoque:          GET /stock + /contract-spend + /movements-by-date + /movements | POST /stock/movements | POST /stock/inventory-count
Propostas:        GET/POST /proposals | GET /proposals/kanban | GET/DELETE /proposals/:id | + 5 sub-rotas de pipeline
Fornecedores:     GET/POST /fornecedores | GET /fornecedores/search | GET/PUT /fornecedores/:id | POST /fornecedores/:id/desativar
Cat. despesa:     GET/POST /categorias-despesa | PUT /categorias-despesa/:id | POST /categorias-despesa/:id/desativar
Notas recebidas:  GET/POST /notas-recebidas | GET/PUT /notas-recebidas/:id | POST /notas-recebidas/:id/cancelar
Contas a pagar:   GET/POST /contas-pagar | GET /contas-pagar/resumo | GET/PUT /contas-pagar/:id | + /baixar + /cancelar
Arquivos:         GET /files/:pdf | /files/approvals/:f | /files/notas/:f | /files/comprovantes/:f
Health:           GET /health
```

**Conclusão: O backend já é uma API 100% JSON. Não há nenhuma rota que renderize HTML. A migração para React não exige nenhuma alteração no backend.**

---

## 3. Plano de Arquitetura React

### Estrutura proposta (mesmo repositório)

```
ERP/
├── src/                     — backend Express (inalterado)
├── public/                  — frontend atual (mantido durante transição)
├── frontend/                — NOVO: React + Vite
│   ├── index.html
│   ├── vite.config.js       — proxy /api/* → localhost:3000 em dev
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── router.jsx          — React Router v6
│       ├── contexts/
│       │   └── AuthContext.jsx — estado de sessão global
│       ├── hooks/
│       │   └── useAuth.js
│       ├── api/                — módulos de fetch por domínio
│       │   ├── proposals.js
│       │   ├── clients.js
│       │   ├── parts.js
│       │   └── ...
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Navbar.jsx     — navegação única (hoje duplicada em 14 arquivos)
│       │   │   └── PageBar.jsx    — header de página
│       │   └── shared/
│       │       ├── Toast.jsx
│       │       ├── ConfirmModal.jsx
│       │       └── Table.jsx
│       └── pages/
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── Proposals.jsx        ← tela piloto
│           └── ... (demais páginas)
├── package.json             — backend (inalterado)
└── ...
```

### Como o Express serviria o React (produção)

Após `npm run build` do Vite gerar `frontend/dist/`, adicionar ao `app.js`:

```js
// Serve o build React
const frontendDist = path.resolve(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));

// Fallback SPA — rotas não-API devolvem o index.html do React
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/auth') || req.path.startsWith('/clients') ...) return next();
  res.sendFile(path.join(frontendDist, 'index.html'));
});
```

**Resultado: mesmo origin → zero CORS, cookie de sessão funciona sem mudança alguma.**

### Autenticação em React

A autenticação atual (cookie httpOnly) é perfeitamente compatível com React. O único ajuste é criar um context que substitui o `auth.js` atual:

```jsx
// AuthContext.jsx
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => { setUser(data?.user ?? null); setLoading(false); })
      .catch(() => { setUser(null); setLoading(false); });
  }, []);

  return <AuthContext.Provider value={{ user, setUser, loading }}>{children}</AuthContext.Provider>;
}
```

Todos os `fetch()` existentes continuam funcionando sem mudança nos endpoints. Cookie enviado automaticamente pelo browser (same-origin).

### CSS

**Opção recomendada para a migração**: Importar `styles.css` global no `main.jsx` e usar os tokens CSS existentes. CSS Modules pode ser adotado página a página conforme cada componente for criado. Não reescrever o visual — aproveitar os tokens que já existem.

---

## 4. Ordem Recomendada de Migração

| Fase | Tela | Linhas | fetch calls | Observação |
|---|---|---|---|---|
| 0 | Base: Vite + Router + AuthContext + Navbar | — | — | Fundação obrigatória |
| 1 | `login.html` | 89 | 1 | Mais simples; necessário para o fluxo |
| 2 | **`proposals.html`** ← piloto | 302 | 2 | Core do sistema, simples |
| 3 | `responsaveis.html` | 325 | 3 | CRUD simples, valida o padrão |
| 4 | `fornecedores.html` | 389 | 7 | CRUD simples |
| 5 | `financeiro.html` | 250 | 3 | Introduz Chart.js → react-chartjs-2 |
| 6 | `usuarios.html` | 443 | 9 | CRUD com roles + permissão admin |
| 7 | `objetos.html` | 698 | 8 | CRUD com inline create/edit |
| 8 | `clients.html` | 747 | 5 | Core, médio, tem profit-analysis |
| 9 | `contas-pagar.html` | 519 | 10 | Financeiro com file upload |
| 10 | `notas-recebidas.html` | 1137 | 10 | Complexo com upload XML/PDF |
| 11 | `stock.html` | 1360 | 10 | Complexo com Chart.js |
| 12 | `parts.html` | 1203 | 17 | Complexo: histórico, referências, comparação |
| 13 | `index.html` (dashboard) | 628 | 2 | Dashboard com stats |
| 14 | `kanban.html` | 1281 | 13 | Complexo: cards, comentários, múltiplos modais |
| 15 | `nova-proposta.html` | 2007 | 9 | **Última** — mais crítica do sistema |

---

## 5. Tela Piloto Recomendada: `proposals.html`

**Por quê `proposals.html`?**

1. **É o core do negócio** — entidade principal, alto uso diário. O piloto deve provar valor real.
2. **É simples o suficiente** — 302 linhas, apenas 2 fetch calls (`GET /proposals` + `DELETE /proposals/:id`).
3. **Cobre todos os padrões que serão replicados nas demais telas**:
   - AuthContext verificando autenticação
   - Fetch de lista com loading state
   - Render de tabela
   - Delete com modal de confirmação
   - Toast de feedback
   - Filtro/busca client-side
4. **Sem dependências especiais** — sem Chart.js, sem file upload, sem autocomplete, sem localStorage.
5. **Rollback trivial** — se falhar, remove o componente React e o HTML antigo continua funcionando.

---

## 6. Riscos da Migração

### 🔴 Alto impacto — requer atenção antes de implementar

**Coexistência de rotas durante a transição**
- Durante a migração, rotas React e arquivos `.html` vão coexistir no mesmo Express.
- Problema: React Router usa `/proposals` mas o arquivo estático é `/proposals.html`.
- **Solução recomendada**: Ao migrar uma página, remover o arquivo `.html` correspondente de `public/` e configurar o fallback SPA no Express para aquela rota. Ou usar URLs sem `.html` no React (React Router) e manter os arquivos `.html` para acesso legado enquanto não foram migrados.

**`nova-proposta.html` é a mais crítica e deve ser a última**
- 2007 linhas com: autocomplete customizado, sugestão de preço via API, items dinâmicos, validação inline de cliente, autosave localStorage.
- Qualquer bug nessa tela para a criação de propostas — função central do sistema.
- **Plano**: manter a versão HTML em paralelo até o componente React estar 100% validado em staging.

### 🟡 Médio impacto — resolver durante a migração

**CSS com aliases legados**
- `styles.css` tem variáveis duplicadas: `--green` (legado) e `--color-primary` (novo). Algumas páginas usam os aliases legados inline (`var(--green)`, `var(--muted)`).
- Em React com CSS Modules, isso precisará ser normalizado.
- **Solução**: Importar `styles.css` globalmente primeiro. Normalizar os aliases conforme cada componente for criado.

**Navbar duplicada em 14 arquivos → componente único**
- Ganho imediato: em React vira um `<Navbar />`. Mas a lógica de `_markActiveNav()` precisa ser reescrita usando `useLocation()` do React Router.
- Não é difícil — apenas precisa ser feito na Fase 0 (base).

**File uploads (FormData)**
- 4 telas usam `multipart/form-data` para uploads.
- Em React, `new FormData()` + `fetch()` sem `Content-Type` header funciona igual ao vanilla JS. Não é um risco real — apenas precisa ser testado.

**localStorage (autosave de rascunho)**
- `nova-proposta.html` usa `localStorage` para autosave. Em React, localStorage funciona igual no browser. O `useEffect` de cleanup precisa limpar o draft ao submeter com sucesso.

### 🟢 Baixo impacto / Não é risco real

| Item | Por quê não é risco |
|---|---|
| CORS | Zero — mesmo origin (Express serve o build React) |
| Autenticação / Sessão | Cookie httpOnly, browser envia automaticamente. `requireAuth.js` inalterado. |
| Backend | Zero mudanças necessárias. Todos os endpoints já são JSON. |
| Chart.js | Trocar por `react-chartjs-2` (wrapper oficial, API quase idêntica) |
| Kanban | Usa botões para mover cards — sem drag-and-drop. Não precisa de biblioteca DnD. |
| Arquivos estáticos | `/files/*.pdf`, `/files/approvals/*` continuam servidos pelo Express. React apenas linka. |
| Deploy | Express + PM2 + nginx continuam iguais. Apenas adiciona `npm run build` no frontend. |

---

## 7. Próximo Prompt para Implementar a Base React

Quando quiser avançar, use este prompt:

---

**"Implemente a base do React + Vite para o projeto GHTec ERP.**

**Requisitos:**
1. Criar pasta `frontend/` na raiz com Vite + React (sem TypeScript por ora, CommonJS no backend não afeta o frontend)
2. Configurar `vite.config.js` com proxy para o Express em `localhost:3000` em desenvolvimento
3. Criar `AuthContext.jsx` que chama `GET /auth/me` ao montar e expõe `{ user, loading, logout }`
4. Criar `ProtectedRoute.jsx` que redireciona para `/login` se não autenticado
5. Criar `router.jsx` com React Router v6 com rotas para: `/login`, `/`, `/proposals`, `/responsaveis`
6. Criar `Navbar.jsx` usando `useLocation()` para marcar a rota ativa — substitui o nav duplicado em 14 arquivos
7. Migrar apenas `proposals.html` como componente piloto (`pages/Proposals.jsx`)
8. Importar `public/css/styles.css` globalmente no `main.jsx` — não reescrever o CSS ainda
9. O build Vite gera em `frontend/dist/`. Adicionar ao `app.js` o serve estático + fallback SPA para rotas React

**Não alterar nada no backend. Não remover os arquivos `.html` de `public/` ainda. As duas versões coexistem.**"

---

## Resumo Executivo

| Item | Avaliação |
|---|---|
| Backend pronto para React | ✅ 100% — já é API JSON pura, zero mudanças necessárias |
| CORS necessário | ❌ Não — mesmo origin |
| Mudanças no backend | ❌ Nenhuma |
| Viabilidade geral | ✅ Alta — arquitetura atual é a mais amigável possível para migrar |
| Volume de trabalho | ~12.464 linhas de frontend a migrar, de forma incremental |
| Maior risco | 🔴 `nova-proposta.html` (2007 linhas, última a migrar) |
| Ganho imediato da migração | Navbar compartilhada, componentes reutilizáveis, estado gerenciado, autosave mais robusto |
| Dependência externa nova | `react-chartjs-2` para 4 páginas com gráficos |

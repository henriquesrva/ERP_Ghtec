# Feedback — Passo 4.10: Migrar tela Estoque para React

## Status geral

Passo 4.10 concluído. Arquivos criados, rota ativa, Navbar atualizada, todas as validações passando.

---

## Arquivos criados

### `frontend/src/api/stock.js`
- `getStockParts()` → `GET /stock`
- `getMovements(partId)` → `GET /stock/movements?part_id=...` ou `GET /stock/movements`
- `getContractSpend()` → `GET /stock/contract-spend`
- `getMovsByDate(days)` → `GET /stock/movements-by-date?days=...`
- `createMovement(data)` → `POST /stock/movements`
- `inventoryCount(adjustments)` → `POST /stock/inventory-count`
- `getPartCategories()` → `GET /part-categories`

### `frontend/src/pages/Stock.jsx`
- **4 views** via estado `view`: `home` | `stock` | `movements` | `charts`
- **View Home**: 3 cards (Estoque, Movimentações, Gráficos)
- **View Estoque**: tabela filtrada por texto + categoria; botão "Contagem de estoque"; badges `qty-ok/qty-low/qty-zero`; link "Ver" → movimentações filtradas por peça
- **View Movimentações**: filtro por peça + limpar; tabela com `badge-entrada/badge-saida/badge-contagem`; `movement_type === 'contagem'` exibe "Contagem de estoque"; colunas: Data/Hora, Tipo, Peça, Cód. Interno, Qtd., Antes→Depois, Detalhe, Proposta, Cliente, Usuário, Obs.
- **View Gráficos**: 2 cards → abre SpendModal / MovDateModal
- **Modal: Nova Movimentação** (2 passos):
  - Passo 1: tipo (entrada/saída)
  - Passo 2 entrada: tipo de entrada (4 opções), busca de peça autocomplete debounced 250ms, quantidade, obs.
  - Passo 2 saída: busca de peça, estoque disponível colorido, quantidade, proposta (auto-preenche cliente), cliente, volta ao estoque (Sim/Não), obs.
  - Após sucesso: recarrega estoque + movimentações, fecha em 1200ms
- **Modal: Gastos com Contratos**: Bar chart (horizontal se > 4 clientes); aviso itens sem preço; tabela detalhada
- **Modal: Contagem de Estoque**: tabela editável com `count-input.changed`; envia só peças alteradas; fecha em 1500ms
- **Modal: Movimentações por Data**: Bar chart Entradas/Saídas; botões 30/60/90 dias
- Gráficos via `react-chartjs-2` (Bar) + `ChartJS.register(...)` no topo
- `fmtDateTime` com fuso `America/Sao_Paulo`; `fmtBRL` com `Intl.NumberFormat` BRL
- Reutiliza `proposals.js`, `clients.js`, `parts.js`, `Toast`

---

## Arquivos modificados

### `public/css/styles.css`
Todas as classes específicas de Estoque foram adicionadas: `.subview-header/.subview-title`, `.qty-badge/.qty-ok/.qty-low/.qty-zero`, `.badge-entrada/.badge-saida/.badge-contagem`, `.type-grid/.type-card`, `.entry-type-grid/.entry-type-opt`, `.returns-row/.returns-opt`, `.mfield`, `.part-search-wrap/.part-dropdown/.part-opt`, `.count-input`, `.chart-wrap/.spend-empty/.spend-table/.spend-section-title`, `.hist-filter`, `.btn-hist`, `.period-btns`, `.modal-subtitle`.

### `frontend/src/router.jsx`
- `Stock` importado e `<Route path="/stock" element={<Stock />} />` ativa
- `/stock` removido do array `LEGACY`

### `frontend/src/components/layout/Navbar.jsx`
- "Estoque" aponta para `to: '/stock', react: true`

---

## Endpoints usados

| Endpoint | Uso |
|---|---|
| `GET /stock` | Carrega lista de peças com estoque |
| `GET /stock/movements` | Histórico de movimentações (com `?part_id=N` opcional) |
| `GET /stock/contract-spend` | Gastos por cliente com contrato |
| `GET /stock/movements-by-date?days=N` | Movimentações agrupadas por data |
| `POST /stock/movements` | Registra entrada ou saída |
| `POST /stock/inventory-count` | Submete contagem de estoque |
| `GET /parts/search?q=...` | Autocomplete de peças no modal |
| `GET /part-categories` | Categorias para filtro |
| `GET /proposals` | Propostas para seleção na saída |
| `GET /clients` | Clientes para seleção na saída |

---

## O que ficou em legacy

- `public/legacy/stock.html` — mantido, não removido

---

## Validações executadas (2026-05-28)

- `npm run frontend:build` → ✅ 73 modules, 1.32s, build OK
- `npm test` → ✅ 408/408 testes passando, 18 arquivos
- `npm run prisma:status` → ✅ Database schema is up to date!
- `node scripts/check-prisma-connection.js` → ✅ Prisma conectado ao PostgreSQL com sucesso! (15 seções verificadas)

---

## Documentação atualizada

`SYSTEM_CONTEXT.md` — não atualizado. A migração de Estoque para React não altera a estrutura de backend, entidades, regras de negócio ou arquitetura. É mudança de frontend apenas, dentro do escopo esperado da migração incremental já documentada.

---

## Próximo passo recomendado

**Passo 4.11 — Migrar Peças**

Telas legacy ainda não migradas:
- `/parts` → `public/legacy/parts.html` (1203 linhas, 17 fetch calls — mais complexa, tem histórico de preços, referências por cliente, categorias)
- `/kanban` → `public/legacy/kanban.html`
- `/nova-proposta` → `public/legacy/nova-proposta.html` (última — mais crítica)

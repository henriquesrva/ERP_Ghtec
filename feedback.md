# Feedback — Passo 4.6: Migrar Clientes para React

## O que foi feito

### Dependências adicionadas
- `chart.js` e `react-chartjs-2` instalados em `frontend/package.json`
  - Necessários para o gráfico de análise de lucro por cliente

### Arquivos criados
- `frontend/src/api/clients.js` — camada API (`listClients`, `searchClients`, `getClient`, `createClient`, `updateClient`, `deleteClient`, `getProfitAnalysis`)
- `frontend/src/pages/Clients.jsx` — página React completa com CRUD + análise de lucro

### Arquivos alterados
- `frontend/src/router.jsx` — `/clients` saiu do array LEGACY, virou `<Route path="/clients" element={<Clients />} />`
- `frontend/src/components/layout/Navbar.jsx` — "Clientes" trocado de `href` legacy para `to="/clients"` com `react: true`

### Arquivos NÃO alterados
- `public/legacy/clients.html` — mantido conforme instrução
- Nenhum arquivo de backend alterado

---

## Endpoints usados

| Endpoint | Método | Uso |
|---|---|---|
| `GET /clients` | GET | Listar todos os clientes |
| `GET /clients/search?q=` | GET | Busca com debounce 280ms |
| `GET /clients/profit-analysis` | GET | Dados do gráfico de lucro |
| `GET /clients/:id` | GET | Carregar cliente para edição |
| `POST /clients` | POST | Criar cliente → `{ success, client }` |
| `PUT /clients/:id` | PUT | Atualizar cliente → `{ success, client }` |
| `DELETE /clients/:id` | DELETE | Excluir com ConfirmModal |

---

## Comportamentos migrados

- Listar clientes com busca por nome/CNPJ (debounce 280ms)
- Criar cliente (validação: nome obrigatório)
- Editar cliente (clicar no item da lista carrega o formulário)
- Após CREATE: troca para modo edição com os dados do cliente salvo (igual ao legado)
- Após UPDATE: atualiza título do formulário com novo nome
- Excluir com ConfirmModal; 409 HAS_PROPOSALS → aviso inline no formulário
- 409 DUPLICATE_CNPJ em criar/editar → aviso inline (msg-warn)
- Split layout: lista esquerda (360px) + formulário direita
- Botão excluir (✕) aparece ao hover no item da lista
- Formulário com todos os campos: nome, nome_fantasia, razao_social, cnpj, inscricao_estadual, email, telefone, contato_responsavel, endereco, cidade, estado, cep, observacoes, has_parts_contract
- Checkbox "Possui contrato de peças" com descrição
- Edit badge "Editando" aparece quando em modo edição
- Query params: `?id=X` abre edição do cliente X
- Barra de análise de lucro com botão que abre modal
- Modal com gráfico de barras Chart.js (horizontal se > 4 clientes)
  - Verde para lucro positivo, vermelho para negativo
  - Tooltip com valor formatado em BRL
- Tabela detalhada no modal: cliente, propostas, valor faturado, custo, lucro, margem, itens s/ custo
- Aviso de itens sem preço de compra no modal
- Loading state em lista e modal
- Mensagens de sucesso/erro inline + Toast global

---

## Como ficou /app/clients

Rota React protegida. Split layout fiel ao legado. Análise de lucro migrada completamente com gráfico react-chartjs-2 e tabela de detalhamento.

---

## O que ficou em legacy

`public/legacy/clients.html` — mantido no lugar, mas a Navbar React não aponta mais para ele.

---

## Validações executadas

- `npm run frontend:build` → 63 modules, sem erros (incluindo chart.js)
- `npm test` → 408/408 passando (18 arquivos)
- `npm run prisma:status` → Database schema is up to date!
- `node scripts/check-prisma-connection.js` → ✅ Prisma OK

---

## Problemas encontrados

Nenhum. Build limpo, testes intactos, sem necessidade de alterar backend.

**Observação:** O backend tem um bug no `client.service.js` onde `countClientProposals` não é `await`ed (retorna Promise ao invés do número), tornando a proteção `HAS_PROPOSALS` ineficaz. Não foi corrigido neste passo por estar fora do escopo da migração de frontend.

---

## Próximo passo recomendado

**Passo 4.7 — Migrar tela Financeiro para React**

`financeiro.html` (250 linhas, 3 fetch calls) — dashboard financeiro com gráficos Chart.js. Já temos react-chartjs-2 instalado.

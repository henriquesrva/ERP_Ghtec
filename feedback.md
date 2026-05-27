# Feedback — Passo 4.3: Migração Fornecedores

## Arquivos criados

- `frontend/src/api/fornecedores.js` — listFornecedores, searchFornecedores, getFornecedor, getFornecedorDetalhes, createFornecedor, updateFornecedor, desativarFornecedor
- `frontend/src/pages/Fornecedores.jsx` — componente completo migrado do legado

## Arquivos alterados

- `frontend/src/router.jsx` — `/fornecedores` saiu do LEGACY, ganhou `<Route>` própria com componente React; importado Fornecedores
- `frontend/src/components/layout/Navbar.jsx` — link "Fornecedores" no grupo Operacional mudou de `href: /legacy/fornecedores.html` para `to: /fornecedores, react: true`

## Endpoints usados

| Método | Rota | Uso |
|---|---|---|
| GET | `/fornecedores?includeInactive=` | lista (com checkbox inativos) |
| GET | `/fornecedores/search?q=&includeInactive=` | busca em tempo real |
| GET | `/fornecedores/:id` | carregar dados para edição |
| GET | `/fornecedores/:id/detalhes` | painel de detalhe (notas + contas) |
| POST | `/fornecedores` | criar |
| PUT | `/fornecedores/:id` | editar |
| POST | `/fornecedores/:id/desativar` | desativar (admin only) |

## Comportamentos migrados

- Lista com busca em tempo real (sem debounce, igual ao legado)
- Checkbox "Mostrar inativos" — refiltra a lista
- Badge "inativo" nos itens inativos da lista
- Seleção de item → painel de detalhe (notas recebidas + contas a pagar como mini-tabelas)
- Botão "Editar" no detalhe → abre formulário pré-preenchido
- "+ Novo" → formulário em branco
- Formulário: razao_social*, nome_fantasia, cnpj, inscricao_estadual, telefone, email, endereco, cidade, estado (uppercase), cep, observacoes
- Validação: razao_social obrigatória com mensagem inline
- CNPJ duplicado: erro 409 → exibe `err.message` no formulário
- Após salvar → exibe detalhe do fornecedor salvo + toast sucesso
- Botão "Desativar fornecedor" visível apenas para admin (via `user.role === 'admin'` do AuthContext)
- ConfirmModal antes de desativar
- Após desativar → placeholder + lista recarregada
- Loading state no painel de detalhe
- Toast de erro para falhas de rede

## Como ficou /app/fornecedores

Rota React completa. Navbar Operacional aponta para `/app/fornecedores` via Link React. Item ativo funciona via `activePaths: ['/fornecedores']` já existente no MENUS.

## O que ainda está em legacy

`public/legacy/fornecedores.html` — arquivo mantido, mas navegação principal usa React.

## Validações executadas

- `npm run frontend:build` → ✅ (199KB / gzip 62KB)
- `npm test` → ✅ 408/408
- `npm run prisma:status` → ✅ schema up to date
- `node scripts/check-prisma-connection.js` → ✅ Prisma conectado ao PostgreSQL

## Documentação

`SYSTEM_CONTEXT.md` não atualizado — migração de tela individual não constitui mudança estrutural.

---
name: project_dashboard
description: Estado atual do Dashboard/Home do GHTec ERP após refatoração — layout, permissões, componentes e CSS
metadata:
  type: project
---

Dashboard refatorado em 2026-05-28. Arquivos alterados: `frontend/src/pages/Dashboard.jsx`, `frontend/src/components/layout/Navbar.jsx`, `frontend/src/styles.css`.

**Why:** Tela anterior era apenas atalhos sem visão operacional. Objetivo: central operacional com KPIs reais, fila de atenção e acesso rápido filtrado por role.

**How to apply:** Qualquer alteração futura no Dashboard deve respeitar as regras abaixo.

## Regra de permissão central

```js
const canSeeFinanceiro = (role) => role === 'admin' || role === 'financeiro'
```

- Usuários `admin` e `financeiro` veem: card "Contas vencidas", atalho "Financeiro", grupo "Contas vencidas" na fila de atenção.
- Todos os outros roles NÃO veem nada financeiro na home. O módulo Financeiro continua acessível via menu (Navbar também filtra por role).

## Layout

```
Hero (gradiente verde escuro)
KPI Row (auto-fit, 5 cards padrão, 6 para financeiro)
dash-main (grid 2 colunas: 1fr / 320px)
  dash-left:
    - CTA "Nova Proposta" (verde, destaque visual)
    - Grid 3x2 acesso rápido (filtrado por role)
    - "Propostas recentes" (5 mais novas, dado real)
  dash-right:
    - "Exigem atenção" (fila de atenção operacional)
```

## KPI Cards (StatCard)

| Label | Fonte | Cor alerta |
|---|---|---|
| Em andamento | proposals não faturadas | neutral |
| Aguardando compra | kanban_status | warn se > 0 |
| Pendente execução | kanban_status | warn se > 0 |
| Pronto p/ faturar | kanban_status | info se > 0 |
| Estoque crítico | stock_quantity <= 0 | danger se > 0 |
| Contas vencidas | proxVencimentos.atrasado (financeiro only) | danger se > 0 |

## Fila de atenção (AttentionGroup)

Grupos mostrados (se houver itens):
1. Aguardando compra → /kanban (tom: warn)
2. Pendente de execução → /kanban (tom: warn)
3. Prontas para faturar → /kanban (tom: info)
4. Estoque crítico → /stock (tom: danger)
5. Contas vencidas → /contas-pagar (tom: danger, financeiro only)

Sem valores financeiros (BRL) na home — apenas contagens.

## Navbar

- Grupo "Financeiro" filtrado: só aparece para `admin` e `financeiro`.
- Botão logout e engrenagem integrados no menu de usuário (dropdown por hover, alinhado à direita).
- Menu usuário: nome + bolinha de cor por role + dropdown com "Usuários" (admin only) + "Sair".
- Classes: `.nav-user-group`, `.nav-user-btn`, `.nav-user-dropdown`, `.nav-user-info`, `.nav-dd-logout-item`.

## CSS

Bloco dashboard em `styles.css` (após `.two-col`): classes com prefixo `dash-*`.
Bloco navbar user menu: classes com prefixo `nav-user-*` e `nav-dd-*`.
Classes antigas `dash-kpi-card`, `dash-pend-*` foram substituídas por `dash-stat-*` e `dash-atg-*`.

## Dados reais vs mock

- KPIs: dados reais de `/proposals`, `/stock`, `/contas-pagar/resumo` (financeiro).
- Propostas recentes: derivadas do array de propostas já carregado (5 mais novas por `created_at`).
- Nenhum dado mockado exibido — empty states elegantes quando não há dados.
- `Promise.allSettled` garante que falha em uma API não quebra o dashboard.

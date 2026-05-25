# Feedback — Passo 2.4: Testes críticos do fluxo de proposta

## Arquivos criados

- **`tests/integration/proposal-flow.test.js`** — 39 novos testes cobrindo o core do sistema:
  - `calculateTotal` (5 casos)
  - `canMarkExecution` (5 casos)
  - `createProposalFlow` (13 casos — com PDF mockado)
  - `markProposalExecuted` (6 casos)
  - `removeProposalExecution` (5 casos)
  - `registerBilling` (4 casos)

## Arquivos alterados

- **`src/modules/proposal/proposal.service.js`**:
  - `calculateTotal` adicionado às exports (era função interna, necessária para testar)
  - Importação de `proposal-pdf.service` mudou de destrutiva (`const { generateProposalPdf }`) para por objeto (`const pdfService`), para permitir `vi.spyOn` nos testes. Comportamento idêntico.

## Testes adicionados

| Grupo | Casos |
|---|---|
| `calculateTotal` | retorna 0 para vazio, soma simples, múltiplos itens, decimais, coerce strings |
| `canMarkExecution` | admin/tecnico = true; user/comercial/financeiro = false |
| `createProposalFlow` | proposalId retornado; valor_total correto; valor_total_extenso gerado no backend; data_emissao gerada no servidor; kanban_status = pendente_envio; proposal_items criados; price_history com todos os campos; part_id auto-preenchido; part_id do payload respeitado; snapshot da assinatura gravado; numero_proposta duplicado → CONFLICT; cliente inline novo; reutiliza cliente existente; mock de PDF verificado |
| `markProposalExecuted` | admin e tecnico marcam; user/comercial/financeiro → FORBIDDEN; dados de execução gravados |
| `removeProposalExecution` | user → FORBIDDEN; em faturar → volta para pendente_execucao; em faturado → volta; em pendente_execucao → autoMoved = false; campos de execução limpos |
| `registerBilling` | invoice_number vazio → VALIDATION; ausente → VALIDATION; grava dados corretamente; proposta inexistente → NOT_FOUND |

## Mock de PDF

- **Usado**: sim
- **Método**: `vi.spyOn(pdfService, "generateProposalPdf").mockResolvedValue(undefined)` no `beforeEach`
- **Por que não vi.mock**: o projeto é 100% CommonJS e `vi.mock` com factory não é hoistado em arquivos CJS no Vitest — a chamada `generateProposalPdf` do `proposal.service.js` era destrutiva (local binding), então o spy não interceptava. A solução foi mudar para importação por objeto (`const pdfService = require(...)`) e usar `vi.spyOn`, que substitui a propriedade do objeto e é interceptada corretamente.
- **Puppeteer não roda nos testes**: confirmado — duração de 454ms para 137 testes (vs 35s com Puppeteer real rodando)

## Resultado

137/137 testes passando em 454ms. Nenhuma regressão.

## Bugs encontrados

Nenhum. O comportamento existente estava correto em todos os casos testados.

## Documentação

- **SYSTEM_CONTEXT.md**: atualizado apenas o rodapé (contagem de testes: 137, 7 arquivos)
- **MIGRATION_PLAN.md**: não alterado

## Próximo passo recomendado

Os passos preparatórios 2.1 a 2.4 estão concluídos:
- ✅ 2.1 — Kanban domain extraído
- ✅ 2.2 — PDF service extraído
- ✅ 2.3 — Upload/Multer extraído
- ✅ 2.4 — Testes críticos do fluxo de proposta

O sistema está em estado limpo com 137 testes cobrindo os comportamentos críticos. Já podemos considerar iniciar a instalação/configuração de Prisma e PostgreSQL conforme o MIGRATION_PLAN.md — a base está sólida para isso.

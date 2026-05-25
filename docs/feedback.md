# Feedback — Passo 2.2: Extração de PDF para proposal-pdf.service.js

## O que foi feito

- Criado `src/modules/proposal/proposal-pdf.service.js` com toda a lógica de geração de PDF extraída de `proposal.service.js`.
- `proposal-pdf.service.js` concentra: `ensureFileExists`, `getMimeType`, `assetDataUri`, `buildTemplateData`, `renderHtmlToPdfBytes`, `buildWatermarkP1Html`, `buildWatermarkPNHtml`, `mergePdfLayers` e `generateProposalPdf` (função principal).
- `proposal.service.js` perdeu ~175 linhas e 3 imports pesados (`handlebars`, `puppeteer`, `pdf-lib`). Ficou apenas com `fs` e `path` do Node, e importa somente `generateProposalPdf` do novo service.
- Interface do PDF service: `generateProposalPdf(proposalData, pdfFilePath)` — recebe `valor_total_raw` já calculado pelo service de negócio, sem dependência reversa.
- `buildTemplateData` foi adaptada para usar `proposalData.valor_total_raw` em vez de recalcular o total internamente.
- `formatCurrency` removida dos imports de `proposal.service.js` (só necessária no PDF service).

## Contagem de linhas

| Arquivo | Antes | Depois |
|---|---|---|
| `proposal.service.js` | 644 | ~470 |
| `proposal-pdf.service.js` | — | ~170 |

## Testes

94/94 passando. Nenhuma regressão.

## Decisão de design

`generateProposalPdf` recebe `valor_total_raw` como campo em `proposalData` em vez de recalcular internamente. Isso evita duplicar `calculateTotal` no PDF service e evita acoplamento cruzado. O `proposal.service.js` já calcula o total para gravar no banco — reutiliza o mesmo valor para o template.

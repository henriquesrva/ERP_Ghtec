# Feedback — Passo 4.13: Migração da Nova Proposta para React

## 1. Arquivos criados
- `frontend/src/pages/NovaProposta.jsx` — página React completa (~700 linhas)
- `frontend/src/pages/NovaProposta.css` — estilos específicos da tela (classes `np-*`)

## 2. Arquivos alterados
- `frontend/src/api/proposals.js` — adicionado `createProposal` e `getLastItemPrice`
- `frontend/src/router.jsx` — adicionado `<Route path="/nova-proposta" element={<NovaProposta />} />`; lista LEGACY agora vazia (todas as telas migradas)

## 3. Endpoints usados
- `GET /clients` — listagem para o picker de clientes
- `GET /clients/:id` — restaurar cliente do rascunho
- `GET /objetos` — listagem para o picker de objetos
- `GET /objetos/:id` — restaurar objeto do rascunho
- `GET /commercial-conditions` — listagem para o picker de condições
- `GET /commercial-conditions/:id` — restaurar condição do rascunho + carregar após criar nova
- `POST /commercial-conditions` — criar nova condição (modo "Criar nova condição padrão")
- `GET /parts` — listagem para o picker de peças por item
- `GET /items/last-price?clientId=&descricao=&partId=` — sugestão de preço por cliente/peça
- `POST /proposals` — gerar proposta e PDF

## 4. Comportamentos migrados
- Header com breadcrumb Propostas / Nova proposta (layout dark-green)
- Layout 2 colunas: formulário (esq.) + sidebar fixa (dir.)
- Sidebar com resumo em tempo real: número, cliente, itens, responsável, total, botão gerar
- Identificação: campo número da proposta
- Cliente: picker modal com busca por nome/CNPJ/cidade + card de preview completo (razão social, CNPJ, endereço, etc.)
- Objeto: picker modal + card de preview com descrição
- Itens: tabela dinâmica com "Procurar peça" por linha, NCM auto-preenchido, preço sugerido clicável abaixo do input, subtotal por linha, total geral
- Condições comerciais: 3 modos (catálogo, nova padrão, específica/manual) — idênticos ao legado
- Observações: textarea com auto-resize
- Responsável: auto-preenchido via `useAuth()`, estados: loading/loaded/nosig
- Botão "Gerar Proposta PDF" com loading state
- Link do PDF após sucesso: `/files/proposta-{numero}.pdf`
- Sticky footer no mobile

## 5. Payload POST /proposals preservado?
✅ Sim. Estrutura idêntica ao legado:
```json
{
  "numero_proposta": "...",
  "observacoes": null,
  "objeto_proposta": "...",
  "cliente_id": 123,
  "items": [{ "quantidade": 1, "descricao": "...", "part_id": 456, "valor_unitario": 100.00, "ncm": "..." }],
  "condicoes": { "forma_pagamento": "...", "prazo_pagamento": "...", "prazo_entrega": "...", "garantia": "...", "validade": "..." },
  "commercial_condition_id": null
}
```

## 6. Autosave migrado?
✅ Sim.
- Chave: `draft_new_proposal_user_{user.id}`
- Debounce: 800ms
- Usa `latestStateRef` para evitar stale closure no timer
- Modal de restauração ao abrir com rascunho existente
- Validação de entidades ao restaurar (client/objeto/condition via API)
- Limpa rascunho após POST bem-sucedido

## 7. Itens dinâmicos migrados?
✅ Sim.
- Adicionar item vazio via "+ Adicionar peça do catálogo"
- Picker modal de peças por linha
- "Trocar" limpa a peça e re-exibe o picker
- NCM auto-preenchido (readonly) ao selecionar peça
- Qty e valor unitário editáveis, subtotal calculado em tempo real
- Remover linha atualiza total
- Validação: todas as linhas devem ter part_id antes de enviar

## 8. Autocompletes migrados?
✅ Sim (via `EntityPickerModal` genérico):
- Cliente: busca por nome/CNPJ/cidade
- Objeto: busca por nome/descrição
- Condição comercial: busca por nome/forma de pagamento
- Peça (por item): busca por nome/marca/modelo
- Cada modal carrega a lista completa e filtra client-side (igual ao legado)
- ESC e clique fora fecham o modal

## 9. Sugestão de preço migrada?
✅ Sim.
- `GET /items/last-price?clientId=&descricao=&partId=`
- Exibida como div clicável abaixo do campo de preço
- Auto-aplica se o campo de preço estiver vazio ao selecionar a peça
- Re-fetcha para todos os itens quando o cliente é trocado
- Prioridade do backend (part_client_price_references > price_history) preservada

## 10. Responsável/assinatura migrado?
✅ Sim.
- `useAuth()` já disponibiliza `user.signature_cargo` e `user.signature_telefone`
- Estados: loading (skeleton), loaded (nome + cargo · telefone), nosig (aviso de configurar)
- Validação frontend: impede envio se `userState !== 'loaded'`
- Backend valida novamente via sessão (dupla camada)
- Link "Alterar assinatura" → `/usuarios`

## 11. Condições comerciais migradas?
✅ Sim, com os 3 modos:
- **Catálogo**: picker modal + card de preview + "Trocar"
- **Nova padrão**: formulário inline → POST `/commercial-conditions` → GET para carregar → seleciona como catálogo
- **Específica/manual**: campos inline (forma, prazo pag., prazo ent., garantia, validade)
- Validações por modo preservadas

## 12. Como ficou /app/nova-proposta
- Rota React em `/nova-proposta` servida pelo SPA
- Navbar marca grupo "Comercial" como ativo (activePaths já incluía `/nova-proposta`)
- Sem redirect legacy; sem reload

## 13. O que ainda ficou em legacy
- `public/legacy/nova-proposta.html` — arquivo mantido, não removido
- Nenhuma outra tela em legacy — **migração completa**

## 14. Validações executadas
- `npm run frontend:build` → ✅ 79 módulos, build limpo
- `npm test` → ✅ 408/408 testes passando (18 suites)
- `node scripts/check-prisma-connection.js` → ✅ Prisma conectado

## 15. Problemas encontrados
- `EntityPreview` duplicado com bug de render → removido; substituído por `buildPreviewRows()` correto
- Stale closure no autosave timer → corrigido com `latestStateRef` que sempre tem o estado mais recente
- `display: contents` usado nos spans do `buildPreviewRows` para manter o layout CSS Grid correto

## 16. Próximo passo recomendado
**Migração concluída. Todas as 15 telas foram migradas para React.**

Próximos passos sugeridos:
- Teste manual completo do fluxo nova proposta → kanban → faturamento
- Code splitting (o bundle está em 585KB — considerar `React.lazy` por rota)
- Remover os arquivos `public/legacy/*.html` após validação em produção

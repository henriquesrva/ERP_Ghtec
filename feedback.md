# Feedback — Passo 4.2: Migração Responsáveis

## Arquivos criados

- `frontend/src/api/responsaveis.js` — listResponsaveis, searchResponsaveis, createResponsavel, deleteResponsavel
- `frontend/src/pages/Responsaveis.jsx` — componente completo migrado do legado

## Arquivos alterados

- `frontend/src/router.jsx` — rota `/responsaveis` saiu do array LEGACY, ganhou `<Route path="/responsaveis" element={<Responsaveis />} />`

## Endpoints usados

- `GET /responsaveis` — lista completa
- `GET /responsaveis/search?q=...` — busca com debounce 280ms (igual ao legado)
- `POST /responsaveis` — criação
- `DELETE /responsaveis/:id` — exclusão

Sem `PUT` — backend não tem edição de responsável, portanto não foi implementada.

## Comportamentos migrados

- Lista de responsáveis com busca em tempo real (debounce 280ms)
- Botão de excluir visível somente no hover do item (via estado `hoveredId`)
- ConfirmModal antes de excluir
- Toast de sucesso/erro após operações
- Loading state na lista (texto "Carregando...")
- Erro de carregamento com botão "Tentar novamente"
- Formulário de criação: nome (obrigatório), cargo e telefone (opcionais)
- Validação inline: destaca campo nome em erro
- Layout split: lista à esquerda (360px), formulário à direita (1fr)
- Após criar, lista recarrega mantendo a busca ativa

## Rota

`/app/responsaveis` → componente React `Responsaveis.jsx`

Navbar não alterada — Responsáveis não aparecia em nenhum grupo de menu no legado (acessado via URL direta ou Nova Proposta). O `isAdmin` da Navbar já detecta `/responsaveis` para iluminar o ícone de engrenagem.

## O que ainda está em legacy

`public/legacy/responsaveis.html` — arquivo mantido, mas navegação principal usa React.

## Validações executadas

- `npm run frontend:build` → ✅ (185KB / gzip 59KB)
- `npm test` → ✅ 408/408 testes
- `npm run prisma:status` → ✅ schema up to date
- `node scripts/check-prisma-connection.js` → ✅ todos os checks passando

## Documentação

`SYSTEM_CONTEXT.md` não atualizado — migração de tela individual não constitui mudança estrutural.

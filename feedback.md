# Feedback — Passo 4.6.1: Corrigir bug await countClientProposals

## Causa exata do bug

Em `src/modules/client/client.service.js`, linha 68:

```js
// ANTES (bugado)
const proposalCount = repo.countClientProposals(id);
if (proposalCount > 0) { ...
```

`countClientProposals` é `async` (usa `prisma.proposal.count`), então retorna uma **Promise**.
Sem `await`, `proposalCount` recebe a Promise em si, não o número.
A comparação `Promise > 0` resolve para `NaN > 0 = false` — **sempre falso**.
Resultado: qualquer cliente podia ser excluído, mesmo com propostas vinculadas.

---

## Arquivos alterados

### `src/modules/client/client.service.js`
- Adicionado `await` na chamada `countClientProposals`:
  ```js
  // DEPOIS (correto)
  const proposalCount = await repo.countClientProposals(id);
  ```

### `tests/services/client.service.test.js`
- Trocados 3 mocks de `mockReturnValue` (síncrono) para `mockResolvedValue` (async) no bloco `deleteClient`, para refletir corretamente o comportamento assíncrono do repository:
  - `mockReturnValue(3)` → `mockResolvedValue(3)` (teste HAS_PROPOSALS)
  - `mockReturnValue(0)` → `mockResolvedValue(0)` (teste excluir sem propostas)
  - `mockReturnValue(1)` → `mockResolvedValue(1)` (teste não chamar deleteClientById)

---

## Por que os testes passavam antes mesmo com o bug

Os testes usavam `mockReturnValue` (retorno síncrono), não `mockResolvedValue`. Como o service **não** fazia `await`, recebia o valor diretamente do mock síncrono (ex: `3`). O teste funcionava com o mock mas falhava em produção (onde `countClientProposals` retorna uma Promise real).

Após a correção: service usa `await` + testes usam `mockResolvedValue` — comportamento mock alinhado com produção.

---

## Validações executadas

- `npm test` → ✅ 408/408 passando (18 arquivos)
- `npm run prisma:status` → ✅ Database schema is up to date!
- `npm run frontend:build` → ✅ 63 modules, build OK

---

## Confirmação de que HAS_PROPOSALS voltou a funcionar

Após a correção, o fluxo `deleteClient` funciona corretamente:
1. `findClientById` verifica se o cliente existe (NOT_FOUND se não)
2. `await countClientProposals(id)` retorna o número real de propostas
3. Se `proposalCount > 0`: lança `HAS_PROPOSALS` com a contagem — **cliente não é excluído**
4. Se `proposalCount === 0`: prossegue para `deleteClientById` — cliente excluído normalmente

---

## Próximo passo recomendado

**Passo 4.7 — Migrar tela Financeiro para React**

`financeiro.html` (250 linhas, 3 fetch calls) — dashboard financeiro com gráficos Chart.js.
`react-chartjs-2` já está instalado (adicionado no Passo 4.6).

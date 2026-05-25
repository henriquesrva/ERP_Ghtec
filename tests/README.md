# Testes Automatizados — GHTec Propostas

## Como rodar

```bash
# Roda todos os testes uma vez
npm test

# Roda em modo watch (re-executa ao salvar)
npm run test:watch
```

## Banco de dados nos testes

**Os testes nunca tocam o banco de produção (`database.sqlite`).**

Quando `NODE_ENV=test`, `src/db/connection.js` abre um banco SQLite em memória (`:memory:`). O vitest roda cada arquivo de teste em um worker isolado com seu próprio registro de módulos, então cada arquivo recebe uma instância fresca e independente.

O setup em `tests/setup/testDb.js` executa `init.js` e `migrate.js` para criar o schema completo. A função `clearAllTables()` é chamada em `beforeEach` nos testes para garantir isolamento entre casos.

## Estrutura

```
tests/
  setup/
    testDb.js     — inicializa schema em memória, exporta clearAllTables()
    fixtures.js   — helpers para criar dados de teste (createTestUser, etc.)
  utils/
    extensao.test.js        — valorPorExtenso: todos os casos BRL
  services/
    auth.service.test.js    — guards de último admin, auto-delete, senha
    part.service.test.js    — parsePrecoCompra, validação, código duplicado
    proposal.service.test.js — validateProposalItems, canMoveKanban, atomicidade
```

## Como adicionar testes

1. Crie o arquivo em `tests/services/` ou `tests/utils/`
2. No topo, importe `clearAllTables` de `../../tests/setup/testDb` e chame em `beforeEach`
3. Use fixtures de `../../tests/setup/fixtures` para criar dados necessários
4. **Nunca** faça `require("../src/db/connection")` fora do setup — acesse o DB via fixtures ou serviços

## Segurança

- `NODE_ENV=test` é definido pelos scripts `npm test` / `npm run test:watch`
- Em modo teste, o banco em memória é descartado ao fim de cada worker — nenhum arquivo é criado em disco
- O arquivo `database.sqlite` de produção **jamais é aberto** durante testes

/**
 * Valida conexão real do Prisma com PostgreSQL.
 *
 * Pré-requisitos:
 *   - PostgreSQL rodando (docker compose up -d postgres)
 *   - DATABASE_URL definido no .env
 *
 * Como rodar:
 *   node scripts/check-prisma-connection.js
 */

require("dotenv/config");

const prisma = require("../src/db/prisma");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌  DATABASE_URL não definida no .env");
    process.exit(1);
  }
  console.log(`DATABASE_URL: ${url.replace(/:\/\/.*@/, "://<credenciais>@")}`);

  // 1. Ping básico
  console.log("\n1. Verificando conexão com SELECT 1...");
  const [{ "?column?": ping }] = await prisma.$queryRaw`SELECT 1`;
  console.log(`   ✅  ping = ${ping}`);

  // 2. part_categories — CRUD
  console.log("\n2. part_categories — listar e CRUD...");
  const cats = await prisma.partCategory.findMany({ orderBy: { name: "asc" } });
  console.log(`   ✅  ${cats.length} categoria(s) encontrada(s)`);

  const CAT_CODE = "TST_PRISMA_CHECK";
  const existingCat = await prisma.partCategory.findUnique({ where: { code: CAT_CODE } });
  if (existingCat) await prisma.partCategory.delete({ where: { code: CAT_CODE } });
  const createdCat = await prisma.partCategory.create({
    data: { name: "Categoria de Teste (Prisma check)", code: CAT_CODE },
  });
  console.log(`   ✅  categoria criada: id=${createdCat.id}`);
  await prisma.partCategory.delete({ where: { id: createdCat.id } });
  console.log(`   ✅  categoria deletada`);

  // 3. responsaveis — CRUD
  console.log("\n3. responsaveis — CRUD...");
  const responsaveis = await prisma.responsavel.findMany({ orderBy: { nome: "asc" } });
  console.log(`   ✅  ${responsaveis.length} responsável(is) encontrado(s)`);

  const createdResp = await prisma.responsavel.create({
    data: { nome: "Teste Prisma Check", cargo: "QA", telefone: "00000000000" },
  });
  console.log(`   ✅  responsável criado: id=${createdResp.id}`);
  await prisma.responsavel.delete({ where: { id: createdResp.id } });
  console.log(`   ✅  responsável deletado`);

  // 4. objetos — CRUD
  console.log("\n4. objetos — CRUD...");
  const objetos = await prisma.objeto.findMany({ orderBy: { nome: "asc" } });
  console.log(`   ✅  ${objetos.length} objeto(s) encontrado(s)`);

  const createdObj = await prisma.objeto.create({
    data: { nome: "Objeto Teste Prisma Check", descricao: "Criado pelo script de validação" },
  });
  console.log(`   ✅  objeto criado: id=${createdObj.id}`);
  const updatedObj = await prisma.objeto.update({
    where: { id: createdObj.id },
    data: { nome: "Objeto Teste Prisma Check (atualizado)" },
  });
  console.log(`   ✅  objeto atualizado: nome="${updatedObj.nome}"`);
  await prisma.objeto.delete({ where: { id: createdObj.id } });
  console.log(`   ✅  objeto deletado`);

  // 5. commercial_conditions — CRUD
  console.log("\n5. commercial_conditions — CRUD...");
  const conditions = await prisma.commercialCondition.findMany({ orderBy: { name: "asc" } });
  console.log(`   ✅  ${conditions.length} condição(ões) encontrada(s)`);

  const createdCond = await prisma.commercialCondition.create({
    data: {
      name:           "Condição Teste Prisma Check",
      formaPagamento: "Boleto",
      prazoPagamento: "30 dias",
      prazoEntrega:   "7 dias",
      garantia:       null,
      validade:       "30 dias",
    },
  });
  console.log(`   ✅  condição criada: id=${createdCond.id}`);
  await prisma.commercialCondition.update({
    where: { id: createdCond.id },
    data: { name: "Condição Teste Prisma Check (atualizada)" },
  });
  console.log(`   ✅  condição atualizada`);
  await prisma.commercialCondition.delete({ where: { id: createdCond.id } });
  console.log(`   ✅  condição deletada`);

  // 6. clients — CRUD
  console.log("\n6. clients — CRUD...");
  const clients = await prisma.client.findMany({ orderBy: { nome: "asc" } });
  console.log(`   ✅  ${clients.length} cliente(s) encontrado(s)`);

  const createdClient = await prisma.client.create({
    data: {
      nome:         "Cliente Teste Prisma Check",
      razaoSocial:  "Empresa de Teste Ltda",
      cnpj:         "00.000.000/0001-00",
      cidade:       "Belo Horizonte",
      estado:       "MG",
    },
  });
  console.log(`   ✅  cliente criado: id=${createdClient.id}`);
  await prisma.client.update({
    where: { id: createdClient.id },
    data: { nome: "Cliente Teste Prisma Check (atualizado)" },
  });
  console.log(`   ✅  cliente atualizado`);
  await prisma.client.delete({ where: { id: createdClient.id } });
  console.log(`   ✅  cliente deletado`);

  // 7. users — CRUD seguro (não toca no admin real)
  console.log("\n7. users — CRUD...");
  const userCount = await prisma.user.count();
  console.log(`   ✅  ${userCount} usuário(s) encontrado(s)`);

  const TEST_USERNAME = "prisma_check_test_user";
  const bcrypt = require("bcryptjs");
  const existingTestUser = await prisma.user.findUnique({ where: { username: TEST_USERNAME } });
  if (existingTestUser) await prisma.user.delete({ where: { username: TEST_USERNAME } });

  const testHash = await bcrypt.hash("teste123", 1);
  const createdUser = await prisma.user.create({
    data: {
      nome:         "Usuário Teste Prisma Check",
      username:     TEST_USERNAME,
      passwordHash: testHash,
      role:         "user",
    },
  });
  console.log(`   ✅  usuário criado: id=${createdUser.id}`);

  const foundByUsername = await prisma.user.findUnique({ where: { username: TEST_USERNAME } });
  console.log(`   ✅  encontrado por username: "${foundByUsername.nome}"`);

  const foundById = await prisma.user.findUnique({
    where: { id: createdUser.id },
    select: { id: true, nome: true, username: true, role: true, signatureCargo: true, signatureTelefone: true },
  });
  console.log(`   ✅  encontrado por id: role="${foundById.role}", password_hash ausente=${!("passwordHash" in foundById)}`);

  await prisma.user.update({
    where: { id: createdUser.id },
    data: { signatureCargo: "Técnico", signatureTelefone: "(31) 9999-0000" },
  });
  console.log(`   ✅  assinatura atualizada`);

  await prisma.user.update({
    where: { id: createdUser.id },
    data: { role: "comercial" },
  });
  console.log(`   ✅  role atualizado para "comercial"`);

  await prisma.user.delete({ where: { id: createdUser.id } });
  console.log(`   ✅  usuário de teste deletado`);

  // 8. parts + part_client_price_references — CRUD
  console.log("\n8. parts + part_client_price_references — CRUD...");
  const partCount = await prisma.part.count();
  console.log(`   ✅  ${partCount} peça(s) encontrada(s)`);

  // Categoria de teste (reutiliza se já existir)
  const CAT_CODE_PART = "TST_PART_CHECK";
  let testCatForPart = await prisma.partCategory.findUnique({ where: { code: CAT_CODE_PART } });
  if (!testCatForPart) {
    testCatForPart = await prisma.partCategory.create({
      data: { name: "Categoria Teste Part Check", code: CAT_CODE_PART },
    });
  }
  console.log(`   ✅  categoria de teste: id=${testCatForPart.id}`);

  // Peça de teste
  const TEST_PART_CODE = "TST_PART_CHECK-001";
  const existingTestPart = await prisma.part.findUnique({ where: { codigoInterno: TEST_PART_CODE } });
  if (existingTestPart) await prisma.part.delete({ where: { id: existingTestPart.id } });

  const testPart = await prisma.part.create({
    data: {
      nome:          "Peça Teste Prisma Check",
      codigoInterno: TEST_PART_CODE,
      identityCode:  "001",
      precoCompra:   99.90,
      categoryId:    testCatForPart.id,
    },
  });
  console.log(`   ✅  peça criada: id=${testPart.id}, codigo_interno="${testPart.codigoInterno}"`);

  const foundPart = await prisma.part.findUnique({
    where: { id: testPart.id },
    include: { category: { select: { name: true, code: true } } },
  });
  console.log(`   ✅  peça encontrada: nome="${foundPart.nome}", category="${foundPart.category?.code}"`);

  await prisma.part.update({
    where: { id: testPart.id },
    data: { precoCompra: 149.90 },
  });
  console.log(`   ✅  preço atualizado`);

  // Cliente de teste para price_ref (reutiliza o cliente já criado pelo check de clientes)
  const testClientForRef = await prisma.client.create({
    data: { nome: "Cliente Teste Part Ref Check", cidade: "BH", estado: "MG" },
  });
  console.log(`   ✅  cliente de teste para ref: id=${testClientForRef.id}`);

  // Upsert de referência de preço
  const priceRef = await prisma.partClientPriceRef.upsert({
    where: { partId_clientId: { partId: testPart.id, clientId: testClientForRef.id } },
    update: { referencePrice: 200.00, source: "manual" },
    create: { partId: testPart.id, clientId: testClientForRef.id, referencePrice: 200.00, source: "manual" },
  });
  console.log(`   ✅  referência de preço upsert: id=${priceRef.id}, price=${priceRef.referencePrice}`);

  const refFound = await prisma.partClientPriceRef.findUnique({
    where: { partId_clientId: { partId: testPart.id, clientId: testClientForRef.id } },
  });
  console.log(`   ✅  referência encontrada: price=${refFound.referencePrice}`);

  // Limpeza
  await prisma.partClientPriceRef.deleteMany({ where: { partId: testPart.id } });
  await prisma.part.delete({ where: { id: testPart.id } });
  await prisma.client.delete({ where: { id: testClientForRef.id } });
  await prisma.partCategory.delete({ where: { id: testCatForPart.id } });
  console.log(`   ✅  dados de teste removidos`);

  // 9. Fluxo real de proposta — proposal + proposal_items + price_history
  console.log("\n9. proposal + proposal_items + price_history — fluxo real...");

  const PROP_NUM = "CHECK-PRISMA-FLOW-001";
  // Limpeza prévia (idempotente)
  const oldProp = await prisma.proposal.findUnique({ where: { numeroProposta: PROP_NUM } });
  if (oldProp) await prisma.proposal.delete({ where: { id: oldProp.id } });

  // Dados de suporte
  const pCat  = await prisma.partCategory.create({ data: { name: "Cat Check Prop", code: "CCP_CHK" } });
  const pPart = await prisma.part.create({ data: { nome: "Peça Check Proposta", precoCompra: 50, categoryId: pCat.id } });
  const pCond = await prisma.commercialCondition.create({
    data: { name: "Cond Check", formaPagamento: "Boleto", prazoPagamento: "30 dias", prazoEntrega: "7 dias", validade: "30 dias" },
  });
  const pUser = await prisma.user.findFirst({ where: { role: "admin" } });
  const pClient = await prisma.client.create({ data: { nome: "Cliente Check Proposta" } });
  console.log(`   ✅  dados de suporte criados (client=${pClient.id}, part=${pPart.id})`);

  // Cria proposta com 2 itens via prisma.$transaction
  const ITEM_UNIT = 100.00;
  const QTY = 2;
  const TOTAL = QTY * ITEM_UNIT + 1 * 30; // 2 itens

  const proposal = await prisma.$transaction(async (tx) => {
    const p = await tx.proposal.create({
      data: {
        numeroProposta:      PROP_NUM,
        clienteId:           pClient.id,
        cidadeEmissao:       "Belo Horizonte",
        dataEmissao:         new Date(),
        objetoProposta:      "Teste Prisma connection check",
        formaPagamento:      "Boleto",
        prazoPagamento:      "30 dias",
        prazoEntrega:        "7 dias",
        garantia:            "90 dias",
        validade:            "30 dias",
        valorTotal:          QTY * ITEM_UNIT + 30,
        valorTotalExtenso:   "duzentos e trinta reais",
        responsavelNome:     "Check Script",
        responsavelCargo:    "QA",
        responsavelEmail:    "",
        responsavelTelefone: "31999999999",
        commercialConditionId: pCond.id,
      },
    });
    await tx.proposalItem.createMany({
      data: [
        { proposalId: p.id, itemOrdem: 1, quantidade: QTY, descricao: "Peça Check Proposta", valorUnitario: ITEM_UNIT, ncm: null },
        { proposalId: p.id, itemOrdem: 2, quantidade: 1,   descricao: "Item Avulso Check",   valorUnitario: 30,         ncm: null },
      ],
    });
    await tx.priceHistory.createMany({
      data: [
        {
          clientId: pClient.id, partId: pPart.id, proposalId: p.id,
          descricaoOriginal: "Peça Check Proposta", descricaoNormalizada: "peca check proposta",
          quantidade: QTY, valorUnitario: ITEM_UNIT, dataProposta: new Date(), numeroProposta: PROP_NUM,
        },
        {
          clientId: pClient.id, partId: null, proposalId: p.id,
          descricaoOriginal: "Item Avulso Check", descricaoNormalizada: "item avulso check",
          quantidade: 1, valorUnitario: 30, dataProposta: new Date(), numeroProposta: PROP_NUM,
        },
      ],
    });
    return p;
  });
  console.log(`   ✅  proposta criada via $transaction: id=${proposal.id}, num="${PROP_NUM}"`);

  // Verifica proposal_items
  const dbItems = await prisma.proposalItem.findMany({ where: { proposalId: proposal.id }, orderBy: { itemOrdem: "asc" } });
  if (dbItems.length !== 2) throw new Error(`Esperava 2 itens, encontrou ${dbItems.length}`);
  console.log(`   ✅  ${dbItems.length} proposal_items encontrados`);
  console.log(`       item 1: ${dbItems[0].descricao} × ${dbItems[0].quantidade} = ${Number(dbItems[0].valorUnitario)}`);

  // Verifica price_history
  const dbPh = await prisma.priceHistory.findMany({ where: { proposalId: proposal.id } });
  if (dbPh.length !== 2) throw new Error(`Esperava 2 price_history, encontrou ${dbPh.length}`);
  console.log(`   ✅  ${dbPh.length} price_history encontrados`);

  // Verifica getLastItemPriceForClient (prioridade 2: price_history)
  const { normalizeText } = require("../src/shared/utils/normalize");
  const lastPrice = await prisma.priceHistory.findFirst({
    where: { clientId: pClient.id, descricaoNormalizada: normalizeText("Peça Check Proposta") },
    orderBy: { id: "desc" },
  });
  if (!lastPrice) throw new Error("price_history não encontrado para cliente+descricão");
  console.log(`   ✅  getLastItemPriceForClient: valor_unitario=${Number(lastPrice.valorUnitario)}, part_id=${lastPrice.partId}`);

  // Verifica deleteProposalAndRelated (cascade)
  await prisma.proposal.delete({ where: { id: proposal.id } });
  const afterItems = await prisma.proposalItem.count({ where: { proposalId: proposal.id } });
  const afterPh    = await prisma.priceHistory.count({ where: { proposalId: proposal.id } });
  if (afterItems !== 0 || afterPh !== 0) throw new Error("Cascade delete falhou");
  console.log(`   ✅  cascade delete OK: proposal_items=${afterItems}, price_history=${afterPh}`);

  // Limpeza de suporte
  await prisma.client.delete({ where: { id: pClient.id } });
  await prisma.commercialCondition.delete({ where: { id: pCond.id } });
  await prisma.part.delete({ where: { id: pPart.id } });
  await prisma.partCategory.delete({ where: { id: pCat.id } });
  console.log(`   ✅  dados de suporte removidos`);

  // 10. stock_movements — fluxo real (entrada, saída, contagem de estoque)
  console.log("\n10. stock_movements — fluxo real...");

  // Dados de suporte
  const sCat  = await prisma.partCategory.create({ data: { name: "Cat Stock Check", code: "CST_CHK" } });
  const sPart = await prisma.part.create({
    data: { nome: "Peça Stock Check", precoCompra: 25, stockQuantity: 0, categoryId: sCat.id },
  });
  const sUser = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!sUser) throw new Error("Nenhum usuário admin encontrado. Execute scripts/seed-postgres.js primeiro.");
  console.log(`   ✅  dados de suporte criados (part=${sPart.id}, user=${sUser.id})`);

  // Entrada: +5 unidades
  const entrada = await prisma.$transaction(async (tx) => {
    const prev    = (await tx.part.findUnique({ where: { id: sPart.id }, select: { stockQuantity: true } })).stockQuantity;
    const delta   = 5;
    const newQty  = prev + delta;
    const mov = await tx.stockMovement.create({
      data: {
        partId: sPart.id, movementType: "entrada", quantity: delta,
        entryType: "compra_nova", previousQuantity: prev, newQuantity: newQty,
        createdByUserId: sUser.id,
      },
    });
    await tx.part.update({ where: { id: sPart.id }, data: { stockQuantity: newQty } });
    return mov;
  });
  const afterEntrada = await prisma.part.findUnique({ where: { id: sPart.id }, select: { stockQuantity: true } });
  if (afterEntrada.stockQuantity !== 5) throw new Error(`Esperava stock_quantity=5, foi ${afterEntrada.stockQuantity}`);
  console.log(`   ✅  entrada registrada: id=${entrada.id}, stock_quantity=${afterEntrada.stockQuantity}`);

  // Saída: -2 unidades
  const saida = await prisma.$transaction(async (tx) => {
    const prev   = (await tx.part.findUnique({ where: { id: sPart.id }, select: { stockQuantity: true } })).stockQuantity;
    const delta  = 2;
    const newQty = prev - delta;
    const mov = await tx.stockMovement.create({
      data: {
        partId: sPart.id, movementType: "saida", quantity: delta,
        returnsToStock: false, previousQuantity: prev, newQuantity: newQty,
        createdByUserId: sUser.id,
      },
    });
    await tx.part.update({ where: { id: sPart.id }, data: { stockQuantity: newQty } });
    return mov;
  });
  const afterSaida = await prisma.part.findUnique({ where: { id: sPart.id }, select: { stockQuantity: true } });
  if (afterSaida.stockQuantity !== 3) throw new Error(`Esperava stock_quantity=3, foi ${afterSaida.stockQuantity}`);
  console.log(`   ✅  saída registrada: id=${saida.id}, stock_quantity=${afterSaida.stockQuantity}`);

  // Contagem de estoque: ajuste para 10 (entry_type='contagem')
  const contagemMov = await prisma.$transaction(async (tx) => {
    const prev   = (await tx.part.findUnique({ where: { id: sPart.id }, select: { stockQuantity: true } })).stockQuantity;
    const newQty = 10;
    const delta  = newQty - prev;
    const mov = await tx.stockMovement.create({
      data: {
        partId: sPart.id, movementType: delta > 0 ? "entrada" : "saida",
        quantity: Math.abs(delta), entryType: "contagem",
        previousQuantity: prev, newQuantity: newQty,
        createdByUserId: sUser.id,
      },
    });
    await tx.part.update({ where: { id: sPart.id }, data: { stockQuantity: newQty } });
    return mov;
  });
  const afterContagem = await prisma.part.findUnique({ where: { id: sPart.id }, select: { stockQuantity: true } });
  if (afterContagem.stockQuantity !== 10) throw new Error(`Esperava stock_quantity=10, foi ${afterContagem.stockQuantity}`);
  console.log(`   ✅  contagem registrada: id=${contagemMov.id}, entry_type=contagem, stock_quantity=${afterContagem.stockQuantity}`);

  // Verificar listagem de movimentações
  const movements = await prisma.stockMovement.findMany({
    where: { partId: sPart.id },
    orderBy: { id: "asc" },
  });
  if (movements.length !== 3) throw new Error(`Esperava 3 movimentos, encontrou ${movements.length}`);
  console.log(`   ✅  ${movements.length} movimentos listados para a peça`);

  // Verificar que contagem NÃO aparece no gráfico (entry_type filter)
  const chartMovements = await prisma.stockMovement.findMany({
    where: {
      partId: sPart.id,
      movementType: { in: ["entrada", "saida"] },
      OR: [{ entryType: null }, { entryType: { not: "contagem" } }],
    },
  });
  if (chartMovements.length !== 2) throw new Error(`Esperava 2 movimentos no gráfico (sem contagem), encontrou ${chartMovements.length}`);
  console.log(`   ✅  filtro chart OK: ${chartMovements.length} movimentos (contagem excluída)`);

  // Limpeza
  await prisma.stockMovement.deleteMany({ where: { partId: sPart.id } });
  await prisma.part.delete({ where: { id: sPart.id } });
  await prisma.partCategory.delete({ where: { id: sCat.id } });
  console.log(`   ✅  dados de teste removidos`);

  // 11. kanban_tasks + kanban_comments — fluxo real
  console.log("\n11. kanban_tasks + kanban_comments — fluxo real...");

  const kUser = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!kUser) throw new Error("Nenhum usuário admin encontrado. Execute scripts/seed-postgres.js primeiro.");

  // Criar task
  const kTask = await prisma.kanbanTask.create({
    data: {
      title:       "Tarefa Check Prisma",
      description: "Criada pelo script de validação",
      createdById: kUser.id,
    },
  });
  console.log(`   ✅  task criada: id=${kTask.id}, status=${kTask.kanbanStatus}`);

  // Mover status
  const kUpdated = await prisma.kanbanTask.update({
    where: { id: kTask.id },
    data:  { kanbanStatus: "aguardando_compra", kanbanStatusUpdatedAt: new Date() },
  });
  if (kUpdated.kanbanStatus !== "aguardando_compra") throw new Error("Status não atualizado");
  console.log(`   ✅  status movido para: ${kUpdated.kanbanStatus}`);

  // Adicionar comentário na task (relação polimórfica — sem FK)
  const kComment = await prisma.kanbanComment.create({
    data: {
      cardType: "task",
      cardId:   kTask.id,
      userId:   kUser.id,
      userNome: kUser.nome,
      comment:  "Comentário de teste na task",
    },
  });
  console.log(`   ✅  comentário criado: id=${kComment.id}, card_type=${kComment.cardType}, card_id=${kComment.cardId}`);

  // Adicionar comentário polimórfico em proposal (card_id=0, sem FK real)
  const kCommentProp = await prisma.kanbanComment.create({
    data: {
      cardType: "proposal",
      cardId:   0,
      userId:   kUser.id,
      userNome: kUser.nome,
      comment:  "Auto-comentário de sistema (teste polimórfico)",
    },
  });
  console.log(`   ✅  comentário polimórfico em proposal: id=${kCommentProp.id}`);

  // Listar comentários da task
  const kComments = await prisma.kanbanComment.findMany({
    where:   { cardType: "task", cardId: kTask.id },
    orderBy: { createdAt: "asc" },
  });
  if (kComments.length !== 1) throw new Error(`Esperava 1 comentário na task, encontrou ${kComments.length}`);
  console.log(`   ✅  ${kComments.length} comentário(s) na task`);

  // Deletar comentários e task (simulando deleteTask do service)
  await prisma.kanbanComment.deleteMany({ where: { cardType: "task",     cardId: kTask.id } });
  await prisma.kanbanComment.deleteMany({ where: { cardType: "proposal", cardId: 0        } });
  await prisma.kanbanTask.delete({ where: { id: kTask.id } });
  const afterDel = await prisma.kanbanComment.count({ where: { cardType: "task", cardId: kTask.id } });
  if (afterDel !== 0) throw new Error(`Esperava 0 comentários após delete, encontrou ${afterDel}`);
  console.log(`   ✅  task e comentários deletados`);

  console.log("\n✅  Prisma conectado ao PostgreSQL com sucesso!\n");
}

main()
  .catch((e) => {
    console.error("\n❌  Erro na conexão Prisma:");
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

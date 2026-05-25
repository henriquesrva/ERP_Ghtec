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

  console.log("\n✅  Prisma conectado ao PostgreSQL com sucesso!\n");
}

main()
  .catch((e) => {
    console.error("\n❌  Erro na conexão Prisma:");
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

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

  // 2. Listar categorias
  console.log("\n2. Listando categorias (part_categories)...");
  const cats = await prisma.partCategory.findMany({ orderBy: { name: "asc" } });
  console.log(`   ✅  ${cats.length} categoria(s) encontrada(s)`);
  if (cats.length > 0) {
    cats.forEach((c) => console.log(`      - [${c.code}] ${c.name}`));
  }

  // 3. Criar e deletar categoria de teste
  console.log("\n3. Criando categoria de teste...");
  const TEST_CODE = "TST_PRISMA_CHECK";
  const existing = await prisma.partCategory.findUnique({ where: { code: TEST_CODE } });
  if (existing) await prisma.partCategory.delete({ where: { code: TEST_CODE } });

  const created = await prisma.partCategory.create({
    data: { name: "Categoria de Teste (Prisma check)", code: TEST_CODE },
  });
  console.log(`   ✅  criada: id=${created.id} code=${created.code}`);

  await prisma.partCategory.delete({ where: { id: created.id } });
  console.log(`   ✅  deletada`);

  console.log("\n✅  Prisma conectado ao PostgreSQL com sucesso!\n");
}

main()
  .catch((e) => {
    console.error("\n❌  Erro na conexão Prisma:");
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

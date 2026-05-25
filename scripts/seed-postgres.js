/**
 * Cria o usuário admin inicial no PostgreSQL (idempotente).
 *
 * Pré-requisitos:
 *   - PostgreSQL rodando e DATABASE_URL definido no .env
 *   - npm run prisma:generate já executado
 *
 * Como rodar:
 *   node scripts/seed-postgres.js
 */

require("dotenv/config");

const bcrypt = require("bcryptjs");
const prisma = require("../src/db/prisma");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌  DATABASE_URL não definida no .env");
    process.exit(1);
  }

  console.log("Verificando usuário admin no PostgreSQL...");

  const existing = await prisma.user.findUnique({ where: { username: "admin" } });

  if (existing) {
    console.log(`✅  Usuário admin já existe (id=${existing.id}). Nada a fazer.`);
    return;
  }

  const passwordHash = await bcrypt.hash("admin123", 10);

  const user = await prisma.user.create({
    data: {
      nome:         "Administrador",
      username:     "admin",
      passwordHash,
      role:         "admin",
    },
  });

  console.log(`✅  Usuário admin criado com sucesso (id=${user.id}).`);
  console.log("   username: admin");
  console.log("   senha:    admin123");
  console.log("   ⚠️  Altere a senha após o primeiro login.");
}

main()
  .catch((e) => {
    console.error("❌  Erro ao executar seed:");
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

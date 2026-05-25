const prisma = require("../../db/prisma");

function mapResponsavel(r) {
  if (!r) return null;
  return { id: r.id, nome: r.nome, telefone: r.telefone, cargo: r.cargo, created_at: r.createdAt };
}

async function listAllResponsaveis() {
  const rows = await prisma.responsavel.findMany({ orderBy: { nome: "asc" } });
  return rows.map(mapResponsavel);
}

async function findResponsavelById(id) {
  return mapResponsavel(await prisma.responsavel.findUnique({ where: { id } }));
}

async function searchResponsaveis(q) {
  return prisma.responsavel.findMany({
    where: {
      OR: [
        { nome: { contains: q, mode: "insensitive" } },
        { cargo: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { nome: "asc" },
    take: 10,
    select: { id: true, nome: true, telefone: true, cargo: true },
  });
}

async function createResponsavel(data) {
  const row = await prisma.responsavel.create({
    data: {
      nome:     data.nome     ?? null,
      telefone: data.telefone ?? null,
      cargo:    data.cargo    ?? null,
    },
  });
  return row.id;
}

async function deleteResponsavelById(id) {
  await prisma.responsavel.delete({ where: { id } });
}

module.exports = {
  listAllResponsaveis,
  findResponsavelById,
  searchResponsaveis,
  createResponsavel,
  deleteResponsavelById,
};

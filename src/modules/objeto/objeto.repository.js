const prisma = require("../../db/prisma");

function mapObjeto(o) {
  if (!o) return null;
  return { id: o.id, nome: o.nome, descricao: o.descricao, created_at: o.createdAt };
}

async function listAllObjetos() {
  const rows = await prisma.objeto.findMany({ orderBy: { nome: "asc" } });
  return rows.map(mapObjeto);
}

async function findObjetoById(id) {
  return mapObjeto(await prisma.objeto.findUnique({ where: { id } }));
}

async function searchObjetos(q) {
  return prisma.objeto.findMany({
    where: {
      OR: [
        { nome:      { contains: q, mode: "insensitive" } },
        { descricao: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { nome: "asc" },
    take: 20,
    select: { id: true, nome: true, descricao: true },
  });
}

async function createObjeto(data) {
  const row = await prisma.objeto.create({
    data: {
      nome:      data.nome      ?? null,
      descricao: data.descricao ?? null,
    },
  });
  return row.id;
}

async function updateObjeto(id, data) {
  await prisma.objeto.update({
    where: { id },
    data: {
      nome:      data.nome      ?? null,
      descricao: data.descricao ?? null,
    },
  });
}

async function deleteObjetoById(id) {
  await prisma.objeto.delete({ where: { id } });
}

module.exports = {
  listAllObjetos,
  findObjetoById,
  searchObjetos,
  createObjeto,
  updateObjeto,
  deleteObjetoById,
};

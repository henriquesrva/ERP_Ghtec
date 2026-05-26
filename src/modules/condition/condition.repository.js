const prisma = require("../../db/prisma");

function mapCondition(c) {
  if (!c) return null;
  return {
    id:              c.id,
    name:            c.name,
    forma_pagamento: c.formaPagamento,
    prazo_pagamento: c.prazoPagamento,
    prazo_entrega:   c.prazoEntrega,
    garantia:        c.garantia,
    validade:        c.validade,
    created_at:      c.createdAt,
    updated_at:      c.updatedAt,
  };
}

async function listConditions() {
  const rows = await prisma.commercialCondition.findMany({ orderBy: { name: "asc" } });
  return rows.map(mapCondition);
}

async function getConditionById(id) {
  return mapCondition(await prisma.commercialCondition.findUnique({ where: { id } }));
}

async function searchConditions(q) {
  const rows = await prisma.commercialCondition.findMany({
    where: {
      OR: [
        { name:           { contains: q, mode: "insensitive" } },
        { formaPagamento: { contains: q, mode: "insensitive" } },
        { prazoPagamento: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { name: "asc" },
    take: 50,
  });
  return rows.map(mapCondition);
}

async function createCondition(data) {
  const row = await prisma.commercialCondition.create({
    data: {
      name:           data.name,
      formaPagamento: data.forma_pagamento,
      prazoPagamento: data.prazo_pagamento,
      prazoEntrega:   data.prazo_entrega,
      garantia:       data.garantia ?? null,
      validade:       data.validade,
    },
  });
  return row.id;
}

async function updateCondition(id, data) {
  await prisma.commercialCondition.update({
    where: { id },
    data: {
      name:           data.name,
      formaPagamento: data.forma_pagamento,
      prazoPagamento: data.prazo_pagamento,
      prazoEntrega:   data.prazo_entrega,
      garantia:       data.garantia ?? null,
      validade:       data.validade,
    },
  });
}

async function deleteCondition(id) {
  await prisma.$transaction([
    prisma.proposal.updateMany({
      where: { commercialConditionId: id },
      data:  { commercialConditionId: null },
    }),
    prisma.commercialCondition.delete({ where: { id } }),
  ]);
}

module.exports = {
  listConditions,
  getConditionById,
  searchConditions,
  createCondition,
  updateCondition,
  deleteCondition,
};

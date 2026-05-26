const prisma = require("../../db/prisma");

function mapCategoriaDespesa(c) {
  if (!c) return null;
  return {
    id:         c.id,
    nome:       c.nome,
    descricao:  c.descricao,
    ativo:      c.ativo,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

async function listCategoriasDespesa({ apenasAtivas = true } = {}) {
  const rows = await prisma.categoriaDespesa.findMany({
    where:   apenasAtivas ? { ativo: true } : {},
    orderBy: { nome: "asc" },
  });
  return rows.map(mapCategoriaDespesa);
}

async function findCategoriaDespesaById(id) {
  return mapCategoriaDespesa(await prisma.categoriaDespesa.findUnique({ where: { id } }));
}

async function createCategoriaDespesa(data) {
  const c = await prisma.categoriaDespesa.create({
    data: {
      nome:      data.nome.trim(),
      descricao: data.descricao?.trim() ?? null,
    },
  });
  return c.id;
}

async function updateCategoriaDespesa(id, data) {
  await prisma.categoriaDespesa.update({
    where: { id },
    data: {
      nome:      data.nome.trim(),
      descricao: data.descricao?.trim() ?? null,
    },
  });
}

async function desativarCategoriaDespesa(id) {
  await prisma.categoriaDespesa.update({ where: { id }, data: { ativo: false } });
}

async function countUsoCategoria(id) {
  const [notas, contas] = await Promise.all([
    prisma.notaRecebida.count({ where: { categoriaDespesaId: id } }),
    prisma.contaPagar.count({ where: { categoriaDespesaId: id } }),
  ]);
  return { notas, contas };
}

module.exports = {
  listCategoriasDespesa,
  findCategoriaDespesaById,
  createCategoriaDespesa,
  updateCategoriaDespesa,
  desativarCategoriaDespesa,
  countUsoCategoria,
};

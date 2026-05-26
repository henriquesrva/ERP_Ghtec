const prisma = require("../../db/prisma");
const db     = require("../../db/connection"); // bridge: notas_recebidas + contas_pagar ainda em SQLite

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

// Bridge: notas e contas ainda em SQLite
function countUsoCategoria(id) {
  const notas  = db.prepare("SELECT COUNT(*) AS n FROM notas_recebidas WHERE categoria_despesa_id = ?").get(id)?.n ?? 0;
  const contas = db.prepare("SELECT COUNT(*) AS n FROM contas_pagar    WHERE categoria_despesa_id = ?").get(id)?.n ?? 0;
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

const prisma = require("../../db/prisma");

// Mapeia o objeto Prisma (camelCase) para o formato snake_case esperado pelos consumers.
function mapCategory(c) {
  if (!c) return null;
  return {
    id:         c.id,
    name:       c.name,
    code:       c.code,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

async function listAllCategories() {
  const rows = await prisma.partCategory.findMany({ orderBy: { name: "asc" } });
  return rows.map(mapCategory);
}

async function findCategoryById(id) {
  const row = await prisma.partCategory.findUnique({ where: { id } });
  return mapCategory(row);
}

async function findCategoryByCode(code) {
  const row = await prisma.partCategory.findUnique({ where: { code } });
  return mapCategory(row);
}

async function createCategory(data) {
  const row = await prisma.partCategory.create({
    data: { name: data.name, code: data.code },
  });
  return row.id;
}

async function updateCategory(id, data) {
  await prisma.partCategory.update({
    where: { id },
    data: { name: data.name, code: data.code },
  });
}

async function deleteCategory(id) {
  await prisma.partCategory.delete({ where: { id } });
}

// Durante migração híbrida: queries PostgreSQL parts (vazia até parts ser migrado).
// Retorna 0 enquanto parts ainda usa SQLite — proteção de deleção temporariamente ineficaz.
async function countPartsInCategory(categoryId) {
  return prisma.part.count({ where: { categoryId } });
}

module.exports = {
  listAllCategories,
  findCategoryById,
  findCategoryByCode,
  createCategory,
  updateCategory,
  deleteCategory,
  countPartsInCategory,
};

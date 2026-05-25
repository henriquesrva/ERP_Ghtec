const repo = require("./category.repository");

async function getAllCategories() {
  return repo.listAllCategories();
}

async function createNewCategory(data) {
  const name = (data.name || "").trim();
  const code = (data.code || "").trim().toUpperCase().replace(/\s+/g, "");

  if (!name) throw Object.assign(new Error("Nome da categoria é obrigatório."), { code: "VALIDATION" });
  if (!code) throw Object.assign(new Error("Código da categoria é obrigatório."), { code: "VALIDATION" });

  const existing = await repo.findCategoryByCode(code);
  if (existing) {
    throw Object.assign(
      new Error(`Já existe uma categoria com o código "${code}".`),
      { code: "DUPLICATE", existingId: existing.id }
    );
  }

  const id = await repo.createCategory({ name, code });
  return repo.findCategoryById(id);
}

async function updateExistingCategory(id, data) {
  const category = await repo.findCategoryById(id);
  if (!category) throw Object.assign(new Error("Categoria não encontrada."), { code: "NOT_FOUND" });

  const name = (data.name || "").trim();
  const code = (data.code || "").trim().toUpperCase().replace(/\s+/g, "");

  if (!name) throw Object.assign(new Error("Nome da categoria é obrigatório."), { code: "VALIDATION" });
  if (!code) throw Object.assign(new Error("Código da categoria é obrigatório."), { code: "VALIDATION" });

  const conflict = await repo.findCategoryByCode(code);
  if (conflict && conflict.id !== id) {
    throw Object.assign(
      new Error(`Já existe outra categoria com o código "${code}".`),
      { code: "DUPLICATE", existingId: conflict.id }
    );
  }

  await repo.updateCategory(id, { name, code });
  return repo.findCategoryById(id);
}

async function deleteExistingCategory(id) {
  const category = await repo.findCategoryById(id);
  if (!category) throw Object.assign(new Error("Categoria não encontrada."), { code: "NOT_FOUND" });

  const count = await repo.countPartsInCategory(id);
  if (count > 0) {
    throw Object.assign(
      new Error(`Esta categoria possui ${count} peça(s) vinculada(s) e não pode ser excluída.`),
      { code: "HAS_PARTS" }
    );
  }

  await repo.deleteCategory(id);
}

module.exports = { getAllCategories, createNewCategory, updateExistingCategory, deleteExistingCategory };

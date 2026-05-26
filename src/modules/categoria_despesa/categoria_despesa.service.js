const repo = require("./categoria_despesa.repository");

async function getAllCategorias({ apenasAtivas } = {}) {
  return repo.listCategoriasDespesa({ apenasAtivas: apenasAtivas !== false });
}

async function getCategoriaById(id) {
  return repo.findCategoriaDespesaById(id);
}

async function createCategoria(data) {
  if (!data.nome?.trim()) {
    throw Object.assign(new Error("O campo 'nome' é obrigatório."), { code: "VALIDATION" });
  }
  const id = await repo.createCategoriaDespesa(data);
  return repo.findCategoriaDespesaById(id);
}

async function updateCategoria(id, data) {
  const existing = await repo.findCategoriaDespesaById(id);
  if (!existing) throw Object.assign(new Error("Categoria não encontrada."), { code: "NOT_FOUND" });
  if (!data.nome?.trim()) {
    throw Object.assign(new Error("O campo 'nome' é obrigatório."), { code: "VALIDATION" });
  }
  await repo.updateCategoriaDespesa(id, data);
  return repo.findCategoriaDespesaById(id);
}

async function desativarCategoria(id) {
  const existing = await repo.findCategoriaDespesaById(id);
  if (!existing) throw Object.assign(new Error("Categoria não encontrada."), { code: "NOT_FOUND" });
  await repo.desativarCategoriaDespesa(id);
}

module.exports = {
  getAllCategorias,
  getCategoriaById,
  createCategoria,
  updateCategoria,
  desativarCategoria,
};

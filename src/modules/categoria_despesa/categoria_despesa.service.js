const {
  listCategoriasDespesa,
  findCategoriaDespesaById,
  createCategoriaDespesa,
  updateCategoriaDespesa,
  desativarCategoriaDespesa,
  countUsoCategoria,
} = require("./categoria_despesa.repository");

function getAllCategorias({ apenasAtivas } = {}) {
  return listCategoriasDespesa({ apenasAtivas: apenasAtivas !== false });
}

function getCategoriaById(id) {
  return findCategoriaDespesaById(id);
}

function createCategoria(data) {
  if (!data.nome?.trim()) {
    throw Object.assign(new Error("O campo 'nome' é obrigatório."), { code: "VALIDATION" });
  }
  const id = createCategoriaDespesa(data);
  return findCategoriaDespesaById(id);
}

function updateCategoria(id, data) {
  const existing = findCategoriaDespesaById(id);
  if (!existing) throw Object.assign(new Error("Categoria não encontrada."), { code: "NOT_FOUND" });
  if (!data.nome?.trim()) {
    throw Object.assign(new Error("O campo 'nome' é obrigatório."), { code: "VALIDATION" });
  }
  updateCategoriaDespesa(id, data);
  return findCategoriaDespesaById(id);
}

function desativarCategoria(id) {
  const existing = findCategoriaDespesaById(id);
  if (!existing) throw Object.assign(new Error("Categoria não encontrada."), { code: "NOT_FOUND" });
  desativarCategoriaDespesa(id);
}

module.exports = {
  getAllCategorias,
  getCategoriaById,
  createCategoria,
  updateCategoria,
  desativarCategoria,
};

const {
  listAllFornecedores,
  findFornecedorById,
  findFornecedorByCnpj,
  searchFornecedores,
  createFornecedor,
  updateFornecedor,
  desativarFornecedor,
  countVinculos,
  getFornecedorDetalhes,
} = require("./fornecedor.repository");

function getAllFornecedores({ includeInactive } = {}) {
  return listAllFornecedores({ includeInactive });
}

function getFornecedorById(id) {
  return findFornecedorById(id);
}

function searchFornecedoresByQuery(q, opts) {
  return searchFornecedores(q, opts);
}

function getFornecedorDetalhesById(id) {
  const result = getFornecedorDetalhes(id);
  if (!result) {
    const err = new Error("Fornecedor não encontrado.");
    err.code = "NOT_FOUND";
    throw err;
  }
  return result;
}

function validateRequired(data) {
  if (!data.razao_social?.trim()) {
    throw Object.assign(new Error("O campo 'razão social' é obrigatório."), { code: "VALIDATION" });
  }
}

function checkDupCnpj(cnpj, excludeId = null) {
  if (!cnpj?.trim()) return;
  const existing = findFornecedorByCnpj(cnpj);
  if (existing && existing.id !== excludeId) {
    const err = new Error(
      `Já existe um fornecedor cadastrado com este CNPJ (id=${existing.id}: ${existing.razao_social}).`
    );
    err.code = "DUPLICATE_CNPJ";
    err.existingId = existing.id;
    throw err;
  }
}

function createNewFornecedor(data) {
  validateRequired(data);
  checkDupCnpj(data.cnpj);
  const id = createFornecedor(data);
  return findFornecedorById(id);
}

function updateExistingFornecedor(id, data) {
  const existing = findFornecedorById(id);
  if (!existing) {
    throw Object.assign(new Error("Fornecedor não encontrado."), { code: "NOT_FOUND" });
  }
  validateRequired(data);
  checkDupCnpj(data.cnpj, id);
  updateFornecedor(id, data);
  return findFornecedorById(id);
}

function desativarFornecedorById(id) {
  const existing = findFornecedorById(id);
  if (!existing) {
    throw Object.assign(new Error("Fornecedor não encontrado."), { code: "NOT_FOUND" });
  }
  desativarFornecedor(id);
}

module.exports = {
  getAllFornecedores,
  getFornecedorById,
  searchFornecedoresByQuery,
  getFornecedorDetalhesById,
  createNewFornecedor,
  updateExistingFornecedor,
  desativarFornecedorById,
};

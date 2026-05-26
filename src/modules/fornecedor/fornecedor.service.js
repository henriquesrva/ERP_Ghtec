const repo = require("./fornecedor.repository");

async function getAllFornecedores({ includeInactive } = {}) {
  return repo.listAllFornecedores({ includeInactive });
}

async function getFornecedorById(id) {
  return repo.findFornecedorById(id);
}

async function searchFornecedoresByQuery(q, opts) {
  return repo.searchFornecedores(q, opts);
}

async function getFornecedorDetalhesById(id) {
  const result = await repo.getFornecedorDetalhes(id);
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

async function checkDupCnpj(cnpj, excludeId = null) {
  if (!cnpj?.trim()) return;
  const existing = await repo.findFornecedorByCnpj(cnpj);
  if (existing && existing.id !== excludeId) {
    const err = new Error(
      `Já existe um fornecedor cadastrado com este CNPJ (id=${existing.id}: ${existing.razao_social}).`
    );
    err.code = "DUPLICATE_CNPJ";
    err.existingId = existing.id;
    throw err;
  }
}

async function createNewFornecedor(data) {
  validateRequired(data);
  await checkDupCnpj(data.cnpj);
  const id = await repo.createFornecedor(data);
  return repo.findFornecedorById(id);
}

async function updateExistingFornecedor(id, data) {
  const existing = await repo.findFornecedorById(id);
  if (!existing) {
    throw Object.assign(new Error("Fornecedor não encontrado."), { code: "NOT_FOUND" });
  }
  validateRequired(data);
  await checkDupCnpj(data.cnpj, id);
  await repo.updateFornecedor(id, data);
  return repo.findFornecedorById(id);
}

async function desativarFornecedorById(id) {
  const existing = await repo.findFornecedorById(id);
  if (!existing) {
    throw Object.assign(new Error("Fornecedor não encontrado."), { code: "NOT_FOUND" });
  }
  await repo.desativarFornecedor(id);
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

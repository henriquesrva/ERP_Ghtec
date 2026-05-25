const repo = require("./responsavel.repository");

async function getAllResponsaveis() {
  return repo.listAllResponsaveis();
}

async function getResponsavelById(id) {
  return repo.findResponsavelById(id);
}

async function searchResponsaveisByQuery(q) {
  return repo.searchResponsaveis(q);
}

async function createNewResponsavel(data) {
  if (!data.nome || !data.nome.trim()) {
    throw new Error("O campo 'nome' é obrigatório.");
  }
  const id = await repo.createResponsavel(data);
  return repo.findResponsavelById(id);
}

async function deleteResponsavel(id) {
  const existing = await repo.findResponsavelById(id);
  if (!existing) {
    const err = new Error("Responsável não encontrado.");
    err.code = "NOT_FOUND";
    throw err;
  }
  await repo.deleteResponsavelById(id);
}

module.exports = {
  getAllResponsaveis,
  getResponsavelById,
  searchResponsaveisByQuery,
  createNewResponsavel,
  deleteResponsavel,
};

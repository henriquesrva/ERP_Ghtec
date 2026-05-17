const {
  listAllResponsaveis,
  findResponsavelById,
  searchResponsaveis,
  createResponsavel,
  deleteResponsavelById,
} = require("./responsavel.repository");

function getAllResponsaveis() {
  return listAllResponsaveis();
}

function getResponsavelById(id) {
  return findResponsavelById(id);
}

function searchResponsaveisByQuery(q) {
  return searchResponsaveis(q);
}

function createNewResponsavel(data) {
  if (!data.nome || !data.nome.trim()) {
    throw new Error("O campo 'nome' é obrigatório.");
  }
  const id = createResponsavel(data);
  return findResponsavelById(id);
}

function deleteResponsavel(id) {
  const existing = findResponsavelById(id);
  if (!existing) {
    const err = new Error("Responsável não encontrado.");
    err.code = "NOT_FOUND";
    throw err;
  }
  deleteResponsavelById(id);
}

module.exports = {
  getAllResponsaveis,
  getResponsavelById,
  searchResponsaveisByQuery,
  createNewResponsavel,
  deleteResponsavel,
};

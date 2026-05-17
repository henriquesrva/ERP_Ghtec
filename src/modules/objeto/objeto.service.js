const {
  listAllObjetos,
  findObjetoById,
  searchObjetos,
  createObjeto,
  deleteObjetoById,
} = require("./objeto.repository");

function getAllObjetos() {
  return listAllObjetos();
}

function getObjetoById(id) {
  return findObjetoById(id);
}

function searchObjetosByQuery(q) {
  return searchObjetos(q);
}

function createNewObjeto(data) {
  if (!data.nome || !data.nome.trim()) {
    throw new Error("O campo 'nome' é obrigatório.");
  }
  const id = createObjeto({ nome: data.nome.trim(), descricao: data.descricao?.trim() || null });
  return findObjetoById(id);
}

function deleteObjeto(id) {
  const existing = findObjetoById(id);
  if (!existing) {
    const err = new Error("Objeto não encontrado.");
    err.code = "NOT_FOUND";
    throw err;
  }
  deleteObjetoById(id);
}

module.exports = {
  getAllObjetos,
  getObjetoById,
  searchObjetosByQuery,
  createNewObjeto,
  deleteObjeto,
};

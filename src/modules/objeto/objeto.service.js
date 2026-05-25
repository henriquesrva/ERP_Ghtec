const repo = require("./objeto.repository");

async function getAllObjetos() {
  return repo.listAllObjetos();
}

async function getObjetoById(id) {
  return repo.findObjetoById(id);
}

async function searchObjetosByQuery(q) {
  return repo.searchObjetos(q);
}

async function createNewObjeto(data) {
  if (!data.nome || !data.nome.trim()) {
    throw new Error("O campo 'nome' é obrigatório.");
  }
  const id = await repo.createObjeto({ nome: data.nome.trim(), descricao: data.descricao?.trim() || null });
  return repo.findObjetoById(id);
}

async function updateObjetoService(id, data) {
  const existing = await repo.findObjetoById(id);
  if (!existing) {
    const err = new Error("Objeto não encontrado.");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (!data.nome || !data.nome.trim()) {
    throw new Error("O campo 'nome' é obrigatório.");
  }
  await repo.updateObjeto(id, { nome: data.nome.trim(), descricao: data.descricao?.trim() || null });
  return repo.findObjetoById(id);
}

async function deleteObjeto(id) {
  const existing = await repo.findObjetoById(id);
  if (!existing) {
    const err = new Error("Objeto não encontrado.");
    err.code = "NOT_FOUND";
    throw err;
  }
  await repo.deleteObjetoById(id);
}

module.exports = {
  getAllObjetos,
  getObjetoById,
  searchObjetosByQuery,
  createNewObjeto,
  updateObjetoService,
  deleteObjeto,
};

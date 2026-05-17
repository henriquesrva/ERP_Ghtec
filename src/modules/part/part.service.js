const {
  listAllParts,
  findPartById,
  findPartByComposition,
  searchParts,
  createPart,
  updatePart,
  getPartPriceHistory,
} = require("./part.repository");

function getAllParts() {
  return listAllParts();
}

function getPartById(id) {
  return findPartById(id);
}

function searchPartsByQuery(q) {
  return searchParts(q);
}

function createNewPart(data) {
  if (!data.nome || !data.nome.trim()) {
    throw new Error("O campo 'nome' é obrigatório.");
  }

  // Bloqueia duplicidade por nome + marca + modelo
  const existing = findPartByComposition(data.nome, data.marca, data.modelo);
  if (existing) {
    const label = [data.nome, data.marca, data.modelo].filter(Boolean).join(" / ");
    const err = new Error(`Já existe uma peça cadastrada com esta combinação nome/marca/modelo: "${label}" (id=${existing.id}).`);
    err.code = "DUPLICATE_PART";
    err.existingId = existing.id;
    throw err;
  }

  const id = createPart(data);
  return findPartById(id);
}

function updateExistingPart(id, data) {
  const existing = findPartById(id);
  if (!existing) {
    const err = new Error("Peça não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }

  if (!data.nome || !data.nome.trim()) {
    throw new Error("O campo 'nome' é obrigatório.");
  }

  // Bloqueia conflito de composição com outra peça
  const conflict = findPartByComposition(data.nome, data.marca, data.modelo);
  if (conflict && conflict.id !== id) {
    const label = [data.nome, data.marca, data.modelo].filter(Boolean).join(" / ");
    const err = new Error(`Já existe outra peça com esta combinação nome/marca/modelo: "${label}" (id=${conflict.id}).`);
    err.code = "DUPLICATE_PART";
    err.existingId = conflict.id;
    throw err;
  }

  updatePart(id, data);
  return findPartById(id);
}

function getPartPriceHistoryService(id) {
  const part = findPartById(id);
  if (!part) {
    const err = new Error("Peça não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  return getPartPriceHistory(id);
}

module.exports = {
  getAllParts,
  getPartById,
  searchPartsByQuery,
  createNewPart,
  updateExistingPart,
  getPartPriceHistoryService,
};

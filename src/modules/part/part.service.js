const {
  listAllParts,
  findPartById,
  findPartByInternalCode,
  searchParts,
  createPart,
  updatePart,
  deletePart,
  getPartPriceHistory,
  getPartPriceHistoryByClient,
  getPartLastPricePerClient,
  getClientPriceRefs,
  upsertClientPriceRef,
} = require("./part.repository");

// Hybrid migration: category.repository uses Prisma (async). Parts remain on SQLite.
// Query part_categories directly via SQLite to keep buildInternalCode synchronous.
const db = require("../../db/connection");
function findCategoryByIdSync(id) {
  return db.prepare("SELECT id, name, code FROM part_categories WHERE id = ?").get(id) || null;
}

function getAllParts() {
  return listAllParts();
}

function getPartById(id) {
  return findPartById(id);
}

function searchPartsByQuery(q) {
  return searchParts(q);
}

function parsePrecoCompra(value) {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).trim().replace(/\./g, "").replace(",", ".");
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function buildInternalCode(data) {
  if (!data.category_id || !data.identity_code) return data.codigo_interno ?? null;
  const cat = findCategoryByIdSync(Number(data.category_id));
  if (!cat) {
    const err = new Error("Categoria não encontrada.");
    err.code = "VALIDATION";
    throw err;
  }
  return `${cat.code}-${String(data.identity_code).trim()}`;
}

function createNewPart(data) {
  if (!data.nome || !String(data.nome).trim()) {
    throw new Error("O campo 'nome' é obrigatório.");
  }

  const preco = parsePrecoCompra(data.preco_compra);
  if (preco === null || preco < 0) {
    throw new Error("O campo 'preço de compra' é obrigatório e deve ser um valor válido.");
  }
  data = { ...data, preco_compra: preco };

  // Gera código interno a partir da categoria + identity_code
  const codigoInterno = buildInternalCode(data);
  data = { ...data, codigo_interno: codigoInterno };

  // Valida unicidade do código interno
  if (codigoInterno) {
    const dup = findPartByInternalCode(codigoInterno);
    if (dup) {
      const err = new Error(`Já existe uma peça cadastrada com o código interno "${codigoInterno}".`);
      err.code = "DUPLICATE_INTERNAL_CODE";
      err.existingId = dup.id;
      throw err;
    }
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

  if (!data.nome || !String(data.nome).trim()) {
    throw new Error("O campo 'nome' é obrigatório.");
  }

  const preco = parsePrecoCompra(data.preco_compra);
  if (preco === null || preco < 0) {
    throw new Error("O campo 'preço de compra' é obrigatório e deve ser um valor válido.");
  }
  data = { ...data, preco_compra: preco };

  // Gera código interno a partir da categoria + identity_code
  const codigoInterno = buildInternalCode(data);
  data = { ...data, codigo_interno: codigoInterno };

  // Valida unicidade do código interno (excluindo a própria peça)
  if (codigoInterno) {
    const dup = findPartByInternalCode(codigoInterno);
    if (dup && dup.id !== id) {
      const err = new Error(`Já existe outra peça com o código interno "${codigoInterno}".`);
      err.code = "DUPLICATE_INTERNAL_CODE";
      err.existingId = dup.id;
      throw err;
    }
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

function getPartPriceHistoryByClientService(partId, clientId) {
  const part = findPartById(partId);
  if (!part) {
    const err = new Error("Peça não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  return getPartPriceHistoryByClient(partId, clientId);
}

function getPartPriceComparisonService(partId) {
  const part = findPartById(partId);
  if (!part) {
    const err = new Error("Peça não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  return getPartLastPricePerClient(partId);
}

function deletePartService(id) {
  const part = findPartById(id);
  if (!part) {
    const err = new Error("Peça não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  deletePart(id);
}

function getClientPriceRefsService(partId) {
  const part = findPartById(partId);
  if (!part) {
    const err = new Error("Peça não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  return getClientPriceRefs(partId);
}

function upsertClientPriceRefService(partId, clientId, data, userId) {
  const part = findPartById(partId);
  if (!part) {
    const err = new Error("Peça não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  const rawPrice = data.reference_price;
  let price;
  if (typeof rawPrice === "number") {
    price = rawPrice;
  } else {
    const str = String(rawPrice ?? "").trim().replace(/[R$\s]/g, "");
    price = str.includes(",")
      ? parseFloat(str.replace(/\./g, "").replace(",", "."))
      : parseFloat(str);
  }
  if (isNaN(price) || price < 0) {
    const err = new Error("Preço de referência inválido.");
    err.code = "VALIDATION";
    throw err;
  }
  if (!clientId || isNaN(Number(clientId))) {
    const err = new Error("client_id inválido.");
    err.code = "VALIDATION";
    throw err;
  }
  return upsertClientPriceRef(partId, Number(clientId), price, data.notes ?? null, userId);
}

module.exports = {
  getAllParts,
  getPartById,
  searchPartsByQuery,
  parsePrecoCompra,
  createNewPart,
  updateExistingPart,
  deletePartService,
  getPartPriceHistoryService,
  getPartPriceHistoryByClientService,
  getPartPriceComparisonService,
  getClientPriceRefsService,
  upsertClientPriceRefService,
};

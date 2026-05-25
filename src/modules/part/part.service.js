const repo = require("./part.repository");

function parsePrecoCompra(value) {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).trim().replace(/\./g, "").replace(",", ".");
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

async function buildInternalCode(data) {
  if (!data.category_id || !data.identity_code) return data.codigo_interno ?? null;
  const cat = await repo.findCategoryById(Number(data.category_id));
  if (!cat) {
    const err = new Error("Categoria não encontrada.");
    err.code = "VALIDATION";
    throw err;
  }
  return `${cat.code}-${String(data.identity_code).trim()}`;
}

async function getAllParts() {
  return repo.listAllParts();
}

async function getPartById(id) {
  return repo.findPartById(id);
}

async function searchPartsByQuery(q) {
  return repo.searchParts(q);
}

async function createNewPart(data) {
  if (!data.nome || !String(data.nome).trim()) {
    throw new Error("O campo 'nome' é obrigatório.");
  }

  const preco = parsePrecoCompra(data.preco_compra);
  if (preco === null || preco < 0) {
    throw new Error("O campo 'preço de compra' é obrigatório e deve ser um valor válido.");
  }
  data = { ...data, preco_compra: preco };

  const codigoInterno = await buildInternalCode(data);
  data = { ...data, codigo_interno: codigoInterno };

  if (codigoInterno) {
    const dup = await repo.findPartByInternalCode(codigoInterno);
    if (dup) {
      const err = new Error(`Já existe uma peça cadastrada com o código interno "${codigoInterno}".`);
      err.code = "DUPLICATE_INTERNAL_CODE";
      err.existingId = dup.id;
      throw err;
    }
  }

  const id = await repo.createPart(data);
  return repo.findPartById(id);
}

async function updateExistingPart(id, data) {
  const existing = await repo.findPartById(id);
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

  const codigoInterno = await buildInternalCode(data);
  data = { ...data, codigo_interno: codigoInterno };

  if (codigoInterno) {
    const dup = await repo.findPartByInternalCode(codigoInterno);
    if (dup && dup.id !== id) {
      const err = new Error(`Já existe outra peça com o código interno "${codigoInterno}".`);
      err.code = "DUPLICATE_INTERNAL_CODE";
      err.existingId = dup.id;
      throw err;
    }
  }

  await repo.updatePart(id, data);
  return repo.findPartById(id);
}

async function getPartPriceHistoryService(id) {
  const part = await repo.findPartById(id);
  if (!part) {
    const err = new Error("Peça não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  return repo.getPartPriceHistory(id);
}

async function getPartPriceHistoryByClientService(partId, clientId) {
  const part = await repo.findPartById(partId);
  if (!part) {
    const err = new Error("Peça não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  return repo.getPartPriceHistoryByClient(partId, clientId);
}

async function getPartPriceComparisonService(partId) {
  const part = await repo.findPartById(partId);
  if (!part) {
    const err = new Error("Peça não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  return repo.getPartLastPricePerClient(partId);
}

async function deletePartService(id) {
  const part = await repo.findPartById(id);
  if (!part) {
    const err = new Error("Peça não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  await repo.deletePart(id);
}

async function getClientPriceRefsService(partId) {
  const part = await repo.findPartById(partId);
  if (!part) {
    const err = new Error("Peça não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  return repo.getClientPriceRefs(partId);
}

async function upsertClientPriceRefService(partId, clientId, data, userId) {
  const part = await repo.findPartById(partId);
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
  return repo.upsertClientPriceRef(partId, Number(clientId), price, data.notes ?? null, userId);
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

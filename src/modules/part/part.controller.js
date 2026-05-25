const {
  getAllParts,
  getPartById,
  searchPartsByQuery,
  createNewPart,
  updateExistingPart,
  deletePartService,
  getPartPriceHistoryService,
  getPartPriceHistoryByClientService,
  getPartPriceComparisonService,
  getClientPriceRefsService,
  upsertClientPriceRefService,
} = require("./part.service");

async function listPartsHandler(req, res) {
  try {
    return res.json(await getAllParts());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao listar peças." });
  }
}

async function getPartByIdHandler(req, res) {
  try {
    const part = await getPartById(Number(req.params.id));
    if (!part) {
      return res.status(404).json({ success: false, message: "Peça não encontrada." });
    }
    return res.json(part);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao buscar peça." });
  }
}

async function searchPartsHandler(req, res) {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json([]);
    return res.json(await searchPartsByQuery(q));
  } catch (err) {
    console.error(err);
    return res.status(500).json([]);
  }
}

async function createPartHandler(req, res) {
  try {
    const part = await createNewPart(req.body);
    return res.status(201).json({ success: true, part });
  } catch (err) {
    console.error(err);
    if (err.code === "DUPLICATE_PART" || err.code === "DUPLICATE_INTERNAL_CODE") {
      return res.status(409).json({
        success: false,
        message: err.message,
        existingId: err.existingId,
      });
    }
    if (err.code === "VALIDATION" || err.message.includes("obrigatório")) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Erro ao criar peça." });
  }
}

async function updatePartHandler(req, res) {
  try {
    const part = await updateExistingPart(Number(req.params.id), req.body);
    return res.json({ success: true, part });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (err.code === "DUPLICATE_PART" || err.code === "DUPLICATE_INTERNAL_CODE") {
      return res.status(409).json({
        success: false,
        message: err.message,
        existingId: err.existingId,
      });
    }
    if (err.code === "VALIDATION" || err.message.includes("obrigatório")) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Erro ao atualizar peça." });
  }
}

async function getPartPriceHistoryHandler(req, res) {
  try {
    const history = await getPartPriceHistoryService(Number(req.params.id));
    return res.json(history);
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Erro ao buscar histórico." });
  }
}

async function getPartPriceHistoryByClientHandler(req, res) {
  try {
    const partId   = Number(req.params.id);
    const clientId = Number(req.query.client_id);
    if (!clientId) {
      return res.status(400).json({ success: false, message: "client_id é obrigatório." });
    }
    const history = await getPartPriceHistoryByClientService(partId, clientId);
    return res.json(history);
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Erro ao buscar histórico." });
  }
}

async function getPartPriceComparisonHandler(req, res) {
  try {
    const data = await getPartPriceComparisonService(Number(req.params.id));
    return res.json(data);
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Erro ao buscar comparação de preços." });
  }
}

async function deletePartHandler(req, res) {
  try {
    await deletePartService(Number(req.params.id));
    return res.json({ success: true, message: "Peça excluída com sucesso." });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND")        return res.status(404).json({ success: false, message: err.message });
    if (err.code === "HAS_DEPENDENCIES") return res.status(409).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao excluir peça." });
  }
}

async function getClientPriceRefsHandler(req, res) {
  try {
    const refs = await getClientPriceRefsService(Number(req.params.id));
    return res.json(refs);
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") return res.status(404).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao buscar referências de preço." });
  }
}

async function upsertClientPriceRefHandler(req, res) {
  if (req.session?.userRole !== "admin") {
    return res.status(403).json({ success: false, message: "Apenas administradores podem gerenciar referências de preço." });
  }
  try {
    const partId   = Number(req.params.id);
    const clientId = Number(req.body.client_id);
    if (!clientId) return res.status(400).json({ success: false, message: "client_id é obrigatório." });
    const ref = await upsertClientPriceRefService(partId, clientId, req.body, req.session.userId);
    return res.json({ success: true, ref });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND")   return res.status(404).json({ success: false, message: err.message });
    if (err.code === "VALIDATION")  return res.status(400).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao salvar referência de preço." });
  }
}

module.exports = {
  listPartsHandler,
  getPartByIdHandler,
  searchPartsHandler,
  createPartHandler,
  updatePartHandler,
  deletePartHandler,
  getPartPriceHistoryHandler,
  getPartPriceHistoryByClientHandler,
  getPartPriceComparisonHandler,
  getClientPriceRefsHandler,
  upsertClientPriceRefHandler,
};

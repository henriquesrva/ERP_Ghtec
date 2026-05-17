const {
  getAllParts,
  getPartById,
  searchPartsByQuery,
  createNewPart,
  updateExistingPart,
  getPartPriceHistoryService,
} = require("./part.service");

function listPartsHandler(req, res) {
  try {
    return res.json(getAllParts());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao listar peças." });
  }
}

function getPartByIdHandler(req, res) {
  try {
    const part = getPartById(Number(req.params.id));
    if (!part) {
      return res.status(404).json({ success: false, message: "Peça não encontrada." });
    }
    return res.json(part);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao buscar peça." });
  }
}

function searchPartsHandler(req, res) {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json([]);
    return res.json(searchPartsByQuery(q));
  } catch (err) {
    console.error(err);
    return res.status(500).json([]);
  }
}

function createPartHandler(req, res) {
  try {
    const part = createNewPart(req.body);
    return res.status(201).json({ success: true, part });
  } catch (err) {
    console.error(err);
    if (err.code === "DUPLICATE_PART") {
      return res.status(409).json({
        success: false,
        message: err.message,
        existingId: err.existingId,
      });
    }
    if (err.message.includes("obrigatório")) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Erro ao criar peça." });
  }
}

function updatePartHandler(req, res) {
  try {
    const part = updateExistingPart(Number(req.params.id), req.body);
    return res.json({ success: true, part });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (err.code === "DUPLICATE_PART") {
      return res.status(409).json({
        success: false,
        message: err.message,
        existingId: err.existingId,
      });
    }
    if (err.message.includes("obrigatório")) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Erro ao atualizar peça." });
  }
}

function getPartPriceHistoryHandler(req, res) {
  try {
    const history = getPartPriceHistoryService(Number(req.params.id));
    return res.json(history);
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Erro ao buscar histórico." });
  }
}

module.exports = {
  listPartsHandler,
  getPartByIdHandler,
  searchPartsHandler,
  createPartHandler,
  updatePartHandler,
  getPartPriceHistoryHandler,
};

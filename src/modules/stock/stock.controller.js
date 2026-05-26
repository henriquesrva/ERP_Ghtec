const stockService = require("./stock.service");

async function listStockPartsHandler(req, res) {
  try {
    return res.json(await stockService.getAllStockParts());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao listar estoque." });
  }
}

async function listMovementsHandler(req, res) {
  try {
    const opts = {};
    if (req.query.part_id) opts.part_id = Number(req.query.part_id);
    if (req.query.limit)   opts.limit   = Math.min(Number(req.query.limit) || 100, 500);
    if (req.query.offset)  opts.offset  = Number(req.query.offset) || 0;
    return res.json(await stockService.getMovements(opts));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao listar movimentações." });
  }
}

async function createMovementHandler(req, res) {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Não autenticado." });

    const id = await stockService.registerMovement(req.body, userId);
    return res.status(201).json({ success: true, id });
  } catch (err) {
    console.error(err);
    if (err.code === "VALIDATION") {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (err.code === "INSUFFICIENT_STOCK") {
      return res.status(422).json({ success: false, message: err.message, available: err.available });
    }
    if (err.code === "PART_NOT_IN_PROPOSAL" || err.code === "EXCEEDS_PROPOSAL_QTY") {
      return res.status(422).json({ success: false, message: err.message, available: err.available });
    }
    return res.status(500).json({ success: false, message: "Erro ao registrar movimentação." });
  }
}

async function getContractSpendHandler(req, res) {
  try {
    return res.json(await stockService.getContractSpend());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao calcular gastos por contrato." });
  }
}

async function getMovementsByDateHandler(req, res) {
  try {
    const days = req.query.days ? Math.min(Number(req.query.days) || 60, 365) : 60;
    return res.json(await stockService.getMovementsByDateData({ days }));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao carregar dados por data." });
  }
}

async function inventoryCountHandler(req, res) {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Não autenticado." });
    const { adjustments } = req.body;
    const ids = await stockService.registerInventoryCount(adjustments, userId);
    return res.json({ success: true, count: ids.length });
  } catch (err) {
    console.error(err);
    if (err.code === "VALIDATION") {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Erro ao registrar contagem." });
  }
}

module.exports = {
  listStockPartsHandler,
  listMovementsHandler,
  createMovementHandler,
  getContractSpendHandler,
  getMovementsByDateHandler,
  inventoryCountHandler,
};

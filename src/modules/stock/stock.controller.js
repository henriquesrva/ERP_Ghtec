const { getAllStockParts, getMovements, registerMovement, getContractSpend } = require("./stock.service");

function listStockPartsHandler(req, res) {
  try {
    return res.json(getAllStockParts());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao listar estoque." });
  }
}

function listMovementsHandler(req, res) {
  try {
    const opts = {};
    if (req.query.part_id) opts.part_id = Number(req.query.part_id);
    if (req.query.limit)   opts.limit   = Math.min(Number(req.query.limit) || 100, 500);
    if (req.query.offset)  opts.offset  = Number(req.query.offset) || 0;
    return res.json(getMovements(opts));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao listar movimentações." });
  }
}

function createMovementHandler(req, res) {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Não autenticado." });

    const id = registerMovement(req.body, userId);
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

function getContractSpendHandler(req, res) {
  try {
    return res.json(getContractSpend());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao calcular gastos por contrato." });
  }
}

module.exports = {
  listStockPartsHandler,
  listMovementsHandler,
  createMovementHandler,
  getContractSpendHandler,
};

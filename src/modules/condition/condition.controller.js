const {
  getAllConditions,
  getCondition,
  searchConds,
  createCond,
  updateCond,
  deleteCond,
} = require("./condition.service");

function listConditionsHandler(req, res) {
  try {
    return res.json(getAllConditions());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao listar condições." });
  }
}

function getConditionHandler(req, res) {
  try {
    const cond = getCondition(Number(req.params.id));
    if (!cond) return res.status(404).json({ success: false, message: "Condição não encontrada." });
    return res.json(cond);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao buscar condição." });
  }
}

function searchConditionsHandler(req, res) {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json(getAllConditions());
    return res.json(searchConds(q));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao buscar condições." });
  }
}

function createConditionHandler(req, res) {
  try {
    const id = createCond(req.body);
    return res.status(201).json({ success: true, id });
  } catch (err) {
    console.error(err);
    if (err.code === "VALIDATION") return res.status(400).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao criar condição." });
  }
}

function updateConditionHandler(req, res) {
  try {
    updateCond(Number(req.params.id), req.body);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    if (err.code === "VALIDATION") return res.status(400).json({ success: false, message: err.message });
    if (err.code === "NOT_FOUND")  return res.status(404).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao atualizar condição." });
  }
}

function deleteConditionHandler(req, res) {
  try {
    deleteCond(Number(req.params.id));
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") return res.status(404).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao excluir condição." });
  }
}

module.exports = {
  listConditionsHandler,
  getConditionHandler,
  searchConditionsHandler,
  createConditionHandler,
  updateConditionHandler,
  deleteConditionHandler,
};

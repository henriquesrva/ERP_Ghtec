const {
  getAllConditions,
  getCondition,
  searchConds,
  createCond,
  updateCond,
  deleteCond,
} = require("./condition.service");

async function listConditionsHandler(req, res) {
  try {
    return res.json(await getAllConditions());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao listar condições." });
  }
}

async function getConditionHandler(req, res) {
  try {
    const cond = await getCondition(Number(req.params.id));
    if (!cond) return res.status(404).json({ success: false, message: "Condição não encontrada." });
    return res.json(cond);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao buscar condição." });
  }
}

async function searchConditionsHandler(req, res) {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json(await getAllConditions());
    return res.json(await searchConds(q));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao buscar condições." });
  }
}

async function createConditionHandler(req, res) {
  try {
    const id = await createCond(req.body);
    return res.status(201).json({ success: true, id });
  } catch (err) {
    console.error(err);
    if (err.code === "VALIDATION") return res.status(400).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao criar condição." });
  }
}

async function updateConditionHandler(req, res) {
  try {
    await updateCond(Number(req.params.id), req.body);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    if (err.code === "VALIDATION") return res.status(400).json({ success: false, message: err.message });
    if (err.code === "NOT_FOUND")  return res.status(404).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao atualizar condição." });
  }
}

async function deleteConditionHandler(req, res) {
  try {
    await deleteCond(Number(req.params.id));
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

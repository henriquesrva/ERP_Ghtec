const {
  getAllResponsaveis,
  getResponsavelById,
  searchResponsaveisByQuery,
  createNewResponsavel,
  deleteResponsavel,
} = require("./responsavel.service");

function listResponsaveisHandler(req, res) {
  try {
    return res.json(getAllResponsaveis());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao listar responsáveis." });
  }
}

function getResponsavelByIdHandler(req, res) {
  try {
    const r = getResponsavelById(Number(req.params.id));
    if (!r) {
      return res.status(404).json({ success: false, message: "Responsável não encontrado." });
    }
    return res.json(r);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao buscar responsável." });
  }
}

function searchResponsaveisHandler(req, res) {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json([]);
    return res.json(searchResponsaveisByQuery(q));
  } catch (err) {
    console.error(err);
    return res.status(500).json([]);
  }
}

function createResponsavelHandler(req, res) {
  try {
    const r = createNewResponsavel(req.body);
    return res.status(201).json({ success: true, responsavel: r });
  } catch (err) {
    console.error(err);
    if (err.message.includes("obrigatório")) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Erro ao criar responsável." });
  }
}

function deleteResponsavelHandler(req, res) {
  try {
    deleteResponsavel(Number(req.params.id));
    return res.json({ success: true, message: "Responsável excluído com sucesso." });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Erro ao excluir responsável." });
  }
}

module.exports = {
  listResponsaveisHandler,
  getResponsavelByIdHandler,
  searchResponsaveisHandler,
  createResponsavelHandler,
  deleteResponsavelHandler,
};

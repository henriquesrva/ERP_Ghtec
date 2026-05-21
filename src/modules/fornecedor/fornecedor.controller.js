const {
  getAllFornecedores,
  getFornecedorById,
  searchFornecedoresByQuery,
  getFornecedorDetalhesById,
  createNewFornecedor,
  updateExistingFornecedor,
  desativarFornecedorById,
} = require("./fornecedor.service");

function listFornecedoresHandler(req, res) {
  try {
    const includeInactive = req.query.includeInactive === "true";
    return res.json(getAllFornecedores({ includeInactive }));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao listar fornecedores." });
  }
}

function getFornecedorByIdHandler(req, res) {
  try {
    const f = getFornecedorById(Number(req.params.id));
    if (!f) return res.status(404).json({ success: false, message: "Fornecedor não encontrado." });
    return res.json(f);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao buscar fornecedor." });
  }
}

function getFornecedorDetalhesHandler(req, res) {
  try {
    return res.json(getFornecedorDetalhesById(Number(req.params.id)));
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") return res.status(404).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao buscar detalhes do fornecedor." });
  }
}

function searchFornecedoresHandler(req, res) {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json([]);
    const includeInactive = req.query.includeInactive === "true";
    return res.json(searchFornecedoresByQuery(q, { includeInactive }));
  } catch (err) {
    console.error(err);
    return res.status(500).json([]);
  }
}

function createFornecedorHandler(req, res) {
  try {
    const f = createNewFornecedor(req.body);
    return res.status(201).json({ success: true, fornecedor: f });
  } catch (err) {
    console.error(err);
    if (err.code === "VALIDATION")     return res.status(400).json({ success: false, message: err.message });
    if (err.code === "DUPLICATE_CNPJ") return res.status(409).json({ success: false, message: err.message, existingId: err.existingId });
    return res.status(500).json({ success: false, message: "Erro ao criar fornecedor." });
  }
}

function updateFornecedorHandler(req, res) {
  try {
    const f = updateExistingFornecedor(Number(req.params.id), req.body);
    return res.json({ success: true, fornecedor: f });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND")      return res.status(404).json({ success: false, message: err.message });
    if (err.code === "VALIDATION")     return res.status(400).json({ success: false, message: err.message });
    if (err.code === "DUPLICATE_CNPJ") return res.status(409).json({ success: false, message: err.message, existingId: err.existingId });
    return res.status(500).json({ success: false, message: "Erro ao atualizar fornecedor." });
  }
}

function desativarFornecedorHandler(req, res) {
  try {
    if (req.session.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Apenas administradores podem desativar fornecedores." });
    }
    desativarFornecedorById(Number(req.params.id));
    return res.json({ success: true, message: "Fornecedor desativado com sucesso." });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") return res.status(404).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao desativar fornecedor." });
  }
}

module.exports = {
  listFornecedoresHandler,
  getFornecedorByIdHandler,
  getFornecedorDetalhesHandler,
  searchFornecedoresHandler,
  createFornecedorHandler,
  updateFornecedorHandler,
  desativarFornecedorHandler,
};

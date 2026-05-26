const svc = require("./fornecedor.service");

async function listFornecedoresHandler(req, res) {
  try {
    const includeInactive = req.query.includeInactive === "true";
    return res.json(await svc.getAllFornecedores({ includeInactive }));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao listar fornecedores." });
  }
}

async function getFornecedorByIdHandler(req, res) {
  try {
    const f = await svc.getFornecedorById(Number(req.params.id));
    if (!f) return res.status(404).json({ success: false, message: "Fornecedor não encontrado." });
    return res.json(f);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao buscar fornecedor." });
  }
}

async function getFornecedorDetalhesHandler(req, res) {
  try {
    return res.json(await svc.getFornecedorDetalhesById(Number(req.params.id)));
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") return res.status(404).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao buscar detalhes do fornecedor." });
  }
}

async function searchFornecedoresHandler(req, res) {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json([]);
    const includeInactive = req.query.includeInactive === "true";
    return res.json(await svc.searchFornecedoresByQuery(q, { includeInactive }));
  } catch (err) {
    console.error(err);
    return res.status(500).json([]);
  }
}

async function createFornecedorHandler(req, res) {
  try {
    const f = await svc.createNewFornecedor(req.body);
    return res.status(201).json({ success: true, fornecedor: f });
  } catch (err) {
    console.error(err);
    if (err.code === "VALIDATION")     return res.status(400).json({ success: false, message: err.message });
    if (err.code === "DUPLICATE_CNPJ") return res.status(409).json({ success: false, message: err.message, existingId: err.existingId });
    return res.status(500).json({ success: false, message: "Erro ao criar fornecedor." });
  }
}

async function updateFornecedorHandler(req, res) {
  try {
    const f = await svc.updateExistingFornecedor(Number(req.params.id), req.body);
    return res.json({ success: true, fornecedor: f });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND")      return res.status(404).json({ success: false, message: err.message });
    if (err.code === "VALIDATION")     return res.status(400).json({ success: false, message: err.message });
    if (err.code === "DUPLICATE_CNPJ") return res.status(409).json({ success: false, message: err.message, existingId: err.existingId });
    return res.status(500).json({ success: false, message: "Erro ao atualizar fornecedor." });
  }
}

async function desativarFornecedorHandler(req, res) {
  try {
    if (req.session.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Apenas administradores podem desativar fornecedores." });
    }
    await svc.desativarFornecedorById(Number(req.params.id));
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

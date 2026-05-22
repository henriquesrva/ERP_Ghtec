const {
  getAllNotas,
  getNotaById,
  getNotaDetalhes,
  createNotaComContas,
  updateNotaExistente,
  cancelarNotaById,
} = require("./nota_recebida.service");

function listNotasHandler(req, res) {
  try {
    const filtros = {};
    if (req.query.fornecedor_id) filtros.fornecedor_id = Number(req.query.fornecedor_id);
    if (req.query.status)        filtros.status        = req.query.status;
    if (req.query.categoria_id)  filtros.categoria_id  = Number(req.query.categoria_id);
    if (req.query.limit)         filtros.limit         = Math.min(Number(req.query.limit) || 100, 500);
    if (req.query.offset)        filtros.offset        = Number(req.query.offset) || 0;
    return res.json(getAllNotas(filtros));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao listar notas recebidas." });
  }
}

function getNotaHandler(req, res) {
  try {
    return res.json(getNotaDetalhes(Number(req.params.id)));
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") return res.status(404).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao buscar nota." });
  }
}

function createNotaHandler(req, res) {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Não autenticado." });

    const data = { ...req.body };

    // Caminhos dos arquivos enviados via multer
    if (req.files?.arquivo_pdf?.[0]) {
      data.arquivo_pdf = `notas-recebidas/${req.files.arquivo_pdf[0].filename}`;
    }
    if (req.files?.arquivo_xml?.[0]) {
      data.arquivo_xml = `notas-recebidas/${req.files.arquivo_xml[0].filename}`;
    }

    // Coerce tipos
    data.fornecedor_id        = Number(data.fornecedor_id);
    data.valor_total          = parseFloat(data.valor_total);
    data.categoria_despesa_id = data.categoria_despesa_id ? Number(data.categoria_despesa_id) : null;
    data.gerar_contas_pagar   = data.gerar_contas_pagar === "true" || data.gerar_contas_pagar === true;

    // Itens: vem como JSON string em multipart/form-data
    if (typeof data.itens === "string") {
      try { data.itens = JSON.parse(data.itens); } catch { data.itens = []; }
    }
    if (!Array.isArray(data.itens)) data.itens = [];

    const nota = createNotaComContas(data, userId);
    return res.status(201).json({ success: true, nota });
  } catch (err) {
    console.error(err);
    if (err.code === "VALIDATION")      return res.status(400).json({ success: false, message: err.message });
    if (err.code === "DUPLICATE_NOTA")  return res.status(409).json({ success: false, message: err.message, existingId: err.existingId });
    if (err.code === "DUPLICATE_CHAVE") return res.status(409).json({ success: false, message: err.message, existingId: err.existingId });
    return res.status(500).json({ success: false, message: "Erro ao lançar nota." });
  }
}

function updateNotaHandler(req, res) {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Não autenticado." });

    const data = { ...req.body };
    data.fornecedor_id        = Number(data.fornecedor_id);
    data.valor_total          = parseFloat(data.valor_total);
    data.categoria_despesa_id = data.categoria_despesa_id ? Number(data.categoria_despesa_id) : null;

    if (typeof data.itens === "string") {
      try { data.itens = JSON.parse(data.itens); } catch { data.itens = []; }
    }
    if (!Array.isArray(data.itens)) data.itens = [];

    const nota = updateNotaExistente(Number(req.params.id), data, userId);
    return res.json({ success: true, nota });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND")       return res.status(404).json({ success: false, message: err.message });
    if (err.code === "VALIDATION")      return res.status(400).json({ success: false, message: err.message });
    if (err.code === "DUPLICATE_NOTA")  return res.status(409).json({ success: false, message: err.message });
    if (err.code === "DUPLICATE_CHAVE") return res.status(409).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao atualizar nota." });
  }
}

function cancelarNotaHandler(req, res) {
  try {
    const role = req.session.userRole;
    if (role !== "admin" && role !== "financeiro") {
      return res.status(403).json({ success: false, message: "Apenas administradores e o financeiro podem cancelar notas." });
    }
    cancelarNotaById(Number(req.params.id), req.session.userId);
    return res.json({ success: true, message: "Nota cancelada com sucesso." });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND")           return res.status(404).json({ success: false, message: err.message });
    if (err.code === "VALIDATION")          return res.status(400).json({ success: false, message: err.message });
    if (err.code === "HAS_CONTAS_ABERTAS")  return res.status(409).json({ success: false, message: err.message, count: err.count });
    return res.status(500).json({ success: false, message: "Erro ao cancelar nota." });
  }
}

module.exports = {
  listNotasHandler,
  getNotaHandler,
  createNotaHandler,
  updateNotaHandler,
  cancelarNotaHandler,
};

const svc = require("./conta_pagar.service");

async function listContasHandler(req, res) {
  try {
    const filtros = {};
    if (req.query.fornecedor_id)   filtros.fornecedor_id   = Number(req.query.fornecedor_id);
    if (req.query.status)          filtros.status          = req.query.status;
    if (req.query.categoria_id)    filtros.categoria_id    = Number(req.query.categoria_id);
    if (req.query.forma_pagamento) filtros.forma_pagamento = req.query.forma_pagamento;
    if (req.query.limit)           filtros.limit           = Math.min(Number(req.query.limit) || 100, 500);
    if (req.query.offset)          filtros.offset          = Number(req.query.offset) || 0;
    return res.json(await svc.getAllContas(filtros));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao listar contas a pagar." });
  }
}

async function getContaHandler(req, res) {
  try {
    return res.json(await svc.getContaById(Number(req.params.id)));
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") return res.status(404).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao buscar conta." });
  }
}

async function createContaHandler(req, res) {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Não autenticado." });
    const conta = await svc.createNewConta(req.body, userId);
    return res.status(201).json({ success: true, conta });
  } catch (err) {
    console.error(err);
    if (err.code === "VALIDATION") return res.status(400).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao criar conta a pagar." });
  }
}

async function updateContaHandler(req, res) {
  try {
    const conta = await svc.updateExistingConta(Number(req.params.id), req.body);
    return res.json({ success: true, conta });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND")  return res.status(404).json({ success: false, message: err.message });
    if (err.code === "VALIDATION") return res.status(400).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao atualizar conta." });
  }
}

async function baixarContaHandler(req, res) {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Não autenticado." });

    let comprovantePath = null;
    if (req.file) {
      comprovantePath = `comprovantes/${req.file.filename}`;
    }

    const baixaData = { ...req.body };
    if (baixaData.valor_pago) baixaData.valor_pago = parseFloat(baixaData.valor_pago);

    const conta = await svc.darBaixa(Number(req.params.id), baixaData, userId, comprovantePath);
    return res.json({ success: true, conta });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND")  return res.status(404).json({ success: false, message: err.message });
    if (err.code === "VALIDATION") return res.status(400).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao dar baixa na conta." });
  }
}

async function cancelarContaHandler(req, res) {
  try {
    const role = req.session.userRole;
    if (role !== "admin" && role !== "financeiro") {
      return res.status(403).json({ success: false, message: "Apenas administradores e o financeiro podem cancelar contas." });
    }
    const { motivo } = req.body;
    const conta = await svc.cancelar(Number(req.params.id), motivo, req.session.userId);
    return res.json({ success: true, conta });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND")  return res.status(404).json({ success: false, message: err.message });
    if (err.code === "VALIDATION") return res.status(400).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao cancelar conta." });
  }
}

async function getResumoHandler(req, res) {
  try {
    return res.json(await svc.getResumo());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao carregar resumo financeiro." });
  }
}

module.exports = {
  listContasHandler,
  getContaHandler,
  createContaHandler,
  updateContaHandler,
  baixarContaHandler,
  cancelarContaHandler,
  getResumoHandler,
};

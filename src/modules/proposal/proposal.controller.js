const {
  createProposalFlow,
  getProposalById,
  getAllProposals,
  deleteProposalService,
  getKanbanProposals,
  updateKanbanStatus,
  markProposalExecuted,
  removeProposalExecution,
  registerApproval,
  registerBilling,
  canMoveKanban,
} = require("./proposal.service");

const {
  searchItemDescriptions,
  getLastItemPriceForClient,
  findClientsByName,
  findProposalRowById,
} = require("./proposal.repository");

const { findUserById: findAuthUserById } = require("../auth/auth.repository");

async function createProposal(req, res) {
  try {
    const user = findAuthUserById(req.session.userId);
    if (!user) return res.status(401).json({ success: false, message: "Sessão inválida. Faça login novamente." });

    if (!user.signature_cargo && !user.signature_telefone) {
      return res.status(400).json({
        success: false,
        message: "Complete sua assinatura de usuário (cargo e/ou telefone) antes de gerar uma proposta. Acesse a aba Usuários para configurar.",
        code: "SIGNATURE_REQUIRED",
      });
    }

    const body = {
      ...req.body,
      responsavel: {
        nome:     user.nome,
        cargo:    user.signature_cargo    || "",
        email:    "",
        telefone: user.signature_telefone || "",
      },
      responsible_user_id: user.id,
      responsible_name:    user.nome,
      responsible_role:    user.signature_cargo    || "",
      responsible_phone:   user.signature_telefone || "",
    };

    const result = await createProposalFlow(body);

    return res.status(201).json({
      success:                  true,
      proposalId:               result.proposalId,
      pdfPath:                  result.pdfPath,
      clienteId:                result.clienteId,
      clienteIsNew:             result.clienteIsNew,
      possibleDuplicateClients: result.possibleDuplicates,
    });
  } catch (error) {
    console.error(error);

    if (error.code === "CLIENT_DATA_CONFLICT") {
      return res.status(409).json({
        success:          false,
        message:          error.message,
        code:             "CLIENT_DATA_CONFLICT",
        existingClientId: error.existingClientId ?? null,
        conflicts:        error.conflicts ?? [],
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Erro ao gerar proposta.",
    });
  }
}

function listProposals(req, res) {
  try {
    const proposals = getAllProposals();
    return res.json(proposals);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Erro ao listar propostas."
    });
  }
}

function getProposal(req, res) {
  try {
    const proposal = getProposalById(req.params.id);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: "Proposta não encontrada."
      });
    }

    return res.json(proposal);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Erro ao buscar proposta."
    });
  }
}

function searchItemsHandler(req, res) {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json([]);
    const rows = searchItemDescriptions(q);
    return res.json(rows.map(r => r.descricao));
  } catch (error) {
    console.error(error);
    return res.status(500).json([]);
  }
}

function getItemPriceHandler(req, res) {
  try {
    const { clientId, clienteNome, descricao } = req.query;
    if (!descricao) return res.json(null);

    let resolvedClientId = clientId ? parseInt(clientId, 10) : null;

    // Fallback: resolve pelo nome quando clientId não for enviado
    if (!resolvedClientId && clienteNome) {
      const matches = findClientsByName(clienteNome);
      if (matches.length === 1) resolvedClientId = matches[0].id;
    }

    if (!resolvedClientId) return res.json(null);

    const row = getLastItemPriceForClient(resolvedClientId, descricao);
    return res.json(row || null);
  } catch (error) {
    console.error(error);
    return res.status(500).json(null);
  }
}

function deleteProposalHandler(req, res) {
  try {
    deleteProposalService(Number(req.params.id));
    return res.json({ success: true, message: "Proposta excluída com sucesso." });
  } catch (error) {
    console.error(error);
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Erro ao excluir proposta." });
  }
}

function listKanbanProposalsHandler(req, res) {
  try {
    return res.json(getKanbanProposals());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao carregar kanban." });
  }
}

function updateKanbanStatusHandler(req, res) {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: "O campo 'status' é obrigatório." });
    }
    const userRole = req.session.userRole || "user";
    updateKanbanStatus(Number(req.params.id), status, userRole);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND")          return res.status(404).json({ success: false, message: err.message });
    if (err.code === "INVALID_STATUS")     return res.status(400).json({ success: false, message: err.message });
    if (err.code === "FORBIDDEN")          return res.status(403).json({ success: false, message: err.message });
    if (err.code === "EXECUTION_REQUIRED") return res.status(422).json({ success: false, message: err.message, code: err.code });
    return res.status(500).json({ success: false, message: "Erro ao atualizar status." });
  }
}

function markExecutionHandler(req, res) {
  try {
    const id = Number(req.params.id);
    markProposalExecuted(
      id, req.body,
      req.session.userRole || "user",
      req.session.userId,
      req.session.userName || "Usuário"
    );
    const row = findProposalRowById(id);
    return res.json({
      success: true,
      execution: {
        execution_completed:  row.execution_completed,
        execution_date:       row.execution_date,
        executed_by:          row.executed_by,
        execution_os:         row.execution_os,
        execution_details:    row.execution_details,
        execution_marked_at:  row.execution_marked_at,
      },
    });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") return res.status(404).json({ success: false, message: err.message });
    if (err.code === "FORBIDDEN") return res.status(403).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao marcar execução." });
  }
}

function removeExecutionHandler(req, res) {
  try {
    const id = Number(req.params.id);
    const result = removeProposalExecution(
      id,
      req.session.userRole || "user",
      req.session.userId,
      req.session.userName || "Usuário"
    );
    return res.json({ success: true, autoMoved: result.autoMoved, newStatus: result.newStatus });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") return res.status(404).json({ success: false, message: err.message });
    if (err.code === "FORBIDDEN") return res.status(403).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao remover execução." });
  }
}

function registerApprovalHandler(req, res) {
  try {
    const id = Number(req.params.id);
    registerApproval(
      id,
      {
        approval_date:            req.body.approval_date            || null,
        approval_notes:           req.body.approval_notes           || null,
        approval_attachment_path: req.file ? req.file.filename : null,
      },
      req.session.userId,
      req.session.userName || "Usuário"
    );
    const row = findProposalRowById(id);
    return res.json({
      success: true,
      approval: {
        approval_date:            row.approval_date,
        approval_notes:           row.approval_notes,
        approval_attachment_path: row.approval_attachment_path,
        approval_registered_at:   row.approval_registered_at,
      },
    });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") return res.status(404).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao registrar aprovação." });
  }
}

function registerBillingHandler(req, res) {
  try {
    const id = Number(req.params.id);
    const userRole = req.session.userRole || "user";

    // Verifica permissão antes de persistir qualquer dado
    const proposalRow = findProposalRowById(id);
    if (!proposalRow) return res.status(404).json({ success: false, message: "Proposta não encontrada." });
    if (!canMoveKanban(userRole, proposalRow.kanban_status, "faturado")) {
      return res.status(403).json({ success: false, message: "Você não tem permissão para faturar esta proposta." });
    }

    registerBilling(
      id,
      {
        billing_date:  req.body.billing_date  || null,
        invoice_number: req.body.invoice_number || null,
        billing_notes: req.body.billing_notes || null,
      },
      req.session.userId,
      req.session.userName || "Usuário"
    );
    updateKanbanStatus(id, "faturado", userRole);
    const row = findProposalRowById(id);
    return res.json({
      success: true,
      billing: {
        billing_date:  row.billing_date,
        invoice_number: row.invoice_number,
        billing_notes: row.billing_notes,
        billed_at:     row.billed_at,
      },
    });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND")      return res.status(404).json({ success: false, message: err.message });
    if (err.code === "VALIDATION")     return res.status(400).json({ success: false, message: err.message });
    if (err.code === "FORBIDDEN")      return res.status(403).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao registrar faturamento." });
  }
}

module.exports = {
  createProposal,
  listProposals,
  getProposal,
  searchItemsHandler,
  getItemPriceHandler,
  deleteProposalHandler,
  listKanbanProposalsHandler,
  updateKanbanStatusHandler,
  markExecutionHandler,
  removeExecutionHandler,
  registerApprovalHandler,
  registerBillingHandler,
};
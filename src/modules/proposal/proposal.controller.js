const {
  createProposalFlow,
  getProposalById,
  getAllProposals,
  deleteProposalService,
} = require("./proposal.service");

const {
  searchItemDescriptions,
  getLastItemPriceForClient,
  findClientsByName,
} = require("./proposal.repository");

async function createProposal(req, res) {
  try {
    const result = await createProposalFlow(req.body);

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

module.exports = {
  createProposal,
  listProposals,
  getProposal,
  searchItemsHandler,
  getItemPriceHandler,
  deleteProposalHandler,
};
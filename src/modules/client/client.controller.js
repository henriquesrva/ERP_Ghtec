const {
  getAllClients,
  getClientById,
  searchClientsByQuery,
  createNewClient,
  updateExistingClient,
  deleteClient,
  getClientProfitAnalysis,
} = require("./client.service");

function listClientsHandler(req, res) {
  try {
    return res.json(getAllClients());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao listar clientes." });
  }
}

function getClientByIdHandler(req, res) {
  try {
    const client = getClientById(Number(req.params.id));
    if (!client) {
      return res.status(404).json({ success: false, message: "Cliente não encontrado." });
    }
    return res.json(client);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao buscar cliente." });
  }
}

function searchClientsHandler(req, res) {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json([]);
    return res.json(searchClientsByQuery(q));
  } catch (err) {
    console.error(err);
    return res.status(500).json([]);
  }
}

function createClientHandler(req, res) {
  try {
    const client = createNewClient(req.body);
    return res.status(201).json({ success: true, client });
  } catch (err) {
    console.error(err);
    if (err.code === "DUPLICATE_CNPJ") {
      return res.status(409).json({
        success: false,
        message: err.message,
        existingId: err.existingId,
      });
    }
    if (err.message.includes("obrigatório")) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Erro ao criar cliente." });
  }
}

function updateClientHandler(req, res) {
  try {
    const client = updateExistingClient(Number(req.params.id), req.body);
    return res.json({ success: true, client });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (err.code === "DUPLICATE_CNPJ") {
      return res.status(409).json({
        success: false,
        message: err.message,
        existingId: err.existingId,
      });
    }
    if (err.message.includes("obrigatório")) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Erro ao atualizar cliente." });
  }
}

function deleteClientHandler(req, res) {
  try {
    deleteClient(Number(req.params.id));
    return res.json({ success: true, message: "Cliente excluído com sucesso." });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (err.code === "HAS_PROPOSALS") {
      return res.status(409).json({
        success: false,
        message: err.message,
        proposalCount: err.proposalCount,
      });
    }
    return res.status(500).json({ success: false, message: "Erro ao excluir cliente." });
  }
}

function getProfitAnalysisHandler(req, res) {
  try {
    return res.json(getClientProfitAnalysis());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao calcular análise de lucro." });
  }
}

module.exports = {
  listClientsHandler,
  getClientByIdHandler,
  searchClientsHandler,
  createClientHandler,
  updateClientHandler,
  deleteClientHandler,
  getProfitAnalysisHandler,
};

const repo = require("./client.repository");

async function getAllClients() {
  return repo.listAllClients();
}

async function getClientById(id) {
  return repo.findClientById(id);
}

async function searchClientsByQuery(q) {
  return repo.searchClients(q);
}

async function createNewClient(data) {
  if (!data.nome || !data.nome.trim()) {
    throw Object.assign(new Error("O campo 'nome' é obrigatório."), { code: "VALIDATION" });
  }

  if (data.cnpj && data.cnpj.trim()) {
    const existing = await repo.findClientByCnpj(data.cnpj);
    if (existing) {
      const err = new Error(`Já existe um cliente cadastrado com este CNPJ (id=${existing.id}: ${existing.nome}).`);
      err.code = "DUPLICATE_CNPJ";
      err.existingId = existing.id;
      throw err;
    }
  }

  const id = await repo.createClient(data);
  return repo.findClientById(id);
}

async function updateExistingClient(id, data) {
  const existing = await repo.findClientById(id);
  if (!existing) {
    const err = new Error("Cliente não encontrado.");
    err.code = "NOT_FOUND";
    throw err;
  }

  if (!data.nome || !data.nome.trim()) {
    throw Object.assign(new Error("O campo 'nome' é obrigatório."), { code: "VALIDATION" });
  }

  if (data.cnpj && data.cnpj.trim()) {
    const byCnpj = await repo.findClientByCnpj(data.cnpj);
    if (byCnpj && byCnpj.id !== id) {
      const err = new Error(`Já existe outro cliente com este CNPJ (id=${byCnpj.id}: ${byCnpj.nome}).`);
      err.code = "DUPLICATE_CNPJ";
      err.existingId = byCnpj.id;
      throw err;
    }
  }

  await repo.updateClient(id, data);
  return repo.findClientById(id);
}

async function deleteClient(id) {
  const existing = await repo.findClientById(id);
  if (!existing) {
    const err = new Error("Cliente não encontrado.");
    err.code = "NOT_FOUND";
    throw err;
  }

  const proposalCount = await repo.countClientProposals(id);
  if (proposalCount > 0) {
    const err = new Error(
      `Este cliente possui ${proposalCount} proposta(s) vinculada(s) e não pode ser excluído. ` +
      `Exclua as propostas antes de remover o cliente.`
    );
    err.code = "HAS_PROPOSALS";
    err.proposalCount = proposalCount;
    throw err;
  }

  await repo.deleteClientById(id);
}

async function getClientProfitAnalysis() {
  return repo.getProfitAnalysis();
}

module.exports = {
  getAllClients,
  getClientById,
  searchClientsByQuery,
  createNewClient,
  updateExistingClient,
  deleteClient,
  getClientProfitAnalysis,
};

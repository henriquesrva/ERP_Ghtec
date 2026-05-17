const {
  listAllClients,
  findClientById,
  findClientByCnpj,
  searchClients,
  createClient,
  updateClient,
  countClientProposals,
  deleteClientById,
} = require("./client.repository");

function getAllClients() {
  return listAllClients();
}

function getClientById(id) {
  return findClientById(id);
}

function searchClientsByQuery(q) {
  return searchClients(q);
}

function createNewClient(data) {
  if (!data.nome || !data.nome.trim()) {
    throw new Error("O campo 'nome' é obrigatório.");
  }

  // Bloqueia CNPJ duplicado
  if (data.cnpj && data.cnpj.trim()) {
    const existing = findClientByCnpj(data.cnpj);
    if (existing) {
      const err = new Error(`Já existe um cliente cadastrado com este CNPJ (id=${existing.id}: ${existing.nome}).`);
      err.code = "DUPLICATE_CNPJ";
      err.existingId = existing.id;
      throw err;
    }
  }

  const id = createClient(data);
  return findClientById(id);
}

function updateExistingClient(id, data) {
  const existing = findClientById(id);
  if (!existing) {
    const err = new Error("Cliente não encontrado.");
    err.code = "NOT_FOUND";
    throw err;
  }

  if (!data.nome || !data.nome.trim()) {
    throw new Error("O campo 'nome' é obrigatório.");
  }

  // Bloqueia conflito de CNPJ com outro cliente
  if (data.cnpj && data.cnpj.trim()) {
    const byCnpj = findClientByCnpj(data.cnpj);
    if (byCnpj && byCnpj.id !== id) {
      const err = new Error(`Já existe outro cliente com este CNPJ (id=${byCnpj.id}: ${byCnpj.nome}).`);
      err.code = "DUPLICATE_CNPJ";
      err.existingId = byCnpj.id;
      throw err;
    }
  }

  updateClient(id, data);
  return findClientById(id);
}

function deleteClient(id) {
  const existing = findClientById(id);
  if (!existing) {
    const err = new Error("Cliente não encontrado.");
    err.code = "NOT_FOUND";
    throw err;
  }

  const proposalCount = countClientProposals(id);
  if (proposalCount > 0) {
    const err = new Error(
      `Este cliente possui ${proposalCount} proposta(s) vinculada(s) e não pode ser excluído. ` +
      `Exclua as propostas antes de remover o cliente.`
    );
    err.code = "HAS_PROPOSALS";
    err.proposalCount = proposalCount;
    throw err;
  }

  deleteClientById(id);
}

module.exports = {
  getAllClients,
  getClientById,
  searchClientsByQuery,
  createNewClient,
  updateExistingClient,
  deleteClient,
};

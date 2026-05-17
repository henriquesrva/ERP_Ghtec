const db = require("../../db/connection");
const { normalizeText } = require("../../shared/utils/normalize");

// Funções de cliente delegadas ao módulo correto
const {
  findClientByCnpj,
  findClientsByName,
  findClientsByExactName,
  findClientById,
  createClient,
  searchClients,
} = require("../client/client.repository");

function createProposal(proposal) {
  const result = db.prepare(`
    INSERT INTO proposals (
      numero_proposta,
      cliente_id,
      cidade_emissao,
      data_emissao,
      objeto_proposta,
      forma_pagamento,
      prazo_pagamento,
      prazo_entrega,
      garantia,
      validade,
      valor_total,
      valor_total_extenso,
      responsavel_nome,
      responsavel_cargo,
      responsavel_email,
      responsavel_telefone,
      pdf_path
    ) VALUES (
      @numero_proposta,
      @cliente_id,
      @cidade_emissao,
      @data_emissao,
      @objeto_proposta,
      @forma_pagamento,
      @prazo_pagamento,
      @prazo_entrega,
      @garantia,
      @validade,
      @valor_total,
      @valor_total_extenso,
      @responsavel_nome,
      @responsavel_cargo,
      @responsavel_email,
      @responsavel_telefone,
      @pdf_path
    )
  `).run(proposal);
  return result.lastInsertRowid;
}

function createProposalItems(proposalId, items) {
  const stmt = db.prepare(`
    INSERT INTO proposal_items (
      proposal_id, item_ordem, quantidade, descricao, valor_unitario, ncm
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.transaction((list) => {
    for (const item of list) {
      stmt.run(proposalId, item.item_ordem, item.quantidade, item.descricao, item.valor_unitario, item.ncm || null);
    }
  })(items);
}

function insertPriceHistoryItems(clientId, proposalId, numeroProposta, dataProposta, items) {
  const stmt = db.prepare(`
    INSERT INTO price_history (
      client_id, part_id, proposal_id,
      descricao_original, descricao_normalizada,
      quantidade, valor_unitario,
      data_proposta, numero_proposta
    ) VALUES (
      @client_id, @part_id, @proposal_id,
      @descricao_original, @descricao_normalizada,
      @quantidade, @valor_unitario,
      @data_proposta, @numero_proposta
    )
  `);

  db.transaction((list) => {
    for (const item of list) {
      stmt.run({
        client_id:             clientId,
        part_id:               item.part_id ?? null,
        proposal_id:           proposalId,
        descricao_original:    item.descricao,
        descricao_normalizada: normalizeText(item.descricao),
        quantidade:            item.quantidade,
        valor_unitario:        item.valor_unitario,
        data_proposta:         dataProposta,
        numero_proposta:       numeroProposta,
      });
    }
  })(items);
}

function updateProposalPdfPath(proposalId, pdfPath) {
  db.prepare(`UPDATE proposals SET pdf_path = ? WHERE id = ?`).run(pdfPath, proposalId);
}

function findProposalById(proposalId) {
  const proposal = db.prepare(`
    SELECT
      p.*,
      c.nome AS cliente_nome,
      c.razao_social AS cliente_razao_social,
      c.cnpj AS cliente_cnpj,
      c.endereco AS cliente_endereco,
      c.cidade AS cliente_cidade,
      c.estado AS cliente_estado,
      c.cep AS cliente_cep
    FROM proposals p
    INNER JOIN clients c ON c.id = p.cliente_id
    WHERE p.id = ?
  `).get(proposalId);

  if (!proposal) return null;

  const items = db.prepare(`
    SELECT * FROM proposal_items WHERE proposal_id = ? ORDER BY item_ordem ASC
  `).all(proposalId);

  return { proposal, items };
}

function listProposals() {
  return db.prepare(`
    SELECT
      p.id,
      p.numero_proposta,
      p.data_emissao,
      p.valor_total,
      p.pdf_path,
      c.nome AS cliente_nome
    FROM proposals p
    INNER JOIN clients c ON c.id = p.cliente_id
    ORDER BY p.id DESC
  `).all();
}

function searchItemDescriptions(q) {
  const term = `%${q}%`;
  return db.prepare(`
    SELECT DISTINCT descricao FROM proposal_items WHERE descricao LIKE ? ORDER BY id DESC LIMIT 10
  `).all(term);
}

// Prioridade 1: client_id + part_id (quando a peça estiver cadastrada)
// Prioridade 2: client_id + descricao_normalizada
function getLastItemPriceForClient(clientId, descricao) {
  return db.prepare(`
    SELECT ph.valor_unitario, ph.descricao_original, ph.numero_proposta, ph.data_proposta
    FROM price_history ph
    WHERE ph.client_id = ? AND ph.descricao_normalizada = ?
    ORDER BY ph.id DESC
    LIMIT 1
  `).get(clientId, normalizeText(descricao));
}

// Vincula part_id nos registros de price_history de uma proposta específica.
// Chamado após o auto-registro de peças para manter integridade referencial.
function updatePriceHistoryPartId(proposalId, descricaoOriginal, partId) {
  db.prepare(`
    UPDATE price_history SET part_id = ?
    WHERE proposal_id = ? AND descricao_original = ?
  `).run(partId, proposalId, descricaoOriginal);
}

// Exclui proposta e todos os registros dependentes (em transação).
// O arquivo PDF gerado NÃO é removido do disco para evitar perda acidental
// de histórico; o arquivo permanece em output/proposals/ e pode ser
// removido manualmente se necessário.
function deleteProposalAndRelated(proposalId) {
  db.transaction(() => {
    db.prepare(`DELETE FROM price_history WHERE proposal_id = ?`).run(proposalId);
    db.prepare(`DELETE FROM proposal_items WHERE proposal_id = ?`).run(proposalId);
    db.prepare(`DELETE FROM proposals WHERE id = ?`).run(proposalId);
  })();
}

module.exports = {
  findClientByCnpj,
  findClientsByName,
  findClientsByExactName,
  findClientById,
  createClient,
  searchClients,
  createProposal,
  createProposalItems,
  insertPriceHistoryItems,
  updatePriceHistoryPartId,
  updateProposalPdfPath,
  findProposalById,
  listProposals,
  searchItemDescriptions,
  getLastItemPriceForClient,
  deleteProposalAndRelated,
};

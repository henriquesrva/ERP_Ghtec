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
      responsible_user_id,
      responsible_name,
      responsible_role,
      responsible_phone,
      commercial_condition_id,
      pdf_path,
      kanban_status,
      kanban_status_updated_at
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
      @responsible_user_id,
      @responsible_name,
      @responsible_role,
      @responsible_phone,
      @commercial_condition_id,
      @pdf_path,
      'pendente_envio',
      datetime('now')
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
      p.kanban_status,
      p.billed_at,
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

// Prioridade 1: referência manual (part_client_price_references) por client_id + part_id
// Prioridade 2: client_id + descricao_normalizada em price_history
function getLastItemPriceForClient(clientId, descricao, partId = null) {
  if (partId) {
    const manualRef = db.prepare(`
      SELECT reference_price AS valor_unitario, NULL AS numero_proposta, updated_at AS data_proposta
      FROM part_client_price_references
      WHERE client_id = ? AND part_id = ?
      LIMIT 1
    `).get(clientId, partId);
    if (manualRef) return manualRef;
  }

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

const KANBAN_STATUSES = [
  'pendente_envio',
  'enviado',
  'aguardando_compra',
  'comprado',
  'pendente_execucao',
  'faturar',
  'faturado',
];

function listProposalsForKanban() {
  return db.prepare(`
    SELECT
      p.id,
      p.numero_proposta,
      p.data_emissao,
      p.valor_total,
      p.pdf_path,
      p.created_at,
      p.kanban_status,
      p.kanban_status_updated_at,
      p.execution_completed,
      p.execution_date,
      p.executed_by,
      p.execution_os,
      p.execution_details,
      p.execution_marked_by_user_id,
      p.execution_marked_at,
      p.approval_date,
      p.approval_notes,
      p.approval_attachment_path,
      p.approval_registered_by_user_id,
      p.approval_registered_at,
      p.billing_date,
      p.invoice_number,
      p.billing_notes,
      p.billed_by_user_id,
      p.billed_at,
      c.nome AS cliente_nome
    FROM proposals p
    JOIN clients c ON c.id = p.cliente_id
    ORDER BY p.kanban_status_updated_at ASC
  `).all();
}

function findProposalRowById(id) {
  return db.prepare(`SELECT * FROM proposals WHERE id = ?`).get(id);
}

function setProposalExecution(proposalId, data) {
  db.prepare(`
    UPDATE proposals SET
      execution_completed         = 1,
      execution_date              = @execution_date,
      executed_by                 = @executed_by,
      execution_os                = @execution_os,
      execution_details           = @execution_details,
      execution_marked_by_user_id = @execution_marked_by_user_id,
      execution_marked_at         = datetime('now')
    WHERE id = @id
  `).run({
    id:                          proposalId,
    execution_date:              data.execution_date              || null,
    executed_by:                 data.executed_by                 || null,
    execution_os:                data.execution_os                || null,
    execution_details:           data.execution_details           || null,
    execution_marked_by_user_id: data.execution_marked_by_user_id || null,
  });
}

function setProposalApproval(proposalId, data) {
  db.prepare(`
    UPDATE proposals SET
      approval_date                  = @approval_date,
      approval_notes                 = @approval_notes,
      approval_attachment_path       = @approval_attachment_path,
      approval_registered_by_user_id = @approval_registered_by_user_id,
      approval_registered_at         = datetime('now')
    WHERE id = @id
  `).run({
    id:                             proposalId,
    approval_date:                  data.approval_date                  || null,
    approval_notes:                 data.approval_notes                 || null,
    approval_attachment_path:       data.approval_attachment_path       || null,
    approval_registered_by_user_id: data.approval_registered_by_user_id || null,
  });
}

function clearProposalExecution(proposalId) {
  db.prepare(`
    UPDATE proposals SET
      execution_completed         = 0,
      execution_date              = NULL,
      executed_by                 = NULL,
      execution_os                = NULL,
      execution_details           = NULL,
      execution_marked_by_user_id = NULL,
      execution_marked_at         = NULL
    WHERE id = ?
  `).run(proposalId);
}

function setProposalBilling(proposalId, data) {
  db.prepare(`
    UPDATE proposals SET
      billing_date      = @billing_date,
      invoice_number    = @invoice_number,
      billing_notes     = @billing_notes,
      billed_by_user_id = @billed_by_user_id,
      billed_at         = datetime('now')
    WHERE id = @id
  `).run({
    id:               proposalId,
    billing_date:     data.billing_date     || null,
    invoice_number:   data.invoice_number   || null,
    billing_notes:    data.billing_notes    || null,
    billed_by_user_id: data.billed_by_user_id || null,
  });
}

function setProposalKanbanStatus(proposalId, newStatus) {
  if (!KANBAN_STATUSES.includes(newStatus)) {
    throw new Error(`Status inválido: ${newStatus}`);
  }
  db.prepare(`
    UPDATE proposals
    SET kanban_status = ?, kanban_status_updated_at = datetime('now')
    WHERE id = ?
  `).run(newStatus, proposalId);
}

// Cria proposta, itens e histórico de preços em uma única transação atômica.
// Se qualquer etapa falhar, nada é persistido — evita proposta em estado parcial.
function createProposalAtomic(proposalData, items, { clientId, numeroProposta, dataProposta }) {
  return db.transaction(() => {
    const proposalId = createProposal(proposalData);
    createProposalItems(proposalId, items);
    insertPriceHistoryItems(clientId, proposalId, numeroProposta, dataProposta, items);
    return proposalId;
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
  createProposalAtomic,
  createProposalItems,
  insertPriceHistoryItems,
  updatePriceHistoryPartId,
  updateProposalPdfPath,
  findProposalById,
  findProposalRowById,
  listProposals,
  searchItemDescriptions,
  getLastItemPriceForClient,
  deleteProposalAndRelated,
  listProposalsForKanban,
  setProposalKanbanStatus,
  setProposalExecution,
  clearProposalExecution,
  setProposalApproval,
  setProposalBilling,
  KANBAN_STATUSES,
};

const db = require("../../db/connection");
const { normalizeText } = require("../../shared/utils/normalize");

function stripCnpj(cnpj) {
  if (!cnpj) return null;
  return cnpj.replace(/\D/g, "");
}

function listAllClients() {
  return db.prepare(`
    SELECT
      id, nome, razao_social, nome_fantasia, cnpj,
      cidade, estado, email, telefone, contato_responsavel,
      created_at, updated_at
    FROM clients
    ORDER BY nome ASC
  `).all();
}

function findClientById(id) {
  return db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id);
}

function findClientByCnpj(cnpj) {
  const digits = stripCnpj(cnpj);
  if (!digits) return null;
  return db.prepare(`
    SELECT * FROM clients
    WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '') = ?
    LIMIT 1
  `).get(digits);
}

function findClientsByName(nome) {
  const term = `%${nome}%`;
  return db.prepare(`
    SELECT id, nome, razao_social, cnpj, cidade, estado
    FROM clients
    WHERE nome LIKE ?
    ORDER BY id DESC
    LIMIT 5
  `).all(term);
}

function searchClients(q) {
  const term = `%${q}%`;
  return db.prepare(`
    SELECT id, nome, razao_social, nome_fantasia, cnpj, cidade, estado, email, telefone
    FROM clients
    WHERE nome LIKE ? OR cnpj LIKE ? OR razao_social LIKE ? OR nome_fantasia LIKE ?
    ORDER BY nome ASC
    LIMIT 10
  `).all(term, term, term, term);
}

function createClient(data) {
  const result = db.prepare(`
    INSERT INTO clients (
      nome, razao_social, nome_fantasia, cnpj, inscricao_estadual,
      endereco, cidade, estado, cep,
      email, telefone, contato_responsavel, observacoes
    ) VALUES (
      @nome, @razao_social, @nome_fantasia, @cnpj, @inscricao_estadual,
      @endereco, @cidade, @estado, @cep,
      @email, @telefone, @contato_responsavel, @observacoes
    )
  `).run({
    nome:                data.nome                ?? null,
    razao_social:        data.razao_social        ?? null,
    nome_fantasia:       data.nome_fantasia       ?? null,
    cnpj:                data.cnpj                ?? null,
    inscricao_estadual:  data.inscricao_estadual  ?? null,
    endereco:            data.endereco            ?? null,
    cidade:              data.cidade              ?? null,
    estado:              data.estado              ?? null,
    cep:                 data.cep                 ?? null,
    email:               data.email               ?? null,
    telefone:            data.telefone            ?? null,
    contato_responsavel: data.contato_responsavel ?? null,
    observacoes:         data.observacoes         ?? null,
  });
  return result.lastInsertRowid;
}

// Busca clientes com nome exatamente igual após normalização (sem acento, case-insensitive)
function findClientsByExactName(nome) {
  if (!nome || !nome.trim()) return [];
  const normInput = normalizeText(nome);
  const rows = db.prepare(`SELECT * FROM clients`).all();
  return rows.filter(c => normalizeText(c.nome) === normInput);
}

function countClientProposals(clientId) {
  return db.prepare(`SELECT COUNT(*) AS count FROM proposals WHERE cliente_id = ?`).get(clientId).count;
}

function deleteClientById(clientId) {
  db.prepare(`DELETE FROM clients WHERE id = ?`).run(clientId);
}

function updateClient(id, data) {
  // updated_at é gerenciado pelo trigger clients_updated_at
  db.prepare(`
    UPDATE clients SET
      nome                = @nome,
      razao_social        = @razao_social,
      nome_fantasia       = @nome_fantasia,
      cnpj                = @cnpj,
      inscricao_estadual  = @inscricao_estadual,
      endereco            = @endereco,
      cidade              = @cidade,
      estado              = @estado,
      cep                 = @cep,
      email               = @email,
      telefone            = @telefone,
      contato_responsavel = @contato_responsavel,
      observacoes         = @observacoes
    WHERE id = @id
  `).run({
    id,
    nome:                data.nome                ?? null,
    razao_social:        data.razao_social        ?? null,
    nome_fantasia:       data.nome_fantasia       ?? null,
    cnpj:                data.cnpj                ?? null,
    inscricao_estadual:  data.inscricao_estadual  ?? null,
    endereco:            data.endereco            ?? null,
    cidade:              data.cidade              ?? null,
    estado:              data.estado              ?? null,
    cep:                 data.cep                 ?? null,
    email:               data.email               ?? null,
    telefone:            data.telefone            ?? null,
    contato_responsavel: data.contato_responsavel ?? null,
    observacoes:         data.observacoes         ?? null,
  });
}

// Calcula lucro por cliente com base nas propostas ativas (não excluídas).
// Itens sem preco_compra na peça são contabilizados separadamente para aviso.
function getProfitAnalysis() {
  return db.prepare(`
    SELECT
      c.id AS client_id,
      c.nome AS cliente_nome,
      COUNT(DISTINCT p.id) AS num_propostas,
      SUM(pi.quantidade * pi.valor_unitario) AS valor_total_venda,
      SUM(CASE WHEN pt.preco_compra IS NOT NULL THEN pi.quantidade * pt.preco_compra END) AS custo_total,
      SUM(CASE WHEN pt.preco_compra IS NOT NULL THEN pi.quantidade * (pi.valor_unitario - pt.preco_compra) END) AS lucro_calculavel,
      SUM(CASE WHEN pt.preco_compra IS NOT NULL THEN pi.quantidade * pi.valor_unitario END) AS valor_venda_calculavel,
      SUM(CASE WHEN pt.preco_compra IS NULL OR pt.id IS NULL THEN 1 ELSE 0 END) AS itens_sem_custo,
      COUNT(pi.id) AS total_itens
    FROM proposals p
    JOIN clients c ON c.id = p.cliente_id
    JOIN proposal_items pi ON pi.proposal_id = p.id
    LEFT JOIN price_history ph ON ph.proposal_id = p.id
      AND ph.descricao_original = pi.descricao
      AND ph.id = (
        SELECT MIN(id) FROM price_history
        WHERE proposal_id = pi.proposal_id AND descricao_original = pi.descricao
      )
    LEFT JOIN parts pt ON pt.id = ph.part_id
    WHERE p.kanban_status = 'faturado'
    GROUP BY c.id, c.nome
    ORDER BY lucro_calculavel DESC
  `).all();
}

module.exports = {
  listAllClients,
  findClientById,
  findClientByCnpj,
  findClientsByName,
  findClientsByExactName,
  searchClients,
  createClient,
  updateClient,
  countClientProposals,
  deleteClientById,
  getProfitAnalysis,
};

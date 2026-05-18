const db = require("../../db/connection");

function listAllParts() {
  return db.prepare(`
    SELECT
      id, nome, descricao, marca, modelo, categoria,
      ncm, codigo_interno, created_at, updated_at
    FROM parts
    ORDER BY nome ASC
  `).all();
}

function findPartById(id) {
  return db.prepare(`SELECT * FROM parts WHERE id = ?`).get(id);
}

function findPartByComposition(nome, marca, modelo) {
  return db.prepare(`
    SELECT * FROM parts
    WHERE nome    IS ?
      AND marca   IS ?
      AND modelo  IS ?
    LIMIT 1
  `).get(
    nome   || null,
    marca  || null,
    modelo || null
  );
}

function searchParts(q) {
  const term = `%${q}%`;
  return db.prepare(`
    SELECT id, nome, descricao, marca, modelo, categoria, ncm, codigo_interno
    FROM parts
    WHERE nome           LIKE ?
       OR marca          LIKE ?
       OR modelo         LIKE ?
       OR categoria      LIKE ?
       OR codigo_interno LIKE ?
    ORDER BY nome ASC
    LIMIT 10
  `).all(term, term, term, term, term);
}

function createPart(data) {
  const result = db.prepare(`
    INSERT INTO parts (
      nome, descricao, marca, modelo, categoria,
      ncm, codigo_interno, observacoes
    ) VALUES (
      @nome, @descricao, @marca, @modelo, @categoria,
      @ncm, @codigo_interno, @observacoes
    )
  `).run({
    nome:           data.nome           ?? null,
    descricao:      data.descricao      ?? null,
    marca:          data.marca          ?? null,
    modelo:         data.modelo         ?? null,
    categoria:      data.categoria      ?? null,
    ncm:            data.ncm            ?? null,
    codigo_interno: data.codigo_interno ?? null,
    observacoes:    data.observacoes    ?? null,
  });
  return result.lastInsertRowid;
}

function updatePart(id, data) {
  // updated_at gerenciado pelo trigger parts_updated_at
  db.prepare(`
    UPDATE parts SET
      nome           = @nome,
      descricao      = @descricao,
      marca          = @marca,
      modelo         = @modelo,
      categoria      = @categoria,
      ncm            = @ncm,
      codigo_interno = @codigo_interno,
      observacoes    = @observacoes
    WHERE id = @id
  `).run({
    id,
    nome:           data.nome           ?? null,
    descricao:      data.descricao      ?? null,
    marca:          data.marca          ?? null,
    modelo:         data.modelo         ?? null,
    categoria:      data.categoria      ?? null,
    ncm:            data.ncm            ?? null,
    codigo_interno: data.codigo_interno ?? null,
    observacoes:    data.observacoes    ?? null,
  });
}

// Retorna o histórico de preços de uma peça por cliente, do mais recente para o mais antigo.
function getPartPriceHistory(partId) {
  return db.prepare(`
    SELECT
      c.nome          AS cliente_nome,
      ph.valor_unitario,
      ph.numero_proposta,
      ph.data_proposta,
      ph.quantidade
    FROM price_history ph
    JOIN clients c ON c.id = ph.client_id
    WHERE ph.part_id = ?
    ORDER BY ph.id DESC
  `).all(partId);
}

// Histórico filtrado por peça + cliente específico.
function getPartPriceHistoryByClient(partId, clientId) {
  return db.prepare(`
    SELECT
      c.nome          AS cliente_nome,
      ph.valor_unitario,
      ph.numero_proposta,
      ph.data_proposta,
      ph.quantidade
    FROM price_history ph
    JOIN clients c ON c.id = ph.client_id
    WHERE ph.part_id = ? AND ph.client_id = ?
    ORDER BY ph.id DESC
  `).all(partId, clientId);
}

// Último preço cobrado por cliente para comparação.
function getPartLastPricePerClient(partId) {
  return db.prepare(`
    SELECT
      c.id            AS client_id,
      c.nome          AS cliente_nome,
      ph.valor_unitario,
      ph.data_proposta,
      ph.numero_proposta
    FROM price_history ph
    JOIN clients c ON c.id = ph.client_id
    WHERE ph.part_id = ?
      AND ph.id = (
        SELECT MAX(id) FROM price_history
        WHERE part_id = ? AND client_id = ph.client_id
      )
    ORDER BY c.nome ASC
  `).all(partId, partId);
}

module.exports = {
  listAllParts,
  findPartById,
  findPartByComposition,
  searchParts,
  createPart,
  updatePart,
  getPartPriceHistory,
  getPartPriceHistoryByClient,
  getPartLastPricePerClient,
};

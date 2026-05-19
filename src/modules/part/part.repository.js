const db = require("../../db/connection");

function listAllParts() {
  return db.prepare(`
    SELECT
      p.id, p.nome, p.descricao, p.categoria,
      p.ncm, p.codigo_interno, p.preco_compra,
      p.category_id, p.identity_code,
      p.stock_quantity,
      pc.name AS category_name, pc.code AS category_code,
      p.created_at, p.updated_at
    FROM parts p
    LEFT JOIN part_categories pc ON pc.id = p.category_id
    ORDER BY p.nome ASC
  `).all();
}

function findPartById(id) {
  return db.prepare(`
    SELECT
      p.*,
      pc.name AS category_name, pc.code AS category_code
    FROM parts p
    LEFT JOIN part_categories pc ON pc.id = p.category_id
    WHERE p.id = ?
  `).get(id);
}

function findPartByInternalCode(codigo) {
  if (!codigo) return null;
  return db.prepare(`
    SELECT id FROM parts WHERE codigo_interno = ? LIMIT 1
  `).get(codigo);
}

function searchParts(q) {
  const term = `%${q}%`;
  return db.prepare(`
    SELECT
      p.id, p.nome, p.descricao, p.categoria,
      p.ncm, p.codigo_interno, p.category_id, p.identity_code,
      pc.name AS category_name, pc.code AS category_code
    FROM parts p
    LEFT JOIN part_categories pc ON pc.id = p.category_id
    WHERE p.nome           LIKE ?
       OR p.categoria      LIKE ?
       OR p.codigo_interno LIKE ?
       OR p.identity_code  LIKE ?
    ORDER BY p.nome ASC
    LIMIT 10
  `).all(term, term, term, term);
}

function createPart(data) {
  const result = db.prepare(`
    INSERT INTO parts (
      nome, descricao, categoria,
      ncm, codigo_interno, observacoes, preco_compra,
      category_id, identity_code
    ) VALUES (
      @nome, @descricao, @categoria,
      @ncm, @codigo_interno, @observacoes, @preco_compra,
      @category_id, @identity_code
    )
  `).run({
    nome:           data.nome           ?? null,
    descricao:      data.descricao      ?? null,
    categoria:      data.categoria      ?? null,
    ncm:            data.ncm            ?? null,
    codigo_interno: data.codigo_interno ?? null,
    observacoes:    data.observacoes    ?? null,
    preco_compra:   data.preco_compra   ?? null,
    category_id:    data.category_id    ?? null,
    identity_code:  data.identity_code  ?? null,
  });
  return result.lastInsertRowid;
}

function updatePart(id, data) {
  db.prepare(`
    UPDATE parts SET
      nome           = @nome,
      descricao      = @descricao,
      categoria      = @categoria,
      ncm            = @ncm,
      codigo_interno = @codigo_interno,
      observacoes    = @observacoes,
      preco_compra   = @preco_compra,
      category_id    = @category_id,
      identity_code  = @identity_code
    WHERE id = @id
  `).run({
    id,
    nome:           data.nome           ?? null,
    descricao:      data.descricao      ?? null,
    categoria:      data.categoria      ?? null,
    ncm:            data.ncm            ?? null,
    codigo_interno: data.codigo_interno ?? null,
    observacoes:    data.observacoes    ?? null,
    preco_compra:   data.preco_compra   ?? null,
    category_id:    data.category_id    ?? null,
    identity_code:  data.identity_code  ?? null,
  });
}

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

// Mantida para compatibilidade com migrate.js backfill
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

module.exports = {
  listAllParts,
  findPartById,
  findPartByInternalCode,
  findPartByComposition,
  searchParts,
  createPart,
  updatePart,
  getPartPriceHistory,
  getPartPriceHistoryByClient,
  getPartLastPricePerClient,
};

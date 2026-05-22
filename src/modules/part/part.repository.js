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

function deletePart(id) {
  const hasMovements = db.prepare(
    `SELECT 1 FROM stock_movements WHERE part_id = ? LIMIT 1`
  ).get(id);
  if (hasMovements) {
    const err = new Error("Não é possível excluir esta peça pois ela possui movimentações de estoque vinculadas.");
    err.code = "HAS_DEPENDENCIES";
    throw err;
  }

  db.transaction(() => {
    db.prepare(`UPDATE price_history        SET part_id    = NULL WHERE part_id    = ?`).run(id);
    db.prepare(`UPDATE itens_nota_recebida  SET produto_id = NULL WHERE produto_id = ?`).run(id);
    db.prepare(`DELETE FROM part_client_price_references WHERE part_id = ?`).run(id);
    db.prepare(`DELETE FROM parts WHERE id = ?`).run(id);
  })();
}

// ── part_client_price_references ─────────────────────────────────────────────

function getClientPriceRefs(partId) {
  return db.prepare(`
    SELECT
      c.id            AS client_id,
      c.nome          AS client_nome,
      c.cnpj,
      COALESCE(r.reference_price, ph_last.valor_unitario) AS reference_price,
      CASE WHEN r.id IS NOT NULL THEN 'manual' ELSE 'proposal' END AS source,
      COALESCE(r.updated_at, ph_last.data_proposta)        AS updated_at,
      r.notes,
      ph_last.numero_proposta,
      r.id            AS ref_id
    FROM clients c
    LEFT JOIN part_client_price_references r
      ON r.part_id = ? AND r.client_id = c.id
    LEFT JOIN (
      SELECT client_id, MAX(id) AS max_id
      FROM price_history
      WHERE part_id = ?
      GROUP BY client_id
    ) ph_agg ON ph_agg.client_id = c.id
    LEFT JOIN price_history ph_last ON ph_last.id = ph_agg.max_id
    WHERE r.id IS NOT NULL OR ph_last.id IS NOT NULL
    ORDER BY c.nome ASC
  `).all(partId, partId);
}

function upsertClientPriceRef(partId, clientId, referencePrice, notes, userId) {
  const existing = db.prepare(
    `SELECT id FROM part_client_price_references WHERE part_id = ? AND client_id = ?`
  ).get(partId, clientId);

  if (existing) {
    db.prepare(`
      UPDATE part_client_price_references
      SET reference_price = ?, notes = ?, source = 'manual', updated_by_user_id = ?
      WHERE part_id = ? AND client_id = ?
    `).run(referencePrice, notes ?? null, userId, partId, clientId);
  } else {
    db.prepare(`
      INSERT INTO part_client_price_references
        (part_id, client_id, reference_price, notes, source, created_by_user_id, updated_by_user_id)
      VALUES (?, ?, ?, ?, 'manual', ?, ?)
    `).run(partId, clientId, referencePrice, notes ?? null, userId, userId);
  }

  return db.prepare(
    `SELECT * FROM part_client_price_references WHERE part_id = ? AND client_id = ?`
  ).get(partId, clientId);
}

function getManualPriceRef(partId, clientId) {
  return db.prepare(`
    SELECT reference_price AS valor_unitario, NULL AS numero_proposta, updated_at AS data_proposta
    FROM part_client_price_references
    WHERE part_id = ? AND client_id = ?
    LIMIT 1
  `).get(partId, clientId);
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
  deletePart,
  findPartByInternalCode,
  findPartByComposition,
  searchParts,
  createPart,
  updatePart,
  getPartPriceHistory,
  getPartPriceHistoryByClient,
  getPartLastPricePerClient,
  getClientPriceRefs,
  upsertClientPriceRef,
  getManualPriceRef,
};

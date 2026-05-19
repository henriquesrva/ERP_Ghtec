const db = require("../../db/connection");

function listStockParts() {
  return db.prepare(`
    SELECT
      p.id,
      p.nome,
      p.codigo_interno,
      p.categoria,
      p.ncm,
      p.preco_compra,
      p.category_id,
      COALESCE(p.stock_quantity, 0) AS stock_quantity,
      pc.name AS category_name,
      pc.code AS category_code
    FROM parts p
    LEFT JOIN part_categories pc ON pc.id = p.category_id
    WHERE p.codigo_interno IS NOT NULL
      AND TRIM(p.codigo_interno) != ''
    ORDER BY p.nome ASC
  `).all();
}

function getStockPartById(id) {
  return db.prepare(`
    SELECT
      p.id,
      p.nome,
      p.codigo_interno,
      p.categoria,
      p.marca,
      p.modelo,
      COALESCE(p.stock_quantity, 0) AS stock_quantity
    FROM parts p
    WHERE p.id = ?
  `).get(id);
}

function listMovements({ limit = 100, offset = 0, part_id } = {}) {
  const where = part_id ? `WHERE sm.part_id = ${Number(part_id)}` : '';
  return db.prepare(`
    SELECT
      sm.id,
      sm.part_id,
      p.nome          AS part_nome,
      p.codigo_interno,
      sm.movement_type,
      sm.quantity,
      sm.entry_type,
      sm.proposal_id,
      pr.numero_proposta,
      sm.client_id,
      c.nome          AS client_nome,
      sm.returns_to_stock,
      sm.notes,
      sm.created_by_user_id,
      u.nome          AS created_by_nome,
      sm.created_at
    FROM stock_movements sm
    JOIN parts   p  ON p.id  = sm.part_id
    JOIN users   u  ON u.id  = sm.created_by_user_id
    LEFT JOIN proposals pr ON pr.id = sm.proposal_id
    LEFT JOIN clients   c  ON c.id  = sm.client_id
    ${where}
    ORDER BY sm.id DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
}

function createMovement(data) {
  const insert = db.prepare(`
    INSERT INTO stock_movements (
      part_id, movement_type, quantity, entry_type,
      proposal_id, client_id, returns_to_stock, notes, created_by_user_id
    ) VALUES (
      @part_id, @movement_type, @quantity, @entry_type,
      @proposal_id, @client_id, @returns_to_stock, @notes, @created_by_user_id
    )
  `);

  const updateQty = db.prepare(`
    UPDATE parts
    SET stock_quantity = COALESCE(stock_quantity, 0) + @delta
    WHERE id = @id
  `);

  const txn = db.transaction((d) => {
    const result = insert.run({
      part_id:            d.part_id,
      movement_type:      d.movement_type,
      quantity:           d.quantity,
      entry_type:         d.entry_type         ?? null,
      proposal_id:        d.proposal_id        ?? null,
      client_id:          d.client_id          ?? null,
      returns_to_stock:   d.returns_to_stock   ?? null,
      notes:              d.notes              ?? null,
      created_by_user_id: d.created_by_user_id,
    });

    const delta = d.movement_type === 'entrada' ? d.quantity : -d.quantity;
    updateQty.run({ delta, id: d.part_id });

    return result.lastInsertRowid;
  });

  return txn(data);
}

function getPartCurrentStock(partId) {
  const row = db.prepare(`
    SELECT COALESCE(stock_quantity, 0) AS stock_quantity
    FROM parts WHERE id = ?
  `).get(partId);
  return row ? row.stock_quantity : 0;
}

module.exports = {
  listStockParts,
  getStockPartById,
  listMovements,
  createMovement,
  getPartCurrentStock,
};

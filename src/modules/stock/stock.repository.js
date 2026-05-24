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
  const base = `
    SELECT
      sm.id,
      sm.part_id,
      p.nome          AS part_nome,
      p.codigo_interno,
      sm.movement_type,
      sm.quantity,
      sm.previous_quantity,
      sm.new_quantity,
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
  `;
  if (part_id) {
    return db.prepare(`${base} WHERE sm.part_id = ? ORDER BY sm.id DESC LIMIT ? OFFSET ?`)
      .all(Number(part_id), limit, offset);
  }
  return db.prepare(`${base} ORDER BY sm.id DESC LIMIT ? OFFSET ?`).all(limit, offset);
}

function getPartQtyInProposal(partId, proposalId) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(ph.quantidade), 0) AS total
    FROM price_history ph
    WHERE ph.proposal_id = ? AND ph.part_id = ?
  `).get(proposalId, partId);
  return row ? row.total : 0;
}

function getContractClientSpend() {
  return db.prepare(`
    SELECT
      c.id   AS client_id,
      c.nome AS client_nome,
      COALESCE(SUM(
        CASE WHEN p.preco_compra IS NOT NULL
          THEN sm.quantity * p.preco_compra
          ELSE NULL END
      ), 0) AS total_spend,
      SUM(CASE WHEN p.preco_compra IS NULL AND sm.id IS NOT NULL THEN 1 ELSE 0 END) AS items_without_price,
      COUNT(sm.id) AS total_movements
    FROM clients c
    LEFT JOIN stock_movements sm ON sm.client_id = c.id AND sm.movement_type = 'saida'
    LEFT JOIN parts p ON p.id = sm.part_id
    WHERE c.has_parts_contract = 1
    GROUP BY c.id, c.nome
    ORDER BY total_spend DESC
  `).all();
}

function createMovement(data) {
  const insert = db.prepare(`
    INSERT INTO stock_movements (
      part_id, movement_type, quantity, entry_type,
      proposal_id, client_id, returns_to_stock, notes, created_by_user_id,
      previous_quantity, new_quantity
    ) VALUES (
      @part_id, @movement_type, @quantity, @entry_type,
      @proposal_id, @client_id, @returns_to_stock, @notes, @created_by_user_id,
      @previous_quantity, @new_quantity
    )
  `);

  const getQty = db.prepare(`SELECT COALESCE(stock_quantity, 0) AS qty FROM parts WHERE id = ?`);

  const updateQty = db.prepare(`
    UPDATE parts
    SET stock_quantity = COALESCE(stock_quantity, 0) + @delta
    WHERE id = @id
  `);

  const txn = db.transaction((d) => {
    const prevRow = getQty.get(d.part_id);
    const previous_quantity = prevRow ? prevRow.qty : 0;
    const delta = d.movement_type === 'entrada' ? d.quantity : -d.quantity;
    const new_quantity = previous_quantity + delta;

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
      previous_quantity,
      new_quantity,
    });

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

function getMovementsByDate({ days = 60 } = {}) {
  const n = Math.max(1, Math.min(365, Number(days) || 60));
  return db.prepare(`
    SELECT
      DATE(created_at)   AS date,
      movement_type,
      CAST(SUM(quantity) AS INTEGER) AS total_qty
    FROM stock_movements
    WHERE movement_type IN ('entrada', 'saida')
      AND created_at >= DATE('now', '-${n} days')
    GROUP BY DATE(created_at), movement_type
    ORDER BY DATE(created_at) ASC
  `).all();
}

function createInventoryCount(adjustments, userId) {
  const getQty     = db.prepare(`SELECT COALESCE(stock_quantity, 0) AS qty FROM parts WHERE id = ?`);
  const insertMov  = db.prepare(`
    INSERT INTO stock_movements (
      part_id, movement_type, quantity,
      previous_quantity, new_quantity,
      notes, created_by_user_id
    ) VALUES (
      @part_id, 'contagem', @quantity,
      @previous_quantity, @new_quantity,
      @notes, @created_by_user_id
    )
  `);
  const updateQty  = db.prepare(`UPDATE parts SET stock_quantity = ? WHERE id = ?`);

  const txn = db.transaction((items) => {
    const ids = [];
    for (const item of items) {
      const prevRow = getQty.get(item.part_id);
      const previous_quantity = prevRow ? prevRow.qty : 0;
      const new_quantity = item.new_quantity;
      if (new_quantity === previous_quantity) continue;
      const id = insertMov.run({
        part_id:            item.part_id,
        quantity:           Math.abs(new_quantity - previous_quantity),
        previous_quantity,
        new_quantity,
        notes:              item.notes || null,
        created_by_user_id: userId,
      }).lastInsertRowid;
      updateQty.run(new_quantity, item.part_id);
      ids.push(id);
    }
    return ids;
  });

  return txn(adjustments);
}

module.exports = {
  listStockParts,
  getStockPartById,
  listMovements,
  createMovement,
  getPartCurrentStock,
  getPartQtyInProposal,
  getContractClientSpend,
  getMovementsByDate,
  createInventoryCount,
};

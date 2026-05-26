const prisma = require("../../db/prisma");

// Inventory count movements are stored as 'entrada'/'saida' with entry_type='contagem'
// (PostgreSQL MovementType enum only has entrada/saida).
// The mapper restores movement_type='contagem' in the response to preserve the API contract.
function mapStockMovement(sm) {
  if (!sm) return null;
  const movement_type = sm.entryType === "contagem" ? "contagem" : sm.movementType;
  return {
    id:                  sm.id,
    part_id:             sm.partId,
    part_nome:           sm.part?.nome         ?? null,
    codigo_interno:      sm.part?.codigoInterno ?? null,
    movement_type,
    quantity:            sm.quantity,
    previous_quantity:   sm.previousQuantity,
    new_quantity:        sm.newQuantity,
    entry_type:          sm.entryType,
    proposal_id:         sm.proposalId,
    numero_proposta:     sm.proposal?.numeroProposta ?? null,
    client_id:           sm.clientId,
    client_nome:         sm.client?.nome  ?? null,
    returns_to_stock:    sm.returnsToStock,
    notes:               sm.notes,
    created_by_user_id:  sm.createdByUserId,
    created_by_nome:     sm.createdBy?.nome ?? null,
    created_at:          sm.createdAt,
  };
}

async function listStockParts() {
  const rows = await prisma.part.findMany({
    where:   { codigoInterno: { not: null } },
    include: { category: { select: { name: true, code: true } } },
    orderBy: { nome: "asc" },
  });
  return rows
    .filter(p => p.codigoInterno && p.codigoInterno.trim() !== "")
    .map(p => ({
      id:             p.id,
      nome:           p.nome,
      codigo_interno: p.codigoInterno,
      categoria:      null,
      ncm:            p.ncm,
      preco_compra:   p.precoCompra !== null && p.precoCompra !== undefined
                        ? Number(p.precoCompra) : null,
      category_id:    p.categoryId,
      stock_quantity: p.stockQuantity ?? 0,
      category_name:  p.category?.name ?? null,
      category_code:  p.category?.code ?? null,
    }));
}

async function getStockPartById(id) {
  const p = await prisma.part.findUnique({
    where:  { id },
    select: { id: true, nome: true, codigoInterno: true, marca: true, modelo: true, stockQuantity: true },
  });
  if (!p) return null;
  return {
    id:             p.id,
    nome:           p.nome,
    codigo_interno: p.codigoInterno,
    marca:          p.marca,
    modelo:         p.modelo,
    stock_quantity: p.stockQuantity ?? 0,
  };
}

async function listMovements({ limit = 100, offset = 0, part_id } = {}) {
  const rows = await prisma.stockMovement.findMany({
    where:   part_id ? { partId: Number(part_id) } : undefined,
    include: {
      part:      { select: { nome: true, codigoInterno: true } },
      proposal:  { select: { numeroProposta: true } },
      client:    { select: { nome: true } },
      createdBy: { select: { nome: true } },
    },
    orderBy: { id: "desc" },
    take:    limit,
    skip:    offset,
  });
  return rows.map(mapStockMovement);
}

async function getPartQtyInProposal(partId, proposalId) {
  const result = await prisma.priceHistory.aggregate({
    where: { proposalId: Number(proposalId), partId: Number(partId) },
    _sum:  { quantidade: true },
  });
  return result._sum.quantidade ?? 0;
}

async function getContractClientSpend() {
  const rows = await prisma.$queryRaw`
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
    WHERE c.has_parts_contract = true
    GROUP BY c.id, c.nome
    ORDER BY total_spend DESC
  `;
  return rows.map(row => ({
    client_id:           row.client_id,
    client_nome:         row.client_nome,
    total_spend:         Number(row.total_spend),
    items_without_price: Number(row.items_without_price),
    total_movements:     Number(row.total_movements),
  }));
}

async function createMovement(data) {
  return prisma.$transaction(async (tx) => {
    const part = await tx.part.findUnique({
      where:  { id: data.part_id },
      select: { stockQuantity: true },
    });
    const previous_quantity = part ? (part.stockQuantity ?? 0) : 0;
    const delta             = data.movement_type === "entrada" ? data.quantity : -data.quantity;
    const new_quantity      = previous_quantity + delta;

    const movement = await tx.stockMovement.create({
      data: {
        partId:           data.part_id,
        movementType:     data.movement_type,
        quantity:         data.quantity,
        entryType:        data.entry_type         ?? null,
        proposalId:       data.proposal_id        ?? null,
        clientId:         data.client_id          ?? null,
        returnsToStock:   data.returns_to_stock != null ? Boolean(data.returns_to_stock) : null,
        notes:            data.notes              ?? null,
        createdByUserId:  data.created_by_user_id,
        previousQuantity: previous_quantity,
        newQuantity:      new_quantity,
      },
    });

    await tx.part.update({
      where: { id: data.part_id },
      data:  { stockQuantity: { increment: delta } },
    });

    return movement.id;
  });
}

async function getPartCurrentStock(partId) {
  const p = await prisma.part.findUnique({
    where:  { id: partId },
    select: { stockQuantity: true },
  });
  return p ? (p.stockQuantity ?? 0) : 0;
}

async function getMovementsByDate({ days = 60 } = {}) {
  const n = Math.max(1, Math.min(365, Number(days) || 60));
  const since = new Date();
  since.setDate(since.getDate() - n);

  const rows = await prisma.$queryRaw`
    SELECT
      DATE(created_at)::text       AS date,
      movement_type::text          AS movement_type,
      CAST(SUM(quantity) AS INTEGER) AS total_qty
    FROM stock_movements
    WHERE movement_type IN ('entrada', 'saida')
      AND (entry_type IS NULL OR entry_type != 'contagem')
      AND created_at >= ${since}
    GROUP BY DATE(created_at), movement_type
    ORDER BY DATE(created_at) ASC
  `;
  return rows.map(row => ({
    date:          row.date,
    movement_type: row.movement_type,
    total_qty:     Number(row.total_qty),
  }));
}

async function createInventoryCount(adjustments, userId) {
  return prisma.$transaction(async (tx) => {
    const ids = [];
    for (const item of adjustments) {
      const part = await tx.part.findUnique({
        where:  { id: item.part_id },
        select: { stockQuantity: true },
      });
      const previous_quantity = part ? (part.stockQuantity ?? 0) : 0;
      const new_quantity      = item.new_quantity;
      if (new_quantity === previous_quantity) continue;

      const delta        = new_quantity - previous_quantity;
      const movementType = delta > 0 ? "entrada" : "saida";

      const created = await tx.stockMovement.create({
        data: {
          partId:           item.part_id,
          movementType,
          quantity:         Math.abs(delta),
          entryType:        "contagem",
          previousQuantity: previous_quantity,
          newQuantity:      new_quantity,
          notes:            item.notes ?? null,
          createdByUserId:  userId,
        },
      });

      await tx.part.update({
        where: { id: item.part_id },
        data:  { stockQuantity: new_quantity },
      });

      ids.push(created.id);
    }
    return ids;
  });
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

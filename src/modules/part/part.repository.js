const prisma = require("../../db/prisma");
const db = require("../../db/connection");

function mapPart(p) {
  if (!p) return null;
  return {
    id:             p.id,
    nome:           p.nome,
    descricao:      p.descricao,
    marca:          p.marca,
    modelo:         p.modelo,
    categoria:      null, // campo legado — não mais usado
    category_id:    p.categoryId,
    identity_code:  p.identityCode,
    codigo_interno: p.codigoInterno,
    ncm:            p.ncm,
    preco_compra:   p.precoCompra !== null && p.precoCompra !== undefined
                      ? Number(p.precoCompra) : null,
    stock_quantity: p.stockQuantity,
    observacoes:    p.observacoes,
    category_name:  p.category?.name ?? null,
    category_code:  p.category?.code ?? null,
    created_at:     p.createdAt,
    updated_at:     p.updatedAt,
  };
}

function mapPartRef(r) {
  if (!r) return null;
  return {
    id:                  r.id,
    part_id:             r.partId,
    client_id:           r.clientId,
    reference_price:     r.referencePrice !== null && r.referencePrice !== undefined
                           ? Number(r.referencePrice) : null,
    source:              r.source,
    notes:               r.notes,
    created_by_user_id:  r.createdByUserId,
    updated_by_user_id:  r.updatedByUserId,
    created_at:          r.createdAt,
    updated_at:          r.updatedAt,
  };
}

// ── CRUD Prisma/PostgreSQL ────────────────────────────────────────────────────

async function listAllParts() {
  const rows = await prisma.part.findMany({
    include: { category: { select: { name: true, code: true } } },
    orderBy: { nome: "asc" },
  });
  return rows.map(mapPart);
}

async function findPartById(id) {
  const p = await prisma.part.findUnique({
    where: { id },
    include: { category: { select: { name: true, code: true } } },
  });
  return mapPart(p);
}

async function findPartByInternalCode(codigo) {
  if (!codigo) return null;
  const p = await prisma.part.findUnique({
    where: { codigoInterno: codigo },
    select: { id: true },
  });
  return p || null;
}

async function searchParts(q) {
  const rows = await prisma.part.findMany({
    where: {
      OR: [
        { nome:          { contains: q, mode: "insensitive" } },
        { codigoInterno: { contains: q, mode: "insensitive" } },
        { identityCode:  { contains: q, mode: "insensitive" } },
      ],
    },
    include: { category: { select: { name: true, code: true } } },
    orderBy: { nome: "asc" },
    take: 10,
  });
  return rows.map(mapPart);
}

async function createPart(data) {
  const row = await prisma.part.create({
    data: {
      nome:          data.nome           ?? null,
      descricao:     data.descricao      ?? null,
      marca:         data.marca          ?? null,
      modelo:        data.modelo         ?? null,
      ncm:           data.ncm            ?? null,
      codigoInterno: data.codigo_interno ?? null,
      observacoes:   data.observacoes    ?? null,
      precoCompra:   data.preco_compra   ?? 0,
      categoryId:    data.category_id    != null ? Number(data.category_id) : null,
      identityCode:  data.identity_code  ?? null,
    },
  });
  return row.id;
}

async function updatePart(id, data) {
  await prisma.part.update({
    where: { id },
    data: {
      nome:          data.nome           ?? null,
      descricao:     data.descricao      ?? null,
      marca:         data.marca          ?? null,
      modelo:        data.modelo         ?? null,
      ncm:           data.ncm            ?? null,
      codigoInterno: data.codigo_interno ?? null,
      observacoes:   data.observacoes    ?? null,
      precoCompra:   data.preco_compra   ?? 0,
      categoryId:    data.category_id    != null ? Number(data.category_id) : null,
      identityCode:  data.identity_code  ?? null,
    },
  });
}

async function deletePart(id) {
  // stock_movements ainda em SQLite — verificação de dependência best-effort
  // Nota: IDs de parts em SQLite e PostgreSQL podem divergir durante fase híbrida
  const hasMovements = db.prepare(
    "SELECT 1 FROM stock_movements WHERE part_id = ? LIMIT 1"
  ).get(id);
  if (hasMovements) {
    const err = new Error(
      "Não é possível excluir esta peça pois ela possui movimentações de estoque vinculadas."
    );
    err.code = "HAS_DEPENDENCIES";
    throw err;
  }

  // Nulifica referências em tabelas SQLite ainda não migradas
  db.prepare("UPDATE price_history SET part_id = NULL WHERE part_id = ?").run(id);
  db.prepare("UPDATE itens_nota_recebida SET produto_id = NULL WHERE produto_id = ?").run(id);

  // Remove referências de preço e a peça do PostgreSQL
  await prisma.partClientPriceRef.deleteMany({ where: { partId: id } });
  await prisma.part.delete({ where: { id } });
}

// Usado por part.service.js para resolver category.code ao gerar codigo_interno
async function findCategoryById(id) {
  const cat = await prisma.partCategory.findUnique({
    where: { id },
    select: { id: true, name: true, code: true },
  });
  return cat || null;
}

// ── Bridges SQLite — price_history ainda não migrado ─────────────────────────
// Remover quando proposal + price_history migrarem para Prisma.

function getPartPriceHistory(partId) {
  return db.prepare(`
    SELECT c.nome AS cliente_nome, ph.valor_unitario, ph.numero_proposta,
           ph.data_proposta, ph.quantidade
    FROM price_history ph
    JOIN clients c ON c.id = ph.client_id
    WHERE ph.part_id = ?
    ORDER BY ph.id DESC
  `).all(partId);
}

function getPartPriceHistoryByClient(partId, clientId) {
  return db.prepare(`
    SELECT c.nome AS cliente_nome, ph.valor_unitario, ph.numero_proposta,
           ph.data_proposta, ph.quantidade
    FROM price_history ph
    JOIN clients c ON c.id = ph.client_id
    WHERE ph.part_id = ? AND ph.client_id = ?
    ORDER BY ph.id DESC
  `).all(partId, clientId);
}

function getPartLastPricePerClient(partId) {
  return db.prepare(`
    SELECT c.id AS client_id, c.nome AS cliente_nome,
           ph.valor_unitario, ph.data_proposta, ph.numero_proposta
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

// ── part_client_price_references — Prisma/PostgreSQL + bridge price_history ──
// Manual refs vêm do PostgreSQL (autoritativo após migração).
// Histórico de propostas vem do SQLite (bridge — price_history não migrado).
// Clientes sem ref manual mas com histórico SQLite aparecem via bridge.
// Remover bridge de price_history quando proposal migrar para Prisma.

async function getClientPriceRefs(partId) {
  // Refs manuais do PostgreSQL
  const refs = await prisma.partClientPriceRef.findMany({
    where: { partId },
    include: { client: { select: { id: true, nome: true, cnpj: true } } },
    orderBy: { client: { nome: "asc" } },
  });

  // Último preço por cliente do SQLite (price_history bridge)
  const histRows = db.prepare(`
    SELECT ph.client_id, ph.valor_unitario, ph.data_proposta, ph.numero_proposta
    FROM price_history ph
    WHERE ph.part_id = ?
      AND ph.id = (
        SELECT MAX(id) FROM price_history WHERE part_id = ? AND client_id = ph.client_id
      )
  `).all(partId, partId);

  const histByClientId = {};
  for (const h of histRows) histByClientId[h.client_id] = h;

  const refClientIds = new Set(refs.map(r => r.clientId));

  const result = refs.map(r => ({
    client_id:       r.clientId,
    client_nome:     r.client.nome,
    cnpj:            r.client.cnpj,
    reference_price: Number(r.referencePrice),
    source:          "manual",
    updated_at:      r.updatedAt,
    notes:           r.notes,
    numero_proposta: histByClientId[r.clientId]?.numero_proposta ?? null,
    ref_id:          r.id,
  }));

  // Clientes apenas no histórico SQLite (sem ref manual no PostgreSQL)
  for (const [clientId, hist] of Object.entries(histByClientId)) {
    const cid = Number(clientId);
    if (refClientIds.has(cid)) continue;
    const client = db.prepare("SELECT nome, cnpj FROM clients WHERE id = ?").get(cid);
    if (!client) continue;
    result.push({
      client_id:       cid,
      client_nome:     client.nome,
      cnpj:            client.cnpj,
      reference_price: hist.valor_unitario,
      source:          "proposal",
      updated_at:      hist.data_proposta,
      notes:           null,
      numero_proposta: hist.numero_proposta,
      ref_id:          null,
    });
  }

  result.sort((a, b) => (a.client_nome || "").localeCompare(b.client_nome || "", "pt-BR"));
  return result;
}

async function upsertClientPriceRef(partId, clientId, referencePrice, notes, userId) {
  const result = await prisma.partClientPriceRef.upsert({
    where: { partId_clientId: { partId, clientId } },
    update: {
      referencePrice,
      notes:          notes   ?? null,
      source:         "manual",
      updatedByUserId: userId ?? null,
    },
    create: {
      partId,
      clientId,
      referencePrice,
      notes:           notes   ?? null,
      source:          "manual",
      createdByUserId: userId  ?? null,
      updatedByUserId: userId  ?? null,
    },
  });
  return mapPartRef(result);
}

// Retorna preço de referência manual para um par (part, client).
// Nota: após migração, novos registros estão em PostgreSQL. proposal.repository.js
// ainda consulta SQLite diretamente em getLastItemPriceForClient — bridge separada.
async function getManualPriceRef(partId, clientId) {
  const r = await prisma.partClientPriceRef.findUnique({
    where: { partId_clientId: { partId, clientId } },
    select: { referencePrice: true, updatedAt: true },
  });
  if (!r) return null;
  return {
    valor_unitario:  Number(r.referencePrice),
    numero_proposta: null,
    data_proposta:   r.updatedAt,
  };
}

// ── Bridge síncrona para proposal flow (proposal.service.js) ─────────────────
// findPartByComposition permanece síncrona para manter:
//   1. proposal.service.js sem await no loop de auto-registro (proposal ainda em SQLite)
//   2. compatibilidade com migrate.js backfill
// Remover quando proposal migrar para Prisma.

function findPartByComposition(nome, marca, modelo) {
  return db.prepare(`
    SELECT * FROM parts
    WHERE nome  IS ?
      AND marca  IS ?
      AND modelo IS ?
    LIMIT 1
  `).get(nome || null, marca || null, modelo || null);
}

module.exports = {
  listAllParts,
  findPartById,
  findPartByInternalCode,
  searchParts,
  createPart,
  updatePart,
  deletePart,
  findCategoryById,
  getPartPriceHistory,
  getPartPriceHistoryByClient,
  getPartLastPricePerClient,
  getClientPriceRefs,
  upsertClientPriceRef,
  getManualPriceRef,
  findPartByComposition,
};

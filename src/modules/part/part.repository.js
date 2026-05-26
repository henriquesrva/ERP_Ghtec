const prisma = require("../../db/prisma");

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
  const movCount = await prisma.stockMovement.count({ where: { partId: id } });
  if (movCount > 0) {
    const err = new Error(
      "Não é possível excluir esta peça pois ela possui movimentações de estoque vinculadas."
    );
    err.code = "HAS_DEPENDENCIES";
    throw err;
  }

  // nulificar produto_id nos itens de nota que referenciam esta peça
  await prisma.itemNotaRecebida.updateMany({ where: { produtoId: id }, data: { produtoId: null } });

  // price_history em PostgreSQL — nulificar FK antes de deletar a peça
  await prisma.priceHistory.updateMany({ where: { partId: id }, data: { partId: null } });

  await prisma.partClientPriceRef.deleteMany({ where: { partId: id } });
  await prisma.part.delete({ where: { id } });
}

async function findCategoryById(id) {
  const cat = await prisma.partCategory.findUnique({
    where: { id },
    select: { id: true, name: true, code: true },
  });
  return cat || null;
}

// ── Histórico de preços — Prisma/PostgreSQL ───────────────────────────────────

async function getPartPriceHistory(partId) {
  const rows = await prisma.priceHistory.findMany({
    where:   { partId },
    include: { client: { select: { nome: true } } },
    orderBy: { id: "desc" },
  });
  return rows.map(r => ({
    cliente_nome:    r.client.nome,
    valor_unitario:  Number(r.valorUnitario),
    numero_proposta: r.numeroProposta,
    data_proposta:   r.dataProposta,
    quantidade:      r.quantidade,
  }));
}

async function getPartPriceHistoryByClient(partId, clientId) {
  const rows = await prisma.priceHistory.findMany({
    where:   { partId, clientId },
    include: { client: { select: { nome: true } } },
    orderBy: { id: "desc" },
  });
  return rows.map(r => ({
    cliente_nome:    r.client.nome,
    valor_unitario:  Number(r.valorUnitario),
    numero_proposta: r.numeroProposta,
    data_proposta:   r.dataProposta,
    quantidade:      r.quantidade,
  }));
}

async function getPartLastPricePerClient(partId) {
  const rows = await prisma.priceHistory.findMany({
    where:   { partId },
    include: { client: { select: { id: true, nome: true } } },
    orderBy: { id: "desc" },
  });

  // Manter apenas o registro mais recente por cliente
  const seen = new Set();
  const result = [];
  for (const r of rows) {
    if (seen.has(r.clientId)) continue;
    seen.add(r.clientId);
    result.push({
      client_id:       r.clientId,
      cliente_nome:    r.client.nome,
      valor_unitario:  Number(r.valorUnitario),
      data_proposta:   r.dataProposta,
      numero_proposta: r.numeroProposta,
    });
  }

  result.sort((a, b) => (a.cliente_nome || "").localeCompare(b.cliente_nome || "", "pt-BR"));
  return result;
}

// ── part_client_price_references — Prisma/PostgreSQL ─────────────────────────

async function getClientPriceRefs(partId) {
  const [refs, histRows] = await Promise.all([
    prisma.partClientPriceRef.findMany({
      where:   { partId },
      include: { client: { select: { id: true, nome: true, cnpj: true } } },
      orderBy: { client: { nome: "asc" } },
    }),
    prisma.priceHistory.findMany({
      where:   { partId },
      include: { client: { select: { id: true, nome: true, cnpj: true } } },
      orderBy: { id: "desc" },
    }),
  ]);

  // Último preço por cliente do histórico
  const histByClientId = {};
  for (const h of histRows) {
    if (!histByClientId[h.clientId]) histByClientId[h.clientId] = h;
  }

  const refClientIds = new Set(refs.map(r => r.clientId));

  const result = refs.map(r => ({
    client_id:       r.clientId,
    client_nome:     r.client.nome,
    cnpj:            r.client.cnpj,
    reference_price: Number(r.referencePrice),
    source:          "manual",
    updated_at:      r.updatedAt,
    notes:           r.notes,
    numero_proposta: histByClientId[r.clientId]?.numeroProposta ?? null,
    ref_id:          r.id,
  }));

  // Clientes apenas no histórico (sem ref manual)
  for (const [clientId, hist] of Object.entries(histByClientId)) {
    const cid = Number(clientId);
    if (refClientIds.has(cid)) continue;
    result.push({
      client_id:       cid,
      client_nome:     hist.client.nome,
      cnpj:            hist.client.cnpj,
      reference_price: Number(hist.valorUnitario),
      source:          "proposal",
      updated_at:      hist.dataProposta,
      notes:           null,
      numero_proposta: hist.numeroProposta,
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
      notes:           notes   ?? null,
      source:          "manual",
      updatedByUserId: userId  ?? null,
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

async function findPartByComposition(nome, marca, modelo) {
  return prisma.part.findFirst({
    where: {
      nome:   nome   || null,
      marca:  marca  || null,
      modelo: modelo || null,
    },
  });
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

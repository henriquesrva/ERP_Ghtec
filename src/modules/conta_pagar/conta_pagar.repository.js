const prisma = require("../../db/prisma");

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const CONTA_INCLUDE = {
  fornecedor:       { select: { razaoSocial: true } },
  categoriaDespesa: { select: { nome: true } },
  notaRecebida:     { select: { numeroNota: true, serie: true } },
};

const CONTA_INCLUDE_FULL = {
  ...CONTA_INCLUDE,
  paidBy:      { select: { nome: true } },
  cancelledBy: { select: { nome: true } },
  createdBy:   { select: { nome: true } },
};

function mapContaPagar(cp) {
  if (!cp) return null;
  const today = startOfToday();
  return {
    id:                    cp.id,
    fornecedor_id:         cp.fornecedorId,
    nota_recebida_id:      cp.notaRecebidaId,
    categoria_despesa_id:  cp.categoriaDespesaId,
    descricao:             cp.descricao,
    valor:                 Number(cp.valor),
    data_emissao:          cp.dataEmissao,
    data_vencimento:       cp.dataVencimento,
    forma_pagamento:       cp.formaPagamento,
    status:                cp.status,
    data_pagamento:        cp.dataPagamento,
    valor_pago:            cp.valorPago != null ? Number(cp.valorPago) : null,
    comprovante_pagamento: cp.comprovantePagamento,
    paid_by:               cp.paidById,
    cancelled_by:          cp.cancelledById,
    cancelled_at:          cp.cancelledAt,
    cancel_reason:         cp.cancelReason,
    observacoes:           cp.observacoes,
    parcela_numero:        cp.parcelaNumero,
    parcela_total:         cp.parcelaTotal,
    created_by:            cp.createdById,
    created_at:            cp.createdAt,
    updated_at:            cp.updatedAt,
    atrasado:              cp.status === "em_aberto" && cp.dataVencimento < today ? 1 : 0,
    fornecedor_nome:       cp.fornecedor?.razaoSocial   ?? null,
    categoria_nome:        cp.categoriaDespesa?.nome    ?? null,
    numero_nota:           cp.notaRecebida?.numeroNota  ?? null,
    serie:                 cp.notaRecebida?.serie       ?? null,
    pago_por_nome:         cp.paidBy?.nome              ?? null,
    cancelado_por_nome:    cp.cancelledBy?.nome         ?? null,
    criado_por_nome:       cp.createdBy?.nome           ?? null,
  };
}

async function listContasPagar({ fornecedor_id, status, categoria_id, forma_pagamento, limit = 100, offset = 0 } = {}) {
  const where = {};
  const today = startOfToday();

  if (fornecedor_id) where.fornecedorId = Number(fornecedor_id);
  if (status === "atrasado") {
    where.status         = "em_aberto";
    where.dataVencimento = { lt: today };
  } else if (status) {
    where.status = status;
  }
  if (categoria_id)    where.categoriaDespesaId = Number(categoria_id);
  if (forma_pagamento) where.formaPagamento      = forma_pagamento;

  const rows = await prisma.contaPagar.findMany({
    where,
    include: CONTA_INCLUDE,
    orderBy: { dataVencimento: "asc" },
    take:    limit,
    skip:    offset,
  });

  return rows.map(mapContaPagar);
}

async function findContaById(id) {
  const cp = await prisma.contaPagar.findUnique({
    where:   { id },
    include: CONTA_INCLUDE_FULL,
  });
  return mapContaPagar(cp);
}

async function createConta(data) {
  const cp = await prisma.contaPagar.create({
    data: {
      fornecedorId:       data.fornecedor_id,
      notaRecebidaId:     data.nota_recebida_id     ?? null,
      categoriaDespesaId: data.categoria_despesa_id ?? null,
      descricao:          data.descricao,
      valor:              data.valor,
      dataEmissao:        new Date(data.data_emissao),
      dataVencimento:     new Date(data.data_vencimento),
      formaPagamento:     data.forma_pagamento       ?? null,
      status:             "em_aberto",
      parcelaNumero:      data.parcela_numero        ?? null,
      parcelaTotal:       data.parcela_total         ?? null,
      observacoes:        data.observacoes           ?? null,
      createdById:        data.created_by,
    },
  });
  return cp.id;
}

async function updateConta(id, data) {
  await prisma.contaPagar.update({
    where: { id },
    data: {
      fornecedorId:       data.fornecedor_id,
      categoriaDespesaId: data.categoria_despesa_id ?? null,
      descricao:          data.descricao,
      valor:              data.valor,
      dataEmissao:        new Date(data.data_emissao),
      dataVencimento:     new Date(data.data_vencimento),
      formaPagamento:     data.forma_pagamento       ?? null,
      observacoes:        data.observacoes           ?? null,
    },
  });
}

async function baixarConta(id, baixaData) {
  const updateData = {
    status:               "pago",
    dataPagamento:        new Date(baixaData.data_pagamento),
    valorPago:            baixaData.valor_pago,
    formaPagamento:       baixaData.forma_pagamento        ?? null,
    comprovantePagamento: baixaData.comprovante_pagamento  ?? null,
    paidById:             baixaData.paid_by,
  };
  if (baixaData.observacoes != null) updateData.observacoes = baixaData.observacoes;
  await prisma.contaPagar.update({ where: { id }, data: updateData });
}

async function cancelarConta(id, cancelData) {
  await prisma.contaPagar.update({
    where: { id },
    data: {
      status:       "cancelado",
      cancelledById: cancelData.cancelled_by,
      cancelledAt:  new Date(),
      cancelReason: cancelData.cancel_reason ?? null,
    },
  });
}

async function getResumoFinanceiro() {
  const today    = startOfToday();
  const inicioMes = new Date(today.getFullYear(), today.getMonth(), 1);
  const fimMes    = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
  const seteDias  = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    aggAberto,
    aggAtrasado,
    aggPagoMes,
    proxVencimentosRaw,
    agg7dias,
    porCatRaw,
  ] = await Promise.all([
    prisma.contaPagar.aggregate({
      _sum: { valor: true },
      where: { status: "em_aberto", dataVencimento: { gte: today } },
    }),
    prisma.contaPagar.aggregate({
      _sum: { valor: true },
      where: { status: "em_aberto", dataVencimento: { lt: today } },
    }),
    prisma.contaPagar.aggregate({
      _sum: { valorPago: true },
      where: { status: "pago", dataPagamento: { gte: inicioMes, lte: fimMes } },
    }),
    prisma.contaPagar.findMany({
      where:   { status: "em_aberto" },
      include: { fornecedor: { select: { razaoSocial: true } } },
      orderBy: { dataVencimento: "asc" },
      take:    10,
    }),
    prisma.contaPagar.aggregate({
      _count: { id: true },
      _sum:   { valor: true },
      where:  { status: "em_aberto", dataVencimento: { gte: today, lte: seteDias } },
    }),
    prisma.contaPagar.groupBy({
      by:      ["categoriaDespesaId"],
      _count:  { id: true },
      _sum:    { valor: true },
      where:   { status: { in: ["em_aberto", "pago"] } },
      orderBy: { _sum: { valor: "desc" } },
    }),
  ]);

  const totais = {
    total_aberto:   Number(aggAberto._sum.valor       ?? 0),
    total_atrasado: Number(aggAtrasado._sum.valor     ?? 0),
    total_pago_mes: Number(aggPagoMes._sum.valorPago  ?? 0),
  };

  const proxVencimentos = proxVencimentosRaw.map(cp => ({
    id:              cp.id,
    descricao:       cp.descricao,
    valor:           Number(cp.valor),
    data_vencimento: cp.dataVencimento,
    fornecedor_nome: cp.fornecedor.razaoSocial,
    atrasado:        cp.dataVencimento < today ? 1 : 0,
  }));

  const vencendo7dias = {
    n:     agg7dias._count.id,
    total: Number(agg7dias._sum.valor ?? 0),
  };

  const catIds = porCatRaw.map(r => r.categoriaDespesaId).filter(Boolean);
  const cats   = catIds.length
    ? await prisma.categoriaDespesa.findMany({ where: { id: { in: catIds } }, select: { id: true, nome: true } })
    : [];
  const catMap = Object.fromEntries(cats.map(c => [c.id, c.nome]));

  const porCategoria = porCatRaw.map(r => ({
    categoria: r.categoriaDespesaId ? (catMap[r.categoriaDespesaId] ?? "Sem categoria") : "Sem categoria",
    qtd:       r._count.id,
    total:     Number(r._sum.valor ?? 0),
  }));

  return { totais, proxVencimentos, vencendo7dias, porCategoria };
}

module.exports = {
  listContasPagar,
  findContaById,
  createConta,
  updateConta,
  baixarConta,
  cancelarConta,
  getResumoFinanceiro,
};

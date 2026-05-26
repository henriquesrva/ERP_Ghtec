const prisma = require("../../db/prisma");
const db     = require("../../db/connection"); // bridge: contas_pagar ainda em SQLite

// ── Helpers de coerção ────────────────────────────────────────────────────────

function dec(v) { return v === "" || v == null ? null : Number(v); }
function str(v) { return v === "" || v == null ? null : String(v); }
function int(v) { return v === "" || v == null ? null : parseInt(v, 10); }

// ── Mappers camelCase → snake_case ────────────────────────────────────────────

function mapNotaRecebida(nr) {
  if (!nr) return null;
  return {
    id:                   nr.id,
    fornecedor_id:        nr.fornecedorId,
    numero_nota:          nr.numeroNota,
    serie:                nr.serie,
    chave_acesso:         nr.chaveAcesso,
    tipo_nota:            nr.tipoNota,
    data_emissao:         nr.dataEmissao,
    data_entrada:         nr.dataEntrada,
    valor_total:          dec(nr.valorTotal),
    descricao:            nr.descricao,
    categoria_despesa_id: nr.categoriaDespesaId,
    arquivo_pdf:          nr.arquivoPdf,
    arquivo_xml:          nr.arquivoXml,
    status:               nr.status,
    observacoes:          nr.observacoes,
    natureza_operacao:    nr.naturezaOperacao,
    cfop_principal:       nr.cfopPrincipal,
    modalidade_frete:     nr.modalidadeFrete,
    valor_frete:          dec(nr.valorFrete),
    valor_seguro:         dec(nr.valorSeguro),
    valor_desconto:       dec(nr.valorDesconto),
    valor_outras_despesas: dec(nr.valorOutrasDespesas),
    valor_bc_icms:        dec(nr.valorBcIcms),
    valor_icms:           dec(nr.valorIcms),
    valor_ipi:            dec(nr.valorIpi),
    valor_pis:            dec(nr.valorPis),
    valor_cofins:         dec(nr.valorCofins),
    valor_iss:            dec(nr.valorIss),
    numero_protocolo:     nr.numeroProtocolo,
    data_autorizacao:     nr.dataAutorizacao,
    created_by:           nr.createdById,
    created_at:           nr.createdAt,
    updated_at:           nr.updatedAt,
    // Relações incluídas
    fornecedor_nome:      nr.fornecedor?.razaoSocial   ?? null,
    fornecedor_cnpj:      nr.fornecedor?.cnpj          ?? null,
    categoria_nome:       nr.categoriaDespesa?.nome    ?? null,
    criado_por_nome:      nr.createdBy?.nome           ?? null,
  };
}

function mapItemNotaRecebida(item) {
  if (!item) return null;
  return {
    id:                      item.id,
    nota_recebida_id:        item.notaRecebidaId,
    produto_id:              item.produtoId,
    numero_item:             item.numeroItem,
    codigo_produto:          item.codigoProduto,
    descricao:               item.descricao,
    ncm:                     item.ncm,
    cfop:                    item.cfop,
    unidade:                 item.unidade,
    quantidade:              dec(item.quantidade),
    valor_unitario:          dec(item.valorUnitario),
    valor_total:             dec(item.valorTotal),
    valor_desconto:          dec(item.valorDesconto),
    origem_mercadoria:       item.origemMercadoria,
    cst_icms:                item.cstIcms,
    csosn:                   item.csosn,
    modalidade_bc_icms:      item.modalidadeBcIcms,
    reducao_base_icms:       dec(item.reducaoBaseIcms),
    valor_bc_icms:           dec(item.valorBcIcms),
    aliquota_icms:           dec(item.aliquotaIcms),
    valor_icms:              dec(item.valorIcms),
    valor_bc_icms_st:        dec(item.valorBcIcmsSt),
    aliquota_icms_st:        dec(item.aliquotaIcmsSt),
    valor_icms_st:           dec(item.valorIcmsSt),
    cst_ipi:                 item.cstIpi,
    codigo_enquadramento_ipi: item.codigoEnquadramentoIpi,
    valor_bc_ipi:            dec(item.valorBcIpi),
    aliquota_ipi:            dec(item.aliquotaIpi),
    valor_ipi:               dec(item.valorIpi),
    cst_pis:                 item.cstPis,
    valor_bc_pis:            dec(item.valorBcPis),
    aliquota_pis:            dec(item.aliquotaPis),
    valor_pis:               dec(item.valorPis),
    cst_cofins:              item.cstCofins,
    valor_bc_cofins:         dec(item.valorBcCofins),
    aliquota_cofins:         dec(item.aliquotaCofins),
    valor_cofins:            dec(item.valorCofins),
    aliquota_iss:            dec(item.aliquotaIss),
    valor_iss:               dec(item.valorIss),
    cest:                    item.cest,
    informacoes_adicionais:  item.informacoesAdicionais,
    created_at:              item.createdAt,
    updated_at:              item.updatedAt,
    produto_nome:            item.produto?.nome ?? null,
  };
}

// ── Includes padrão ───────────────────────────────────────────────────────────

const NOTA_INCLUDE = {
  fornecedor:       { select: { id: true, razaoSocial: true, cnpj: true } },
  categoriaDespesa: { select: { nome: true } },
  createdBy:        { select: { nome: true } },
};

// ── Builders de dados ─────────────────────────────────────────────────────────

function buildNotaCreateData(data, userId) {
  return {
    fornecedorId:        Number(data.fornecedor_id),
    numeroNota:          str(data.numero_nota),
    serie:               str(data.serie),
    chaveAcesso:         str(data.chave_acesso),
    tipoNota:            data.tipo_nota ?? "produto",
    dataEmissao:         data.data_emissao ? new Date(data.data_emissao) : null,
    dataEntrada:         new Date(data.data_entrada),
    valorTotal:          dec(data.valor_total),
    descricao:           str(data.descricao),
    categoriaDespesaId:  data.categoria_despesa_id ?? null,
    arquivoPdf:          str(data.arquivo_pdf),
    arquivoXml:          str(data.arquivo_xml),
    status:              "lancada",
    observacoes:         str(data.observacoes),
    naturezaOperacao:    str(data.natureza_operacao),
    cfopPrincipal:       str(data.cfop_principal),
    modalidadeFrete:     data.modalidade_frete != null && data.modalidade_frete !== ""
                           ? int(data.modalidade_frete) : null,
    valorFrete:          dec(data.valor_frete),
    valorSeguro:         dec(data.valor_seguro),
    valorDesconto:       dec(data.valor_desconto),
    valorOutrasDespesas: dec(data.valor_outras_despesas),
    valorBcIcms:         dec(data.valor_bc_icms),
    valorIcms:           dec(data.valor_icms),
    valorIpi:            dec(data.valor_ipi),
    valorPis:            dec(data.valor_pis),
    valorCofins:         dec(data.valor_cofins),
    valorIss:            dec(data.valor_iss),
    numeroProtocolo:     str(data.numero_protocolo),
    dataAutorizacao:     data.data_autorizacao ? new Date(data.data_autorizacao) : null,
    createdById:         userId,
  };
}

function buildNotaUpdateData(data) {
  return {
    fornecedorId:        Number(data.fornecedor_id),
    numeroNota:          str(data.numero_nota),
    serie:               str(data.serie),
    chaveAcesso:         str(data.chave_acesso),
    tipoNota:            data.tipo_nota ?? "produto",
    dataEmissao:         data.data_emissao ? new Date(data.data_emissao) : null,
    dataEntrada:         new Date(data.data_entrada),
    valorTotal:          dec(data.valor_total),
    descricao:           str(data.descricao),
    categoriaDespesaId:  data.categoria_despesa_id ?? null,
    // arquivo_pdf e arquivo_xml NÃO são atualizados via edição de nota
    observacoes:         str(data.observacoes),
    naturezaOperacao:    str(data.natureza_operacao),
    cfopPrincipal:       str(data.cfop_principal),
    modalidadeFrete:     data.modalidade_frete != null && data.modalidade_frete !== ""
                           ? int(data.modalidade_frete) : null,
    valorFrete:          dec(data.valor_frete),
    valorSeguro:         dec(data.valor_seguro),
    valorDesconto:       dec(data.valor_desconto),
    valorOutrasDespesas: dec(data.valor_outras_despesas),
    valorBcIcms:         dec(data.valor_bc_icms),
    valorIcms:           dec(data.valor_icms),
    valorIpi:            dec(data.valor_ipi),
    valorPis:            dec(data.valor_pis),
    valorCofins:         dec(data.valor_cofins),
    valorIss:            dec(data.valor_iss),
    numeroProtocolo:     str(data.numero_protocolo),
    dataAutorizacao:     data.data_autorizacao ? new Date(data.data_autorizacao) : null,
  };
}

function buildItemData(notaId, item, numero) {
  return {
    notaRecebidaId:         notaId,
    produtoId:              item.produto_id ? Number(item.produto_id) : null,
    numeroItem:             numero,
    codigoProduto:          str(item.codigo_produto),
    descricao:              item.descricao,
    ncm:                    str(item.ncm),
    cfop:                   str(item.cfop),
    unidade:                str(item.unidade),
    quantidade:             dec(item.quantidade),
    valorUnitario:          dec(item.valor_unitario),
    valorTotal:             dec(item.valor_total),
    valorDesconto:          dec(item.valor_desconto),
    origemMercadoria:       str(item.origem_mercadoria),
    cstIcms:                str(item.cst_icms),
    csosn:                  str(item.csosn),
    modalidadeBcIcms:       item.modalidade_bc_icms != null && item.modalidade_bc_icms !== ""
                              ? int(item.modalidade_bc_icms) : null,
    reducaoBaseIcms:        dec(item.reducao_base_icms),
    valorBcIcms:            dec(item.valor_bc_icms),
    aliquotaIcms:           dec(item.aliquota_icms),
    valorIcms:              dec(item.valor_icms),
    valorBcIcmsSt:          dec(item.valor_bc_icms_st),
    aliquotaIcmsSt:         dec(item.aliquota_icms_st),
    valorIcmsSt:            dec(item.valor_icms_st),
    cstIpi:                 str(item.cst_ipi),
    codigoEnquadramentoIpi: str(item.codigo_enquadramento_ipi),
    valorBcIpi:             dec(item.valor_bc_ipi),
    aliquotaIpi:            dec(item.aliquota_ipi),
    valorIpi:               dec(item.valor_ipi),
    cstPis:                 str(item.cst_pis),
    valorBcPis:             dec(item.valor_bc_pis),
    aliquotaPis:            dec(item.aliquota_pis),
    valorPis:               dec(item.valor_pis),
    cstCofins:              str(item.cst_cofins),
    valorBcCofins:          dec(item.valor_bc_cofins),
    aliquotaCofins:         dec(item.aliquota_cofins),
    valorCofins:            dec(item.valor_cofins),
    aliquotaIss:            dec(item.aliquota_iss),
    valorIss:               dec(item.valor_iss),
    cest:                   str(item.cest),
    informacoesAdicionais:  str(item.informacoes_adicionais),
  };
}

// ── Queries Prisma ────────────────────────────────────────────────────────────

async function listNotasRecebidas({ fornecedor_id, status, categoria_id, limit = 100, offset = 0 } = {}) {
  const where = {};
  if (fornecedor_id) where.fornecedorId    = Number(fornecedor_id);
  if (status)        where.status          = status;
  if (categoria_id)  where.categoriaDespesaId = Number(categoria_id);

  const rows = await prisma.notaRecebida.findMany({
    where,
    include: {
      ...NOTA_INCLUDE,
      _count: { select: { itens: true } },
    },
    orderBy: { dataEntrada: "desc" },
    take:    limit,
    skip:    offset,
  });

  return rows.map((nr) => {
    const mapped = mapNotaRecebida(nr);
    // Bridge: total_contas de contas_pagar ainda em SQLite
    const total_contas = db.prepare(
      "SELECT COUNT(*) AS n FROM contas_pagar WHERE nota_recebida_id = ?"
    ).get(nr.id)?.n ?? 0;
    return { ...mapped, total_contas, total_itens: nr._count.itens };
  });
}

async function findNotaById(id) {
  const nr = await prisma.notaRecebida.findUnique({
    where:   { id },
    include: NOTA_INCLUDE,
  });
  return mapNotaRecebida(nr);
}

// Bridge: contas_pagar ainda em SQLite
function findNotaContasPagar(notaId) {
  return db.prepare(`
    SELECT
      cp.*,
      CASE WHEN cp.status = 'em_aberto' AND cp.data_vencimento < date('now') THEN 1 ELSE 0 END AS atrasado,
      upaid.nome AS pago_por_nome,
      ucanc.nome AS cancelado_por_nome
    FROM contas_pagar cp
    LEFT JOIN users upaid ON upaid.id = cp.paid_by
    LEFT JOIN users ucanc ON ucanc.id = cp.cancelled_by
    WHERE cp.nota_recebida_id = ?
    ORDER BY cp.parcela_numero ASC, cp.data_vencimento ASC
  `).all(notaId);
}

async function listItensNota(notaId) {
  const rows = await prisma.itemNotaRecebida.findMany({
    where:   { notaRecebidaId: notaId },
    include: { produto: { select: { nome: true } } },
    orderBy: { numeroItem: "asc" },
  });
  return rows.map(mapItemNotaRecebida);
}

async function checkDuplicataNota(fornecedor_id, numero_nota, serie, excludeId = null) {
  if (!numero_nota || !serie) return null;
  const found = await prisma.notaRecebida.findFirst({
    where:  { fornecedorId: Number(fornecedor_id), numeroNota: numero_nota, serie },
    select: { id: true },
  });
  if (!found) return null;
  if (excludeId && found.id === excludeId) return null;
  return found;
}

async function checkDuplicataChave(chave_acesso, excludeId = null) {
  if (!chave_acesso?.trim()) return null;
  const found = await prisma.notaRecebida.findFirst({
    where:  { chaveAcesso: chave_acesso },
    select: { id: true },
  });
  if (!found) return null;
  if (excludeId && found.id === excludeId) return null;
  return found;
}

// Bridge: conta_pagar ainda em SQLite
function countContasAbertas(notaId) {
  return db.prepare(
    `SELECT COUNT(*) AS n FROM contas_pagar
     WHERE nota_recebida_id = ? AND status NOT IN ('cancelado', 'pago')`
  ).get(notaId).n;
}

// Cria nota + itens em transação Prisma
async function createNotaComItens(data, userId) {
  const itens = Array.isArray(data.itens) ? data.itens : [];
  return prisma.$transaction(async (tx) => {
    const nota = await tx.notaRecebida.create({ data: buildNotaCreateData(data, userId) });
    for (let i = 0; i < itens.length; i++) {
      await tx.itemNotaRecebida.create({ data: buildItemData(nota.id, itens[i], i + 1) });
    }
    return tx.notaRecebida.findUnique({ where: { id: nota.id }, include: NOTA_INCLUDE });
  }).then(mapNotaRecebida);
}

// Atualiza nota + itens em transação Prisma (delete + reinsert dos itens)
async function updateNotaComItens(id, data) {
  const itens = Array.isArray(data.itens) ? data.itens : [];
  return prisma.$transaction(async (tx) => {
    await tx.notaRecebida.update({ where: { id }, data: buildNotaUpdateData(data) });
    await tx.itemNotaRecebida.deleteMany({ where: { notaRecebidaId: id } });
    for (let i = 0; i < itens.length; i++) {
      await tx.itemNotaRecebida.create({ data: buildItemData(id, itens[i], i + 1) });
    }
    return tx.notaRecebida.findUnique({ where: { id }, include: NOTA_INCLUDE });
  }).then(mapNotaRecebida);
}

async function cancelarNota(id) {
  await prisma.notaRecebida.update({ where: { id }, data: { status: "cancelada" } });
}

// Bridge: insere contas a pagar em SQLite com FK relaxada temporariamente.
// nota_recebida_id aponta para PostgreSQL ID — FK enforce desativado enquanto
// contas_pagar não migra para Prisma.
function insertContasPagarBridge(parcelas) {
  const insertConta = db.prepare(`
    INSERT INTO contas_pagar (
      fornecedor_id, nota_recebida_id, categoria_despesa_id,
      descricao, valor, data_emissao, data_vencimento,
      forma_pagamento, status, parcela_numero, parcela_total, created_by
    ) VALUES (
      @fornecedor_id, @nota_recebida_id, @categoria_despesa_id,
      @descricao, @valor, @data_emissao, @data_vencimento,
      @forma_pagamento, @status, @parcela_numero, @parcela_total, @created_by
    )
  `);
  db.pragma("foreign_keys = OFF");
  try {
    for (const p of parcelas) insertConta.run(p);
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

module.exports = {
  listNotasRecebidas,
  findNotaById,
  findNotaContasPagar,
  listItensNota,
  checkDuplicataNota,
  checkDuplicataChave,
  countContasAbertas,
  createNotaComItens,
  updateNotaComItens,
  cancelarNota,
  insertContasPagarBridge,
};

const prisma = require("../../db/prisma");
const db = require("../../db/connection");
const { normalizeText } = require("../../shared/utils/normalize");
const { KANBAN_STATUSES } = require("../../shared/domain/kanban");

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapProposal(p) {
  if (!p) return null;
  return {
    id:                              p.id,
    numero_proposta:                 p.numeroProposta,
    cliente_id:                      p.clienteId,
    cidade_emissao:                  p.cidadeEmissao,
    data_emissao:                    p.dataEmissao,
    objeto_proposta:                 p.objetoProposta,
    forma_pagamento:                 p.formaPagamento,
    prazo_pagamento:                 p.prazoPagamento,
    prazo_entrega:                   p.prazoEntrega,
    garantia:                        p.garantia,
    validade:                        p.validade,
    valor_total:                     p.valorTotal !== null ? Number(p.valorTotal) : null,
    valor_total_extenso:             p.valorTotalExtenso,
    responsavel_nome:                p.responsavelNome,
    responsavel_cargo:               p.responsavelCargo,
    responsavel_email:               p.responsavelEmail,
    responsavel_telefone:            p.responsavelTelefone,
    responsible_user_id:             p.responsibleUserId,
    responsible_name:                p.responsibleName,
    responsible_role:                p.responsibleRole,
    responsible_phone:               p.responsiblePhone,
    commercial_condition_id:         p.commercialConditionId,
    pdf_path:                        p.pdfPath,
    kanban_status:                   p.kanbanStatus,
    kanban_status_updated_at:        p.kanbanStatusUpdatedAt,
    execution_completed:             p.executionCompleted ? 1 : 0,
    execution_date:                  p.executionDate,
    executed_by:                     p.executedBy,
    execution_os:                    p.executionOs,
    execution_details:               p.executionDetails,
    execution_marked_by_user_id:     p.executionMarkedByUserId,
    execution_marked_at:             p.executionMarkedAt,
    approval_date:                   p.approvalDate,
    approval_notes:                  p.approvalNotes,
    approval_attachment_path:        p.approvalAttachmentPath,
    approval_registered_by_user_id:  p.approvalRegisteredByUserId,
    approval_registered_at:          p.approvalRegisteredAt,
    billing_date:                    p.billingDate,
    invoice_number:                  p.invoiceNumber,
    billing_notes:                   p.billingNotes,
    billed_by_user_id:               p.billedByUserId,
    billed_at:                       p.billedAt,
    created_at:                      p.createdAt,
    // campos de join opcionals
    cliente_nome:         p.cliente?.nome          ?? null,
    cliente_razao_social: p.cliente?.razaoSocial   ?? null,
    cliente_cnpj:         p.cliente?.cnpj          ?? null,
    cliente_endereco:     p.cliente?.endereco       ?? null,
    cliente_cidade:       p.cliente?.cidade         ?? null,
    cliente_estado:       p.cliente?.estado         ?? null,
    cliente_cep:          p.cliente?.cep            ?? null,
  };
}

function mapProposalItem(pi) {
  if (!pi) return null;
  return {
    id:             pi.id,
    proposal_id:    pi.proposalId,
    item_ordem:     pi.itemOrdem,
    quantidade:     pi.quantidade,
    descricao:      pi.descricao,
    valor_unitario: pi.valorUnitario !== null ? Number(pi.valorUnitario) : null,
    ncm:            pi.ncm,
  };
}

// ── Proposal CRUD ─────────────────────────────────────────────────────────────

// Cria proposta, itens e histórico de preços em transação PostgreSQL real.
// Rollback automático em qualquer falha — equivale ao antigo createProposalAtomic SQLite.
async function createProposalAtomic(proposalData, items, { clientId, numeroProposta, dataProposta }) {
  const proposal = await prisma.$transaction(async (tx) => {
    const created = await tx.proposal.create({
      data: {
        numeroProposta:        proposalData.numero_proposta,
        clienteId:             proposalData.cliente_id,
        cidadeEmissao:         proposalData.cidade_emissao || "",
        dataEmissao:           dataProposta,
        objetoProposta:        proposalData.objeto_proposta,
        formaPagamento:        proposalData.forma_pagamento,
        prazoPagamento:        proposalData.prazo_pagamento,
        prazoEntrega:          proposalData.prazo_entrega,
        garantia:              proposalData.garantia,
        validade:              proposalData.validade,
        valorTotal:            proposalData.valor_total,
        valorTotalExtenso:     proposalData.valor_total_extenso,
        responsavelNome:       proposalData.responsavel_nome,
        responsavelCargo:      proposalData.responsavel_cargo,
        responsavelEmail:      proposalData.responsavel_email || "",
        responsavelTelefone:   proposalData.responsavel_telefone,
        responsibleUserId:     proposalData.responsible_user_id     || null,
        responsibleName:       proposalData.responsible_name        || null,
        responsibleRole:       proposalData.responsible_role        || null,
        responsiblePhone:      proposalData.responsible_phone       || null,
        commercialConditionId: proposalData.commercial_condition_id || null,
        pdfPath:               null,
        // kanbanStatus: "pendente_envio" — padrão definido no schema
      },
    });

    await tx.proposalItem.createMany({
      data: items.map((item) => ({
        proposalId:    created.id,
        itemOrdem:     item.item_ordem,
        quantidade:    item.quantidade,
        descricao:     item.descricao,
        valorUnitario: item.valor_unitario,
        ncm:           item.ncm || null,
      })),
    });

    await tx.priceHistory.createMany({
      data: items.map((item) => ({
        clientId:             clientId,
        partId:               item.part_id ?? null,
        proposalId:           created.id,
        descricaoOriginal:    item.descricao,
        descricaoNormalizada: normalizeText(item.descricao),
        quantidade:           item.quantidade,
        valorUnitario:        item.valor_unitario,
        dataProposta:         dataProposta,
        numeroProposta:       numeroProposta,
      })),
    });

    return created;
  });

  return proposal.id;
}

async function updateProposalPdfPath(proposalId, pdfPath) {
  await prisma.proposal.update({ where: { id: proposalId }, data: { pdfPath } });
}

async function findProposalById(proposalId) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: Number(proposalId) },
    include: {
      cliente: {
        select: {
          nome: true, razaoSocial: true, cnpj: true,
          endereco: true, cidade: true, estado: true, cep: true,
        },
      },
      items: { orderBy: { itemOrdem: "asc" } },
    },
  });
  if (!proposal) return null;
  return {
    proposal: mapProposal(proposal),
    items:    proposal.items.map(mapProposalItem),
  };
}

async function findProposalRowById(id) {
  const p = await prisma.proposal.findUnique({ where: { id: Number(id) } });
  return mapProposal(p);
}

async function listProposals() {
  const rows = await prisma.proposal.findMany({
    include: { cliente: { select: { nome: true } } },
    orderBy: { id: "desc" },
  });
  return rows.map(p => ({
    id:              p.id,
    numero_proposta: p.numeroProposta,
    data_emissao:    p.dataEmissao,
    valor_total:     Number(p.valorTotal),
    pdf_path:        p.pdfPath,
    kanban_status:   p.kanbanStatus,
    billed_at:       p.billedAt,
    cliente_nome:    p.cliente.nome,
  }));
}

async function searchItemDescriptions(q) {
  const rows = await prisma.proposalItem.findMany({
    where:   { descricao: { contains: q, mode: "insensitive" } },
    select:  { descricao: true },
    distinct: ["descricao"],
    orderBy: { id: "desc" },
    take:    10,
  });
  return rows;
}

// Prioridade 1: referência manual (part_client_price_references) por clientId + partId
// Prioridade 2: último price_history por clientId + descricaoNormalizada
async function getLastItemPriceForClient(clientId, descricao, partId = null) {
  if (partId) {
    const ref = await prisma.partClientPriceRef.findUnique({
      where: { partId_clientId: { partId: Number(partId), clientId: Number(clientId) } },
    });
    if (ref) {
      return {
        valor_unitario:  Number(ref.referencePrice),
        numero_proposta: null,
        data_proposta:   ref.updatedAt,
      };
    }
  }

  const ph = await prisma.priceHistory.findFirst({
    where:   { clientId: Number(clientId), descricaoNormalizada: normalizeText(descricao) },
    orderBy: { id: "desc" },
  });
  if (!ph) return null;
  return {
    valor_unitario:     Number(ph.valorUnitario),
    descricao_original: ph.descricaoOriginal,
    numero_proposta:    ph.numeroProposta,
    data_proposta:      ph.dataProposta,
  };
}

// Vincula part_id nos registros de price_history de uma proposta específica.
async function updatePriceHistoryPartId(proposalId, descricaoOriginal, partId) {
  await prisma.priceHistory.updateMany({
    where: { proposalId: Number(proposalId), descricaoOriginal },
    data:  { partId: Number(partId) },
  });
}

// Deleta proposta; cascade PostgreSQL remove proposal_items e price_history automaticamente.
// PDF NÃO é removido do disco (mantido em output/proposals/ para histórico manual).
async function deleteProposalAndRelated(proposalId) {
  await prisma.proposal.delete({ where: { id: Number(proposalId) } });
}

async function listProposalsForKanban() {
  const rows = await prisma.proposal.findMany({
    include: { cliente: { select: { nome: true } } },
    orderBy: { kanbanStatusUpdatedAt: "asc" },
  });
  return rows.map(p => ({
    id:                              p.id,
    numero_proposta:                 p.numeroProposta,
    data_emissao:                    p.dataEmissao,
    valor_total:                     Number(p.valorTotal),
    pdf_path:                        p.pdfPath,
    created_at:                      p.createdAt,
    kanban_status:                   p.kanbanStatus,
    kanban_status_updated_at:        p.kanbanStatusUpdatedAt,
    execution_completed:             p.executionCompleted ? 1 : 0,
    execution_date:                  p.executionDate,
    executed_by:                     p.executedBy,
    execution_os:                    p.executionOs,
    execution_details:               p.executionDetails,
    execution_marked_by_user_id:     p.executionMarkedByUserId,
    execution_marked_at:             p.executionMarkedAt,
    approval_date:                   p.approvalDate,
    approval_notes:                  p.approvalNotes,
    approval_attachment_path:        p.approvalAttachmentPath,
    approval_registered_by_user_id:  p.approvalRegisteredByUserId,
    approval_registered_at:          p.approvalRegisteredAt,
    billing_date:                    p.billingDate,
    invoice_number:                  p.invoiceNumber,
    billing_notes:                   p.billingNotes,
    billed_by_user_id:               p.billedByUserId,
    billed_at:                       p.billedAt,
    cliente_nome:                    p.cliente.nome,
  }));
}

async function setProposalKanbanStatus(proposalId, newStatus) {
  if (!KANBAN_STATUSES.includes(newStatus)) {
    throw new Error(`Status inválido: ${newStatus}`);
  }
  await prisma.proposal.update({
    where: { id: Number(proposalId) },
    data:  { kanbanStatus: newStatus, kanbanStatusUpdatedAt: new Date() },
  });
}

async function setProposalExecution(proposalId, data) {
  await prisma.proposal.update({
    where: { id: Number(proposalId) },
    data: {
      executionCompleted:         true,
      executionDate:              data.execution_date              ? new Date(data.execution_date)  : null,
      executedBy:                 data.executed_by                 || null,
      executionOs:                data.execution_os                || null,
      executionDetails:           data.execution_details           || null,
      executionMarkedByUserId:    data.execution_marked_by_user_id || null,
      executionMarkedAt:          new Date(),
    },
  });
}

async function clearProposalExecution(proposalId) {
  await prisma.proposal.update({
    where: { id: Number(proposalId) },
    data: {
      executionCompleted:         false,
      executionDate:              null,
      executedBy:                 null,
      executionOs:                null,
      executionDetails:           null,
      executionMarkedByUserId:    null,
      executionMarkedAt:          null,
    },
  });
}

async function setProposalApproval(proposalId, data) {
  await prisma.proposal.update({
    where: { id: Number(proposalId) },
    data: {
      approvalDate:                  data.approval_date                  ? new Date(data.approval_date) : null,
      approvalNotes:                 data.approval_notes                 || null,
      approvalAttachmentPath:        data.approval_attachment_path       || null,
      approvalRegisteredByUserId:    data.approval_registered_by_user_id || null,
      approvalRegisteredAt:          new Date(),
    },
  });
}

async function setProposalBilling(proposalId, data) {
  await prisma.proposal.update({
    where: { id: Number(proposalId) },
    data: {
      billingDate:     data.billing_date   ? new Date(data.billing_date) : null,
      invoiceNumber:   data.invoice_number || null,
      billingNotes:    data.billing_notes  || null,
      billedByUserId:  data.billed_by_user_id || null,
      billedAt:        new Date(),
    },
  });
}

module.exports = {
  createProposalAtomic,
  updateProposalPdfPath,
  findProposalById,
  findProposalRowById,
  listProposals,
  searchItemDescriptions,
  getLastItemPriceForClient,
  updatePriceHistoryPartId,
  deleteProposalAndRelated,
  listProposalsForKanban,
  setProposalKanbanStatus,
  setProposalExecution,
  clearProposalExecution,
  setProposalApproval,
  setProposalBilling,
  KANBAN_STATUSES,
};

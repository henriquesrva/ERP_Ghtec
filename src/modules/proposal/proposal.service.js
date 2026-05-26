const fs = require("fs");
const path = require("path");

const pdfService    = require("./proposal-pdf.service");
const proposalRepo  = require("./proposal.repository");
const clientRepo    = require("../client/client.repository");
const partRepo      = require("../part/part.repository");
const kanbanRepo    = require("../kanban/kanban.repository");

const {
  KANBAN_STATUSES,
  canMoveKanban,
} = require("../../shared/domain/kanban");

const { normalizeText } = require("../../shared/utils/normalize");
const { valorPorExtenso } = require("../../shared/utils/extensao");

function todayFormatted() {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo'
  }).format(new Date());
}

function calculateTotal(items) {
  return items.reduce((acc, item) => {
    return acc + Number(item.quantidade) * Number(item.valor_unitario);
  }, 0);
}

function ensureOutputDir() {
  const outputDir = path.resolve(__dirname, "../../../output/proposals");
  fs.mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

function checkClientConsistency(provided, existing) {
  const norm = (s) => normalizeText(s || "");
  const stripCnpj = (s) => (s || "").replace(/\D/g, "");
  const conflicts = [];

  if (provided.nome && existing.nome) {
    if (norm(provided.nome) !== norm(existing.nome)) {
      conflicts.push(`nome: informado "${provided.nome}", cadastrado "${existing.nome}"`);
    }
  }
  if (provided.cnpj && provided.cnpj.trim() && existing.cnpj && existing.cnpj.trim()) {
    if (stripCnpj(provided.cnpj) !== stripCnpj(existing.cnpj)) {
      conflicts.push(`CNPJ: informado "${provided.cnpj}", cadastrado "${existing.cnpj}"`);
    }
  }
  if (provided.razao_social && provided.razao_social.trim() && existing.razao_social && existing.razao_social.trim()) {
    if (norm(provided.razao_social) !== norm(existing.razao_social)) {
      conflicts.push(`razão social: informada "${provided.razao_social}", cadastrada "${existing.razao_social}"`);
    }
  }
  return conflicts;
}

async function findOrCreateClient(clientData) {
  const matchedIds = new Set();

  if (clientData.cnpj && clientData.cnpj.trim()) {
    const byCnpj = await clientRepo.findClientByCnpj(clientData.cnpj);
    if (byCnpj) matchedIds.add(byCnpj.id);
  }

  if (clientData.nome && clientData.nome.trim()) {
    const byName = await clientRepo.findClientsByExactName(clientData.nome);
    byName.forEach((c) => matchedIds.add(c.id));
  }

  if (matchedIds.size === 0) {
    const clientId = await clientRepo.createClient(clientData);
    return { clientId, isNew: true, possibleDuplicates: [] };
  }

  if (matchedIds.size > 1) {
    const err = new Error(
      "Os dados informados correspondem a múltiplos clientes distintos cadastrados. " +
      "Use o CNPJ para identificar o cliente correto ou selecione-o pelo campo de busca."
    );
    err.code = "CLIENT_DATA_CONFLICT";
    err.conflicts = ["Múltiplos clientes encontrados com os dados informados."];
    throw err;
  }

  const existingClient = await clientRepo.findClientById([...matchedIds][0]);
  const conflicts = checkClientConsistency(clientData, existingClient);

  if (conflicts.length > 0) {
    const err = new Error(
      `Já existe um cliente cadastrado com um dos dados informados ` +
      `(id=${existingClient.id}: "${existingClient.nome}"), ` +
      `mas outros campos estão divergentes: ${conflicts.join("; ")}.`
    );
    err.code = "CLIENT_DATA_CONFLICT";
    err.existingClientId = existingClient.id;
    err.existingClientNome = existingClient.nome;
    err.conflicts = conflicts;
    throw err;
  }

  return { clientId: existingClient.id, isNew: false, possibleDuplicates: [] };
}

function validateProposalItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error("A proposta deve ter pelo menos um item."), { code: "VALIDATION" });
  }
  items.forEach((item, i) => {
    if (!item.descricao || !String(item.descricao).trim()) {
      throw Object.assign(new Error(`Item ${i + 1}: descrição é obrigatória.`), { code: "VALIDATION" });
    }
    const qty = Number(item.quantidade);
    if (!Number.isInteger(qty) || qty <= 0) {
      throw Object.assign(new Error(`Item ${i + 1}: quantidade deve ser um inteiro maior que zero.`), { code: "VALIDATION" });
    }
    const price = Number(item.valor_unitario);
    if (isNaN(price) || price < 0) {
      throw Object.assign(new Error(`Item ${i + 1}: valor unitário não pode ser negativo.`), { code: "VALIDATION" });
    }
  });
}

async function createProposalFlow(data) {
  const outputDir = ensureOutputDir();
  data = { ...data, data_emissao: todayFormatted() };

  if (!data.numero_proposta || !String(data.numero_proposta).trim()) {
    throw Object.assign(new Error("Número da proposta é obrigatório."), { code: "VALIDATION" });
  }
  validateProposalItems(data.items);

  // ── Resolve client ────────────────────────────────────────────────────────
  let resolvedClient, clientId, clienteIsNew, possibleDuplicates;

  if (data.cliente_id) {
    resolvedClient = await clientRepo.findClientById(Number(data.cliente_id));
    if (!resolvedClient) {
      throw new Error("Cliente selecionado não encontrado no cadastro. Por favor, selecione novamente.");
    }
    clientId = resolvedClient.id;
    clienteIsNew = false;
    possibleDuplicates = [];
  } else if (data.cliente && data.cliente.nome) {
    const result = await findOrCreateClient({
      nome:                data.cliente.nome,
      razao_social:        data.cliente.razao_social        ?? null,
      nome_fantasia:       data.cliente.nome_fantasia       ?? null,
      cnpj:                data.cliente.cnpj                ?? null,
      inscricao_estadual:  data.cliente.inscricao_estadual  ?? null,
      endereco:            data.cliente.endereco            ?? null,
      cidade:              data.cliente.cidade              ?? null,
      estado:              data.cliente.estado              ?? null,
      cep:                 data.cliente.cep                 ?? null,
      email:               data.cliente.email               ?? null,
      telefone:            data.cliente.telefone            ?? null,
      contato_responsavel: data.cliente.contato_responsavel ?? null,
      observacoes:         data.cliente.observacoes         ?? null,
    });
    clientId = result.clientId;
    clienteIsNew = result.isNew;
    possibleDuplicates = result.possibleDuplicates;
    resolvedClient = await clientRepo.findClientById(clientId);
  } else {
    throw new Error("Cliente é obrigatório.");
  }

  const total        = calculateTotal(data.items);
  const totalExtenso = valorPorExtenso(total);

  const normalizedItems = data.items.map((item, index) => ({
    item_ordem:     index + 1,
    quantidade:     Number(item.quantidade),
    descricao:      item.descricao,
    part_id:        item.part_id ? Number(item.part_id) : null,
    valor_unitario: Number(item.valor_unitario),
    ncm:            item.ncm || null,
  }));

  let proposalId;
  try {
    proposalId = await proposalRepo.createProposalAtomic(
      {
        numero_proposta:         data.numero_proposta,
        cliente_id:              clientId,
        cidade_emissao:          data.cidade_emissao || '',
        data_emissao:            data.data_emissao,
        objeto_proposta:         data.objeto_proposta,
        forma_pagamento:         data.condicoes.forma_pagamento,
        prazo_pagamento:         data.condicoes.prazo_pagamento,
        prazo_entrega:           data.condicoes.prazo_entrega,
        garantia:                data.condicoes.garantia,
        validade:                data.condicoes.validade,
        valor_total:             total,
        valor_total_extenso:     totalExtenso,
        responsavel_nome:        data.responsavel.nome,
        responsavel_cargo:       data.responsavel.cargo,
        responsavel_email:       data.responsavel.email || '',
        responsavel_telefone:    data.responsavel.telefone,
        responsible_user_id:     data.responsible_user_id     || null,
        responsible_name:        data.responsible_name        || data.responsavel.nome,
        responsible_role:        data.responsible_role        || data.responsavel.cargo,
        responsible_phone:       data.responsible_phone       || data.responsavel.telefone,
        commercial_condition_id: data.commercial_condition_id || null,
        pdf_path:                null,
      },
      normalizedItems,
      { clientId, numeroProposta: data.numero_proposta, dataProposta: new Date() }
    );
  } catch (error) {
    if (error.code === "P2002") {
      throw Object.assign(
        new Error(`Já existe uma proposta com o número ${data.numero_proposta}.`),
        { code: "CONFLICT" }
      );
    }
    throw error;
  }

  // Auto-registro de peças: garante que price_history aponta para a peça correta.
  for (const item of normalizedItems) {
    let partId = item.part_id;
    if (!partId) {
      const existing = await partRepo.findPartByComposition(item.descricao, null, null);
      partId = existing
        ? existing.id
        : await partRepo.createPart({ nome: item.descricao, ncm: item.ncm || null });
    }
    await proposalRepo.updatePriceHistoryPartId(proposalId, item.descricao, partId);
  }

  const pdfFileName = `proposta-${data.numero_proposta}.pdf`;
  const pdfPath = path.join(outputDir, pdfFileName);

  await pdfService.generateProposalPdf({
    ...data,
    cliente: resolvedClient,
    valor_total_extenso: totalExtenso,
    valor_total_raw: total,
  }, pdfPath);
  await proposalRepo.updateProposalPdfPath(proposalId, pdfPath);

  return {
    proposalId,
    pdfPath,
    clienteId:    clientId,
    clienteIsNew,
    possibleDuplicates,
  };
}

async function getProposalById(proposalId) {
  return proposalRepo.findProposalById(proposalId);
}

async function getAllProposals() {
  return proposalRepo.listProposals();
}

async function deleteProposalService(proposalId) {
  const proposal = await proposalRepo.findProposalById(proposalId);
  if (!proposal) {
    const err = new Error("Proposta não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  await proposalRepo.deleteProposalAndRelated(proposalId);
}

async function getKanbanProposals() {
  return proposalRepo.listProposalsForKanban();
}

async function updateKanbanStatus(proposalId, newStatus, userRole) {
  const data = await proposalRepo.findProposalById(proposalId);
  if (!data) {
    const err = new Error("Proposta não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (!KANBAN_STATUSES.includes(newStatus)) {
    const err = new Error(`Status inválido: ${newStatus}. Valores aceitos: ${KANBAN_STATUSES.join(", ")}`);
    err.code = "INVALID_STATUS";
    throw err;
  }
  if (!canMoveKanban(userRole, data.proposal.kanban_status, newStatus)) {
    const err = new Error("Você não tem permissão para fazer esse movimento.");
    err.code = "FORBIDDEN";
    throw err;
  }
  if (newStatus === "faturar" && !data.proposal.execution_completed) {
    const err = new Error("Esta proposta precisa ser marcada como executada antes de ir para Faturar.");
    err.code = "EXECUTION_REQUIRED";
    throw err;
  }
  await proposalRepo.setProposalKanbanStatus(proposalId, newStatus);
}

// ── Execução de proposta ──────────────────────────────────────────────────────

function canMarkExecution(userRole) {
  return userRole === "admin" || userRole === "tecnico";
}

async function markProposalExecuted(proposalId, data, userRole, userId, userName) {
  if (!canMarkExecution(userRole)) {
    const err = new Error("Você não tem permissão para marcar propostas como executadas.");
    err.code = "FORBIDDEN";
    throw err;
  }
  const proposal = await proposalRepo.findProposalRowById(proposalId);
  if (!proposal) {
    const err = new Error("Proposta não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  await proposalRepo.setProposalExecution(proposalId, {
    execution_date:              data.execution_date              || null,
    executed_by:                 data.executed_by                 || null,
    execution_os:                data.execution_os                || null,
    execution_details:           data.execution_details           || null,
    execution_marked_by_user_id: userId                          || null,
  });
  try {
    const parts = ["Sistema: Proposta marcada como executada"];
    if (data.executed_by)   parts.push(`por ${data.executed_by}`);
    if (data.execution_date) parts.push(`em ${data.execution_date}`);
    if (data.execution_os)   parts.push(`OS: ${data.execution_os}`);
    parts.push(`(marcado por ${userName})`);
    await kanbanRepo.addComment({ card_type: "proposal", card_id: proposalId, user_id: userId, user_nome: "Sistema", comment: parts.join(". ") + "." });
  } catch (e) {
    console.error("[markProposalExecuted] auto-comment falhou:", e.message);
  }
}

async function removeProposalExecution(proposalId, userRole, userId, userName) {
  if (!canMarkExecution(userRole)) {
    const err = new Error("Você não tem permissão para remover o selo de execução.");
    err.code = "FORBIDDEN";
    throw err;
  }
  const proposal = await proposalRepo.findProposalRowById(proposalId);
  if (!proposal) {
    const err = new Error("Proposta não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  await proposalRepo.clearProposalExecution(proposalId);
  const autoMovedStatuses = ["faturar", "faturado"];
  const autoMoved = autoMovedStatuses.includes(proposal.kanban_status);
  if (autoMoved) {
    await proposalRepo.setProposalKanbanStatus(proposalId, "pendente_execucao");
  }
  try {
    let comment = `Sistema: Selo de execução removido por ${userName}.`;
    if (autoMoved) comment += " Proposta retornou automaticamente para Pendente Execução.";
    await kanbanRepo.addComment({ card_type: "proposal", card_id: proposalId, user_id: userId, user_nome: "Sistema", comment });
  } catch (e) {
    console.error("[removeProposalExecution] auto-comment falhou:", e.message);
  }
  return { autoMoved, newStatus: autoMoved ? "pendente_execucao" : proposal.kanban_status };
}

async function registerApproval(proposalId, data, userId, userName) {
  const proposal = await proposalRepo.findProposalRowById(proposalId);
  if (!proposal) {
    const err = new Error("Proposta não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  await proposalRepo.setProposalApproval(proposalId, {
    approval_date:                  data.approval_date                  || null,
    approval_notes:                 data.approval_notes                 || null,
    approval_attachment_path:       data.approval_attachment_path       || null,
    approval_registered_by_user_id: userId                              || null,
  });
  try {
    let comment = `Sistema: Aprovação registrada por ${userName}`;
    if (data.approval_date) comment += ` em ${data.approval_date}`;
    comment += ".";
    await kanbanRepo.addComment({ card_type: "proposal", card_id: proposalId, user_id: userId, user_nome: "Sistema", comment });
  } catch (e) {
    console.error("[registerApproval] auto-comment falhou:", e.message);
  }
}

async function registerBilling(proposalId, data, userId, userName) {
  if (!data.invoice_number || !data.invoice_number.trim()) {
    const err = new Error("O número da NF é obrigatório para faturar a proposta.");
    err.code = "VALIDATION";
    throw err;
  }
  const proposal = await proposalRepo.findProposalRowById(proposalId);
  if (!proposal) {
    const err = new Error("Proposta não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  await proposalRepo.setProposalBilling(proposalId, {
    billing_date:     data.billing_date     || null,
    invoice_number:   data.invoice_number.trim(),
    billing_notes:    data.billing_notes    || null,
    billed_by_user_id: userId              || null,
  });
  try {
    const parts = [`Sistema: Faturamento registrado por ${userName}. NF: ${data.invoice_number.trim()}`];
    if (data.billing_date) parts.push(`Data: ${data.billing_date}`);
    await kanbanRepo.addComment({ card_type: "proposal", card_id: proposalId, user_id: userId, user_nome: "Sistema", comment: parts.join(". ") + "." });
  } catch (e) {
    console.error("[registerBilling] auto-comment falhou:", e.message);
  }
}

module.exports = {
  createProposalFlow,
  getProposalById,
  getAllProposals,
  deleteProposalService,
  getKanbanProposals,
  validateProposalItems,
  calculateTotal,
  updateKanbanStatus,
  canMoveKanban,
  canMarkExecution,
  markProposalExecuted,
  removeProposalExecution,
  registerApproval,
  registerBilling,
  KANBAN_STATUSES,
};

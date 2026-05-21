const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");
const puppeteer = require("puppeteer");
const { PDFDocument } = require("pdf-lib");

const {
  findClientByCnpj,
  findClientsByName,
  findClientsByExactName,
  findClientById,
  createClient,
  createProposal,
  createProposalItems,
  insertPriceHistoryItems,
  updatePriceHistoryPartId,
  updateProposalPdfPath,
  findProposalById,
  findProposalRowById,
  listProposals,
  deleteProposalAndRelated,
  listProposalsForKanban,
  setProposalKanbanStatus,
  setProposalExecution,
  clearProposalExecution,
  setProposalApproval,
  setProposalBilling,
  KANBAN_STATUSES,
} = require("./proposal.repository");

const {
  findPartByComposition,
  createPart,
} = require("../part/part.repository");

const { addComment: addKanbanComment } = require("../kanban/kanban.repository");

const { formatCurrency } = require("../../shared/utils/currency");
const { normalizeText } = require("../../shared/utils/normalize");

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

function ensureFileExists(filePath, label = "Arquivo") {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} não encontrado: ${filePath}`);
  }
}

function getMimeType(ext) {
  const normalized = ext.toLowerCase();

  if (normalized === ".png") return "image/png";
  if (normalized === ".jpg" || normalized === ".jpeg") return "image/jpeg";
  if (normalized === ".svg") return "image/svg+xml";
  if (normalized === ".webp") return "image/webp";

  throw new Error(`Extensão não suportada para asset: ${ext}`);
}

function assetDataUri(fileName) {
  const assetPath = path.resolve(__dirname, "../../assets", fileName);

  ensureFileExists(assetPath, `Asset "${fileName}"`);

  const ext = path.extname(assetPath);
  const mimeType = getMimeType(ext);
  const fileBuffer = fs.readFileSync(assetPath);
  const base64 = fileBuffer.toString("base64");

  return `data:${mimeType};base64,${base64}`;
}

function buildTemplateData(proposalData) {
  const formattedItems = proposalData.items.map((item, index) => ({
    item_ordem: index + 1,
    item_label: String(index + 1).padStart(2, "0"),
    quantidade: item.quantidade,
    descricao: item.descricao,
    valor_unitario: formatCurrency(item.valor_unitario),
    subtotal: formatCurrency(Number(item.quantidade) * Number(item.valor_unitario)),
    ncm: item.ncm || ""
  }));

  const total = calculateTotal(proposalData.items);

  return {
    numero_proposta: proposalData.numero_proposta,
    cidade_emissao: proposalData.cidade_emissao,
    data_emissao: proposalData.data_emissao,
    objeto_proposta: proposalData.objeto_proposta,

    cliente: proposalData.cliente,

    itens: formattedItems,
    valor_total: formatCurrency(total),
    valor_total_raw: total,

    condicoes: proposalData.condicoes,
    responsavel: proposalData.responsavel,
    observacoes: proposalData.observacoes || null,

    // AJUSTE ESTES NOMES PRA BATER EXATAMENTE COM OS ARQUIVOS REAIS
    marca_dagua_topo: assetDataUri("marcatopo.png"),
    marca_dagua_fundo: assetDataUri("marcabaixo.jpg"),
    marca_fixa: assetDataUri("marca_fixa.png"),
    logo_ghtec: assetDataUri("LogoGHTEC.png")
  };
}

async function renderHtmlToPdfBytes(browser, html, omitBackground = false) {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: ["domcontentloaded", "load", "networkidle0"] });
    await page.evaluate(async () => {
      await Promise.all(Array.from(document.images).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
      }));
    });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      omitBackground,
      margin: { top: "0", right: "0", bottom: "0", left: "0" }
    });
  } finally {
    await page.close();
  }
}

function buildWatermarkP1Html(templateData) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
@page{size:A4;margin:0;}
*{box-sizing:border-box;margin:0;padding:0;}
html,body{width:210mm;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.p{position:relative;width:210mm;height:297mm;overflow:hidden;}
.wt{position:absolute;top:0;left:0;width:210mm;height:42mm;object-fit:cover;}
.wb{position:absolute;bottom:0;left:0;width:210mm;height:auto;}
</style></head><body>
<div class="p">
  <img class="wt" src="${templateData.marca_dagua_topo}"/>
  <img class="wb" src="${templateData.marca_dagua_fundo}"/>
</div>
</body></html>`;
}

function buildWatermarkPNHtml(templateData) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
@page{size:A4;margin:0;}
*{box-sizing:border-box;margin:0;padding:0;}
html,body{width:210mm;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.p{position:relative;width:210mm;height:297mm;overflow:hidden;}
.wf{position:absolute;top:0;left:0;width:210mm;height:297mm;object-fit:cover;}
</style></head><body>
<div class="p">
  <img class="wf" src="${templateData.marca_fixa}"/>
</div>
</body></html>`;
}

async function mergePdfLayers(contentBytes, wm1Bytes, wmNBytes, outputPath) {
  const contentPdf = await PDFDocument.load(contentBytes);
  const wm1Pdf = await PDFDocument.load(wm1Bytes);
  const wmNPdf = await PDFDocument.load(wmNBytes);

  const resultPdf = await PDFDocument.create();
  const pageCount = contentPdf.getPageCount();

  const [embeddedWm1] = await resultPdf.embedPdf(wm1Pdf, [0]);
  const [embeddedWmN] = await resultPdf.embedPdf(wmNPdf, [0]);

  for (let i = 0; i < pageCount; i++) {
    const [embeddedContent] = await resultPdf.embedPdf(contentPdf, [i]);
    const { width, height } = contentPdf.getPage(i).getSize();
    const page = resultPdf.addPage([width, height]);

    page.drawPage(i === 0 ? embeddedWm1 : embeddedWmN, { x: 0, y: 0, width, height });
    page.drawPage(embeddedContent, { x: 0, y: 0, width, height });
  }

  fs.writeFileSync(outputPath, Buffer.from(await resultPdf.save()));
}

async function renderProposalPdf(templateData, pdfFilePath) {
  const templatePath = path.resolve(__dirname, "./proposal.template.hbs");
  const cssPath = path.resolve(__dirname, "./proposal.css");

  ensureFileExists(templatePath, "Template Handlebars");
  ensureFileExists(cssPath, "Arquivo CSS");

  const templateSource = fs.readFileSync(templatePath, "utf8");
  const cssSource = fs.readFileSync(cssPath, "utf8");
  const contentHtml = handlebars.compile(templateSource)({ ...templateData, inlineCss: cssSource });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const [contentBytes, wm1Bytes, wmNBytes] = await Promise.all([
      renderHtmlToPdfBytes(browser, contentHtml, true),
      renderHtmlToPdfBytes(browser, buildWatermarkP1Html(templateData)),
      renderHtmlToPdfBytes(browser, buildWatermarkPNHtml(templateData))
    ]);

    await mergePdfLayers(contentBytes, wm1Bytes, wmNBytes, pdfFilePath);
  } finally {
    await browser.close();
  }
}

// Verifica se os dados fornecidos são consistentes com um cliente já cadastrado.
// Apenas campos presentes em AMBOS (novo dado e cadastro) são comparados.
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

function findOrCreateClient(clientData) {
  const matchedIds = new Set();

  // Busca por CNPJ (campo único e confiável)
  if (clientData.cnpj && clientData.cnpj.trim()) {
    const byCnpj = findClientByCnpj(clientData.cnpj);
    if (byCnpj) matchedIds.add(byCnpj.id);
  }

  // Busca por nome exato (normalizado)
  if (clientData.nome && clientData.nome.trim()) {
    const byName = findClientsByExactName(clientData.nome);
    byName.forEach((c) => matchedIds.add(c.id));
  }

  // Nenhum dado bate com nenhum cliente → cria novo
  if (matchedIds.size === 0) {
    const clientId = createClient(clientData);
    return { clientId, isNew: true, possibleDuplicates: [] };
  }

  // Dados batem com mais de um cliente distinto → bloqueia (ambíguo)
  if (matchedIds.size > 1) {
    const err = new Error(
      "Os dados informados correspondem a múltiplos clientes distintos cadastrados. " +
      "Use o CNPJ para identificar o cliente correto ou selecione-o pelo campo de busca."
    );
    err.code = "CLIENT_DATA_CONFLICT";
    err.conflicts = ["Múltiplos clientes encontrados com os dados informados."];
    throw err;
  }

  // Exatamente um cliente encontrado → verifica consistência
  const existingClient = findClientById([...matchedIds][0]);
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

  // Dados consistentes → reusa cliente existente
  return { clientId: existingClient.id, isNew: false, possibleDuplicates: [] };
}

async function createProposalFlow(data) {
  const outputDir = ensureOutputDir();
  data = { ...data, data_emissao: todayFormatted() };

  // ── Resolve client ────────────────────────────────────────────────────────
  let resolvedClient, clientId, clienteIsNew, possibleDuplicates;

  if (data.cliente_id) {
    resolvedClient = findClientById(Number(data.cliente_id));
    if (!resolvedClient) {
      throw new Error("Cliente selecionado não encontrado no cadastro. Por favor, selecione novamente.");
    }
    clientId = resolvedClient.id;
    clienteIsNew = false;
    possibleDuplicates = [];
  } else if (data.cliente && data.cliente.nome) {
    const result = findOrCreateClient({
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
    resolvedClient = findClientById(clientId);
  } else {
    throw new Error("Cliente é obrigatório.");
  }

  const templateData = buildTemplateData({ ...data, cliente: resolvedClient });

  const total = calculateTotal(data.items);

  let proposalId;

  try {
    proposalId = createProposal({
      numero_proposta: data.numero_proposta,
      cliente_id: clientId,
      cidade_emissao: data.cidade_emissao || '',
      data_emissao: data.data_emissao,
      objeto_proposta: data.objeto_proposta,
      forma_pagamento: data.condicoes.forma_pagamento,
      prazo_pagamento: data.condicoes.prazo_pagamento,
      prazo_entrega: data.condicoes.prazo_entrega,
      garantia: data.condicoes.garantia,
      validade: data.condicoes.validade,
      valor_total: total,
      valor_total_extenso: data.valor_total_extenso || "valor por extenso",
      responsavel_nome: data.responsavel.nome,
      responsavel_cargo: data.responsavel.cargo,
      responsavel_email: data.responsavel.email || '',
      responsavel_telefone: data.responsavel.telefone,
      responsible_user_id:        data.responsible_user_id        || null,
      responsible_name:           data.responsible_name           || data.responsavel.nome,
      responsible_role:           data.responsible_role           || data.responsavel.cargo,
      responsible_phone:          data.responsible_phone          || data.responsavel.telefone,
      commercial_condition_id:    data.commercial_condition_id    || null,
      pdf_path: null
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new Error(`Já existe uma proposta com o número ${data.numero_proposta}.`);
    }
    throw error;
  }

  const normalizedItems = data.items.map((item, index) => ({
    item_ordem:     index + 1,
    quantidade:     Number(item.quantidade),
    descricao:      item.descricao,
    part_id:        item.part_id ? Number(item.part_id) : null,
    valor_unitario: Number(item.valor_unitario),
    ncm:            item.ncm || null,
  }));

  createProposalItems(proposalId, normalizedItems);

  insertPriceHistoryItems(
    clientId,
    proposalId,
    data.numero_proposta,
    data.data_emissao,
    normalizedItems
  );

  // Auto-registro de peças: garante que price_history aponta para a peça correta.
  // Usa o part_id enviado pelo frontend quando disponível (peça selecionada do catálogo).
  // Só busca/cria por composição de nome como fallback (compatibilidade com itens sem part_id).
  for (const item of normalizedItems) {
    let partId = item.part_id;
    if (!partId) {
      const existing = findPartByComposition(item.descricao, null, null);
      partId = existing
        ? existing.id
        : createPart({ nome: item.descricao, ncm: item.ncm || null });
    }
    updatePriceHistoryPartId(proposalId, item.descricao, partId);
  }

  const pdfFileName = `proposta-${data.numero_proposta}.pdf`;
  const pdfPath = path.join(outputDir, pdfFileName);

  await renderProposalPdf(templateData, pdfPath);
  updateProposalPdfPath(proposalId, pdfPath);

  return {
    proposalId,
    pdfPath,
    clienteId:    clientId,
    clienteIsNew,
    possibleDuplicates,
  };
}

function getProposalById(proposalId) {
  return findProposalById(proposalId);
}

function getAllProposals() {
  return listProposals();
}

function deleteProposalService(proposalId) {
  const proposal = findProposalById(proposalId);
  if (!proposal) {
    const err = new Error("Proposta não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  deleteProposalAndRelated(proposalId);
}

function getKanbanProposals() {
  return listProposalsForKanban();
}

// Centraliza as regras de permissão de movimentação do Kanban.
// Retorna true se userRole pode mover de fromStatus para toStatus.
function canMoveKanban(userRole, fromStatus, toStatus) {
  if (userRole === "user")  return false;
  if (userRole === "admin") return true;

  const RANGE_COMERCIAL = new Set(["pendente_envio","enviado","aguardando_compra","comprado","pendente_execucao","faturar"]);
  const RANGE_TECNICO   = new Set(["aguardando_compra","comprado","pendente_execucao","faturar"]);

  if (userRole === "financeiro") {
    return (fromStatus === "faturar"  && toStatus === "faturado") ||
           (fromStatus === "faturado" && toStatus === "faturar");
  }
  if (userRole === "comercial") return RANGE_COMERCIAL.has(fromStatus) && toStatus !== "faturado";
  if (userRole === "tecnico")   return RANGE_TECNICO.has(fromStatus)   && toStatus !== "faturado";

  return false;
}

function updateKanbanStatus(proposalId, newStatus, userRole) {
  const data = findProposalById(proposalId);
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
  // Proposta precisa estar marcada como executada para ir para "Faturar"
  if (newStatus === "faturar" && !data.proposal.execution_completed) {
    const err = new Error("Esta proposta precisa ser marcada como executada antes de ir para Faturar.");
    err.code = "EXECUTION_REQUIRED";
    throw err;
  }
  setProposalKanbanStatus(proposalId, newStatus);
}

// ── Execução de proposta ──────────────────────────────────────────────────────

function canMarkExecution(userRole) {
  return userRole === "admin" || userRole === "tecnico";
}

function markProposalExecuted(proposalId, data, userRole, userId, userName) {
  if (!canMarkExecution(userRole)) {
    const err = new Error("Você não tem permissão para marcar propostas como executadas.");
    err.code = "FORBIDDEN";
    throw err;
  }
  const proposal = findProposalRowById(proposalId);
  if (!proposal) {
    const err = new Error("Proposta não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  setProposalExecution(proposalId, {
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
    addKanbanComment({ card_type: "proposal", card_id: proposalId, user_id: userId, user_nome: "Sistema", comment: parts.join(". ") + "." });
  } catch (e) {
    console.error("[markProposalExecuted] auto-comment falhou:", e.message);
  }
}

function removeProposalExecution(proposalId, userRole, userId, userName) {
  if (!canMarkExecution(userRole)) {
    const err = new Error("Você não tem permissão para remover o selo de execução.");
    err.code = "FORBIDDEN";
    throw err;
  }
  const proposal = findProposalRowById(proposalId);
  if (!proposal) {
    const err = new Error("Proposta não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  clearProposalExecution(proposalId);
  // Se estiver em "Faturar" ou "Faturado", volta automaticamente para "Pendente Execução"
  const autoMovedStatuses = ["faturar", "faturado"];
  const autoMoved = autoMovedStatuses.includes(proposal.kanban_status);
  if (autoMoved) {
    setProposalKanbanStatus(proposalId, "pendente_execucao");
  }
  try {
    let comment = `Sistema: Selo de execução removido por ${userName}.`;
    if (autoMoved) comment += " Proposta retornou automaticamente para Pendente Execução.";
    addKanbanComment({ card_type: "proposal", card_id: proposalId, user_id: userId, user_nome: "Sistema", comment });
  } catch (e) {
    console.error("[removeProposalExecution] auto-comment falhou:", e.message);
  }
  return { autoMoved, newStatus: autoMoved ? "pendente_execucao" : proposal.kanban_status };
}

function registerApproval(proposalId, data, userId, userName) {
  const proposal = findProposalRowById(proposalId);
  if (!proposal) {
    const err = new Error("Proposta não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  setProposalApproval(proposalId, {
    approval_date:                  data.approval_date                  || null,
    approval_notes:                 data.approval_notes                 || null,
    approval_attachment_path:       data.approval_attachment_path       || null,
    approval_registered_by_user_id: userId                              || null,
  });
  try {
    let comment = `Sistema: Aprovação registrada por ${userName}`;
    if (data.approval_date) comment += ` em ${data.approval_date}`;
    comment += ".";
    addKanbanComment({ card_type: "proposal", card_id: proposalId, user_id: userId, user_nome: "Sistema", comment });
  } catch (e) {
    console.error("[registerApproval] auto-comment falhou:", e.message);
  }
}

function registerBilling(proposalId, data, userId, userName) {
  if (!data.invoice_number || !data.invoice_number.trim()) {
    const err = new Error("O número da NF é obrigatório para faturar a proposta.");
    err.code = "VALIDATION";
    throw err;
  }
  const proposal = findProposalRowById(proposalId);
  if (!proposal) {
    const err = new Error("Proposta não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  setProposalBilling(proposalId, {
    billing_date:     data.billing_date     || null,
    invoice_number:   data.invoice_number.trim(),
    billing_notes:    data.billing_notes    || null,
    billed_by_user_id: userId              || null,
  });
  try {
    const parts = [`Sistema: Faturamento registrado por ${userName}. NF: ${data.invoice_number.trim()}`];
    if (data.billing_date) parts.push(`Data: ${data.billing_date}`);
    addKanbanComment({ card_type: "proposal", card_id: proposalId, user_id: userId, user_nome: "Sistema", comment: parts.join(". ") + "." });
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
  updateKanbanStatus,
  canMoveKanban,
  canMarkExecution,
  markProposalExecuted,
  removeProposalExecution,
  registerApproval,
  registerBilling,
  KANBAN_STATUSES,
};
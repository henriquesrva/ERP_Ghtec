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
  listProposals,
  deleteProposalAndRelated,
  listProposalsForKanban,
  setProposalKanbanStatus,
  KANBAN_STATUSES,
} = require("./proposal.repository");

const {
  findPartByComposition,
  createPart,
} = require("../part/part.repository");

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

  // Auto-registro de peças: para cada item, garante que a peça existe no catálogo
  // e vincula o part_id no price_history para manter integridade referencial.
  // Usa nome exato da descrição + marca/modelo nulos para evitar duplicidade.
  for (const item of normalizedItems) {
    let existing = findPartByComposition(item.descricao, null, null);
    let partId;
    if (existing) {
      partId = existing.id;
    } else {
      partId = createPart({ nome: item.descricao, ncm: item.ncm || null });
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

function updateKanbanStatus(proposalId, newStatus) {
  const proposal = findProposalById(proposalId);
  if (!proposal) {
    const err = new Error("Proposta não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (!KANBAN_STATUSES.includes(newStatus)) {
    const err = new Error(`Status inválido: ${newStatus}. Valores aceitos: ${KANBAN_STATUSES.join(", ")}`);
    err.code = "INVALID_STATUS";
    throw err;
  }
  setProposalKanbanStatus(proposalId, newStatus);
}

module.exports = {
  createProposalFlow,
  getProposalById,
  getAllProposals,
  deleteProposalService,
  getKanbanProposals,
  updateKanbanStatus,
};
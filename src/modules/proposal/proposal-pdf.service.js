"use strict";

const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");
const puppeteer = require("puppeteer");
const { PDFDocument } = require("pdf-lib");

const { formatCurrency } = require("../../shared/utils/currency");

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

// Constrói o objeto de dados para o template Handlebars.
// Recebe proposalData com valor_total_raw já calculado pelo service de negócio.
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

  const total = proposalData.valor_total_raw;

  return {
    numero_proposta: proposalData.numero_proposta,
    cidade_emissao: proposalData.cidade_emissao,
    data_emissao: proposalData.data_emissao,
    objeto_proposta: proposalData.objeto_proposta,

    cliente: proposalData.cliente,

    itens: formattedItems,
    valor_total: formatCurrency(total),
    valor_total_raw: total,
    valor_total_extenso: proposalData.valor_total_extenso,

    condicoes: proposalData.condicoes,
    responsavel: proposalData.responsavel,
    observacoes: proposalData.observacoes || null,

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

// Gera o PDF completo da proposta (3 camadas: conteúdo + marca d'água p.1 + marca d'água pN).
// proposalData deve incluir valor_total_raw (calculado pelo service de negócio).
async function generateProposalPdf(proposalData, pdfFilePath) {
  const templatePath = path.resolve(__dirname, "./proposal.template.hbs");
  const cssPath = path.resolve(__dirname, "./proposal.css");

  ensureFileExists(templatePath, "Template Handlebars");
  ensureFileExists(cssPath, "Arquivo CSS");

  const templateSource = fs.readFileSync(templatePath, "utf8");
  const cssSource = fs.readFileSync(cssPath, "utf8");
  const templateData = buildTemplateData(proposalData);
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

module.exports = { generateProposalPdf };

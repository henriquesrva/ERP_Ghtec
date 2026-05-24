const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const multer = require("multer");
const requireAuth = require("./middleware/requireAuth");
const BetterSQLiteStore = require("./middleware/sessionStore");

// ── Multer: upload de comprovantes de aprovação ───────────────────────────────
const approvalDir = path.resolve(__dirname, "../output/approvals");
fs.mkdirSync(approvalDir, { recursive: true });

// ── Multer: upload de arquivos de notas recebidas (PDF + XML) ─────────────────
const notasDir = path.resolve(__dirname, "../output/notas-recebidas");
fs.mkdirSync(notasDir, { recursive: true });

const notasStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, notasDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    cb(null, `nota_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const uploadNota = multer({
  storage: notasStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "text/xml", "application/xml"];
    const extOk   = [".pdf", ".xml"].includes(path.extname(file.originalname).toLowerCase());
    cb(null, allowed.includes(file.mimetype) || extOk);
  },
});

// ── Multer: upload de comprovantes de pagamento ───────────────────────────────
const comprovantesDir = path.resolve(__dirname, "../output/comprovantes");
fs.mkdirSync(comprovantesDir, { recursive: true });

const comprovantesStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, comprovantesDir),
  filename: (req, _file, cb) => {
    const ext = path.extname(_file.originalname).toLowerCase() || ".jpg";
    cb(null, `comprovante_${req.params.id}_${Date.now()}${ext}`);
  },
});
const uploadComprovante = multer({
  storage: comprovantesStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    const extOk   = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"].includes(
      path.extname(file.originalname).toLowerCase()
    );
    cb(null, allowed.includes(file.mimetype) || extOk);
  },
});

const approvalStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, approvalDir),
  filename: (req, _file, cb) => {
    const ext = path.extname(_file.originalname).toLowerCase() || ".jpg";
    cb(null, `approval_${req.params.id}_${Date.now()}${ext}`);
  },
});
const uploadApproval = multer({
  storage: approvalStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const {
  loginHandler,
  logoutHandler,
  getMeHandler,
  listUsersHandler,
  createUserHandler,
  changePasswordHandler,
  changeUserRoleHandler,
  deleteUserHandler,
  updateSignatureHandler,
} = require("./modules/auth/auth.controller");

const {
  createProposal,
  listProposals,
  getProposal,
  searchItemsHandler,
  getItemPriceHandler,
  deleteProposalHandler,
  listKanbanProposalsHandler,
  updateKanbanStatusHandler,
  markExecutionHandler,
  removeExecutionHandler,
  registerApprovalHandler,
  registerBillingHandler,
} = require("./modules/proposal/proposal.controller");

const {
  listClientsHandler,
  getClientByIdHandler,
  searchClientsHandler,
  createClientHandler,
  updateClientHandler,
  deleteClientHandler,
  getProfitAnalysisHandler,
} = require("./modules/client/client.controller");

const {
  listPartsHandler,
  getPartByIdHandler,
  searchPartsHandler,
  createPartHandler,
  updatePartHandler,
  deletePartHandler,
  getPartPriceHistoryHandler,
  getPartPriceHistoryByClientHandler,
  getPartPriceComparisonHandler,
  getClientPriceRefsHandler,
  upsertClientPriceRefHandler,
} = require("./modules/part/part.controller");

const {
  listResponsaveisHandler,
  getResponsavelByIdHandler,
  searchResponsaveisHandler,
  createResponsavelHandler,
  deleteResponsavelHandler,
} = require("./modules/responsavel/responsavel.controller");

const {
  listObjetosHandler,
  getObjetoByIdHandler,
  searchObjetosHandler,
  createObjetoHandler,
  updateObjetoHandler,
  deleteObjetoHandler,
} = require("./modules/objeto/objeto.controller");

const {
  listCardsHandler,
  createTaskHandler,
  updateTaskHandler,
  moveTaskHandler,
  deleteTaskHandler,
  linkTaskToProposalHandler,
  getCommentsHandler,
  addCommentHandler,
} = require("./modules/kanban/kanban.controller");

const {
  listStockPartsHandler,
  listMovementsHandler,
  createMovementHandler,
  getContractSpendHandler,
  getMovementsByDateHandler,
  inventoryCountHandler,
} = require("./modules/stock/stock.controller");

const {
  listCategoriesHandler,
  createCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
} = require("./modules/category/category.controller");

const {
  listConditionsHandler,
  getConditionHandler,
  searchConditionsHandler,
  createConditionHandler,
  updateConditionHandler,
  deleteConditionHandler,
} = require("./modules/condition/condition.controller");

const {
  listFornecedoresHandler,
  getFornecedorByIdHandler,
  getFornecedorDetalhesHandler,
  searchFornecedoresHandler,
  createFornecedorHandler,
  updateFornecedorHandler,
  desativarFornecedorHandler,
} = require("./modules/fornecedor/fornecedor.controller");

const {
  listCategoriasHandler,
  createCategoriaHandler,
  updateCategoriaHandler,
  desativarCategoriaHandler,
} = require("./modules/categoria_despesa/categoria_despesa.controller");

const {
  listNotasHandler,
  getNotaHandler,
  createNotaHandler,
  updateNotaHandler,
  cancelarNotaHandler,
} = require("./modules/nota_recebida/nota_recebida.controller");

const {
  listContasHandler,
  getContaHandler,
  createContaHandler,
  updateContaHandler,
  baixarContaHandler,
  cancelarContaHandler,
  getResumoHandler,
} = require("./modules/conta_pagar/conta_pagar.controller");

const db = require("./db/connection");
const app = express();

const isProd = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.warn("[AVISO] SESSION_SECRET não definido. Usando secret de desenvolvimento — NÃO use em produção.");
}

app.use(session({
  store: new BetterSQLiteStore({ ttl: 8 * 60 * 60 }),
  secret: sessionSecret || "ghtec-dev-secret-nao-use-em-producao",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000,
    sameSite: "lax",
    secure: isProd,
  },
}));

app.use(requireAuth);
app.use(express.json());
app.use(express.static(path.resolve(__dirname, "../public")));
app.use("/files/approvals",     express.static(path.resolve(__dirname, "../output/approvals")));
app.use("/files/notas",        express.static(path.resolve(__dirname, "../output/notas-recebidas")));
app.use("/files/comprovantes", express.static(path.resolve(__dirname, "../output/comprovantes")));
app.use("/files",              express.static(path.resolve(__dirname, "../output/proposals")));

// Auth
app.post("/auth/login",  loginHandler);
app.post("/auth/logout", logoutHandler);
app.get("/auth/me",      getMeHandler);

// Usuários
app.get("/users",              listUsersHandler);
app.post("/users",             createUserHandler);
app.put("/users/me/password",   changePasswordHandler);
app.put("/users/me/signature",  updateSignatureHandler);
app.put("/users/:id/role",     changeUserRoleHandler);
app.delete("/users/:id",       deleteUserHandler);

app.get("/health", (req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ ok: true, db: "ok", env: process.env.NODE_ENV || "development" });
  } catch (e) {
    console.error("[HEALTH] DB inacessível:", e.message);
    res.status(503).json({ ok: false, db: "error", message: "Banco de dados indisponível." });
  }
});

// Clientes — rotas específicas devem vir antes de /:id
app.get("/clients",                  listClientsHandler);
app.get("/clients/search",           searchClientsHandler);
app.get("/clients/profit-analysis",  getProfitAnalysisHandler);
app.get("/clients/:id",              getClientByIdHandler);
app.post("/clients",         createClientHandler);
app.put("/clients/:id",      updateClientHandler);
app.delete("/clients/:id",   deleteClientHandler);

// Categorias de peças
app.get("/part-categories",         listCategoriesHandler);
app.post("/part-categories",        createCategoryHandler);
app.put("/part-categories/:id",     updateCategoryHandler);
app.delete("/part-categories/:id",  deleteCategoryHandler);

// Peças — rotas específicas devem vir antes de /:id
app.get("/parts",                                     listPartsHandler);
app.get("/parts/search",                              searchPartsHandler);
app.get("/parts/:id/price-history",                   getPartPriceHistoryHandler);
app.get("/parts/:id/price-history-client",            getPartPriceHistoryByClientHandler);
app.get("/parts/:id/price-comparison",                getPartPriceComparisonHandler);
app.get("/parts/:id/client-price-references",         getClientPriceRefsHandler);
app.post("/parts/:id/client-price-references",        upsertClientPriceRefHandler);
app.get("/parts/:id",                                 getPartByIdHandler);
app.post("/parts",                                    createPartHandler);
app.put("/parts/:id",                                 updatePartHandler);
app.delete("/parts/:id",                              deletePartHandler);

// Itens / preço histórico
app.get("/items/search",     searchItemsHandler);
app.get("/items/last-price", getItemPriceHandler);

// Responsáveis — /search deve vir antes de /:id
app.get("/responsaveis",         listResponsaveisHandler);
app.get("/responsaveis/search",  searchResponsaveisHandler);
app.get("/responsaveis/:id",     getResponsavelByIdHandler);
app.post("/responsaveis",        createResponsavelHandler);
app.delete("/responsaveis/:id",  deleteResponsavelHandler);

// Condições comerciais — /search deve vir antes de /:id
app.get("/commercial-conditions",         listConditionsHandler);
app.get("/commercial-conditions/search",  searchConditionsHandler);
app.get("/commercial-conditions/:id",     getConditionHandler);
app.post("/commercial-conditions",        createConditionHandler);
app.put("/commercial-conditions/:id",     updateConditionHandler);
app.delete("/commercial-conditions/:id",  deleteConditionHandler);

// Objetos — /search deve vir antes de /:id
app.get("/objetos",         listObjetosHandler);
app.get("/objetos/search",  searchObjetosHandler);
app.get("/objetos/:id",     getObjetoByIdHandler);
app.post("/objetos",        createObjetoHandler);
app.put("/objetos/:id",     updateObjetoHandler);
app.delete("/objetos/:id",  deleteObjetoHandler);

// Kanban — cards, tarefas e comentários
app.get("/kanban/cards",                      listCardsHandler);
app.post("/kanban/tasks",                     createTaskHandler);
app.put("/kanban/tasks/:id",                  updateTaskHandler);
app.put("/kanban/tasks/:id/status",           moveTaskHandler);
app.delete("/kanban/tasks/:id",               deleteTaskHandler);
app.post("/kanban/tasks/:id/link-proposal",   linkTaskToProposalHandler);
app.get("/kanban/comments/:type/:id",         getCommentsHandler);
app.post("/kanban/comments",                  addCommentHandler);

// Estoque — /contract-spend e /movements devem vir antes de rotas genéricas
app.get("/stock",                    listStockPartsHandler);
app.get("/stock/contract-spend",     getContractSpendHandler);
app.get("/stock/movements-by-date",  getMovementsByDateHandler);
app.get("/stock/movements",          listMovementsHandler);
app.post("/stock/movements",         createMovementHandler);
app.post("/stock/inventory-count",   inventoryCountHandler);

// Propostas
app.get("/proposals",                      listProposals);
app.get("/proposals/kanban",               listKanbanProposalsHandler);
app.get("/proposals/:id",                  getProposal);
app.post("/proposals",                     createProposal);
app.delete("/proposals/:id",               deleteProposalHandler);
app.put("/proposals/:id/kanban-status",    updateKanbanStatusHandler);
app.put("/proposals/:id/execution",        markExecutionHandler);
app.delete("/proposals/:id/execution",     removeExecutionHandler);
app.put("/proposals/:id/billing",      registerBillingHandler);
app.put("/proposals/:id/approval", (req, res, next) => {
  uploadApproval.single("attachment")(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: "Erro no upload: " + err.message });
    next();
  });
}, registerApprovalHandler);

// ── Fornecedores ──────────────────────────────────────────────────────────────
app.get("/fornecedores",                  listFornecedoresHandler);
app.get("/fornecedores/search",           searchFornecedoresHandler);
app.get("/fornecedores/:id/detalhes",     getFornecedorDetalhesHandler);
app.get("/fornecedores/:id",              getFornecedorByIdHandler);
app.post("/fornecedores",                 createFornecedorHandler);
app.put("/fornecedores/:id",              updateFornecedorHandler);
app.post("/fornecedores/:id/desativar",   desativarFornecedorHandler);

// ── Categorias de despesa ─────────────────────────────────────────────────────
app.get("/categorias-despesa",                  listCategoriasHandler);
app.post("/categorias-despesa",                 createCategoriaHandler);
app.put("/categorias-despesa/:id",              updateCategoriaHandler);
app.post("/categorias-despesa/:id/desativar",   desativarCategoriaHandler);

// ── Notas recebidas ───────────────────────────────────────────────────────────
app.get("/notas-recebidas",              listNotasHandler);
app.get("/notas-recebidas/:id",          getNotaHandler);
app.post("/notas-recebidas", (req, res, next) => {
  uploadNota.fields([
    { name: "arquivo_pdf", maxCount: 1 },
    { name: "arquivo_xml", maxCount: 1 },
  ])(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: "Erro no upload: " + err.message });
    next();
  });
}, createNotaHandler);
app.put("/notas-recebidas/:id",          updateNotaHandler);
app.post("/notas-recebidas/:id/cancelar", cancelarNotaHandler);

// ── Contas a pagar ────────────────────────────────────────────────────────────
app.get("/contas-pagar",               listContasHandler);
app.get("/contas-pagar/resumo",        getResumoHandler);
app.get("/contas-pagar/:id",           getContaHandler);
app.post("/contas-pagar",              createContaHandler);
app.put("/contas-pagar/:id",           updateContaHandler);
app.post("/contas-pagar/:id/baixar", (req, res, next) => {
  uploadComprovante.single("comprovante_pagamento")(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: "Erro no upload: " + err.message });
    next();
  });
}, baixarContaHandler);
app.post("/contas-pagar/:id/cancelar", cancelarContaHandler);

// ── Handlers de fallback (devem vir depois de todas as rotas) ─────────────────
const notFoundHandler = require("./middleware/notFoundHandler");
const errorHandler    = require("./middleware/errorHandler");

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
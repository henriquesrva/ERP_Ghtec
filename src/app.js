const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const multer = require("multer");
const requireAuth = require("./middleware/requireAuth");

// ── Multer: upload de comprovantes de aprovação ───────────────────────────────
const approvalDir = path.resolve(__dirname, "../output/approvals");
fs.mkdirSync(approvalDir, { recursive: true });

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
  getPartPriceHistoryHandler,
  getPartPriceHistoryByClientHandler,
  getPartPriceComparisonHandler,
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
} = require("./modules/stock/stock.controller");

const {
  listCategoriesHandler,
  createCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
} = require("./modules/category/category.controller");

const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET || "ghtec-session-secret-2024",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 },
}));

app.use(requireAuth);
app.use(express.json());
app.use(express.static(path.resolve(__dirname, "../public")));
app.use("/files/approvals", express.static(path.resolve(__dirname, "../output/approvals")));
app.use("/files", express.static(path.resolve(__dirname, "../output/proposals")));

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

app.get("/health", (req, res) => res.json({ ok: true }));

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
app.get("/parts",                            listPartsHandler);
app.get("/parts/search",                     searchPartsHandler);
app.get("/parts/:id/price-history",          getPartPriceHistoryHandler);
app.get("/parts/:id/price-history-client",   getPartPriceHistoryByClientHandler);
app.get("/parts/:id/price-comparison",       getPartPriceComparisonHandler);
app.get("/parts/:id",                        getPartByIdHandler);
app.post("/parts",                           createPartHandler);
app.put("/parts/:id",                        updatePartHandler);

// Itens / preço histórico
app.get("/items/search",     searchItemsHandler);
app.get("/items/last-price", getItemPriceHandler);

// Responsáveis — /search deve vir antes de /:id
app.get("/responsaveis",         listResponsaveisHandler);
app.get("/responsaveis/search",  searchResponsaveisHandler);
app.get("/responsaveis/:id",     getResponsavelByIdHandler);
app.post("/responsaveis",        createResponsavelHandler);
app.delete("/responsaveis/:id",  deleteResponsavelHandler);

// Objetos — /search deve vir antes de /:id
app.get("/objetos",         listObjetosHandler);
app.get("/objetos/search",  searchObjetosHandler);
app.get("/objetos/:id",     getObjetoByIdHandler);
app.post("/objetos",        createObjetoHandler);
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
app.get("/stock/movements",          listMovementsHandler);
app.post("/stock/movements",         createMovementHandler);

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

module.exports = app;
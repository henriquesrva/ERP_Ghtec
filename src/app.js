const express = require("express");
const path = require("path");

const {
  createProposal,
  listProposals,
  getProposal,
  searchItemsHandler,
  getItemPriceHandler,
  deleteProposalHandler,
} = require("./modules/proposal/proposal.controller");

const {
  listClientsHandler,
  getClientByIdHandler,
  searchClientsHandler,
  createClientHandler,
  updateClientHandler,
  deleteClientHandler,
} = require("./modules/client/client.controller");

const {
  listPartsHandler,
  getPartByIdHandler,
  searchPartsHandler,
  createPartHandler,
  updatePartHandler,
  getPartPriceHistoryHandler,
} = require("./modules/part/part.controller");

const app = express();

app.use(express.json());
app.use(express.static(path.resolve(__dirname, "../public")));
app.use("/files", express.static(path.resolve(__dirname, "../output/proposals")));

app.get("/health", (req, res) => res.json({ ok: true }));

// Clientes — /search deve vir antes de /:id para não ser capturado como parâmetro
app.get("/clients",          listClientsHandler);
app.get("/clients/search",   searchClientsHandler);
app.get("/clients/:id",      getClientByIdHandler);
app.post("/clients",         createClientHandler);
app.put("/clients/:id",      updateClientHandler);
app.delete("/clients/:id",   deleteClientHandler);

// Peças — rotas específicas devem vir antes de /:id
app.get("/parts",                    listPartsHandler);
app.get("/parts/search",             searchPartsHandler);
app.get("/parts/:id/price-history",  getPartPriceHistoryHandler);
app.get("/parts/:id",                getPartByIdHandler);
app.post("/parts",                   createPartHandler);
app.put("/parts/:id",                updatePartHandler);

// Itens / preço histórico
app.get("/items/search",     searchItemsHandler);
app.get("/items/last-price", getItemPriceHandler);

// Propostas
app.get("/proposals",          listProposals);
app.get("/proposals/:id",      getProposal);
app.post("/proposals",         createProposal);
app.delete("/proposals/:id",   deleteProposalHandler);

module.exports = app;
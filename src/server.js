require("dotenv").config();

// Fail-fast: impede o servidor de subir com secret fraco em produção.
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  console.error("[ERRO CRÍTICO] SESSION_SECRET não está definido. Configure .env antes de iniciar em produção.");
  process.exit(1);
}

require("./db/migrate");

const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

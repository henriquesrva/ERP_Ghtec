const isDev = process.env.NODE_ENV !== "production";

// Mapeia err.code (lançado pelos services) para status HTTP.
// Mantém os mesmos códigos já usados nos controllers.
const CODE_TO_STATUS = {
  NOT_FOUND:                    404,
  FORBIDDEN:                    403,
  VALIDATION:                   400,
  SIGNATURE_REQUIRED:           400,
  INVALID_STATUS:               400,
  PART_NOT_IN_PROPOSAL:         400,
  EXCEEDS_PROPOSAL_QTY:         400,
  EXECUTION_REQUIRED:           422,
  CLIENT_DATA_CONFLICT:         409,
  DUPLICATE_CNPJ:               409,
  DUPLICATE_NOTA:               409,
  DUPLICATE_CHAVE:              409,
  DUPLICATE_INTERNAL_CODE:      409,
  DUPLICATE:                    409,
  HAS_PROPOSALS:                409,
  HAS_CONTAS_ABERTAS:           409,
  HAS_REFERENCES:               409,
  HAS_PARTS:                    409,
  HAS_DEPENDENCIES:             409,
  HAS_LINKED_PROPOSALS:         409,
  INSUFFICIENT_STOCK:           409,
  SQLITE_CONSTRAINT_UNIQUE:     409,
  SQLITE_CONSTRAINT_FOREIGNKEY: 409,
};

// Campos extras que alguns erros carregam e que o front-end já consome.
const EXTRA_FIELDS = [
  "existingId",
  "existingClientId",
  "existingClientNome",
  "conflicts",
  "proposalCount",
  "count",
  "available",
];

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = CODE_TO_STATUS[err.code] ?? err.status ?? 500;

  // Em produção, erros 5xx não expõem detalhes internos ao cliente.
  const message =
    status < 500
      ? err.message
      : isDev
        ? err.message
        : "Erro interno do servidor.";

  const logPrefix = status >= 500 ? "[ERRO]" : "[WARN]";
  const user = req.session?.userId ? `uid=${req.session.userId}` : "anon";
  console.error(`${logPrefix} ${req.method} ${req.path} (${user}) → ${status}: ${err.message}`);
  if (status >= 500 && isDev) console.error(err.stack);

  const body = { success: false, message };
  if (err.code) body.code = err.code;
  for (const field of EXTRA_FIELDS) {
    if (err[field] !== undefined) body[field] = err[field];
  }

  return res.status(status).json(body);
}

module.exports = errorHandler;

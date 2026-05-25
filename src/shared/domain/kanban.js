"use strict";

// Fonte de verdade das regras de domínio do Kanban.
// Importado por proposal.service.js e kanban.service.js — sem dependência cruzada entre os dois.

const KANBAN_STATUSES = [
  "pendente_envio",
  "enviado",
  "aguardando_compra",
  "comprado",
  "pendente_execucao",
  "faturar",
  "faturado",
];

const KANBAN_LABELS = {
  pendente_envio:    "Pendente de envio",
  enviado:           "Enviado",
  aguardando_compra: "Aguardando compra",
  comprado:          "Comprado",
  pendente_execucao: "Pendente de execução",
  faturar:           "Faturar",
  faturado:          "Faturado",
};

// Ranges permitidos por role (from-status). toStatus "faturado" é bloqueado separadamente.
const RANGE_COMERCIAL = new Set([
  "pendente_envio", "enviado", "aguardando_compra",
  "comprado", "pendente_execucao", "faturar",
]);

const RANGE_TECNICO = new Set([
  "aguardando_compra", "comprado", "pendente_execucao", "faturar",
]);

function isValidKanbanStatus(status) {
  return KANBAN_STATUSES.includes(status);
}

// Retorna true se userRole pode mover de fromStatus para toStatus.
function canMoveKanban(userRole, fromStatus, toStatus) {
  if (userRole === "user")  return false;
  if (userRole === "admin") return true;

  if (userRole === "financeiro") {
    return (fromStatus === "faturar"  && toStatus === "faturado") ||
           (fromStatus === "faturado" && toStatus === "faturar");
  }
  if (userRole === "comercial") return RANGE_COMERCIAL.has(fromStatus) && toStatus !== "faturado";
  if (userRole === "tecnico")   return RANGE_TECNICO.has(fromStatus)   && toStatus !== "faturado";

  return false;
}

// Versão que lança erro com code "FORBIDDEN" se o movimento não for permitido.
function assertCanMoveKanban(userRole, fromStatus, toStatus) {
  if (!canMoveKanban(userRole, fromStatus, toStatus)) {
    const err = new Error("Você não tem permissão para fazer esse movimento.");
    err.code = "FORBIDDEN";
    throw err;
  }
}

module.exports = {
  KANBAN_STATUSES,
  KANBAN_LABELS,
  isValidKanbanStatus,
  canMoveKanban,
  assertCanMoveKanban,
};

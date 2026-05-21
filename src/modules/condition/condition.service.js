const {
  listConditions,
  getConditionById,
  searchConditions,
  createCondition,
  updateCondition,
  deleteCondition,
} = require("./condition.repository");

function getAllConditions() {
  return listConditions();
}

function getCondition(id) {
  return getConditionById(id);
}

function searchConds(q) {
  return searchConditions(q);
}

function validateFields(data) {
  if (!data.name?.trim())            throw Object.assign(new Error("Nome é obrigatório."),                 { code: "VALIDATION" });
  if (!data.forma_pagamento?.trim()) throw Object.assign(new Error("Forma de pagamento é obrigatória."),  { code: "VALIDATION" });
  if (!data.prazo_pagamento?.trim()) throw Object.assign(new Error("Prazo de pagamento é obrigatório."), { code: "VALIDATION" });
  if (!data.prazo_entrega?.trim())   throw Object.assign(new Error("Prazo de entrega é obrigatório."),   { code: "VALIDATION" });
  if (!data.validade?.trim())        throw Object.assign(new Error("Validade é obrigatória."),            { code: "VALIDATION" });
}

function createCond(data) {
  validateFields(data);
  return createCondition({
    name:            data.name.trim(),
    forma_pagamento: data.forma_pagamento.trim(),
    prazo_pagamento: data.prazo_pagamento.trim(),
    prazo_entrega:   data.prazo_entrega.trim(),
    garantia:        data.garantia?.trim() || null,
    validade:        data.validade.trim(),
  });
}

function updateCond(id, data) {
  const existing = getConditionById(id);
  if (!existing) throw Object.assign(new Error("Condição não encontrada."), { code: "NOT_FOUND" });
  validateFields(data);
  updateCondition(id, {
    name:            data.name.trim(),
    forma_pagamento: data.forma_pagamento.trim(),
    prazo_pagamento: data.prazo_pagamento.trim(),
    prazo_entrega:   data.prazo_entrega.trim(),
    garantia:        data.garantia?.trim() || null,
    validade:        data.validade.trim(),
  });
}

function deleteCond(id) {
  const existing = getConditionById(id);
  if (!existing) throw Object.assign(new Error("Condição não encontrada."), { code: "NOT_FOUND" });
  deleteCondition(id);
}

module.exports = {
  getAllConditions,
  getCondition,
  searchConds,
  createCond,
  updateCond,
  deleteCond,
};

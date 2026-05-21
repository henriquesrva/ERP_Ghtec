const {
  listContasPagar,
  findContaById,
  createConta,
  updateConta,
  baixarConta,
  cancelarConta,
  getResumoFinanceiro,
} = require("./conta_pagar.repository");

const FORMAS_PAGAMENTO = ["pix", "boleto", "transferencia", "cartao", "dinheiro", "outro"];

function getAllContas(filtros) {
  return listContasPagar(filtros);
}

function getContaById(id) {
  const conta = findContaById(id);
  if (!conta) throw Object.assign(new Error("Conta a pagar não encontrada."), { code: "NOT_FOUND" });
  return conta;
}

function validateConta(data) {
  if (!data.fornecedor_id) {
    throw Object.assign(new Error("Fornecedor é obrigatório."), { code: "VALIDATION" });
  }
  if (!data.descricao?.trim()) {
    throw Object.assign(new Error("Descrição é obrigatória."), { code: "VALIDATION" });
  }
  const valor = parseFloat(data.valor);
  if (isNaN(valor) || valor <= 0) {
    throw Object.assign(new Error("Valor deve ser maior que zero."), { code: "VALIDATION" });
  }
  if (!data.data_emissao) {
    throw Object.assign(new Error("Data de emissão é obrigatória."), { code: "VALIDATION" });
  }
  if (!data.data_vencimento) {
    throw Object.assign(new Error("Data de vencimento é obrigatória."), { code: "VALIDATION" });
  }
}

function createNewConta(data, userId) {
  validateConta(data);
  const id = createConta({
    ...data,
    fornecedor_id:        Number(data.fornecedor_id),
    nota_recebida_id:     data.nota_recebida_id     ? Number(data.nota_recebida_id) : null,
    categoria_despesa_id: data.categoria_despesa_id ? Number(data.categoria_despesa_id) : null,
    valor:                parseFloat(data.valor),
    created_by:           userId,
  });
  return findContaById(id);
}

function updateExistingConta(id, data) {
  const existing = findContaById(id);
  if (!existing) throw Object.assign(new Error("Conta não encontrada."), { code: "NOT_FOUND" });
  if (existing.status !== "em_aberto") {
    throw Object.assign(new Error("Só é possível editar contas em aberto."), { code: "VALIDATION" });
  }
  validateConta(data);
  updateConta(id, {
    ...data,
    fornecedor_id:        Number(data.fornecedor_id),
    categoria_despesa_id: data.categoria_despesa_id ? Number(data.categoria_despesa_id) : null,
    valor:                parseFloat(data.valor),
  });
  return findContaById(id);
}

function darBaixa(id, baixaData, userId, comprovantePath) {
  const existing = findContaById(id);
  if (!existing) throw Object.assign(new Error("Conta não encontrada."), { code: "NOT_FOUND" });
  if (existing.status === "pago") {
    throw Object.assign(new Error("Esta conta já foi paga."), { code: "VALIDATION" });
  }
  if (existing.status === "cancelado") {
    throw Object.assign(new Error("Não é possível dar baixa em conta cancelada."), { code: "VALIDATION" });
  }
  if (!baixaData.data_pagamento) {
    throw Object.assign(new Error("Data de pagamento é obrigatória."), { code: "VALIDATION" });
  }
  const valorPago = parseFloat(baixaData.valor_pago);
  if (isNaN(valorPago) || valorPago <= 0) {
    throw Object.assign(new Error("Valor pago deve ser maior que zero."), { code: "VALIDATION" });
  }
  if (baixaData.forma_pagamento && !FORMAS_PAGAMENTO.includes(baixaData.forma_pagamento)) {
    throw Object.assign(new Error("Forma de pagamento inválida."), { code: "VALIDATION" });
  }

  baixarConta(id, {
    data_pagamento:       baixaData.data_pagamento,
    valor_pago:           valorPago,
    forma_pagamento:      baixaData.forma_pagamento       ?? null,
    comprovante_pagamento: comprovantePath                ?? null,
    paid_by:              userId,
    observacoes:          baixaData.observacoes           ?? null,
  });

  return findContaById(id);
}

function cancelar(id, motivo, userId) {
  const existing = findContaById(id);
  if (!existing) throw Object.assign(new Error("Conta não encontrada."), { code: "NOT_FOUND" });
  if (existing.status === "cancelado") {
    throw Object.assign(new Error("Conta já está cancelada."), { code: "VALIDATION" });
  }
  if (existing.status === "pago") {
    throw Object.assign(new Error("Não é possível cancelar uma conta já paga."), { code: "VALIDATION" });
  }
  cancelarConta(id, { cancelled_by: userId, cancel_reason: motivo ?? null });
  return findContaById(id);
}

function getResumo() {
  return getResumoFinanceiro();
}

module.exports = {
  getAllContas,
  getContaById,
  createNewConta,
  updateExistingConta,
  darBaixa,
  cancelar,
  getResumo,
};

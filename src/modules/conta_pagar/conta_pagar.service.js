const repo = require("./conta_pagar.repository");

const FORMAS_PAGAMENTO = ["pix", "boleto", "transferencia", "cartao", "dinheiro", "outro"];

async function getAllContas(filtros) {
  return repo.listContasPagar(filtros);
}

async function getContaById(id) {
  const conta = await repo.findContaById(id);
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

async function createNewConta(data, userId) {
  validateConta(data);
  const id = await repo.createConta({
    ...data,
    fornecedor_id:        Number(data.fornecedor_id),
    nota_recebida_id:     data.nota_recebida_id     ? Number(data.nota_recebida_id)     : null,
    categoria_despesa_id: data.categoria_despesa_id ? Number(data.categoria_despesa_id) : null,
    valor:                parseFloat(data.valor),
    created_by:           userId,
  });
  return repo.findContaById(id);
}

async function updateExistingConta(id, data) {
  const existing = await repo.findContaById(id);
  if (!existing) throw Object.assign(new Error("Conta não encontrada."), { code: "NOT_FOUND" });
  if (existing.status !== "em_aberto") {
    throw Object.assign(new Error("Só é possível editar contas em aberto."), { code: "VALIDATION" });
  }
  validateConta(data);
  await repo.updateConta(id, {
    ...data,
    fornecedor_id:        Number(data.fornecedor_id),
    categoria_despesa_id: data.categoria_despesa_id ? Number(data.categoria_despesa_id) : null,
    valor:                parseFloat(data.valor),
  });
  return repo.findContaById(id);
}

async function darBaixa(id, baixaData, userId, comprovantePath) {
  const existing = await repo.findContaById(id);
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

  await repo.baixarConta(id, {
    data_pagamento:        baixaData.data_pagamento,
    valor_pago:            valorPago,
    forma_pagamento:       baixaData.forma_pagamento        ?? null,
    comprovante_pagamento: comprovantePath                  ?? null,
    paid_by:               userId,
    observacoes:           baixaData.observacoes            ?? null,
  });

  return repo.findContaById(id);
}

async function cancelar(id, motivo, userId) {
  const existing = await repo.findContaById(id);
  if (!existing) throw Object.assign(new Error("Conta não encontrada."), { code: "NOT_FOUND" });
  if (existing.status === "cancelado") {
    throw Object.assign(new Error("Conta já está cancelada."), { code: "VALIDATION" });
  }
  if (existing.status === "pago") {
    throw Object.assign(new Error("Não é possível cancelar uma conta já paga."), { code: "VALIDATION" });
  }
  await repo.cancelarConta(id, { cancelled_by: userId, cancel_reason: motivo ?? null });
  return repo.findContaById(id);
}

async function getResumo() {
  return repo.getResumoFinanceiro();
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

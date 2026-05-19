const {
  listStockParts,
  getStockPartById,
  listMovements,
  createMovement,
  getPartCurrentStock,
  getPartQtyInProposal,
  getContractClientSpend,
} = require("./stock.repository");

const VALID_ENTRY_TYPES = [
  "compra_nova",
  "devolucao_tecnicos",
  "devolucao_conserto",
  "guardar_alguem",
];

function getAllStockParts() {
  return listStockParts();
}

function getMovements(opts) {
  return listMovements(opts);
}

function registerMovement(data, userId) {
  const { movement_type, part_id, quantity } = data;

  if (!part_id) throw Object.assign(new Error("Peça é obrigatória."), { code: "VALIDATION" });
  if (!movement_type || !["entrada", "saida"].includes(movement_type)) {
    throw Object.assign(new Error("Tipo de movimentação inválido."), { code: "VALIDATION" });
  }

  const qty = Number(quantity);
  if (!qty || qty <= 0 || !Number.isInteger(qty)) {
    throw Object.assign(new Error("Quantidade deve ser um número inteiro maior que zero."), { code: "VALIDATION" });
  }

  const part = getStockPartById(Number(part_id));
  if (!part) throw Object.assign(new Error("Peça não encontrada."), { code: "NOT_FOUND" });

  if (movement_type === "entrada") {
    if (!data.entry_type || !VALID_ENTRY_TYPES.includes(data.entry_type)) {
      throw Object.assign(new Error("Tipo de entrada é obrigatório."), { code: "VALIDATION" });
    }
  }

  if (movement_type === "saida") {
    if (data.returns_to_stock === undefined || data.returns_to_stock === null || data.returns_to_stock === "") {
      throw Object.assign(new Error("Informe se a peça volta para o estoque."), { code: "VALIDATION" });
    }
    const currentStock = getPartCurrentStock(Number(part_id));
    if (qty > currentStock) {
      throw Object.assign(
        new Error(`Estoque insuficiente. Disponível: ${currentStock}, solicitado: ${qty}.`),
        { code: "INSUFFICIENT_STOCK", available: currentStock }
      );
    }
    if (data.proposal_id) {
      const qtyInProposal = getPartQtyInProposal(Number(part_id), Number(data.proposal_id));
      if (qtyInProposal <= 0) {
        throw Object.assign(
          new Error("A proposta informada não contém esta peça."),
          { code: "PART_NOT_IN_PROPOSAL" }
        );
      }
      if (qty > qtyInProposal) {
        throw Object.assign(
          new Error(`Quantidade solicitada (${qty}) excede a quantidade desta peça na proposta (${qtyInProposal}).`),
          { code: "EXCEEDS_PROPOSAL_QTY", available: qtyInProposal }
        );
      }
    }
  }

  const id = createMovement({
    part_id:            Number(part_id),
    movement_type,
    quantity:           qty,
    entry_type:         movement_type === "entrada" ? data.entry_type : null,
    proposal_id:        data.proposal_id  ? Number(data.proposal_id)  : null,
    client_id:          data.client_id    ? Number(data.client_id)    : null,
    returns_to_stock:   movement_type === "saida"
      ? (data.returns_to_stock === true || data.returns_to_stock === "true" || data.returns_to_stock === 1 ? 1 : 0)
      : null,
    notes:              data.notes || null,
    created_by_user_id: userId,
  });

  return id;
}

function getContractSpend() {
  return getContractClientSpend();
}

module.exports = {
  getAllStockParts,
  getMovements,
  registerMovement,
  getContractSpend,
};

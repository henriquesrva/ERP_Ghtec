const db = require("../../db/connection");
const {
  listNotasRecebidas,
  findNotaById,
  findNotaContasPagar,
  listItensNota,
  insertItem,
  deleteItensNota,
  checkDuplicataNota,
  checkDuplicataChave,
  createNota,
  updateNota,
  cancelarNota,
  countContasAbertas,
} = require("./nota_recebida.repository");

const TIPOS_NOTA_VALIDOS = ["produto", "servico", "despesa", "outro"];

function getAllNotas(filtros) {
  return listNotasRecebidas(filtros);
}

function getNotaById(id) {
  const nota = findNotaById(id);
  if (!nota) throw Object.assign(new Error("Nota não encontrada."), { code: "NOT_FOUND" });
  return nota;
}

function getNotaDetalhes(id) {
  const nota = findNotaById(id);
  if (!nota) throw Object.assign(new Error("Nota não encontrada."), { code: "NOT_FOUND" });
  const contas = findNotaContasPagar(id);
  const itens  = listItensNota(id);
  return { nota, contas, itens };
}

function validateNota(data) {
  if (!data.fornecedor_id) {
    throw Object.assign(new Error("Fornecedor é obrigatório."), { code: "VALIDATION" });
  }
  if (!data.data_entrada) {
    throw Object.assign(new Error("Data de entrada é obrigatória."), { code: "VALIDATION" });
  }
  const valor = parseFloat(data.valor_total);
  if (isNaN(valor) || valor <= 0) {
    throw Object.assign(new Error("Valor total deve ser maior que zero."), { code: "VALIDATION" });
  }
  if (data.tipo_nota && !TIPOS_NOTA_VALIDOS.includes(data.tipo_nota)) {
    throw Object.assign(new Error("Tipo de nota inválido."), { code: "VALIDATION" });
  }
}

function validateItens(itens) {
  if (!Array.isArray(itens) || itens.length === 0) return;
  itens.forEach((item, i) => {
    if (!item.descricao?.trim()) {
      throw Object.assign(
        new Error(`Item ${i + 1}: descrição é obrigatória.`),
        { code: "VALIDATION" }
      );
    }
    if (item.valor_total !== undefined && item.valor_total !== "") {
      const vt = parseFloat(item.valor_total);
      if (isNaN(vt) || vt < 0) {
        throw Object.assign(
          new Error(`Item ${i + 1}: valor total não pode ser negativo.`),
          { code: "VALIDATION" }
        );
      }
    }
  });
}

function checkDuplicatas(data, excludeId = null) {
  if (data.numero_nota && data.serie) {
    const dup = checkDuplicataNota(data.fornecedor_id, data.numero_nota, data.serie, excludeId);
    if (dup) {
      throw Object.assign(
        new Error(`Já existe uma nota com número ${data.numero_nota} / série ${data.serie} para este fornecedor.`),
        { code: "DUPLICATE_NOTA", existingId: dup.id }
      );
    }
  }
  if (data.chave_acesso?.trim()) {
    const dupChave = checkDuplicataChave(data.chave_acesso, excludeId);
    if (dupChave) {
      throw Object.assign(
        new Error("Já existe uma nota cadastrada com esta chave de acesso."),
        { code: "DUPLICATE_CHAVE", existingId: dupChave.id }
      );
    }
  }
}

function buildParcelas(data, notaId, userId) {
  const parcelas = [];
  const numParcelas = parseInt(data.parcelas_quantidade) || 1;
  const valorTotal = parseFloat(data.valor_total);
  const dataEmissao = data.data_entrada;
  const vencimentoBase = data.parcela_vencimento_inicial || data.data_entrada;
  const formaPagamento = data.forma_pagamento || null;
  const categId = data.categoria_despesa_id || null;
  const descBase = data.descricao || `NF ${data.numero_nota || "s/n"}`;

  if (numParcelas === 1) {
    parcelas.push({
      fornecedor_id:        data.fornecedor_id,
      nota_recebida_id:     notaId,
      categoria_despesa_id: categId,
      descricao:            descBase,
      valor:                Math.round(valorTotal * 100) / 100,
      data_emissao:         dataEmissao,
      data_vencimento:      vencimentoBase,
      forma_pagamento:      formaPagamento,
      status:               "em_aberto",
      parcela_numero:       1,
      parcela_total:        1,
      created_by:           userId,
    });
    return parcelas;
  }

  const valorParcela = Math.floor((valorTotal / numParcelas) * 100) / 100;
  const somaParc = valorParcela * (numParcelas - 1);
  const ultimaParcela = Math.round((valorTotal - somaParc) * 100) / 100;

  const [anoBase, mesBase, diaBase] = vencimentoBase.split("-").map(Number);

  for (let i = 0; i < numParcelas; i++) {
    let mes = mesBase + i;
    let ano = anoBase + Math.floor((mes - 1) / 12);
    mes = ((mes - 1) % 12) + 1;
    const dia = String(diaBase).padStart(2, "0");
    const mesStr = String(mes).padStart(2, "0");
    const venc = `${ano}-${mesStr}-${dia}`;

    parcelas.push({
      fornecedor_id:        data.fornecedor_id,
      nota_recebida_id:     notaId,
      categoria_despesa_id: categId,
      descricao:            `${descBase} (${i + 1}/${numParcelas})`,
      valor:                i < numParcelas - 1 ? valorParcela : ultimaParcela,
      data_emissao:         dataEmissao,
      data_vencimento:      venc,
      forma_pagamento:      formaPagamento,
      status:               "em_aberto",
      parcela_numero:       i + 1,
      parcela_total:        numParcelas,
      created_by:           userId,
    });
  }

  return parcelas;
}

// Transação atômica: cria nota + itens + parcelas de contas a pagar
function createNotaComContas(data, userId) {
  validateNota(data);
  checkDuplicatas(data);

  const itens = Array.isArray(data.itens) ? data.itens : [];
  validateItens(itens);

  const insertConta = db.prepare(`
    INSERT INTO contas_pagar (
      fornecedor_id, nota_recebida_id, categoria_despesa_id,
      descricao, valor, data_emissao, data_vencimento,
      forma_pagamento, status, parcela_numero, parcela_total, created_by
    ) VALUES (
      @fornecedor_id, @nota_recebida_id, @categoria_despesa_id,
      @descricao, @valor, @data_emissao, @data_vencimento,
      @forma_pagamento, @status, @parcela_numero, @parcela_total, @created_by
    )
  `);

  const run = db.transaction(() => {
    const notaId = createNota({ ...data, created_by: userId });

    for (let i = 0; i < itens.length; i++) {
      insertItem(notaId, itens[i], i + 1);
    }

    if (data.gerar_contas_pagar) {
      const parcelas = buildParcelas(data, notaId, userId);
      for (const p of parcelas) insertConta.run(p);
    }

    return notaId;
  });

  const notaId = run();
  return findNotaById(notaId);
}

function updateNotaExistente(id, data, userId) {
  const existing = findNotaById(id);
  if (!existing) throw Object.assign(new Error("Nota não encontrada."), { code: "NOT_FOUND" });
  if (existing.status === "cancelada") {
    throw Object.assign(new Error("Não é possível editar uma nota cancelada."), { code: "VALIDATION" });
  }
  validateNota(data);
  checkDuplicatas(data, id);

  const itens = Array.isArray(data.itens) ? data.itens : [];
  validateItens(itens);

  // v1: delete + reinsert (safe enquanto não houver movimentação de estoque vinculada)
  const run = db.transaction(() => {
    updateNota(id, data);
    deleteItensNota(id);
    for (let i = 0; i < itens.length; i++) {
      insertItem(id, itens[i], i + 1);
    }
  });

  run();
  return findNotaById(id);
}

function cancelarNotaById(id, userId) {
  const existing = findNotaById(id);
  if (!existing) throw Object.assign(new Error("Nota não encontrada."), { code: "NOT_FOUND" });
  if (existing.status === "cancelada") {
    throw Object.assign(new Error("Nota já está cancelada."), { code: "VALIDATION" });
  }

  const contasAbertas = countContasAbertas(id);
  if (contasAbertas > 0) {
    throw Object.assign(
      new Error(`Esta nota possui ${contasAbertas} conta(s) a pagar em aberto. Cancele-as antes de cancelar a nota.`),
      { code: "HAS_CONTAS_ABERTAS", count: contasAbertas }
    );
  }

  cancelarNota(id);
}

module.exports = {
  getAllNotas,
  getNotaById,
  getNotaDetalhes,
  createNotaComContas,
  updateNotaExistente,
  cancelarNotaById,
};

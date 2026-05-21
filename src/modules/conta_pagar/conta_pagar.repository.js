const db = require("../../db/connection");

const ATRASADO_EXPR = `CASE WHEN cp.status = 'em_aberto' AND cp.data_vencimento < date('now') THEN 1 ELSE 0 END`;

function listContasPagar({ fornecedor_id, status, categoria_id, forma_pagamento, limit = 100, offset = 0 } = {}) {
  const conditions = [];
  const params = [];

  if (fornecedor_id)   { conditions.push("cp.fornecedor_id = ?");        params.push(fornecedor_id); }
  if (status === "atrasado") {
    conditions.push("cp.status = 'em_aberto' AND cp.data_vencimento < date('now')");
  } else if (status)   { conditions.push("cp.status = ?");               params.push(status); }
  if (categoria_id)    { conditions.push("cp.categoria_despesa_id = ?"); params.push(categoria_id); }
  if (forma_pagamento) { conditions.push("cp.forma_pagamento = ?");      params.push(forma_pagamento); }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  params.push(limit, offset);

  return db.prepare(`
    SELECT
      cp.id, cp.descricao, cp.valor, cp.data_emissao, cp.data_vencimento,
      cp.forma_pagamento, cp.status, cp.data_pagamento, cp.valor_pago,
      cp.comprovante_pagamento, cp.parcela_numero, cp.parcela_total,
      cp.cancel_reason, cp.cancelled_at, cp.observacoes,
      cp.nota_recebida_id, cp.created_at,
      ${ATRASADO_EXPR} AS atrasado,
      f.razao_social AS fornecedor_nome, f.id AS fornecedor_id,
      cd.nome AS categoria_nome,
      nr.numero_nota, nr.serie
    FROM contas_pagar cp
    JOIN fornecedores f ON f.id = cp.fornecedor_id
    LEFT JOIN categorias_despesa cd ON cd.id = cp.categoria_despesa_id
    LEFT JOIN notas_recebidas nr ON nr.id = cp.nota_recebida_id
    ${where}
    ORDER BY cp.data_vencimento ASC
    LIMIT ? OFFSET ?
  `).all(...params);
}

function findContaById(id) {
  return db.prepare(`
    SELECT
      cp.*,
      ${ATRASADO_EXPR} AS atrasado,
      f.razao_social AS fornecedor_nome,
      cd.nome AS categoria_nome,
      nr.numero_nota, nr.serie,
      upaid.nome AS pago_por_nome,
      ucanc.nome AS cancelado_por_nome,
      ucreated.nome AS criado_por_nome
    FROM contas_pagar cp
    JOIN fornecedores f ON f.id = cp.fornecedor_id
    LEFT JOIN categorias_despesa cd ON cd.id = cp.categoria_despesa_id
    LEFT JOIN notas_recebidas nr ON nr.id = cp.nota_recebida_id
    LEFT JOIN users upaid    ON upaid.id    = cp.paid_by
    LEFT JOIN users ucanc    ON ucanc.id    = cp.cancelled_by
    LEFT JOIN users ucreated ON ucreated.id = cp.created_by
    WHERE cp.id = ?
  `).get(id);
}

function createConta(data) {
  const result = db.prepare(`
    INSERT INTO contas_pagar (
      fornecedor_id, nota_recebida_id, categoria_despesa_id,
      descricao, valor, data_emissao, data_vencimento,
      forma_pagamento, status, parcela_numero, parcela_total,
      observacoes, created_by
    ) VALUES (
      @fornecedor_id, @nota_recebida_id, @categoria_despesa_id,
      @descricao, @valor, @data_emissao, @data_vencimento,
      @forma_pagamento, 'em_aberto', @parcela_numero, @parcela_total,
      @observacoes, @created_by
    )
  `).run({
    fornecedor_id:        data.fornecedor_id,
    nota_recebida_id:     data.nota_recebida_id     ?? null,
    categoria_despesa_id: data.categoria_despesa_id ?? null,
    descricao:            data.descricao,
    valor:                data.valor,
    data_emissao:         data.data_emissao,
    data_vencimento:      data.data_vencimento,
    forma_pagamento:      data.forma_pagamento       ?? null,
    parcela_numero:       data.parcela_numero        ?? null,
    parcela_total:        data.parcela_total         ?? null,
    observacoes:          data.observacoes           ?? null,
    created_by:           data.created_by,
  });
  return result.lastInsertRowid;
}

function updateConta(id, data) {
  db.prepare(`
    UPDATE contas_pagar SET
      fornecedor_id        = @fornecedor_id,
      categoria_despesa_id = @categoria_despesa_id,
      descricao            = @descricao,
      valor                = @valor,
      data_emissao         = @data_emissao,
      data_vencimento      = @data_vencimento,
      forma_pagamento      = @forma_pagamento,
      observacoes          = @observacoes
    WHERE id = @id
  `).run({
    id,
    fornecedor_id:        data.fornecedor_id,
    categoria_despesa_id: data.categoria_despesa_id ?? null,
    descricao:            data.descricao,
    valor:                data.valor,
    data_emissao:         data.data_emissao,
    data_vencimento:      data.data_vencimento,
    forma_pagamento:      data.forma_pagamento       ?? null,
    observacoes:          data.observacoes           ?? null,
  });
}

function baixarConta(id, baixaData) {
  db.prepare(`
    UPDATE contas_pagar SET
      status               = 'pago',
      data_pagamento       = @data_pagamento,
      valor_pago           = @valor_pago,
      forma_pagamento      = @forma_pagamento,
      comprovante_pagamento = @comprovante_pagamento,
      paid_by              = @paid_by,
      observacoes          = CASE WHEN @obs IS NOT NULL THEN @obs ELSE observacoes END
    WHERE id = @id
  `).run({
    id,
    data_pagamento:       baixaData.data_pagamento,
    valor_pago:           baixaData.valor_pago,
    forma_pagamento:      baixaData.forma_pagamento       ?? null,
    comprovante_pagamento: baixaData.comprovante_pagamento ?? null,
    paid_by:              baixaData.paid_by,
    obs:                  baixaData.observacoes           ?? null,
  });
}

function cancelarConta(id, cancelData) {
  db.prepare(`
    UPDATE contas_pagar SET
      status        = 'cancelado',
      cancelled_by  = @cancelled_by,
      cancelled_at  = datetime('now'),
      cancel_reason = @cancel_reason
    WHERE id = @id
  `).run({ id, cancelled_by: cancelData.cancelled_by, cancel_reason: cancelData.cancel_reason ?? null });
}

function getResumoFinanceiro() {
  const hoje = new Date().toISOString().slice(0, 10);
  const inicioMes = hoje.slice(0, 7) + "-01";
  const fimMes = hoje;
  const seteDias = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

  const totais = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'em_aberto' AND data_vencimento >= date('now') THEN valor ELSE 0 END) AS total_aberto,
      SUM(CASE WHEN status = 'em_aberto' AND data_vencimento <  date('now') THEN valor ELSE 0 END) AS total_atrasado,
      SUM(CASE WHEN status = 'pago' AND data_pagamento BETWEEN ? AND ?     THEN valor_pago ELSE 0 END) AS total_pago_mes
    FROM contas_pagar
  `).get(inicioMes, fimMes);

  const proxVencimentos = db.prepare(`
    SELECT
      cp.id, cp.descricao, cp.valor, cp.data_vencimento,
      f.razao_social AS fornecedor_nome,
      ${ATRASADO_EXPR} AS atrasado
    FROM contas_pagar cp
    JOIN fornecedores f ON f.id = cp.fornecedor_id
    WHERE cp.status = 'em_aberto'
    ORDER BY cp.data_vencimento ASC
    LIMIT 10
  `).all();

  const vencendo7dias = db.prepare(`
    SELECT COUNT(*) AS n, SUM(valor) AS total
    FROM contas_pagar
    WHERE status = 'em_aberto'
      AND data_vencimento >= date('now')
      AND data_vencimento <= ?
  `).get(seteDias);

  const porCategoria = db.prepare(`
    SELECT
      COALESCE(cd.nome, 'Sem categoria') AS categoria,
      COUNT(*) AS qtd,
      SUM(cp.valor) AS total
    FROM contas_pagar cp
    LEFT JOIN categorias_despesa cd ON cd.id = cp.categoria_despesa_id
    WHERE cp.status IN ('em_aberto', 'pago')
    GROUP BY cd.id, cd.nome
    ORDER BY total DESC
  `).all();

  return { totais, proxVencimentos, vencendo7dias, porCategoria };
}

module.exports = {
  listContasPagar,
  findContaById,
  createConta,
  updateConta,
  baixarConta,
  cancelarConta,
  getResumoFinanceiro,
};

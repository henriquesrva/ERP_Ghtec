const db = require("../../db/connection");

function listNotasRecebidas({ fornecedor_id, status, categoria_id, limit = 100, offset = 0 } = {}) {
  const conditions = [];
  const params = [];

  if (fornecedor_id) { conditions.push("nr.fornecedor_id = ?"); params.push(fornecedor_id); }
  if (status)        { conditions.push("nr.status = ?");        params.push(status); }
  if (categoria_id)  { conditions.push("nr.categoria_despesa_id = ?"); params.push(categoria_id); }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  params.push(limit, offset);

  return db.prepare(`
    SELECT
      nr.id, nr.numero_nota, nr.serie, nr.tipo_nota,
      nr.data_emissao, nr.data_entrada, nr.valor_total,
      nr.descricao, nr.status, nr.chave_acesso,
      nr.arquivo_pdf, nr.arquivo_xml,
      nr.created_at,
      f.razao_social AS fornecedor_nome, f.id AS fornecedor_id,
      cd.nome AS categoria_nome,
      u.nome AS criado_por_nome,
      (SELECT COUNT(*) FROM contas_pagar cp WHERE cp.nota_recebida_id = nr.id) AS total_contas,
      (SELECT COUNT(*) FROM itens_nota_recebida i WHERE i.nota_recebida_id = nr.id) AS total_itens
    FROM notas_recebidas nr
    JOIN fornecedores f ON f.id = nr.fornecedor_id
    LEFT JOIN categorias_despesa cd ON cd.id = nr.categoria_despesa_id
    LEFT JOIN users u ON u.id = nr.created_by
    ${where}
    ORDER BY nr.data_entrada DESC
    LIMIT ? OFFSET ?
  `).all(...params);
}

function findNotaById(id) {
  return db.prepare(`
    SELECT
      nr.*,
      f.razao_social AS fornecedor_nome,
      f.cnpj AS fornecedor_cnpj,
      cd.nome AS categoria_nome,
      u.nome AS criado_por_nome
    FROM notas_recebidas nr
    JOIN fornecedores f ON f.id = nr.fornecedor_id
    LEFT JOIN categorias_despesa cd ON cd.id = nr.categoria_despesa_id
    LEFT JOIN users u ON u.id = nr.created_by
    WHERE nr.id = ?
  `).get(id);
}

function findNotaContasPagar(notaId) {
  return db.prepare(`
    SELECT
      cp.*,
      CASE WHEN cp.status = 'em_aberto' AND cp.data_vencimento < date('now') THEN 1 ELSE 0 END AS atrasado,
      upaid.nome AS pago_por_nome,
      ucanc.nome AS cancelado_por_nome
    FROM contas_pagar cp
    LEFT JOIN users upaid ON upaid.id = cp.paid_by
    LEFT JOIN users ucanc ON ucanc.id = cp.cancelled_by
    WHERE cp.nota_recebida_id = ?
    ORDER BY cp.parcela_numero ASC, cp.data_vencimento ASC
  `).all(notaId);
}

function listItensNota(notaId) {
  return db.prepare(`
    SELECT i.*, p.nome AS produto_nome
    FROM itens_nota_recebida i
    LEFT JOIN parts p ON p.id = i.produto_id
    WHERE i.nota_recebida_id = ?
    ORDER BY i.numero_item ASC
  `).all(notaId);
}

function insertItem(notaId, item, numero) {
  const n = (v) => (v === "" || v == null ? null : v);
  const f = (v) => (v === "" || v == null ? null : parseFloat(v));
  const i2 = (v) => (v === "" || v == null ? null : parseInt(v));

  db.prepare(`
    INSERT INTO itens_nota_recebida (
      nota_recebida_id, produto_id, numero_item, codigo_produto, descricao,
      ncm, cfop, unidade, quantidade, valor_unitario, valor_total, valor_desconto,
      origem_mercadoria,
      cst_icms, csosn, modalidade_bc_icms, reducao_base_icms,
      valor_bc_icms, aliquota_icms, valor_icms,
      valor_bc_icms_st, aliquota_icms_st, valor_icms_st,
      cst_ipi, codigo_enquadramento_ipi, valor_bc_ipi, aliquota_ipi, valor_ipi,
      cst_pis, valor_bc_pis, aliquota_pis, valor_pis,
      cst_cofins, valor_bc_cofins, aliquota_cofins, valor_cofins,
      aliquota_iss, valor_iss, cest, informacoes_adicionais
    ) VALUES (
      @nota_recebida_id, @produto_id, @numero_item, @codigo_produto, @descricao,
      @ncm, @cfop, @unidade, @quantidade, @valor_unitario, @valor_total, @valor_desconto,
      @origem_mercadoria,
      @cst_icms, @csosn, @modalidade_bc_icms, @reducao_base_icms,
      @valor_bc_icms, @aliquota_icms, @valor_icms,
      @valor_bc_icms_st, @aliquota_icms_st, @valor_icms_st,
      @cst_ipi, @codigo_enquadramento_ipi, @valor_bc_ipi, @aliquota_ipi, @valor_ipi,
      @cst_pis, @valor_bc_pis, @aliquota_pis, @valor_pis,
      @cst_cofins, @valor_bc_cofins, @aliquota_cofins, @valor_cofins,
      @aliquota_iss, @valor_iss, @cest, @informacoes_adicionais
    )
  `).run({
    nota_recebida_id:         notaId,
    produto_id:               n(item.produto_id),
    numero_item:              numero,
    codigo_produto:           n(item.codigo_produto),
    descricao:                item.descricao,
    ncm:                      n(item.ncm),
    cfop:                     n(item.cfop),
    unidade:                  n(item.unidade),
    quantidade:               f(item.quantidade),
    valor_unitario:           f(item.valor_unitario),
    valor_total:              f(item.valor_total),
    valor_desconto:           f(item.valor_desconto),
    origem_mercadoria:        n(item.origem_mercadoria),
    cst_icms:                 n(item.cst_icms),
    csosn:                    n(item.csosn),
    modalidade_bc_icms:       i2(item.modalidade_bc_icms),
    reducao_base_icms:        f(item.reducao_base_icms),
    valor_bc_icms:            f(item.valor_bc_icms),
    aliquota_icms:            f(item.aliquota_icms),
    valor_icms:               f(item.valor_icms),
    valor_bc_icms_st:         f(item.valor_bc_icms_st),
    aliquota_icms_st:         f(item.aliquota_icms_st),
    valor_icms_st:            f(item.valor_icms_st),
    cst_ipi:                  n(item.cst_ipi),
    codigo_enquadramento_ipi: n(item.codigo_enquadramento_ipi),
    valor_bc_ipi:             f(item.valor_bc_ipi),
    aliquota_ipi:             f(item.aliquota_ipi),
    valor_ipi:                f(item.valor_ipi),
    cst_pis:                  n(item.cst_pis),
    valor_bc_pis:             f(item.valor_bc_pis),
    aliquota_pis:             f(item.aliquota_pis),
    valor_pis:                f(item.valor_pis),
    cst_cofins:               n(item.cst_cofins),
    valor_bc_cofins:          f(item.valor_bc_cofins),
    aliquota_cofins:          f(item.aliquota_cofins),
    valor_cofins:             f(item.valor_cofins),
    aliquota_iss:             f(item.aliquota_iss),
    valor_iss:                f(item.valor_iss),
    cest:                     n(item.cest),
    informacoes_adicionais:   n(item.informacoes_adicionais),
  });
}

function deleteItensNota(notaId) {
  db.prepare(`DELETE FROM itens_nota_recebida WHERE nota_recebida_id = ?`).run(notaId);
}

function checkDuplicataNota(fornecedor_id, numero_nota, serie, excludeId = null) {
  if (!numero_nota || !serie) return null;
  let q = `
    SELECT id FROM notas_recebidas
    WHERE fornecedor_id = ? AND numero_nota = ? AND serie = ?
  `;
  const params = [fornecedor_id, numero_nota, serie];
  if (excludeId) { q += ` AND id != ?`; params.push(excludeId); }
  return db.prepare(q).get(...params);
}

function checkDuplicataChave(chave_acesso, excludeId = null) {
  if (!chave_acesso?.trim()) return null;
  let q = `SELECT id FROM notas_recebidas WHERE chave_acesso = ?`;
  const params = [chave_acesso];
  if (excludeId) { q += ` AND id != ?`; params.push(excludeId); }
  return db.prepare(q).get(...params);
}

function createNota(data) {
  const n = (v) => (v === "" || v == null ? null : v);
  const f = (v) => (v === "" || v == null ? null : parseFloat(v));
  const i2 = (v) => (v === "" || v == null ? null : parseInt(v));

  const result = db.prepare(`
    INSERT INTO notas_recebidas (
      fornecedor_id, numero_nota, serie, chave_acesso, tipo_nota,
      data_emissao, data_entrada, valor_total, descricao,
      categoria_despesa_id, arquivo_pdf, arquivo_xml,
      status, observacoes, created_by,
      natureza_operacao, cfop_principal, modalidade_frete,
      valor_frete, valor_seguro, valor_desconto, valor_outras_despesas,
      valor_bc_icms, valor_icms, valor_ipi, valor_pis, valor_cofins, valor_iss,
      numero_protocolo, data_autorizacao
    ) VALUES (
      @fornecedor_id, @numero_nota, @serie, @chave_acesso, @tipo_nota,
      @data_emissao, @data_entrada, @valor_total, @descricao,
      @categoria_despesa_id, @arquivo_pdf, @arquivo_xml,
      'lancada', @observacoes, @created_by,
      @natureza_operacao, @cfop_principal, @modalidade_frete,
      @valor_frete, @valor_seguro, @valor_desconto, @valor_outras_despesas,
      @valor_bc_icms, @valor_icms, @valor_ipi, @valor_pis, @valor_cofins, @valor_iss,
      @numero_protocolo, @data_autorizacao
    )
  `).run({
    fornecedor_id:        data.fornecedor_id,
    numero_nota:          n(data.numero_nota),
    serie:                n(data.serie),
    chave_acesso:         n(data.chave_acesso),
    tipo_nota:            data.tipo_nota ?? "produto",
    data_emissao:         n(data.data_emissao),
    data_entrada:         data.data_entrada,
    valor_total:          data.valor_total,
    descricao:            n(data.descricao),
    categoria_despesa_id: data.categoria_despesa_id ?? null,
    arquivo_pdf:          n(data.arquivo_pdf),
    arquivo_xml:          n(data.arquivo_xml),
    observacoes:          n(data.observacoes),
    created_by:           data.created_by,
    natureza_operacao:    n(data.natureza_operacao),
    cfop_principal:       n(data.cfop_principal),
    modalidade_frete:     i2(data.modalidade_frete),
    valor_frete:          f(data.valor_frete),
    valor_seguro:         f(data.valor_seguro),
    valor_desconto:       f(data.valor_desconto),
    valor_outras_despesas:f(data.valor_outras_despesas),
    valor_bc_icms:        f(data.valor_bc_icms),
    valor_icms:           f(data.valor_icms),
    valor_ipi:            f(data.valor_ipi),
    valor_pis:            f(data.valor_pis),
    valor_cofins:         f(data.valor_cofins),
    valor_iss:            f(data.valor_iss),
    numero_protocolo:     n(data.numero_protocolo),
    data_autorizacao:     n(data.data_autorizacao),
  });
  return result.lastInsertRowid;
}

function updateNota(id, data) {
  const n = (v) => (v === "" || v == null ? null : v);
  const f = (v) => (v === "" || v == null ? null : parseFloat(v));
  const i2 = (v) => (v === "" || v == null ? null : parseInt(v));

  db.prepare(`
    UPDATE notas_recebidas SET
      fornecedor_id        = @fornecedor_id,
      numero_nota          = @numero_nota,
      serie                = @serie,
      chave_acesso         = @chave_acesso,
      tipo_nota            = @tipo_nota,
      data_emissao         = @data_emissao,
      data_entrada         = @data_entrada,
      valor_total          = @valor_total,
      descricao            = @descricao,
      categoria_despesa_id = @categoria_despesa_id,
      observacoes          = @observacoes,
      natureza_operacao    = @natureza_operacao,
      cfop_principal       = @cfop_principal,
      modalidade_frete     = @modalidade_frete,
      valor_frete          = @valor_frete,
      valor_seguro         = @valor_seguro,
      valor_desconto       = @valor_desconto,
      valor_outras_despesas = @valor_outras_despesas,
      valor_bc_icms        = @valor_bc_icms,
      valor_icms           = @valor_icms,
      valor_ipi            = @valor_ipi,
      valor_pis            = @valor_pis,
      valor_cofins         = @valor_cofins,
      valor_iss            = @valor_iss,
      numero_protocolo     = @numero_protocolo,
      data_autorizacao     = @data_autorizacao
    WHERE id = @id
  `).run({
    id,
    fornecedor_id:        data.fornecedor_id,
    numero_nota:          n(data.numero_nota),
    serie:                n(data.serie),
    chave_acesso:         n(data.chave_acesso),
    tipo_nota:            data.tipo_nota ?? "produto",
    data_emissao:         n(data.data_emissao),
    data_entrada:         data.data_entrada,
    valor_total:          data.valor_total,
    descricao:            n(data.descricao),
    categoria_despesa_id: data.categoria_despesa_id ?? null,
    observacoes:          n(data.observacoes),
    natureza_operacao:    n(data.natureza_operacao),
    cfop_principal:       n(data.cfop_principal),
    modalidade_frete:     i2(data.modalidade_frete),
    valor_frete:          f(data.valor_frete),
    valor_seguro:         f(data.valor_seguro),
    valor_desconto:       f(data.valor_desconto),
    valor_outras_despesas:f(data.valor_outras_despesas),
    valor_bc_icms:        f(data.valor_bc_icms),
    valor_icms:           f(data.valor_icms),
    valor_ipi:            f(data.valor_ipi),
    valor_pis:            f(data.valor_pis),
    valor_cofins:         f(data.valor_cofins),
    valor_iss:            f(data.valor_iss),
    numero_protocolo:     n(data.numero_protocolo),
    data_autorizacao:     n(data.data_autorizacao),
  });
}

function cancelarNota(id) {
  db.prepare(`UPDATE notas_recebidas SET status = 'cancelada' WHERE id = ?`).run(id);
}

function countContasAbertas(notaId) {
  return db.prepare(`
    SELECT COUNT(*) AS n FROM contas_pagar
    WHERE nota_recebida_id = ? AND status NOT IN ('cancelado', 'pago')
  `).get(notaId).n;
}

module.exports = {
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
};

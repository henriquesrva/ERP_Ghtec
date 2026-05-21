const db = require("../../db/connection");

function stripCnpj(cnpj) {
  if (!cnpj) return null;
  return cnpj.replace(/\D/g, "");
}

function listAllFornecedores({ includeInactive = false } = {}) {
  const where = includeInactive ? "" : "WHERE f.ativo = 1";
  return db.prepare(`
    SELECT
      f.id, f.razao_social, f.nome_fantasia, f.cnpj,
      f.email, f.telefone, f.cidade, f.estado, f.ativo,
      f.created_at, f.updated_at,
      (SELECT COUNT(*) FROM notas_recebidas nr WHERE nr.fornecedor_id = f.id) AS total_notas,
      (SELECT COUNT(*) FROM contas_pagar cp WHERE cp.fornecedor_id = f.id) AS total_contas
    FROM fornecedores f
    ${where}
    ORDER BY f.razao_social ASC
  `).all();
}

function findFornecedorById(id) {
  return db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(id);
}

function findFornecedorByCnpj(cnpj) {
  const digits = stripCnpj(cnpj);
  if (!digits) return null;
  return db.prepare(`
    SELECT * FROM fornecedores
    WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj,'.',''),'/',''),'-',''),' ','') = ?
    LIMIT 1
  `).get(digits);
}

function searchFornecedores(q, { includeInactive = false } = {}) {
  const term = `%${q}%`;
  const atvFilter = includeInactive ? "" : "AND ativo = 1";
  return db.prepare(`
    SELECT id, razao_social, nome_fantasia, cnpj, cidade, estado, ativo
    FROM fornecedores
    WHERE (razao_social LIKE ? OR nome_fantasia LIKE ? OR cnpj LIKE ?)
      ${atvFilter}
    ORDER BY razao_social ASC
    LIMIT 15
  `).all(term, term, term);
}

function createFornecedor(data) {
  const result = db.prepare(`
    INSERT INTO fornecedores (
      razao_social, nome_fantasia, cnpj, inscricao_estadual,
      email, telefone, endereco, cidade, estado, cep, observacoes
    ) VALUES (
      @razao_social, @nome_fantasia, @cnpj, @inscricao_estadual,
      @email, @telefone, @endereco, @cidade, @estado, @cep, @observacoes
    )
  `).run({
    razao_social:       data.razao_social       ?? null,
    nome_fantasia:      data.nome_fantasia       ?? null,
    cnpj:               data.cnpj               ?? null,
    inscricao_estadual: data.inscricao_estadual  ?? null,
    email:              data.email              ?? null,
    telefone:           data.telefone           ?? null,
    endereco:           data.endereco           ?? null,
    cidade:             data.cidade             ?? null,
    estado:             data.estado             ?? null,
    cep:                data.cep                ?? null,
    observacoes:        data.observacoes        ?? null,
  });
  return result.lastInsertRowid;
}

function updateFornecedor(id, data) {
  db.prepare(`
    UPDATE fornecedores SET
      razao_social       = @razao_social,
      nome_fantasia      = @nome_fantasia,
      cnpj               = @cnpj,
      inscricao_estadual = @inscricao_estadual,
      email              = @email,
      telefone           = @telefone,
      endereco           = @endereco,
      cidade             = @cidade,
      estado             = @estado,
      cep                = @cep,
      observacoes        = @observacoes
    WHERE id = @id
  `).run({
    id,
    razao_social:       data.razao_social       ?? null,
    nome_fantasia:      data.nome_fantasia       ?? null,
    cnpj:               data.cnpj               ?? null,
    inscricao_estadual: data.inscricao_estadual  ?? null,
    email:              data.email              ?? null,
    telefone:           data.telefone           ?? null,
    endereco:           data.endereco           ?? null,
    cidade:             data.cidade             ?? null,
    estado:             data.estado             ?? null,
    cep:                data.cep                ?? null,
    observacoes:        data.observacoes        ?? null,
  });
}

function desativarFornecedor(id) {
  db.prepare(`UPDATE fornecedores SET ativo = 0 WHERE id = ?`).run(id);
}

function countVinculos(id) {
  const notas  = db.prepare(`SELECT COUNT(*) AS n FROM notas_recebidas WHERE fornecedor_id = ?`).get(id).n;
  const contas = db.prepare(`SELECT COUNT(*) AS n FROM contas_pagar    WHERE fornecedor_id = ?`).get(id).n;
  return { notas, contas };
}

function getFornecedorDetalhes(id) {
  const fornecedor = db.prepare(`SELECT * FROM fornecedores WHERE id = ?`).get(id);
  if (!fornecedor) return null;

  const notas = db.prepare(`
    SELECT nr.id, nr.numero_nota, nr.serie, nr.tipo_nota,
           nr.data_entrada, nr.valor_total, nr.status,
           cd.nome AS categoria_nome
    FROM notas_recebidas nr
    LEFT JOIN categorias_despesa cd ON cd.id = nr.categoria_despesa_id
    WHERE nr.fornecedor_id = ?
    ORDER BY nr.data_entrada DESC
    LIMIT 20
  `).all(id);

  const contas = db.prepare(`
    SELECT cp.id, cp.descricao, cp.valor, cp.data_vencimento,
           cp.status, cp.data_pagamento, cp.parcela_numero, cp.parcela_total,
           CASE WHEN cp.status = 'em_aberto' AND cp.data_vencimento < date('now') THEN 1 ELSE 0 END AS atrasado
    FROM contas_pagar cp
    WHERE cp.fornecedor_id = ?
    ORDER BY cp.data_vencimento ASC
    LIMIT 20
  `).all(id);

  return { fornecedor, notas, contas };
}

module.exports = {
  listAllFornecedores,
  findFornecedorById,
  findFornecedorByCnpj,
  searchFornecedores,
  createFornecedor,
  updateFornecedor,
  desativarFornecedor,
  countVinculos,
  getFornecedorDetalhes,
};

const db = require("../../db/connection");

function listCategoriasDespesa({ apenasAtivas = true } = {}) {
  const where = apenasAtivas ? "WHERE ativo = 1" : "";
  return db.prepare(`
    SELECT id, nome, descricao, ativo, created_at, updated_at
    FROM categorias_despesa
    ${where}
    ORDER BY nome ASC
  `).all();
}

function findCategoriaDespesaById(id) {
  return db.prepare(`SELECT * FROM categorias_despesa WHERE id = ?`).get(id);
}

function createCategoriaDespesa(data) {
  const result = db.prepare(`
    INSERT INTO categorias_despesa (nome, descricao)
    VALUES (@nome, @descricao)
  `).run({ nome: data.nome.trim(), descricao: data.descricao?.trim() ?? null });
  return result.lastInsertRowid;
}

function updateCategoriaDespesa(id, data) {
  db.prepare(`
    UPDATE categorias_despesa SET nome = @nome, descricao = @descricao WHERE id = @id
  `).run({ id, nome: data.nome.trim(), descricao: data.descricao?.trim() ?? null });
}

function desativarCategoriaDespesa(id) {
  db.prepare(`UPDATE categorias_despesa SET ativo = 0 WHERE id = ?`).run(id);
}

function countUsoCategoria(id) {
  const notas  = db.prepare(`SELECT COUNT(*) AS n FROM notas_recebidas WHERE categoria_despesa_id = ?`).get(id).n;
  const contas = db.prepare(`SELECT COUNT(*) AS n FROM contas_pagar    WHERE categoria_despesa_id = ?`).get(id).n;
  return { notas, contas };
}

module.exports = {
  listCategoriasDespesa,
  findCategoriaDespesaById,
  createCategoriaDespesa,
  updateCategoriaDespesa,
  desativarCategoriaDespesa,
  countUsoCategoria,
};

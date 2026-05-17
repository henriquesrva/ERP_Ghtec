const db = require("../../db/connection");

function listAllObjetos() {
  return db.prepare(`
    SELECT id, nome, descricao, created_at
    FROM objetos
    ORDER BY nome ASC
  `).all();
}

function findObjetoById(id) {
  return db.prepare(`SELECT * FROM objetos WHERE id = ?`).get(id);
}

function searchObjetos(q) {
  const term = `%${q}%`;
  return db.prepare(`
    SELECT id, nome, descricao
    FROM objetos
    WHERE nome LIKE ? OR descricao LIKE ?
    ORDER BY nome ASC
    LIMIT 20
  `).all(term, term);
}

function createObjeto(data) {
  const result = db.prepare(`
    INSERT INTO objetos (nome, descricao)
    VALUES (@nome, @descricao)
  `).run({
    nome:     data.nome      ?? null,
    descricao: data.descricao ?? null,
  });
  return result.lastInsertRowid;
}

function deleteObjetoById(id) {
  db.prepare(`DELETE FROM objetos WHERE id = ?`).run(id);
}

module.exports = {
  listAllObjetos,
  findObjetoById,
  searchObjetos,
  createObjeto,
  deleteObjetoById,
};

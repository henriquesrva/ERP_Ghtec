const db = require("../../db/connection");

function listAllResponsaveis() {
  return db.prepare(`
    SELECT id, nome, telefone, cargo, created_at
    FROM responsaveis
    ORDER BY nome ASC
  `).all();
}

function findResponsavelById(id) {
  return db.prepare(`SELECT * FROM responsaveis WHERE id = ?`).get(id);
}

function searchResponsaveis(q) {
  const term = `%${q}%`;
  return db.prepare(`
    SELECT id, nome, telefone, cargo
    FROM responsaveis
    WHERE nome LIKE ? OR cargo LIKE ?
    ORDER BY nome ASC
    LIMIT 10
  `).all(term, term);
}

function createResponsavel(data) {
  const result = db.prepare(`
    INSERT INTO responsaveis (nome, telefone, cargo)
    VALUES (@nome, @telefone, @cargo)
  `).run({
    nome:     data.nome     ?? null,
    telefone: data.telefone ?? null,
    cargo:    data.cargo    ?? null,
  });
  return result.lastInsertRowid;
}

function deleteResponsavelById(id) {
  db.prepare(`DELETE FROM responsaveis WHERE id = ?`).run(id);
}

module.exports = {
  listAllResponsaveis,
  findResponsavelById,
  searchResponsaveis,
  createResponsavel,
  deleteResponsavelById,
};

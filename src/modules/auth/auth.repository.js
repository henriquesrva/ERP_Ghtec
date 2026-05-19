const db = require("../../db/connection");

function findUserByUsername(username) {
  return db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
}

function findUserById(id) {
  return db.prepare(`
    SELECT id, nome, username, role, signature_cargo, signature_telefone, created_at
    FROM users WHERE id = ?
  `).get(id);
}

function listUsers() {
  return db.prepare(`
    SELECT id, nome, username, role, signature_cargo, signature_telefone, created_at
    FROM users ORDER BY created_at ASC
  `).all();
}

function createUser(data) {
  const result = db.prepare(`
    INSERT INTO users (nome, username, password_hash, role)
    VALUES (@nome, @username, @password_hash, @role)
  `).run({
    nome:          data.nome,
    username:      data.username,
    password_hash: data.password_hash,
    role:          data.role || "user",
  });
  return result.lastInsertRowid;
}

function updateUserPassword(id, newHash) {
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(newHash, id);
}

function updateUserRole(id, role) {
  db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, id);
}

function updateUserSignature(id, { cargo, telefone }) {
  db.prepare(`
    UPDATE users SET signature_cargo = ?, signature_telefone = ? WHERE id = ?
  `).run(cargo || null, telefone || null, id);
}

function deleteUserById(id) {
  db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
}

function countUsers() {
  return db.prepare(`SELECT COUNT(*) AS n FROM users`).get().n;
}

function countAdmins() {
  return db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`).get().n;
}

module.exports = {
  findUserByUsername,
  findUserById,
  listUsers,
  createUser,
  updateUserPassword,
  updateUserRole,
  updateUserSignature,
  deleteUserById,
  countUsers,
  countAdmins,
};

// Setup do banco de dados em memória para testes.
// Cada arquivo de teste recebe um módulo isolado (vitest isolate:true),
// portanto uma instância separada do DB em memória.

const db = require("../../src/db/connection");

// Suprime logs de migração durante os testes
const origLog = console.log;
console.log = () => {};
require("../../src/db/init");
require("../../src/db/migrate");
console.log = origLog;

/**
 * Limpa todas as tabelas entre testes.
 * Desativa FKs temporariamente para evitar erros de ordem de deleção.
 */
function clearAllTables() {
  db.pragma("foreign_keys = OFF");
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all();
  for (const { name } of tables) {
    db.prepare(`DELETE FROM "${name}"`).run();
    // Reseta autoincrement para manter IDs previsíveis nos testes
    db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(name);
  }
  db.pragma("foreign_keys = ON");
}

module.exports = { db, clearAllTables };

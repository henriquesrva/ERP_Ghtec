const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.resolve(__dirname, "../../database.sqlite");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
// Evita SQLITE_BUSY em escritas concorrentes leves (5 s de retry automático)
db.pragma("busy_timeout = 5000");

module.exports = db;
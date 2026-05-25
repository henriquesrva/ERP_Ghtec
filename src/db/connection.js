const Database = require("better-sqlite3");
const path = require("path");

const isTest = process.env.NODE_ENV === "test";
const dbPath = isTest ? ":memory:" : path.resolve(__dirname, "../../database.sqlite");

const db = new Database(dbPath);

if (!isTest) {
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
}
db.pragma("foreign_keys = ON");

module.exports = db;
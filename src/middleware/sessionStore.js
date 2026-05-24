const path    = require("path");
const Database = require("better-sqlite3");
const session  = require("express-session");

// Sessões ficam em arquivo separado do banco principal para não misturar
// dados de domínio com infraestrutura de autenticação.
const SESSIONS_DB_PATH = path.resolve(__dirname, "../../sessions.sqlite");

// TTL padrão em segundos (8 horas — igual ao maxAge do cookie).
const DEFAULT_TTL = 8 * 60 * 60;

// Intervalo de limpeza de sessões expiradas: a cada 15 minutos.
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

class BetterSQLiteStore extends session.Store {
  constructor(options = {}) {
    super();

    this.ttl = options.ttl || DEFAULT_TTL;

    this._db = new Database(options.path || SESSIONS_DB_PATH);
    this._db.pragma("journal_mode = WAL");
    this._db.pragma("busy_timeout = 3000");

    this._db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid     TEXT PRIMARY KEY,
        sess    TEXT NOT NULL,
        expired INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions (expired);
    `);

    this._stmtGet     = this._db.prepare("SELECT sess, expired FROM sessions WHERE sid = ?");
    this._stmtSet     = this._db.prepare("INSERT OR REPLACE INTO sessions (sid, sess, expired) VALUES (?, ?, ?)");
    this._stmtDestroy = this._db.prepare("DELETE FROM sessions WHERE sid = ?");
    this._stmtCleanup = this._db.prepare("DELETE FROM sessions WHERE expired < ?");

    // Limpa sessões expiradas periodicamente sem bloquear o event loop.
    const timer = setInterval(() => this._cleanup(), CLEANUP_INTERVAL_MS);
    if (timer.unref) timer.unref();

    this._cleanup();
  }

  get(sid, callback) {
    try {
      const row = this._stmtGet.get(sid);
      if (!row) return callback(null, null);
      if (Date.now() > row.expired) {
        this._stmtDestroy.run(sid);
        return callback(null, null);
      }
      callback(null, JSON.parse(row.sess));
    } catch (e) {
      callback(e);
    }
  }

  set(sid, sess, callback) {
    try {
      const expires = sess.cookie && sess.cookie.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + this.ttl * 1000;
      this._stmtSet.run(sid, JSON.stringify(sess), expires);
      callback && callback(null);
    } catch (e) {
      callback && callback(e);
    }
  }

  destroy(sid, callback) {
    try {
      this._stmtDestroy.run(sid);
      callback && callback(null);
    } catch (e) {
      callback && callback(e);
    }
  }

  touch(sid, sess, callback) {
    // Renova o TTL da sessão sem alterar seus dados.
    this.set(sid, sess, callback);
  }

  _cleanup() {
    try {
      this._stmtCleanup.run(Date.now());
    } catch { /* silencioso — não bloqueia nada */ }
  }
}

module.exports = BetterSQLiteStore;

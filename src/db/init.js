const db = require("./connection");

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    nome                TEXT NOT NULL,
    razao_social        TEXT,
    nome_fantasia       TEXT,
    cnpj                TEXT,
    inscricao_estadual  TEXT,
    endereco            TEXT,
    cidade              TEXT,
    estado              TEXT,
    cep                 TEXT,
    email               TEXT,
    telefone            TEXT,
    contato_responsavel TEXT,
    observacoes         TEXT,
    created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at          TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS parts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nome            TEXT NOT NULL,
    descricao       TEXT,
    marca           TEXT,
    modelo          TEXT,
    categoria       TEXT,
    ncm             TEXT,
    codigo_interno  TEXT,
    observacoes     TEXT,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (nome, marca, modelo)
  );

  CREATE TABLE IF NOT EXISTS proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_proposta TEXT NOT NULL UNIQUE,
    cliente_id INTEGER NOT NULL,
    cidade_emissao TEXT NOT NULL,
    data_emissao TEXT NOT NULL,
    objeto_proposta TEXT NOT NULL,
    forma_pagamento TEXT NOT NULL,
    prazo_pagamento TEXT NOT NULL,
    prazo_entrega TEXT NOT NULL,
    garantia TEXT NOT NULL,
    validade TEXT NOT NULL,
    valor_total REAL NOT NULL,
    valor_total_extenso TEXT NOT NULL,
    responsavel_nome TEXT NOT NULL,
    responsavel_cargo TEXT NOT NULL,
    responsavel_email TEXT NOT NULL,
    responsavel_telefone TEXT NOT NULL,
    pdf_path TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clients(id)
  );

  CREATE TABLE IF NOT EXISTS proposal_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id INTEGER NOT NULL,
    item_ordem INTEGER NOT NULL,
    quantidade INTEGER NOT NULL,
    descricao TEXT NOT NULL,
    valor_unitario REAL NOT NULL,
    ncm TEXT,
    FOREIGN KEY (proposal_id) REFERENCES proposals(id)
  );

  CREATE TABLE IF NOT EXISTS price_history (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id             INTEGER NOT NULL,
    part_id               INTEGER,
    proposal_id           INTEGER NOT NULL,
    descricao_original    TEXT NOT NULL,
    descricao_normalizada TEXT NOT NULL,
    quantidade            INTEGER NOT NULL,
    valor_unitario        REAL NOT NULL,
    data_proposta         TEXT NOT NULL,
    numero_proposta       TEXT NOT NULL,
    observacoes           TEXT,
    created_at            TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id)   REFERENCES clients(id),
    FOREIGN KEY (part_id)     REFERENCES parts(id),
    FOREIGN KEY (proposal_id) REFERENCES proposals(id)
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_ph_client_part
    ON price_history(client_id, part_id);

  CREATE INDEX IF NOT EXISTS idx_ph_client_desc
    ON price_history(client_id, descricao_normalizada);

  CREATE TRIGGER IF NOT EXISTS clients_updated_at
  AFTER UPDATE ON clients
  BEGIN
    UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

  CREATE TRIGGER IF NOT EXISTS parts_updated_at
  AFTER UPDATE ON parts
  BEGIN
    UPDATE parts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
`);

console.log("Banco inicializado com sucesso.");
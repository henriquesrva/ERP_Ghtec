const db = require("./connection");
const { normalizeText } = require("../shared/utils/normalize");

// ── Adiciona colunas novas em clients ────────────────────────────────────────

const clientCols = db.pragma("table_info(clients)").map((c) => c.name);

const newClientCols = [
  ["nome_fantasia",       "TEXT"],
  ["inscricao_estadual",  "TEXT"],
  ["email",               "TEXT"],
  ["telefone",            "TEXT"],
  ["contato_responsavel", "TEXT"],
  ["observacoes",         "TEXT"],
  ["updated_at",          "TEXT"],
];

for (const [col, type] of newClientCols) {
  if (!clientCols.includes(col)) {
    db.exec(`ALTER TABLE clients ADD COLUMN ${col} ${type}`);
    console.log(`[migrate] clients: coluna "${col}" adicionada.`);
  }
}

// ── Coluna preco_compra em parts ─────────────────────────────────────────────

const partCols = db.pragma("table_info(parts)").map((c) => c.name);
if (!partCols.includes("preco_compra")) {
  db.exec(`ALTER TABLE parts ADD COLUMN preco_compra REAL`);
  console.log(`[migrate] parts: coluna "preco_compra" adicionada.`);
}

// ── Tabela parts ─────────────────────────────────────────────────────────────

db.exec(`
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

  CREATE TRIGGER IF NOT EXISTS parts_updated_at
  AFTER UPDATE ON parts
  BEGIN
    UPDATE parts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
`);

// ── Tabela price_history ──────────────────────────────────────────────────────

db.exec(`
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
    FOREIGN KEY (client_id)  REFERENCES clients(id),
    FOREIGN KEY (part_id)    REFERENCES parts(id),
    FOREIGN KEY (proposal_id) REFERENCES proposals(id)
  );

  CREATE INDEX IF NOT EXISTS idx_ph_client_part
    ON price_history(client_id, part_id);

  CREATE INDEX IF NOT EXISTS idx_ph_client_desc
    ON price_history(client_id, descricao_normalizada);
`);

// ── Trigger updated_at em clients ────────────────────────────────────────────
// Recriado com IF NOT EXISTS — seguro rodar múltiplas vezes

db.exec(`
  CREATE TRIGGER IF NOT EXISTS clients_updated_at
  AFTER UPDATE ON clients
  BEGIN
    UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
`);

// ── Backfill: importa proposal_items existentes para price_history ───────────

const pendingItems = db.prepare(`
  SELECT
    pi.id          AS item_id,
    pi.descricao,
    pi.quantidade,
    pi.valor_unitario,
    p.id           AS proposal_id,
    p.cliente_id,
    p.data_emissao,
    p.numero_proposta
  FROM proposal_items pi
  JOIN proposals p ON p.id = pi.proposal_id
  WHERE NOT EXISTS (
    SELECT 1 FROM price_history ph
    WHERE ph.proposal_id = p.id
      AND ph.descricao_original = pi.descricao
  )
`).all();

if (pendingItems.length > 0) {
  const insertHistory = db.prepare(`
    INSERT INTO price_history (
      client_id, part_id, proposal_id,
      descricao_original, descricao_normalizada,
      quantidade, valor_unitario,
      data_proposta, numero_proposta
    ) VALUES (
      @client_id, NULL, @proposal_id,
      @descricao_original, @descricao_normalizada,
      @quantidade, @valor_unitario,
      @data_proposta, @numero_proposta
    )
  `);

  const backfill = db.transaction((items) => {
    for (const item of items) {
      insertHistory.run({
        client_id:             item.cliente_id,
        proposal_id:           item.proposal_id,
        descricao_original:    item.descricao,
        descricao_normalizada: normalizeText(item.descricao),
        quantidade:            item.quantidade,
        valor_unitario:        item.valor_unitario,
        data_proposta:         item.data_emissao,
        numero_proposta:       item.numero_proposta,
      });
    }
  });

  backfill(pendingItems);
  console.log(`[migrate] price_history: ${pendingItems.length} registro(s) importado(s) do histórico existente.`);
}

// ── Backfill: cria peças a partir do price_history existente ─────────────────
// Para cada descricao_original ainda sem part_id, garante que exista uma peça
// na tabela parts (find-or-create) e vincula o part_id no price_history.

const orphanItems = db.prepare(`
  SELECT DISTINCT descricao_original, descricao_normalizada,
    (SELECT pi2.ncm FROM proposal_items pi2
       JOIN proposals p2 ON p2.id = pi2.proposal_id
       WHERE pi2.descricao = ph.descricao_original LIMIT 1) AS ncm
  FROM price_history ph
  WHERE ph.part_id IS NULL
`).all();

if (orphanItems.length > 0) {
  const findPart = db.prepare(`
    SELECT id FROM parts WHERE nome IS ? AND marca IS NULL AND modelo IS NULL LIMIT 1
  `);
  const insertPart = db.prepare(`
    INSERT INTO parts (nome, ncm) VALUES (?, ?)
  `);
  const linkPart = db.prepare(`
    UPDATE price_history SET part_id = ? WHERE descricao_original = ? AND part_id IS NULL
  `);

  const backfillParts = db.transaction((items) => {
    for (const item of items) {
      const existing = findPart.get(item.descricao_original);
      const partId = existing
        ? existing.id
        : insertPart.run(item.descricao_original, item.ncm || null).lastInsertRowid;
      linkPart.run(partId, item.descricao_original);
    }
  });

  backfillParts(orphanItems);
  console.log(`[migrate] parts: ${orphanItems.length} peça(s) sincronizada(s) a partir do histórico.`);
}

// ── Colunas Kanban em proposals ───────────────────────────────────────────────

const proposalCols = db.pragma("table_info(proposals)").map((c) => c.name);

if (!proposalCols.includes("kanban_status")) {
  db.exec(`ALTER TABLE proposals ADD COLUMN kanban_status TEXT`);
  console.log(`[migrate] proposals: coluna "kanban_status" adicionada.`);
}
if (!proposalCols.includes("kanban_status_updated_at")) {
  db.exec(`ALTER TABLE proposals ADD COLUMN kanban_status_updated_at TEXT`);
  console.log(`[migrate] proposals: coluna "kanban_status_updated_at" adicionada.`);
}

// Backfill: propostas existentes sem status entram em "pendente_envio"
db.prepare(`
  UPDATE proposals
  SET kanban_status = 'pendente_envio',
      kanban_status_updated_at = created_at
  WHERE kanban_status IS NULL
`).run();

// ── Colunas de execução em proposals ──────────────────────────────────────────

const execCols = [
  ["execution_completed",         "INTEGER DEFAULT 0"],
  ["execution_date",              "TEXT"],
  ["executed_by",                 "TEXT"],
  ["execution_os",                "TEXT"],
  ["execution_details",           "TEXT"],
  ["execution_marked_by_user_id", "INTEGER"],
  ["execution_marked_at",         "TEXT"],
];
for (const [col, type] of execCols) {
  if (!proposalCols.includes(col)) {
    db.exec(`ALTER TABLE proposals ADD COLUMN ${col} ${type}`);
    console.log(`[migrate] proposals: coluna "${col}" adicionada.`);
  }
}

// ── Colunas de aprovação em proposals ────────────────────────────────────────

const approvalCols = [
  ["approval_date",                   "TEXT"],
  ["approval_notes",                  "TEXT"],
  ["approval_attachment_path",        "TEXT"],
  ["approval_registered_by_user_id",  "INTEGER"],
  ["approval_registered_at",          "TEXT"],
];
for (const [col, type] of approvalCols) {
  if (!proposalCols.includes(col)) {
    db.exec(`ALTER TABLE proposals ADD COLUMN ${col} ${type}`);
    console.log(`[migrate] proposals: coluna "${col}" adicionada.`);
  }
}

// ── Colunas de faturamento em proposals ──────────────────────────────────────

const billingCols = [
  ["billing_date",      "TEXT"],
  ["invoice_number",    "TEXT"],
  ["billing_notes",     "TEXT"],
  ["billed_by_user_id", "INTEGER"],
  ["billed_at",         "TEXT"],
];
const currentProposalCols = db.pragma("table_info(proposals)").map((c) => c.name);
for (const [col, type] of billingCols) {
  if (!currentProposalCols.includes(col)) {
    db.exec(`ALTER TABLE proposals ADD COLUMN ${col} ${type}`);
    console.log(`[migrate] proposals: coluna "${col}" adicionada.`);
  }
}

// ── Tabela responsaveis ───────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS responsaveis (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nome       TEXT NOT NULL,
    telefone   TEXT,
    cargo      TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Tabela objetos ────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS objetos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nome       TEXT NOT NULL,
    descricao  TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Tabela users ──────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nome          TEXT NOT NULL,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user',
    created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at    TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TRIGGER IF NOT EXISTS users_updated_at
  AFTER UPDATE ON users
  BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
`);

// Seed: cria usuário admin na primeira execução
const userCount = db.prepare(`SELECT COUNT(*) AS n FROM users`).get().n;
if (userCount === 0) {
  const bcrypt = require("bcryptjs");
  const defaultPassword = "admin123";
  const hash = bcrypt.hashSync(defaultPassword, 10);
  db.prepare(`
    INSERT INTO users (nome, username, password_hash, role)
    VALUES ('Administrador', 'admin', ?, 'admin')
  `).run(hash);
  console.log("[migrate] Usuário admin criado. Login: admin | Senha: admin123 — altere após o primeiro acesso.");
}

// ── Tabela kanban_tasks (tarefas manuais) ────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS kanban_tasks (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    title                    TEXT NOT NULL,
    description              TEXT,
    kanban_status            TEXT NOT NULL DEFAULT 'pendente_envio',
    kanban_status_updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    created_by               INTEGER REFERENCES users(id),
    created_at               TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at               TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Tabela kanban_comments ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS kanban_comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    card_type  TEXT NOT NULL,
    card_id    INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    user_nome  TEXT NOT NULL,
    comment    TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_kc_card ON kanban_comments(card_type, card_id);
`);

// ── Assinatura de usuário (cargo e telefone vinculados ao login) ──────────────

const userCols = db.pragma("table_info(users)").map((c) => c.name);
if (!userCols.includes("signature_cargo")) {
  db.exec(`ALTER TABLE users ADD COLUMN signature_cargo TEXT`);
  console.log(`[migrate] users: coluna "signature_cargo" adicionada.`);
}
if (!userCols.includes("signature_telefone")) {
  db.exec(`ALTER TABLE users ADD COLUMN signature_telefone TEXT`);
  console.log(`[migrate] users: coluna "signature_telefone" adicionada.`);
}

// ── Responsável automático em proposals (snapshot da assinatura do usuário) ───

const proposalColsFull = db.pragma("table_info(proposals)").map((c) => c.name);
const newResponsibleCols = [
  ["responsible_user_id", "INTEGER"],
  ["responsible_name",    "TEXT"],
  ["responsible_role",    "TEXT"],
  ["responsible_phone",   "TEXT"],
];
for (const [col, type] of newResponsibleCols) {
  if (!proposalColsFull.includes(col)) {
    db.exec(`ALTER TABLE proposals ADD COLUMN ${col} ${type}`);
    console.log(`[migrate] proposals: coluna "${col}" adicionada.`);
  }
}

// ── Coluna stock_quantity em parts ───────────────────────────────────────────

const partColsStock = db.pragma("table_info(parts)").map((c) => c.name);
if (!partColsStock.includes("stock_quantity")) {
  db.exec(`ALTER TABLE parts ADD COLUMN stock_quantity INTEGER DEFAULT 0`);
  console.log(`[migrate] parts: coluna "stock_quantity" adicionada.`);
}

// ── Tabela stock_movements ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS stock_movements (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id              INTEGER NOT NULL,
    movement_type        TEXT    NOT NULL,
    quantity             INTEGER NOT NULL,
    entry_type           TEXT,
    proposal_id          INTEGER,
    client_id            INTEGER,
    returns_to_stock     INTEGER,
    notes                TEXT,
    created_by_user_id   INTEGER NOT NULL,
    created_at           TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (part_id)            REFERENCES parts(id),
    FOREIGN KEY (proposal_id)        REFERENCES proposals(id),
    FOREIGN KEY (client_id)          REFERENCES clients(id),
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_sm_part ON stock_movements(part_id);
  CREATE INDEX IF NOT EXISTS idx_sm_type ON stock_movements(movement_type);
`);

// ── Campo has_parts_contract em clients ──────────────────────────────────────

const clientColsContract = db.pragma("table_info(clients)").map((c) => c.name);
if (!clientColsContract.includes("has_parts_contract")) {
  db.exec(`ALTER TABLE clients ADD COLUMN has_parts_contract INTEGER DEFAULT 0`);
  console.log(`[migrate] clients: coluna "has_parts_contract" adicionada.`);
}

// ── Campos previous_quantity e new_quantity em stock_movements ────────────────

const movCols = db.pragma("table_info(stock_movements)").map((c) => c.name);
if (!movCols.includes("previous_quantity")) {
  db.exec(`ALTER TABLE stock_movements ADD COLUMN previous_quantity INTEGER`);
  console.log(`[migrate] stock_movements: coluna "previous_quantity" adicionada.`);
}
if (!movCols.includes("new_quantity")) {
  db.exec(`ALTER TABLE stock_movements ADD COLUMN new_quantity INTEGER`);
  console.log(`[migrate] stock_movements: coluna "new_quantity" adicionada.`);
}

// ── Tabela part_categories ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS part_categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    code       TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TRIGGER IF NOT EXISTS part_categories_updated_at
  AFTER UPDATE ON part_categories
  BEGIN
    UPDATE part_categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
`);

// ── Colunas category_id e identity_code em parts ─────────────────────────────

const partColsCat = db.pragma("table_info(parts)").map((c) => c.name);
if (!partColsCat.includes("category_id")) {
  db.exec(`ALTER TABLE parts ADD COLUMN category_id INTEGER REFERENCES part_categories(id)`);
  console.log(`[migrate] parts: coluna "category_id" adicionada.`);
}
if (!partColsCat.includes("identity_code")) {
  db.exec(`ALTER TABLE parts ADD COLUMN identity_code TEXT`);
  console.log(`[migrate] parts: coluna "identity_code" adicionada.`);
}

// Índice único em codigo_interno (NULLs são excluídos — SQLite trata NULL como distinto)
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_parts_internal_code_unique
    ON parts(codigo_interno) WHERE codigo_interno IS NOT NULL;
`);

// ── Tabela commercial_conditions ─────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS commercial_conditions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL,
    forma_pagamento  TEXT NOT NULL,
    prazo_pagamento  TEXT NOT NULL,
    prazo_entrega    TEXT NOT NULL,
    garantia         TEXT,
    validade         TEXT NOT NULL,
    created_at       TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at       TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TRIGGER IF NOT EXISTS commercial_conditions_updated_at
  AFTER UPDATE ON commercial_conditions
  BEGIN
    UPDATE commercial_conditions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
`);

// ── Campo commercial_condition_id em proposals ────────────────────────────────

const proposalColsCond = db.pragma("table_info(proposals)").map((c) => c.name);
if (!proposalColsCond.includes("commercial_condition_id")) {
  db.exec(`ALTER TABLE proposals ADD COLUMN commercial_condition_id INTEGER REFERENCES commercial_conditions(id)`);
  console.log(`[migrate] proposals: coluna "commercial_condition_id" adicionada.`);
}

// ── Módulo financeiro: fornecedores ──────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS fornecedores (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    razao_social       TEXT NOT NULL,
    nome_fantasia      TEXT,
    cnpj               TEXT,
    inscricao_estadual TEXT,
    email              TEXT,
    telefone           TEXT,
    endereco           TEXT,
    cidade             TEXT,
    estado             TEXT,
    cep                TEXT,
    observacoes        TEXT,
    ativo              INTEGER NOT NULL DEFAULT 1,
    created_at         TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at         TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_fornecedores_cnpj
    ON fornecedores(cnpj) WHERE cnpj IS NOT NULL;

  CREATE TRIGGER IF NOT EXISTS fornecedores_updated_at
  AFTER UPDATE ON fornecedores BEGIN
    UPDATE fornecedores SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
`);

// ── Módulo financeiro: categorias_despesa ─────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS categorias_despesa (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nome       TEXT NOT NULL,
    descricao  TEXT,
    ativo      INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TRIGGER IF NOT EXISTS categorias_despesa_updated_at
  AFTER UPDATE ON categorias_despesa BEGIN
    UPDATE categorias_despesa SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
`);

// ── Módulo financeiro: notas_recebidas ────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS notas_recebidas (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    fornecedor_id        INTEGER NOT NULL REFERENCES fornecedores(id),
    numero_nota          TEXT,
    serie                TEXT,
    chave_acesso         TEXT,
    tipo_nota            TEXT NOT NULL DEFAULT 'produto',
    data_emissao         TEXT,
    data_entrada         TEXT NOT NULL,
    valor_total          REAL NOT NULL,
    descricao            TEXT,
    categoria_despesa_id INTEGER REFERENCES categorias_despesa(id),
    arquivo_pdf          TEXT,
    arquivo_xml          TEXT,
    status               TEXT NOT NULL DEFAULT 'lancada',
    observacoes          TEXT,
    created_by           INTEGER NOT NULL REFERENCES users(id),
    created_at           TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at           TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_nr_fornecedor ON notas_recebidas(fornecedor_id);

  CREATE INDEX IF NOT EXISTS idx_nr_chave ON notas_recebidas(chave_acesso)
    WHERE chave_acesso IS NOT NULL;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_nr_dedup
    ON notas_recebidas(fornecedor_id, numero_nota, serie)
    WHERE numero_nota IS NOT NULL AND serie IS NOT NULL;

  CREATE TRIGGER IF NOT EXISTS notas_recebidas_updated_at
  AFTER UPDATE ON notas_recebidas BEGIN
    UPDATE notas_recebidas SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
`);

// ── Módulo financeiro: contas_pagar ───────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS contas_pagar (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    fornecedor_id        INTEGER NOT NULL REFERENCES fornecedores(id),
    nota_recebida_id     INTEGER REFERENCES notas_recebidas(id),
    categoria_despesa_id INTEGER REFERENCES categorias_despesa(id),
    descricao            TEXT NOT NULL,
    valor                REAL NOT NULL,
    data_emissao         TEXT NOT NULL,
    data_vencimento      TEXT NOT NULL,
    forma_pagamento      TEXT,
    status               TEXT NOT NULL DEFAULT 'em_aberto',
    data_pagamento       TEXT,
    valor_pago           REAL,
    comprovante_pagamento TEXT,
    paid_by              INTEGER REFERENCES users(id),
    cancelled_by         INTEGER REFERENCES users(id),
    cancelled_at         TEXT,
    cancel_reason        TEXT,
    observacoes          TEXT,
    parcela_numero       INTEGER,
    parcela_total        INTEGER,
    created_by           INTEGER NOT NULL REFERENCES users(id),
    created_at           TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at           TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_cp_fornecedor  ON contas_pagar(fornecedor_id);
  CREATE INDEX IF NOT EXISTS idx_cp_nota        ON contas_pagar(nota_recebida_id);
  CREATE INDEX IF NOT EXISTS idx_cp_vencimento  ON contas_pagar(data_vencimento, status);
  CREATE INDEX IF NOT EXISTS idx_cp_status      ON contas_pagar(status);

  CREATE TRIGGER IF NOT EXISTS contas_pagar_updated_at
  AFTER UPDATE ON contas_pagar BEGIN
    UPDATE contas_pagar SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
`);

// ── Camada fiscal: campos no header de notas_recebidas ───────────────────────

const nrFiscalCols = db.pragma("table_info(notas_recebidas)").map((c) => c.name);
const nrNewFiscalCols = [
  ["natureza_operacao",     "TEXT"],
  ["cfop_principal",        "TEXT"],
  ["modalidade_frete",      "INTEGER"],
  ["valor_frete",           "REAL"],
  ["valor_seguro",          "REAL"],
  ["valor_desconto",        "REAL"],
  ["valor_outras_despesas", "REAL"],
  ["valor_bc_icms",         "REAL"],
  ["valor_icms",            "REAL"],
  ["valor_ipi",             "REAL"],
  ["valor_pis",             "REAL"],
  ["valor_cofins",          "REAL"],
  ["valor_iss",             "REAL"],
  ["numero_protocolo",      "TEXT"],
  ["data_autorizacao",      "TEXT"],
];
for (const [col, type] of nrNewFiscalCols) {
  if (!nrFiscalCols.includes(col)) {
    db.exec(`ALTER TABLE notas_recebidas ADD COLUMN ${col} ${type}`);
    console.log(`[migrate] notas_recebidas: coluna "${col}" adicionada.`);
  }
}

// ── Camada fiscal: tabela itens_nota_recebida ─────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS itens_nota_recebida (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    nota_recebida_id         INTEGER NOT NULL REFERENCES notas_recebidas(id),
    produto_id               INTEGER REFERENCES parts(id),
    numero_item              INTEGER NOT NULL,
    codigo_produto           TEXT,
    descricao                TEXT NOT NULL,
    ncm                      TEXT,
    cfop                     TEXT,
    unidade                  TEXT,
    quantidade               REAL,
    valor_unitario           REAL,
    valor_total              REAL,
    valor_desconto           REAL,
    origem_mercadoria        TEXT,
    cst_icms                 TEXT,
    csosn                    TEXT,
    modalidade_bc_icms       INTEGER,
    reducao_base_icms        REAL,
    valor_bc_icms            REAL,
    aliquota_icms            REAL,
    valor_icms               REAL,
    valor_bc_icms_st         REAL,
    aliquota_icms_st         REAL,
    valor_icms_st            REAL,
    cst_ipi                  TEXT,
    codigo_enquadramento_ipi TEXT,
    valor_bc_ipi             REAL,
    aliquota_ipi             REAL,
    valor_ipi                REAL,
    cst_pis                  TEXT,
    valor_bc_pis             REAL,
    aliquota_pis             REAL,
    valor_pis                REAL,
    cst_cofins               TEXT,
    valor_bc_cofins          REAL,
    aliquota_cofins          REAL,
    valor_cofins             REAL,
    aliquota_iss             REAL,
    valor_iss                REAL,
    cest                     TEXT,
    informacoes_adicionais   TEXT,
    created_at               TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at               TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_inr_nota ON itens_nota_recebida(nota_recebida_id);

  CREATE TRIGGER IF NOT EXISTS itens_nota_recebida_updated_at
  AFTER UPDATE ON itens_nota_recebida BEGIN
    UPDATE itens_nota_recebida SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
`);

// ── Tabela part_client_price_references ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS part_client_price_references (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id            INTEGER NOT NULL REFERENCES parts(id),
    client_id          INTEGER NOT NULL REFERENCES clients(id),
    reference_price    REAL    NOT NULL,
    source             TEXT    NOT NULL DEFAULT 'manual',
    notes              TEXT,
    created_by_user_id INTEGER REFERENCES users(id),
    updated_by_user_id INTEGER REFERENCES users(id),
    created_at         TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at         TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(part_id, client_id)
  );

  CREATE INDEX IF NOT EXISTS idx_pcpr_part_client
    ON part_client_price_references(part_id, client_id);

  CREATE TRIGGER IF NOT EXISTS part_client_price_references_updated_at
  AFTER UPDATE ON part_client_price_references BEGIN
    UPDATE part_client_price_references SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
`);

console.log("[migrate] Banco de dados atualizado com sucesso.");

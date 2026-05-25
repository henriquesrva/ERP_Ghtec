// vi.spyOn é usado em vez de vi.mock porque o projeto é 100% CommonJS.
// proposal.service.js usa pdfService.generateProposalPdf() (acesso por propriedade),
// o que permite que o spy intercepte a chamada sem precisar de hoisting de módulo.

const { clearAllTables, db } = require("../../tests/setup/testDb");
const { createTestClient, createTestUser } = require("../../tests/setup/fixtures");
const {
  createProposalFlow,
  calculateTotal,
  markProposalExecuted,
  removeProposalExecution,
  registerBilling,
  canMarkExecution,
} = require("../../src/modules/proposal/proposal.service");
const pdfServiceMock = require("../../src/modules/proposal/proposal-pdf.service");

beforeEach(() => {
  clearAllTables();
  vi.spyOn(pdfServiceMock, "generateProposalPdf").mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Helper: insere proposta diretamente no banco (sem passar pelo service) ────

function insertProposal(clientId, overrides = {}) {
  const p = {
    numero_proposta:     "TEST-001",
    cliente_id:          clientId,
    cidade_emissao:      "BH",
    data_emissao:        "2026-01-01",
    objeto_proposta:     "Manutenção",
    forma_pagamento:     "Boleto",
    prazo_pagamento:     "30 dias",
    prazo_entrega:       "7 dias",
    garantia:            "90 dias",
    validade:            "30 dias",
    valor_total:         500.0,
    valor_total_extenso: "quinhentos reais",
    responsavel_nome:    "Resp",
    responsavel_cargo:   "Cargo",
    responsavel_email:   "",
    responsavel_telefone: "999",
    kanban_status:       "pendente_envio",
    ...overrides,
  };
  const result = db.prepare(`
    INSERT INTO proposals (
      numero_proposta, cliente_id, cidade_emissao, data_emissao,
      objeto_proposta, forma_pagamento, prazo_pagamento, prazo_entrega,
      garantia, validade, valor_total, valor_total_extenso,
      responsavel_nome, responsavel_cargo, responsavel_email, responsavel_telefone,
      kanban_status, kanban_status_updated_at
    ) VALUES (
      @numero_proposta, @cliente_id, @cidade_emissao, @data_emissao,
      @objeto_proposta, @forma_pagamento, @prazo_pagamento, @prazo_entrega,
      @garantia, @validade, @valor_total, @valor_total_extenso,
      @responsavel_nome, @responsavel_cargo, @responsavel_email, @responsavel_telefone,
      @kanban_status, datetime('now')
    )
  `).run(p);
  return { id: Number(result.lastInsertRowid) };
}

// ── Helper: monta payload padrão para createProposalFlow ──────────────────────

function proposalPayload({ clienteId, numeroProposta = "FLOW-001", items, responsavel } = {}) {
  return {
    numero_proposta: numeroProposta,
    cliente_id:      clienteId,
    objeto_proposta: "Manutenção de equipamentos",
    cidade_emissao:  "Belo Horizonte",
    condicoes: {
      forma_pagamento: "Boleto",
      prazo_pagamento: "30 dias",
      prazo_entrega:   "7 dias",
      garantia:        "90 dias",
      validade:        "30 dias",
    },
    responsavel: responsavel || {
      nome:     "Responsável Teste",
      cargo:    "Gerente",
      email:    "resp@teste.com",
      telefone: "(31) 99999-9999",
    },
    responsible_user_id: null,
    responsible_name:    "Responsável Teste",
    responsible_role:    "Gerente",
    responsible_phone:   "(31) 99999-9999",
    items: items || [
      { descricao: "Peca Alpha", quantidade: 2, valor_unitario: 100, ncm: null },
      { descricao: "Peca Beta",  quantidade: 1, valor_unitario: 50,  ncm: null },
    ],
  };
}

// ── calculateTotal ────────────────────────────────────────────────────────────

describe("calculateTotal", () => {
  it("retorna 0 para lista vazia", () => {
    expect(calculateTotal([])).toBe(0);
  });

  it("soma quantidade * valor_unitario de um único item", () => {
    expect(calculateTotal([{ quantidade: 2, valor_unitario: 50 }])).toBe(100);
  });

  it("soma múltiplos itens corretamente", () => {
    expect(calculateTotal([
      { quantidade: 2, valor_unitario: 100 },
      { quantidade: 3, valor_unitario: 10  },
    ])).toBe(230);
  });

  it("lida com valores decimais", () => {
    expect(calculateTotal([{ quantidade: 1, valor_unitario: 67.5 }])).toBeCloseTo(67.5);
  });

  it("coerce strings numéricas corretamente", () => {
    expect(calculateTotal([{ quantidade: "3", valor_unitario: "20" }])).toBe(60);
  });
});

// ── canMarkExecution ──────────────────────────────────────────────────────────

describe("canMarkExecution", () => {
  it("retorna true para admin",      () => expect(canMarkExecution("admin")).toBe(true));
  it("retorna true para tecnico",    () => expect(canMarkExecution("tecnico")).toBe(true));
  it("retorna false para user",      () => expect(canMarkExecution("user")).toBe(false));
  it("retorna false para comercial", () => expect(canMarkExecution("comercial")).toBe(false));
  it("retorna false para financeiro",() => expect(canMarkExecution("financeiro")).toBe(false));
});

// ── createProposalFlow ────────────────────────────────────────────────────────

describe("createProposalFlow", () => {
  it("retorna proposalId ao criar proposta válida", async () => {
    const client = createTestClient();
    const result = await createProposalFlow(proposalPayload({ clienteId: client.id }));
    expect(result.proposalId).toBeGreaterThan(0);
  });

  it("persiste valor_total correto no banco (2*100 + 1*50 = 250)", async () => {
    const client = createTestClient();
    const result = await createProposalFlow(proposalPayload({ clienteId: client.id }));
    const row = db.prepare("SELECT valor_total FROM proposals WHERE id = ?").get(result.proposalId);
    expect(row.valor_total).toBeCloseTo(250);
  });

  it("valor_total_extenso é gerado pelo backend — payload do frontend é ignorado", async () => {
    const client = createTestClient();
    const data = proposalPayload({ clienteId: client.id });
    data.valor_total_extenso = "DEVE SER IGNORADO";
    const result = await createProposalFlow(data);
    const row = db.prepare("SELECT valor_total_extenso FROM proposals WHERE id = ?").get(result.proposalId);
    expect(row.valor_total_extenso).not.toBe("DEVE SER IGNORADO");
    expect(row.valor_total_extenso).toBeTruthy();
  });

  it("data_emissao é gerada pelo servidor (não vem do payload do frontend)", async () => {
    const client = createTestClient();
    const result = await createProposalFlow(proposalPayload({ clienteId: client.id }));
    const row = db.prepare("SELECT data_emissao FROM proposals WHERE id = ?").get(result.proposalId);
    expect(row.data_emissao).toBeTruthy();
  });

  it("kanban_status inicial é pendente_envio", async () => {
    const client = createTestClient();
    const result = await createProposalFlow(proposalPayload({ clienteId: client.id }));
    const row = db.prepare("SELECT kanban_status FROM proposals WHERE id = ?").get(result.proposalId);
    expect(row.kanban_status).toBe("pendente_envio");
  });

  it("cria proposal_items para cada item na ordem correta", async () => {
    const client = createTestClient();
    const result = await createProposalFlow(proposalPayload({ clienteId: client.id }));
    const items = db
      .prepare("SELECT * FROM proposal_items WHERE proposal_id = ? ORDER BY item_ordem")
      .all(result.proposalId);
    expect(items).toHaveLength(2);
    expect(items[0].descricao).toBe("Peca Alpha");
    expect(items[0].quantidade).toBe(2);
    expect(items[1].descricao).toBe("Peca Beta");
  });

  it("cria price_history para cada item com todos os campos obrigatórios", async () => {
    const client = createTestClient();
    const result = await createProposalFlow(
      proposalPayload({ clienteId: client.id, numeroProposta: "PH-001" })
    );
    const ph = db
      .prepare("SELECT * FROM price_history WHERE proposal_id = ? ORDER BY id")
      .all(result.proposalId);

    expect(ph).toHaveLength(2);

    const first = ph[0];
    expect(first.client_id).toBe(client.id);
    expect(first.descricao_original).toBe("Peca Alpha");
    expect(first.descricao_normalizada).toBe("peca alpha");
    expect(first.quantidade).toBe(2);
    expect(first.valor_unitario).toBeCloseTo(100);
    expect(first.numero_proposta).toBe("PH-001");
    expect(first.proposal_id).toBe(result.proposalId);
  });

  it("price_history.part_id é preenchido após auto-registro de peça", async () => {
    const client = createTestClient();
    const result = await createProposalFlow(proposalPayload({ clienteId: client.id }));
    const ph = db
      .prepare("SELECT part_id FROM price_history WHERE proposal_id = ?")
      .all(result.proposalId);
    ph.forEach(row => expect(row.part_id).toBeGreaterThan(0));
  });

  it("price_history.part_id usa o part_id fornecido no item (sem criar nova peça)", async () => {
    const client = createTestClient();
    const partRes = db.prepare("INSERT INTO parts (nome, preco_compra) VALUES (?, ?)").run("Peça Existente", 100);
    const partId = Number(partRes.lastInsertRowid);

    const data = proposalPayload({ clienteId: client.id, numeroProposta: "PART-001" });
    data.items = [{ descricao: "Peça Existente", quantidade: 1, valor_unitario: 100, part_id: partId }];
    const result = await createProposalFlow(data);

    const ph = db.prepare("SELECT part_id FROM price_history WHERE proposal_id = ?").get(result.proposalId);
    expect(ph.part_id).toBe(partId);
  });

  it("snapshot da assinatura: responsavel_nome/cargo/telefone gravados na proposta", async () => {
    const client = createTestClient();
    const data = proposalPayload({
      clienteId: client.id,
      responsavel: { nome: "Maria Souza", cargo: "Diretora", email: "m@co.com", telefone: "31911" },
    });
    const result = await createProposalFlow(data);
    const row = db
      .prepare("SELECT responsavel_nome, responsavel_cargo, responsavel_telefone FROM proposals WHERE id = ?")
      .get(result.proposalId);
    expect(row.responsavel_nome).toBe("Maria Souza");
    expect(row.responsavel_cargo).toBe("Diretora");
    expect(row.responsavel_telefone).toBe("31911");
  });

  it("rejeita numero_proposta duplicado com código CONFLICT", async () => {
    const client = createTestClient();
    await createProposalFlow(proposalPayload({ clienteId: client.id, numeroProposta: "DUP-001" }));
    await expect(
      createProposalFlow(proposalPayload({ clienteId: client.id, numeroProposta: "DUP-001" }))
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("cria cliente novo via dados inline quando cliente_id não é fornecido", async () => {
    const data = proposalPayload({ numeroProposta: "INLINE-001" });
    delete data.cliente_id;
    data.cliente = { nome: "Cliente Inline Novo" };

    const result = await createProposalFlow(data);
    expect(result.clienteIsNew).toBe(true);

    const found = db.prepare("SELECT id FROM clients WHERE nome = ?").get("Cliente Inline Novo");
    expect(found).toBeTruthy();
    expect(result.clienteId).toBe(found.id);
  });

  it("reutiliza cliente existente quando nome inline bate com cadastro", async () => {
    const existing = createTestClient({ nome: "Empresa ABC" });

    const data = proposalPayload({ numeroProposta: "REUSE-001" });
    delete data.cliente_id;
    data.cliente = { nome: "Empresa ABC" };

    const result = await createProposalFlow(data);
    expect(result.clienteIsNew).toBe(false);
    expect(result.clienteId).toBe(existing.id);

    const count = db.prepare("SELECT COUNT(*) AS n FROM clients WHERE nome = 'Empresa ABC'").get().n;
    expect(count).toBe(1);
  });

  it("PDF não é gerado com Puppeteer real — generateProposalPdf é mockado e chamado", async () => {
    const client = createTestClient();
    await createProposalFlow(proposalPayload({ clienteId: client.id, numeroProposta: "MOCK-001" }));
    expect(pdfServiceMock.generateProposalPdf).toHaveBeenCalledOnce();
  });
});

// ── markProposalExecuted ──────────────────────────────────────────────────────

describe("markProposalExecuted", () => {
  let client;
  let proposalId;
  let userId;

  beforeEach(() => {
    client = createTestClient();
    ({ id: proposalId } = insertProposal(client.id));
    ({ id: userId } = createTestUser());
  });

  it("admin marca proposta como executada — execution_completed = 1", () => {
    markProposalExecuted(proposalId, {}, "admin", userId, "Admin");
    const row = db.prepare("SELECT execution_completed FROM proposals WHERE id = ?").get(proposalId);
    expect(row.execution_completed).toBe(1);
  });

  it("tecnico marca proposta como executada", () => {
    markProposalExecuted(proposalId, {}, "tecnico", userId, "Tec");
    const row = db.prepare("SELECT execution_completed FROM proposals WHERE id = ?").get(proposalId);
    expect(row.execution_completed).toBe(1);
  });

  it("user não pode marcar execução — FORBIDDEN", () => {
    expect(() => markProposalExecuted(proposalId, {}, "user", null, "U"))
      .toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("comercial não pode marcar execução — FORBIDDEN", () => {
    expect(() => markProposalExecuted(proposalId, {}, "comercial", null, "C"))
      .toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("financeiro não pode marcar execução — FORBIDDEN", () => {
    expect(() => markProposalExecuted(proposalId, {}, "financeiro", null, "F"))
      .toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("salva dados de execução fornecidos (data, responsável, OS)", () => {
    markProposalExecuted(
      proposalId,
      { execution_date: "2026-05-20", executed_by: "João", execution_os: "OS-999" },
      "admin", userId, "Admin"
    );
    const row = db
      .prepare("SELECT execution_date, executed_by, execution_os FROM proposals WHERE id = ?")
      .get(proposalId);
    expect(row.execution_date).toBe("2026-05-20");
    expect(row.executed_by).toBe("João");
    expect(row.execution_os).toBe("OS-999");
  });
});

// ── removeProposalExecution ───────────────────────────────────────────────────

describe("removeProposalExecution", () => {
  let client;
  let proposalId;
  let userId;

  beforeEach(() => {
    client = createTestClient();
    ({ id: proposalId } = insertProposal(client.id));
    db.prepare("UPDATE proposals SET execution_completed = 1 WHERE id = ?").run(proposalId);
    ({ id: userId } = createTestUser());
  });

  it("user não pode remover execução — FORBIDDEN", () => {
    expect(() => removeProposalExecution(proposalId, "user", null, "U"))
      .toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("ao remover execução de proposta em 'faturar', status volta para pendente_execucao", () => {
    db.prepare("UPDATE proposals SET kanban_status = 'faturar' WHERE id = ?").run(proposalId);

    const result = removeProposalExecution(proposalId, "admin", userId, "Admin");

    expect(result.autoMoved).toBe(true);
    expect(result.newStatus).toBe("pendente_execucao");

    const row = db.prepare("SELECT execution_completed, kanban_status FROM proposals WHERE id = ?").get(proposalId);
    expect(row.execution_completed).toBe(0);
    expect(row.kanban_status).toBe("pendente_execucao");
  });

  it("ao remover execução de proposta em 'faturado', status volta para pendente_execucao", () => {
    db.prepare("UPDATE proposals SET kanban_status = 'faturado' WHERE id = ?").run(proposalId);

    const result = removeProposalExecution(proposalId, "admin", userId, "Admin");

    expect(result.autoMoved).toBe(true);
    expect(result.newStatus).toBe("pendente_execucao");
  });

  it("ao remover execução de proposta em 'pendente_execucao', status não muda (autoMoved = false)", () => {
    db.prepare("UPDATE proposals SET kanban_status = 'pendente_execucao' WHERE id = ?").run(proposalId);

    const result = removeProposalExecution(proposalId, "admin", userId, "Admin");

    expect(result.autoMoved).toBe(false);
    expect(result.newStatus).toBe("pendente_execucao");

    const row = db.prepare("SELECT kanban_status FROM proposals WHERE id = ?").get(proposalId);
    expect(row.kanban_status).toBe("pendente_execucao");
  });

  it("limpa todos os campos de execução ao remover", () => {
    db.prepare("UPDATE proposals SET execution_date = '2026-05-01', executed_by = 'João', execution_os = 'OS-1' WHERE id = ?").run(proposalId);

    removeProposalExecution(proposalId, "admin", userId, "Admin");

    const row = db
      .prepare("SELECT execution_completed, execution_date, executed_by, execution_os FROM proposals WHERE id = ?")
      .get(proposalId);
    expect(row.execution_completed).toBe(0);
    expect(row.execution_date).toBeNull();
    expect(row.executed_by).toBeNull();
    expect(row.execution_os).toBeNull();
  });
});

// ── registerBilling ───────────────────────────────────────────────────────────

describe("registerBilling", () => {
  let client;
  let proposalId;
  let userId;

  beforeEach(() => {
    client = createTestClient();
    ({ id: proposalId } = insertProposal(client.id));
    ({ id: userId } = createTestUser());
  });

  it("rejeita invoice_number vazio — VALIDATION", () => {
    expect(() => registerBilling(proposalId, { invoice_number: "" }, null, "Admin"))
      .toThrow(expect.objectContaining({ code: "VALIDATION" }));
  });

  it("rejeita invoice_number ausente — VALIDATION", () => {
    expect(() => registerBilling(proposalId, {}, null, "Admin"))
      .toThrow(expect.objectContaining({ code: "VALIDATION" }));
  });

  it("grava invoice_number, billing_date e billing_notes na proposta", () => {
    registerBilling(
      proposalId,
      { invoice_number: "NF-9999", billing_date: "2026-05-20", billing_notes: "Pago via PIX" },
      userId, "Admin"
    );
    const row = db
      .prepare("SELECT invoice_number, billing_date, billing_notes FROM proposals WHERE id = ?")
      .get(proposalId);
    expect(row.invoice_number).toBe("NF-9999");
    expect(row.billing_date).toBe("2026-05-20");
    expect(row.billing_notes).toBe("Pago via PIX");
  });

  it("throws NOT_FOUND para proposta inexistente", () => {
    expect(() => registerBilling(9999, { invoice_number: "NF-0001" }, null, "Admin"))
      .toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
  });
});

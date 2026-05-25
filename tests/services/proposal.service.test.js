const { clearAllTables, db } = require("../../tests/setup/testDb");
const { createTestClient, createTestProposal } = require("../../tests/setup/fixtures");
const { validateProposalItems, canMoveKanban, updateKanbanStatus } = require("../../src/modules/proposal/proposal.service");
const { createProposalAtomic } = require("../../src/modules/proposal/proposal.repository");

beforeEach(clearAllTables);

// ── validateProposalItems ─────────────────────────────────────────────────────

describe("validateProposalItems", () => {
  it("throws VALIDATION when items array is empty", () => {
    expect(() => validateProposalItems([])).toThrow(expect.objectContaining({
      code: "VALIDATION",
      message: expect.stringMatching(/pelo menos um item/i),
    }));
  });

  it("throws VALIDATION when items is not an array", () => {
    expect(() => validateProposalItems(null)).toThrow(expect.objectContaining({ code: "VALIDATION" }));
    expect(() => validateProposalItems("not an array")).toThrow(expect.objectContaining({ code: "VALIDATION" }));
  });

  it("throws VALIDATION when item has no descricao", () => {
    expect(() =>
      validateProposalItems([{ quantidade: 1, valor_unitario: 100 }])
    ).toThrow(expect.objectContaining({ code: "VALIDATION" }));
  });

  it("throws VALIDATION when item has quantidade = 0", () => {
    expect(() =>
      validateProposalItems([{ descricao: "Item A", quantidade: 0, valor_unitario: 100 }])
    ).toThrow(expect.objectContaining({
      code: "VALIDATION",
      message: expect.stringMatching(/inteiro maior/i),
    }));
  });

  it("throws VALIDATION when item has non-integer quantidade (1.5)", () => {
    expect(() =>
      validateProposalItems([{ descricao: "Item A", quantidade: 1.5, valor_unitario: 100 }])
    ).toThrow(expect.objectContaining({ code: "VALIDATION" }));
  });

  it("throws VALIDATION when item has negative valor_unitario", () => {
    expect(() =>
      validateProposalItems([{ descricao: "Item A", quantidade: 1, valor_unitario: -1 }])
    ).toThrow(expect.objectContaining({
      code: "VALIDATION",
      message: expect.stringMatching(/negativo/i),
    }));
  });

  it("passes for valid items without throwing", () => {
    expect(() =>
      validateProposalItems([{ descricao: "Item A", quantidade: 2, valor_unitario: 100 }])
    ).not.toThrow();
  });
});

// ── canMoveKanban ─────────────────────────────────────────────────────────────

describe("canMoveKanban", () => {
  describe('role "user"', () => {
    it("returns false regardless of status", () => {
      expect(canMoveKanban("user", "pendente_envio", "enviado")).toBe(false);
      expect(canMoveKanban("user", "enviado", "aguardando_compra")).toBe(false);
      expect(canMoveKanban("user", "faturar", "faturado")).toBe(false);
    });
  });

  describe('role "admin"', () => {
    it("returns true regardless of status", () => {
      expect(canMoveKanban("admin", "pendente_envio", "faturado")).toBe(true);
      expect(canMoveKanban("admin", "faturado", "pendente_envio")).toBe(true);
      expect(canMoveKanban("admin", "faturar", "faturado")).toBe(true);
    });
  });

  describe('role "financeiro"', () => {
    it("returns true only for faturar↔faturado moves", () => {
      expect(canMoveKanban("financeiro", "faturar", "faturado")).toBe(true);
      expect(canMoveKanban("financeiro", "faturado", "faturar")).toBe(true);
    });

    it("returns false for other moves", () => {
      expect(canMoveKanban("financeiro", "pendente_envio", "enviado")).toBe(false);
      expect(canMoveKanban("financeiro", "enviado", "aguardando_compra")).toBe(false);
      expect(canMoveKanban("financeiro", "comprado", "pendente_execucao")).toBe(false);
    });
  });

  describe('role "comercial"', () => {
    it("can move within RANGE_COMERCIAL statuses", () => {
      expect(canMoveKanban("comercial", "pendente_envio", "enviado")).toBe(true);
      expect(canMoveKanban("comercial", "enviado", "aguardando_compra")).toBe(true);
      expect(canMoveKanban("comercial", "pendente_execucao", "faturar")).toBe(true);
    });

    it("cannot move to faturado", () => {
      expect(canMoveKanban("comercial", "faturar", "faturado")).toBe(false);
    });

    it("cannot move from outside RANGE_COMERCIAL", () => {
      expect(canMoveKanban("comercial", "faturado", "faturar")).toBe(false);
    });
  });

  describe('role "tecnico"', () => {
    it("can move from pendente_execucao to faturar", () => {
      expect(canMoveKanban("tecnico", "pendente_execucao", "faturar")).toBe(true);
    });

    it("can move within RANGE_TECNICO", () => {
      expect(canMoveKanban("tecnico", "aguardando_compra", "comprado")).toBe(true);
      expect(canMoveKanban("tecnico", "comprado", "pendente_execucao")).toBe(true);
    });

    it("cannot move to faturado", () => {
      expect(canMoveKanban("tecnico", "faturar", "faturado")).toBe(false);
    });

    it("cannot move from outside RANGE_TECNICO", () => {
      expect(canMoveKanban("tecnico", "pendente_envio", "enviado")).toBe(false);
    });
  });
});

// ── updateKanbanStatus ────────────────────────────────────────────────────────

describe("updateKanbanStatus — execution required guard", () => {
  it("throws EXECUTION_REQUIRED when moving to faturar without execution_completed", () => {
    const client = createTestClient();
    const proposal = createTestProposal({ clienteId: client.id, numeroProposta: "TEST-001" });

    // proposal starts at pendente_envio, move to pendente_execucao first so admin can try faturar
    db.prepare("UPDATE proposals SET kanban_status = 'pendente_execucao' WHERE id = ?").run(proposal.id);

    expect(() => updateKanbanStatus(proposal.id, "faturar", "admin")).toThrow(
      expect.objectContaining({ code: "EXECUTION_REQUIRED" })
    );
  });

  it("succeeds moving from pendente_envio to enviado as admin", () => {
    const client = createTestClient();
    const proposal = createTestProposal({ clienteId: client.id, numeroProposta: "TEST-002" });

    expect(() => updateKanbanStatus(proposal.id, "enviado", "admin")).not.toThrow();
  });

  it("succeeds moving to faturar after execution_completed = 1 as comercial", () => {
    const client = createTestClient();
    const proposal = createTestProposal({ clienteId: client.id, numeroProposta: "TEST-003" });

    db.prepare("UPDATE proposals SET kanban_status = 'pendente_execucao', execution_completed = 1 WHERE id = ?").run(proposal.id);

    expect(() => updateKanbanStatus(proposal.id, "faturar", "comercial")).not.toThrow();
  });
});

// ── createProposalAtomic — DB atomicity ───────────────────────────────────────

describe("createProposalAtomic — DB atomicity", () => {
  it("throws and commits nothing when cliente_id does not exist", () => {
    expect(() =>
      createProposalAtomic(
        {
          numero_proposta:         "X-001",
          cliente_id:              999,
          cidade_emissao:          "BH",
          data_emissao:            "2026-01-01",
          objeto_proposta:         "Teste",
          forma_pagamento:         "Boleto",
          prazo_pagamento:         "30 dias",
          prazo_entrega:           "7 dias",
          garantia:                "90 dias",
          validade:                "30 dias",
          valor_total:             100,
          valor_total_extenso:     "cem reais",
          responsavel_nome:        "Resp",
          responsavel_cargo:       "Cargo",
          responsavel_email:       "r@test.com",
          responsavel_telefone:    "31999",
          responsible_user_id:     null,
          responsible_name:        "Resp",
          responsible_role:        "Cargo",
          responsible_phone:       "31999",
          commercial_condition_id: null,
          pdf_path:                null,
        },
        [{ item_ordem: 1, quantidade: 1, descricao: "Item", valor_unitario: 100, ncm: null }],
        { clientId: 999, numeroProposta: "X-001", dataProposta: "2026-01-01" }
      )
    ).toThrow();

    const count = db.prepare("SELECT COUNT(*) AS n FROM proposals").get().n;
    expect(count).toBe(0);
  });
});

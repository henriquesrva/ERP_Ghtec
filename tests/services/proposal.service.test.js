// Testes unitários do proposal.service.js.
// O service usa referências de módulo (proposalRepo.fn()), portanto vi.spyOn()
// intercepta corretamente as chamadas — mesmo padrão de pdfService no projeto.

const proposalRepo = require("../../src/modules/proposal/proposal.repository");
const clientRepo   = require("../../src/modules/client/client.repository");

const {
  validateProposalItems,
  canMoveKanban,
  updateKanbanStatus,
} = require("../../src/modules/proposal/proposal.service");

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws EXECUTION_REQUIRED when moving to faturar without execution_completed", async () => {
    vi.spyOn(proposalRepo, "findProposalById").mockResolvedValue({
      proposal: { kanban_status: "pendente_execucao", execution_completed: 0 },
      items: [],
    });
    vi.spyOn(proposalRepo, "setProposalKanbanStatus").mockResolvedValue(undefined);

    await expect(updateKanbanStatus(1, "faturar", "admin")).rejects.toMatchObject({
      code: "EXECUTION_REQUIRED",
    });
  });

  it("succeeds moving from pendente_envio to enviado as admin", async () => {
    vi.spyOn(proposalRepo, "findProposalById").mockResolvedValue({
      proposal: { kanban_status: "pendente_envio", execution_completed: 0 },
      items: [],
    });
    const setStatus = vi.spyOn(proposalRepo, "setProposalKanbanStatus").mockResolvedValue(undefined);

    await expect(updateKanbanStatus(1, "enviado", "admin")).resolves.toBeUndefined();
    expect(setStatus).toHaveBeenCalledWith(1, "enviado");
  });

  it("succeeds moving to faturar after execution_completed = 1 as comercial", async () => {
    vi.spyOn(proposalRepo, "findProposalById").mockResolvedValue({
      proposal: { kanban_status: "pendente_execucao", execution_completed: 1 },
      items: [],
    });
    vi.spyOn(proposalRepo, "setProposalKanbanStatus").mockResolvedValue(undefined);

    await expect(updateKanbanStatus(1, "faturar", "comercial")).resolves.toBeUndefined();
  });

  it("throws NOT_FOUND for inexistent proposal", async () => {
    vi.spyOn(proposalRepo, "findProposalById").mockResolvedValue(null);

    await expect(updateKanbanStatus(9999, "enviado", "admin")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("throws FORBIDDEN when role has no permission", async () => {
    vi.spyOn(proposalRepo, "findProposalById").mockResolvedValue({
      proposal: { kanban_status: "pendente_envio", execution_completed: 0 },
      items: [],
    });
    vi.spyOn(proposalRepo, "setProposalKanbanStatus").mockResolvedValue(undefined);

    await expect(updateKanbanStatus(1, "enviado", "user")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

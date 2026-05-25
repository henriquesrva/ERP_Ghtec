const {
  KANBAN_STATUSES,
  KANBAN_LABELS,
  isValidKanbanStatus,
  canMoveKanban,
  assertCanMoveKanban,
} = require("../../src/shared/domain/kanban");

// ── isValidKanbanStatus ───────────────────────────────────────────────────────

describe("isValidKanbanStatus", () => {
  it("returns true for all valid statuses", () => {
    expect(isValidKanbanStatus("pendente_envio")).toBe(true);
    expect(isValidKanbanStatus("enviado")).toBe(true);
    expect(isValidKanbanStatus("aguardando_compra")).toBe(true);
    expect(isValidKanbanStatus("comprado")).toBe(true);
    expect(isValidKanbanStatus("pendente_execucao")).toBe(true);
    expect(isValidKanbanStatus("faturar")).toBe(true);
    expect(isValidKanbanStatus("faturado")).toBe(true);
  });

  it("returns false for invalid status", () => {
    expect(isValidKanbanStatus("invalido")).toBe(false);
    expect(isValidKanbanStatus("")).toBe(false);
    expect(isValidKanbanStatus(null)).toBe(false);
    expect(isValidKanbanStatus(undefined)).toBe(false);
    expect(isValidKanbanStatus("FATURADO")).toBe(false);
  });

  it("KANBAN_STATUSES has exactly 7 entries", () => {
    expect(KANBAN_STATUSES).toHaveLength(7);
  });

  it("KANBAN_LABELS has label for every status", () => {
    for (const status of KANBAN_STATUSES) {
      expect(KANBAN_LABELS[status]).toBeTruthy();
    }
  });
});

// ── canMoveKanban — role "admin" ──────────────────────────────────────────────

describe('canMoveKanban — role "admin"', () => {
  it("can move between any two valid statuses", () => {
    expect(canMoveKanban("admin", "pendente_envio", "faturado")).toBe(true);
    expect(canMoveKanban("admin", "faturado", "pendente_envio")).toBe(true);
    expect(canMoveKanban("admin", "faturar", "faturado")).toBe(true);
    expect(canMoveKanban("admin", "enviado", "comprado")).toBe(true);
  });
});

// ── canMoveKanban — role "user" ───────────────────────────────────────────────

describe('canMoveKanban — role "user"', () => {
  it("cannot move any card regardless of status", () => {
    expect(canMoveKanban("user", "pendente_envio", "enviado")).toBe(false);
    expect(canMoveKanban("user", "enviado", "aguardando_compra")).toBe(false);
    expect(canMoveKanban("user", "faturar", "faturado")).toBe(false);
    expect(canMoveKanban("user", "faturado", "faturar")).toBe(false);
  });
});

// ── canMoveKanban — role "comercial" ─────────────────────────────────────────

describe('canMoveKanban — role "comercial"', () => {
  it("can move within allowed range (pendente_envio → faturar)", () => {
    expect(canMoveKanban("comercial", "pendente_envio", "enviado")).toBe(true);
    expect(canMoveKanban("comercial", "enviado", "aguardando_compra")).toBe(true);
    expect(canMoveKanban("comercial", "aguardando_compra", "comprado")).toBe(true);
    expect(canMoveKanban("comercial", "comprado", "pendente_execucao")).toBe(true);
    expect(canMoveKanban("comercial", "pendente_execucao", "faturar")).toBe(true);
  });

  it("cannot move to faturado", () => {
    expect(canMoveKanban("comercial", "faturar", "faturado")).toBe(false);
  });

  it("cannot move from faturado (outside allowed range)", () => {
    expect(canMoveKanban("comercial", "faturado", "faturar")).toBe(false);
  });

  it("can move backwards within range", () => {
    expect(canMoveKanban("comercial", "enviado", "pendente_envio")).toBe(true);
    expect(canMoveKanban("comercial", "faturar", "pendente_execucao")).toBe(true);
  });
});

// ── canMoveKanban — role "tecnico" ────────────────────────────────────────────

describe('canMoveKanban — role "tecnico"', () => {
  it("can move within allowed range (aguardando_compra → faturar)", () => {
    expect(canMoveKanban("tecnico", "aguardando_compra", "comprado")).toBe(true);
    expect(canMoveKanban("tecnico", "comprado", "pendente_execucao")).toBe(true);
    expect(canMoveKanban("tecnico", "pendente_execucao", "faturar")).toBe(true);
  });

  it("cannot move to faturado", () => {
    expect(canMoveKanban("tecnico", "faturar", "faturado")).toBe(false);
  });

  it("cannot move from before aguardando_compra", () => {
    expect(canMoveKanban("tecnico", "pendente_envio", "enviado")).toBe(false);
    expect(canMoveKanban("tecnico", "enviado", "aguardando_compra")).toBe(false);
  });

  it("cannot move from faturado", () => {
    expect(canMoveKanban("tecnico", "faturado", "faturar")).toBe(false);
  });

  it("can move backwards within range", () => {
    expect(canMoveKanban("tecnico", "faturar", "pendente_execucao")).toBe(true);
    expect(canMoveKanban("tecnico", "comprado", "aguardando_compra")).toBe(true);
  });
});

// ── canMoveKanban — role "financeiro" ────────────────────────────────────────

describe('canMoveKanban — role "financeiro"', () => {
  it("can move from faturar to faturado", () => {
    expect(canMoveKanban("financeiro", "faturar", "faturado")).toBe(true);
  });

  it("can move from faturado back to faturar", () => {
    expect(canMoveKanban("financeiro", "faturado", "faturar")).toBe(true);
  });

  it("cannot move any other status pair", () => {
    expect(canMoveKanban("financeiro", "pendente_envio", "enviado")).toBe(false);
    expect(canMoveKanban("financeiro", "enviado", "aguardando_compra")).toBe(false);
    expect(canMoveKanban("financeiro", "comprado", "pendente_execucao")).toBe(false);
    expect(canMoveKanban("financeiro", "pendente_execucao", "faturar")).toBe(false);
  });
});

// ── assertCanMoveKanban ───────────────────────────────────────────────────────

describe("assertCanMoveKanban", () => {
  it("does not throw when move is allowed", () => {
    expect(() => assertCanMoveKanban("admin", "pendente_envio", "faturado")).not.toThrow();
    expect(() => assertCanMoveKanban("financeiro", "faturar", "faturado")).not.toThrow();
    expect(() => assertCanMoveKanban("comercial", "pendente_envio", "enviado")).not.toThrow();
  });

  it("throws FORBIDDEN when move is not allowed", () => {
    expect(() => assertCanMoveKanban("user", "pendente_envio", "enviado")).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" })
    );
    expect(() => assertCanMoveKanban("comercial", "faturar", "faturado")).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" })
    );
    expect(() => assertCanMoveKanban("tecnico", "pendente_envio", "enviado")).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" })
    );
    expect(() => assertCanMoveKanban("financeiro", "pendente_envio", "enviado")).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" })
    );
  });
});

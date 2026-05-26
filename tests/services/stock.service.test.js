const repo        = require("../../src/modules/stock/stock.repository");
const stockService = require("../../src/modules/stock/stock.service");

const {
  getAllStockParts,
  getMovements,
  registerMovement,
  getContractSpend,
  getMovementsByDateData,
  registerInventoryCount,
} = stockService;

afterEach(() => {
  vi.restoreAllMocks();
});

// ── getAllStockParts ───────────────────────────────────────────────────────────

describe("getAllStockParts", () => {
  it("returns result of repo.listStockParts", async () => {
    const fake = [{ id: 1, nome: "Peça A", stock_quantity: 5 }];
    vi.spyOn(repo, "listStockParts").mockResolvedValue(fake);

    await expect(getAllStockParts()).resolves.toEqual(fake);
  });
});

// ── getMovements ──────────────────────────────────────────────────────────────

describe("getMovements", () => {
  it("delegates to repo.listMovements with given opts", async () => {
    const fake = [{ id: 1, movement_type: "entrada" }];
    const spy = vi.spyOn(repo, "listMovements").mockResolvedValue(fake);

    const opts = { limit: 50, offset: 0, part_id: 3 };
    await expect(getMovements(opts)).resolves.toEqual(fake);
    expect(spy).toHaveBeenCalledWith(opts);
  });
});

// ── registerMovement — validação ──────────────────────────────────────────────

describe("registerMovement — validation", () => {
  it("throws VALIDATION when part_id is missing", async () => {
    await expect(
      registerMovement({ movement_type: "entrada", quantity: 1 }, 1)
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("throws VALIDATION for invalid movement_type", async () => {
    await expect(
      registerMovement({ part_id: 1, movement_type: "invalido", quantity: 1 }, 1)
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("throws VALIDATION for zero quantity", async () => {
    await expect(
      registerMovement({ part_id: 1, movement_type: "entrada", quantity: 0 }, 1)
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("throws VALIDATION for non-integer quantity", async () => {
    await expect(
      registerMovement({ part_id: 1, movement_type: "entrada", quantity: 1.5 }, 1)
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("throws NOT_FOUND when part does not exist", async () => {
    vi.spyOn(repo, "getStockPartById").mockResolvedValue(null);

    await expect(
      registerMovement({ part_id: 99, movement_type: "entrada", quantity: 1, entry_type: "compra_nova" }, 1)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws VALIDATION for entrada without entry_type", async () => {
    vi.spyOn(repo, "getStockPartById").mockResolvedValue({ id: 1, stock_quantity: 10 });

    await expect(
      registerMovement({ part_id: 1, movement_type: "entrada", quantity: 1 }, 1)
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("throws VALIDATION for invalid entry_type on entrada", async () => {
    vi.spyOn(repo, "getStockPartById").mockResolvedValue({ id: 1, stock_quantity: 10 });

    await expect(
      registerMovement({ part_id: 1, movement_type: "entrada", quantity: 1, entry_type: "inventado" }, 1)
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("throws VALIDATION for saida without returns_to_stock", async () => {
    vi.spyOn(repo, "getStockPartById").mockResolvedValue({ id: 1, stock_quantity: 10 });
    vi.spyOn(repo, "getPartCurrentStock").mockResolvedValue(10);

    await expect(
      registerMovement({ part_id: 1, movement_type: "saida", quantity: 1 }, 1)
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("throws INSUFFICIENT_STOCK when qty > stock", async () => {
    vi.spyOn(repo, "getStockPartById").mockResolvedValue({ id: 1, stock_quantity: 2 });
    vi.spyOn(repo, "getPartCurrentStock").mockResolvedValue(2);

    await expect(
      registerMovement({ part_id: 1, movement_type: "saida", quantity: 5, returns_to_stock: false }, 1)
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK", available: 2 });
  });

  it("throws PART_NOT_IN_PROPOSAL when part has no qty in proposal", async () => {
    vi.spyOn(repo, "getStockPartById").mockResolvedValue({ id: 1, stock_quantity: 10 });
    vi.spyOn(repo, "getPartCurrentStock").mockResolvedValue(10);
    vi.spyOn(repo, "getPartQtyInProposal").mockResolvedValue(0);

    await expect(
      registerMovement({ part_id: 1, movement_type: "saida", quantity: 1, returns_to_stock: false, proposal_id: 5 }, 1)
    ).rejects.toMatchObject({ code: "PART_NOT_IN_PROPOSAL" });
  });

  it("throws EXCEEDS_PROPOSAL_QTY when qty > qty in proposal", async () => {
    vi.spyOn(repo, "getStockPartById").mockResolvedValue({ id: 1, stock_quantity: 10 });
    vi.spyOn(repo, "getPartCurrentStock").mockResolvedValue(10);
    vi.spyOn(repo, "getPartQtyInProposal").mockResolvedValue(2);

    await expect(
      registerMovement({ part_id: 1, movement_type: "saida", quantity: 5, returns_to_stock: false, proposal_id: 5 }, 1)
    ).rejects.toMatchObject({ code: "EXCEEDS_PROPOSAL_QTY", available: 2 });
  });
});

// ── registerMovement — sucesso ────────────────────────────────────────────────

describe("registerMovement — success", () => {
  it("registers entrada and returns id", async () => {
    vi.spyOn(repo, "getStockPartById").mockResolvedValue({ id: 1, stock_quantity: 5 });
    const createSpy = vi.spyOn(repo, "createMovement").mockResolvedValue(42);

    const id = await registerMovement(
      { part_id: 1, movement_type: "entrada", quantity: 3, entry_type: "compra_nova" },
      10
    );

    expect(id).toBe(42);
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      part_id:      1,
      movement_type: "entrada",
      quantity:     3,
      entry_type:   "compra_nova",
    }));
  });

  it("registers saida with returns_to_stock=true and returns id", async () => {
    vi.spyOn(repo, "getStockPartById").mockResolvedValue({ id: 1, stock_quantity: 10 });
    vi.spyOn(repo, "getPartCurrentStock").mockResolvedValue(10);
    const createSpy = vi.spyOn(repo, "createMovement").mockResolvedValue(99);

    const id = await registerMovement(
      { part_id: 1, movement_type: "saida", quantity: 2, returns_to_stock: true },
      10
    );

    expect(id).toBe(99);
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      movement_type:   "saida",
      returns_to_stock: 1,
    }));
  });

  it("registers saida with returns_to_stock=false", async () => {
    vi.spyOn(repo, "getStockPartById").mockResolvedValue({ id: 1, stock_quantity: 10 });
    vi.spyOn(repo, "getPartCurrentStock").mockResolvedValue(10);
    const createSpy = vi.spyOn(repo, "createMovement").mockResolvedValue(7);

    await registerMovement(
      { part_id: 1, movement_type: "saida", quantity: 1, returns_to_stock: false },
      10
    );

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      returns_to_stock: 0,
    }));
  });
});

// ── getContractSpend ──────────────────────────────────────────────────────────

describe("getContractSpend", () => {
  it("delegates to repo.getContractClientSpend", async () => {
    const fake = [{ client_id: 1, client_nome: "GHTec", total_spend: 500 }];
    vi.spyOn(repo, "getContractClientSpend").mockResolvedValue(fake);

    await expect(getContractSpend()).resolves.toEqual(fake);
  });
});

// ── getMovementsByDateData ────────────────────────────────────────────────────

describe("getMovementsByDateData", () => {
  it("delegates to repo.getMovementsByDate with days param", async () => {
    const fake = [{ date: "2026-05-20", movement_type: "entrada", total_qty: 10 }];
    const spy  = vi.spyOn(repo, "getMovementsByDate").mockResolvedValue(fake);

    await expect(getMovementsByDateData({ days: 30 })).resolves.toEqual(fake);
    expect(spy).toHaveBeenCalledWith({ days: 30 });
  });
});

// ── registerInventoryCount — validação ───────────────────────────────────────

describe("registerInventoryCount — validation", () => {
  it("throws VALIDATION for empty adjustments array", async () => {
    await expect(registerInventoryCount([], 1)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("throws VALIDATION for non-array input", async () => {
    await expect(registerInventoryCount(null, 1)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("throws VALIDATION for item without part_id", async () => {
    await expect(
      registerInventoryCount([{ new_quantity: 5 }], 1)
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("throws VALIDATION for negative new_quantity", async () => {
    await expect(
      registerInventoryCount([{ part_id: 1, new_quantity: -1 }], 1)
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("throws VALIDATION for non-integer new_quantity", async () => {
    await expect(
      registerInventoryCount([{ part_id: 1, new_quantity: 1.5 }], 1)
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("registerInventoryCount — success", () => {
  it("delegates valid adjustments to repo.createInventoryCount and returns ids", async () => {
    const spy = vi.spyOn(repo, "createInventoryCount").mockResolvedValue([10, 11]);

    const ids = await registerInventoryCount(
      [{ part_id: 1, new_quantity: 5 }, { part_id: 2, new_quantity: 3 }],
      7
    );

    expect(ids).toEqual([10, 11]);
    expect(spy).toHaveBeenCalledWith(
      [{ part_id: 1, new_quantity: 5 }, { part_id: 2, new_quantity: 3 }],
      7
    );
  });
});

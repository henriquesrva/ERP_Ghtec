const repo = require("../../src/modules/condition/condition.repository");
const {
  getAllConditions,
  getCondition,
  searchConds,
  createCond,
  updateCond,
  deleteCond,
} = require("../../src/modules/condition/condition.service");

const FAKE = {
  id:              1,
  name:            "Padrão",
  forma_pagamento: "Boleto 30/60/90",
  prazo_pagamento: "30/60/90 dias",
  prazo_entrega:   "7 dias úteis",
  garantia:        "12 meses",
  validade:        "30 dias",
  created_at:      new Date("2026-01-01"),
  updated_at:      new Date("2026-01-01"),
};

const VALID_DATA = {
  name:            "Padrão",
  forma_pagamento: "Boleto 30/60/90",
  prazo_pagamento: "30/60/90 dias",
  prazo_entrega:   "7 dias úteis",
  validade:        "30 dias",
};

afterEach(() => vi.restoreAllMocks());

// ── getAllConditions ───────────────────────────────────────────────────────────

describe("getAllConditions", () => {
  it("retorna lista vazia quando não há condições", async () => {
    vi.spyOn(repo, "listConditions").mockResolvedValue([]);
    expect(await getAllConditions()).toEqual([]);
  });

  it("retorna condições do repository", async () => {
    vi.spyOn(repo, "listConditions").mockResolvedValue([FAKE]);
    const result = await getAllConditions();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Padrão");
  });
});

// ── getCondition ──────────────────────────────────────────────────────────────

describe("getCondition", () => {
  it("retorna registro do repository", async () => {
    vi.spyOn(repo, "getConditionById").mockResolvedValue(FAKE);
    expect(await getCondition(1)).toEqual(FAKE);
  });

  it("retorna null quando não encontrado", async () => {
    vi.spyOn(repo, "getConditionById").mockResolvedValue(null);
    expect(await getCondition(999)).toBeNull();
  });
});

// ── searchConds ────────────────────────────────────────────────────────────────

describe("searchConds", () => {
  it("delega busca ao repository", async () => {
    vi.spyOn(repo, "searchConditions").mockResolvedValue([FAKE]);
    const result = await searchConds("Boleto");
    expect(result).toEqual([FAKE]);
    expect(repo.searchConditions).toHaveBeenCalledWith("Boleto");
  });
});

// ── createCond ────────────────────────────────────────────────────────────────

describe("createCond", () => {
  it("lança VALIDATION se name estiver vazio", async () => {
    const err = await createCond({ ...VALID_DATA, name: "" }).catch((e) => e);
    expect(err.code).toBe("VALIDATION");
  });

  it("lança VALIDATION se forma_pagamento estiver vazia", async () => {
    const err = await createCond({ ...VALID_DATA, forma_pagamento: "" }).catch((e) => e);
    expect(err.code).toBe("VALIDATION");
  });

  it("lança VALIDATION se prazo_pagamento estiver vazio", async () => {
    const err = await createCond({ ...VALID_DATA, prazo_pagamento: "" }).catch((e) => e);
    expect(err.code).toBe("VALIDATION");
  });

  it("lança VALIDATION se prazo_entrega estiver vazio", async () => {
    const err = await createCond({ ...VALID_DATA, prazo_entrega: "" }).catch((e) => e);
    expect(err.code).toBe("VALIDATION");
  });

  it("lança VALIDATION se validade estiver vazia", async () => {
    const err = await createCond({ ...VALID_DATA, validade: "" }).catch((e) => e);
    expect(err.code).toBe("VALIDATION");
  });

  it("cria condição e retorna o id", async () => {
    vi.spyOn(repo, "createCondition").mockResolvedValue(1);
    const id = await createCond(VALID_DATA);
    expect(id).toBe(1);
    expect(repo.createCondition).toHaveBeenCalledWith(expect.objectContaining({ name: "Padrão" }));
  });

  it("garantia é opcional e fica null quando ausente", async () => {
    vi.spyOn(repo, "createCondition").mockResolvedValue(1);
    await createCond(VALID_DATA);
    expect(repo.createCondition).toHaveBeenCalledWith(expect.objectContaining({ garantia: null }));
  });

  it("não chama createCondition se validação falhar", async () => {
    vi.spyOn(repo, "createCondition");
    await createCond({ ...VALID_DATA, name: "" }).catch(() => {});
    expect(repo.createCondition).not.toHaveBeenCalled();
  });
});

// ── updateCond ────────────────────────────────────────────────────────────────

describe("updateCond", () => {
  it("lança NOT_FOUND se condição não existe", async () => {
    vi.spyOn(repo, "getConditionById").mockResolvedValue(null);
    const err = await updateCond(999, VALID_DATA).catch((e) => e);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("lança VALIDATION se name for vazio na atualização", async () => {
    vi.spyOn(repo, "getConditionById").mockResolvedValue(FAKE);
    const err = await updateCond(1, { ...VALID_DATA, name: "" }).catch((e) => e);
    expect(err.code).toBe("VALIDATION");
  });

  it("atualiza condição existente", async () => {
    vi.spyOn(repo, "getConditionById").mockResolvedValue(FAKE);
    vi.spyOn(repo, "updateCondition").mockResolvedValue(undefined);
    await expect(updateCond(1, VALID_DATA)).resolves.toBeUndefined();
    expect(repo.updateCondition).toHaveBeenCalledWith(1, expect.objectContaining({ name: "Padrão" }));
  });

  it("não chama updateCondition se NOT_FOUND", async () => {
    vi.spyOn(repo, "getConditionById").mockResolvedValue(null);
    vi.spyOn(repo, "updateCondition");
    await updateCond(999, VALID_DATA).catch(() => {});
    expect(repo.updateCondition).not.toHaveBeenCalled();
  });
});

// ── deleteCond ────────────────────────────────────────────────────────────────

describe("deleteCond", () => {
  it("lança NOT_FOUND se condição não existe", async () => {
    vi.spyOn(repo, "getConditionById").mockResolvedValue(null);
    const err = await deleteCond(999).catch((e) => e);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("exclui condição existente", async () => {
    vi.spyOn(repo, "getConditionById").mockResolvedValue(FAKE);
    vi.spyOn(repo, "deleteCondition").mockResolvedValue(undefined);
    await expect(deleteCond(1)).resolves.toBeUndefined();
    expect(repo.deleteCondition).toHaveBeenCalledWith(1);
  });

  it("não chama deleteCondition se não encontrar", async () => {
    vi.spyOn(repo, "getConditionById").mockResolvedValue(null);
    vi.spyOn(repo, "deleteCondition");
    await deleteCond(999).catch(() => {});
    expect(repo.deleteCondition).not.toHaveBeenCalled();
  });
});

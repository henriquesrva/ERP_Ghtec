const repo = require("../../src/modules/part/part.repository");
const {
  parsePrecoCompra,
  getAllParts,
  getPartById,
  searchPartsByQuery,
  createNewPart,
  updateExistingPart,
  deletePartService,
  getPartPriceHistoryService,
  getPartPriceHistoryByClientService,
  getPartPriceComparisonService,
  getClientPriceRefsService,
  upsertClientPriceRefService,
} = require("../../src/modules/part/part.service");

const FAKE_PART = {
  id:             1,
  nome:           "Resistor",
  descricao:      "Componente eletrônico",
  marca:          null,
  modelo:         null,
  categoria:      null,
  category_id:    2,
  identity_code:  "001",
  codigo_interno: "EL-001",
  ncm:            null,
  preco_compra:   5.5,
  stock_quantity: 0,
  observacoes:    null,
  category_name:  "Eletrônico",
  category_code:  "EL",
  created_at:     new Date("2026-01-01"),
  updated_at:     new Date("2026-01-01"),
};

const FAKE_CATEGORY = { id: 2, name: "Eletrônico", code: "EL" };

afterEach(() => vi.restoreAllMocks());

// ── parsePrecoCompra ──────────────────────────────────────────────────────────

describe("parsePrecoCompra", () => {
  it("retorna null para null", () => {
    expect(parsePrecoCompra(null)).toBeNull();
  });

  it("retorna null para string vazia", () => {
    expect(parsePrecoCompra("")).toBeNull();
  });

  it("retorna null para string não numérica", () => {
    expect(parsePrecoCompra("abc")).toBeNull();
  });

  it("retorna 0 para número 0", () => {
    expect(parsePrecoCompra(0)).toBe(0);
  });

  it("retorna 100 para número 100", () => {
    expect(parsePrecoCompra(100)).toBe(100);
  });

  it("parseia string '100' como 100", () => {
    expect(parsePrecoCompra("100")).toBe(100);
  });

  it("trata ponto como separador de milhar — '100.50' → 10050", () => {
    expect(parsePrecoCompra("100.50")).toBe(10050);
  });

  it("parseia formato brasileiro '100,50' como 100.5", () => {
    expect(parsePrecoCompra("100,50")).toBe(100.5);
  });

  it("parseia '1.234,56' como 1234.56", () => {
    expect(parsePrecoCompra("1.234,56")).toBe(1234.56);
  });

  it("retorna valor negativo como está (validação é responsabilidade do chamador)", () => {
    expect(parsePrecoCompra(-5)).toBe(-5);
  });
});

// ── getAllParts ───────────────────────────────────────────────────────────────

describe("getAllParts", () => {
  it("retorna lista do repository", async () => {
    vi.spyOn(repo, "listAllParts").mockResolvedValue([FAKE_PART]);
    const result = await getAllParts();
    expect(result).toHaveLength(1);
    expect(result[0].nome).toBe("Resistor");
  });

  it("retorna lista vazia", async () => {
    vi.spyOn(repo, "listAllParts").mockResolvedValue([]);
    expect(await getAllParts()).toEqual([]);
  });
});

// ── getPartById ───────────────────────────────────────────────────────────────

describe("getPartById", () => {
  it("retorna peça pelo id", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(FAKE_PART);
    const result = await getPartById(1);
    expect(result.id).toBe(1);
  });

  it("retorna null quando não encontrada", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(null);
    expect(await getPartById(999)).toBeNull();
  });
});

// ── createNewPart ─────────────────────────────────────────────────────────────

describe("createNewPart", () => {
  it("lança quando nome está ausente", async () => {
    await expect(createNewPart({ preco_compra: 0 })).rejects.toThrow(/nome/i);
  });

  it("lança quando nome está vazio", async () => {
    await expect(createNewPart({ nome: "", preco_compra: 0 })).rejects.toThrow(/nome/i);
  });

  it("lança quando preco_compra é null", async () => {
    await expect(createNewPart({ nome: "Peça X", preco_compra: null })).rejects.toThrow(/preço/i);
  });

  it("lança quando preco_compra é undefined", async () => {
    await expect(createNewPart({ nome: "Peça X" })).rejects.toThrow(/preço/i);
  });

  it("lança quando preco_compra é negativo", async () => {
    await expect(createNewPart({ nome: "Peça X", preco_compra: -10 })).rejects.toThrow(/preço/i);
  });

  it("cria peça sem categoria (sem codigo_interno)", async () => {
    vi.spyOn(repo, "createPart").mockResolvedValue(1);
    vi.spyOn(repo, "findPartById").mockResolvedValue({
      ...FAKE_PART, nome: "Peça Mínima", codigo_interno: null, category_id: null,
    });
    const result = await createNewPart({ nome: "Peça Mínima", preco_compra: 0 });
    expect(result.nome).toBe("Peça Mínima");
  });

  it("gera codigo_interno = '{cat.code}-{identity_code}'", async () => {
    vi.spyOn(repo, "findCategoryById").mockResolvedValue(FAKE_CATEGORY);
    vi.spyOn(repo, "findPartByInternalCode").mockResolvedValue(null);
    vi.spyOn(repo, "createPart").mockResolvedValue(1);
    vi.spyOn(repo, "findPartById").mockResolvedValue(FAKE_PART);
    const result = await createNewPart({
      nome: "Resistor", preco_compra: 5.5, category_id: 2, identity_code: "001",
    });
    expect(result.codigo_interno).toBe("EL-001");
  });

  it("lança DUPLICATE_INTERNAL_CODE quando código interno já existe", async () => {
    vi.spyOn(repo, "findCategoryById").mockResolvedValue(FAKE_CATEGORY);
    vi.spyOn(repo, "findPartByInternalCode").mockResolvedValue({ id: 99 });
    await expect(
      createNewPart({ nome: "Peça B", preco_compra: 20, category_id: 2, identity_code: "001" })
    ).rejects.toMatchObject({ code: "DUPLICATE_INTERNAL_CODE" });
  });

  it("lança VALIDATION quando categoria não encontrada", async () => {
    vi.spyOn(repo, "findCategoryById").mockResolvedValue(null);
    await expect(
      createNewPart({ nome: "Peça X", preco_compra: 10, category_id: 999, identity_code: "001" })
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("não chama createPart se validação de nome falhar", async () => {
    vi.spyOn(repo, "createPart");
    await createNewPart({ nome: "", preco_compra: 10 }).catch(() => {});
    expect(repo.createPart).not.toHaveBeenCalled();
  });

  it("faz parse de preco_compra no formato brasileiro antes de persistir", async () => {
    vi.spyOn(repo, "findPartByInternalCode").mockResolvedValue(null);
    vi.spyOn(repo, "createPart").mockResolvedValue(1);
    vi.spyOn(repo, "findPartById").mockResolvedValue({ ...FAKE_PART, preco_compra: 1234.56 });
    await createNewPart({ nome: "Peça", preco_compra: "1.234,56" });
    const savedData = repo.createPart.mock.calls[0][0];
    expect(savedData.preco_compra).toBe(1234.56);
  });
});

// ── updateExistingPart ────────────────────────────────────────────────────────

describe("updateExistingPart", () => {
  it("lança NOT_FOUND quando peça não existe", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(null);
    await expect(
      updateExistingPart(999, { nome: "X", preco_compra: 10 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lança quando nome está vazio", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(FAKE_PART);
    await expect(
      updateExistingPart(1, { nome: "", preco_compra: 10 })
    ).rejects.toThrow(/nome/i);
  });

  it("lança quando preco_compra é negativo", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(FAKE_PART);
    await expect(
      updateExistingPart(1, { nome: "Resistor", preco_compra: -5 })
    ).rejects.toThrow(/preço/i);
  });

  it("atualiza peça com sucesso e retorna atualizada", async () => {
    const updated = { ...FAKE_PART, nome: "Resistor Atualizado" };
    vi.spyOn(repo, "findPartById")
      .mockResolvedValueOnce(FAKE_PART)  // verificação NOT_FOUND
      .mockResolvedValueOnce(updated);   // retorno após update
    vi.spyOn(repo, "findCategoryById").mockResolvedValue(FAKE_CATEGORY);
    vi.spyOn(repo, "findPartByInternalCode").mockResolvedValue(null);
    vi.spyOn(repo, "updatePart").mockResolvedValue(undefined);
    const result = await updateExistingPart(1, {
      nome: "Resistor Atualizado", preco_compra: 5.5, category_id: 2, identity_code: "001",
    });
    expect(result.nome).toBe("Resistor Atualizado");
    expect(repo.updatePart).toHaveBeenCalledWith(1, expect.objectContaining({ nome: "Resistor Atualizado" }));
  });

  it("lança DUPLICATE_INTERNAL_CODE quando código pertence a outra peça", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(FAKE_PART);
    vi.spyOn(repo, "findCategoryById").mockResolvedValue(FAKE_CATEGORY);
    vi.spyOn(repo, "findPartByInternalCode").mockResolvedValue({ id: 99 }); // id diferente
    await expect(
      updateExistingPart(1, { nome: "Resistor", preco_compra: 5, category_id: 2, identity_code: "001" })
    ).rejects.toMatchObject({ code: "DUPLICATE_INTERNAL_CODE" });
  });

  it("permite manter o mesmo codigo_interno na própria peça (dup.id === id)", async () => {
    vi.spyOn(repo, "findPartById")
      .mockResolvedValueOnce(FAKE_PART)
      .mockResolvedValueOnce(FAKE_PART);
    vi.spyOn(repo, "findCategoryById").mockResolvedValue(FAKE_CATEGORY);
    vi.spyOn(repo, "findPartByInternalCode").mockResolvedValue({ id: 1 }); // mesmo id
    vi.spyOn(repo, "updatePart").mockResolvedValue(undefined);
    await expect(
      updateExistingPart(1, { nome: "Resistor", preco_compra: 5.5, category_id: 2, identity_code: "001" })
    ).resolves.toBeDefined();
  });
});

// ── deletePartService ─────────────────────────────────────────────────────────

describe("deletePartService", () => {
  it("lança NOT_FOUND quando peça não existe", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(null);
    await expect(deletePartService(999)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("exclui peça com sucesso", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(FAKE_PART);
    vi.spyOn(repo, "deletePart").mockResolvedValue(undefined);
    await expect(deletePartService(1)).resolves.toBeUndefined();
    expect(repo.deletePart).toHaveBeenCalledWith(1);
  });

  it("não chama deletePart quando peça não encontrada", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(null);
    vi.spyOn(repo, "deletePart");
    await deletePartService(999).catch(() => {});
    expect(repo.deletePart).not.toHaveBeenCalled();
  });

  it("repassa erro HAS_DEPENDENCIES do repository", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(FAKE_PART);
    const err = new Error("Tem movimentações."); err.code = "HAS_DEPENDENCIES";
    vi.spyOn(repo, "deletePart").mockRejectedValue(err);
    await expect(deletePartService(1)).rejects.toMatchObject({ code: "HAS_DEPENDENCIES" });
  });
});

// ── getPartPriceHistoryService ────────────────────────────────────────────────

describe("getPartPriceHistoryService", () => {
  it("lança NOT_FOUND quando peça não existe", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(null);
    await expect(getPartPriceHistoryService(999)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("retorna histórico da peça", async () => {
    const history = [{ cliente_nome: "Cliente A", valor_unitario: 100 }];
    vi.spyOn(repo, "findPartById").mockResolvedValue(FAKE_PART);
    vi.spyOn(repo, "getPartPriceHistory").mockReturnValue(history); // sync bridge
    const result = await getPartPriceHistoryService(1);
    expect(result).toHaveLength(1);
    expect(result[0].cliente_nome).toBe("Cliente A");
  });

  it("retorna lista vazia quando não há histórico", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(FAKE_PART);
    vi.spyOn(repo, "getPartPriceHistory").mockReturnValue([]);
    expect(await getPartPriceHistoryService(1)).toEqual([]);
  });
});

// ── getPartPriceHistoryByClientService ────────────────────────────────────────

describe("getPartPriceHistoryByClientService", () => {
  it("lança NOT_FOUND quando peça não existe", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(null);
    await expect(getPartPriceHistoryByClientService(999, 1)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("retorna histórico por cliente", async () => {
    const history = [{ cliente_nome: "Cliente A", valor_unitario: 200, quantidade: 3 }];
    vi.spyOn(repo, "findPartById").mockResolvedValue(FAKE_PART);
    vi.spyOn(repo, "getPartPriceHistoryByClient").mockReturnValue(history); // sync bridge
    const result = await getPartPriceHistoryByClientService(1, 1);
    expect(result[0].valor_unitario).toBe(200);
  });
});

// ── getPartPriceComparisonService ─────────────────────────────────────────────

describe("getPartPriceComparisonService", () => {
  it("lança NOT_FOUND quando peça não existe", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(null);
    await expect(getPartPriceComparisonService(999)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("retorna comparação de preços por cliente", async () => {
    const comparison = [{ client_id: 1, cliente_nome: "A", valor_unitario: 100 }];
    vi.spyOn(repo, "findPartById").mockResolvedValue(FAKE_PART);
    vi.spyOn(repo, "getPartLastPricePerClient").mockReturnValue(comparison); // sync bridge
    const result = await getPartPriceComparisonService(1);
    expect(result[0].cliente_nome).toBe("A");
  });
});

// ── getClientPriceRefsService ─────────────────────────────────────────────────

describe("getClientPriceRefsService", () => {
  it("lança NOT_FOUND quando peça não existe", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(null);
    await expect(getClientPriceRefsService(999)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("retorna referências de preço por cliente", async () => {
    const refs = [{ client_id: 1, client_nome: "Cliente A", reference_price: 150 }];
    vi.spyOn(repo, "findPartById").mockResolvedValue(FAKE_PART);
    vi.spyOn(repo, "getClientPriceRefs").mockResolvedValue(refs);
    const result = await getClientPriceRefsService(1);
    expect(result).toHaveLength(1);
    expect(result[0].reference_price).toBe(150);
  });

  it("retorna lista vazia quando sem referências", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(FAKE_PART);
    vi.spyOn(repo, "getClientPriceRefs").mockResolvedValue([]);
    expect(await getClientPriceRefsService(1)).toEqual([]);
  });
});

// ── upsertClientPriceRefService ───────────────────────────────────────────────

describe("upsertClientPriceRefService", () => {
  it("lança NOT_FOUND quando peça não existe", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(null);
    await expect(
      upsertClientPriceRefService(999, 1, { reference_price: 100 }, 1)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lança VALIDATION para preço inválido (string não numérica)", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(FAKE_PART);
    await expect(
      upsertClientPriceRefService(1, 1, { reference_price: "abc" }, 1)
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança VALIDATION para preço negativo", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(FAKE_PART);
    await expect(
      upsertClientPriceRefService(1, 1, { reference_price: -5 }, 1)
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança VALIDATION para client_id inválido", async () => {
    vi.spyOn(repo, "findPartById").mockResolvedValue(FAKE_PART);
    await expect(
      upsertClientPriceRefService(1, NaN, { reference_price: 100 }, 1)
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("salva referência com sucesso (preço numérico direto)", async () => {
    const ref = { id: 1, part_id: 1, client_id: 1, reference_price: 100 };
    vi.spyOn(repo, "findPartById").mockResolvedValue(FAKE_PART);
    vi.spyOn(repo, "upsertClientPriceRef").mockResolvedValue(ref);
    const result = await upsertClientPriceRefService(1, 1, { reference_price: 100 }, 1);
    expect(result.reference_price).toBe(100);
    expect(repo.upsertClientPriceRef).toHaveBeenCalledWith(1, 1, 100, null, 1);
  });

  it("salva referência com preço no formato brasileiro '1.234,56'", async () => {
    const ref = { id: 1, part_id: 1, client_id: 1, reference_price: 1234.56 };
    vi.spyOn(repo, "findPartById").mockResolvedValue(FAKE_PART);
    vi.spyOn(repo, "upsertClientPriceRef").mockResolvedValue(ref);
    await upsertClientPriceRefService(1, 1, { reference_price: "1.234,56" }, 1);
    expect(repo.upsertClientPriceRef).toHaveBeenCalledWith(1, 1, 1234.56, null, 1);
  });

  it("passa notes corretamente", async () => {
    const ref = { id: 1, part_id: 1, client_id: 1, reference_price: 50, notes: "Contrato especial" };
    vi.spyOn(repo, "findPartById").mockResolvedValue(FAKE_PART);
    vi.spyOn(repo, "upsertClientPriceRef").mockResolvedValue(ref);
    await upsertClientPriceRefService(1, 1, { reference_price: 50, notes: "Contrato especial" }, 1);
    expect(repo.upsertClientPriceRef).toHaveBeenCalledWith(1, 1, 50, "Contrato especial", 1);
  });
});

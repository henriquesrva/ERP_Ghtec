// category.repository.js agora usa Prisma/PostgreSQL.
// Os testes mockam o repository via vi.spyOn para não depender de conexão ao banco.
// Padrão consistente com o uso de vi.spyOn em proposal-flow.test.js.

const repo = require("../../src/modules/category/category.repository");
const {
  getAllCategories,
  createNewCategory,
  updateExistingCategory,
  deleteExistingCategory,
} = require("../../src/modules/category/category.service");

afterEach(() => {
  vi.restoreAllMocks();
});

const makeCategory = (overrides = {}) => ({
  id:         1,
  name:       "Motores",
  code:       "MOT",
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  ...overrides,
});

// ── getAllCategories ───────────────────────────────────────────────────────────

describe("getAllCategories", () => {
  it("retorna lista vazia quando não há categorias", async () => {
    vi.spyOn(repo, "listAllCategories").mockResolvedValue([]);
    const result = await getAllCategories();
    expect(result).toEqual([]);
  });

  it("retorna categorias do repository", async () => {
    const cats = [makeCategory(), makeCategory({ id: 2, name: "Elétrica", code: "ELE" })];
    vi.spyOn(repo, "listAllCategories").mockResolvedValue(cats);
    const result = await getAllCategories();
    expect(result).toHaveLength(2);
    expect(result[0].code).toBe("MOT");
    expect(result[1].code).toBe("ELE");
  });
});

// ── createNewCategory ─────────────────────────────────────────────────────────

describe("createNewCategory", () => {
  it("lança VALIDATION quando name está vazio", async () => {
    await expect(createNewCategory({ name: "", code: "MOT" }))
      .rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança VALIDATION quando name é apenas espaços", async () => {
    await expect(createNewCategory({ name: "   ", code: "MOT" }))
      .rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança VALIDATION quando code está vazio", async () => {
    await expect(createNewCategory({ name: "Motores", code: "" }))
      .rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança DUPLICATE quando code já existe", async () => {
    vi.spyOn(repo, "findCategoryByCode").mockResolvedValue(makeCategory({ id: 99 }));
    await expect(createNewCategory({ name: "Outra", code: "MOT" }))
      .rejects.toMatchObject({ code: "DUPLICATE", existingId: 99 });
  });

  it("normaliza code para maiúsculas e remove espaços", async () => {
    vi.spyOn(repo, "findCategoryByCode").mockResolvedValue(null);
    vi.spyOn(repo, "createCategory").mockResolvedValue(1);
    vi.spyOn(repo, "findCategoryById").mockResolvedValue(makeCategory({ code: "ELE" }));

    await createNewCategory({ name: "Elétrica", code: "  ele  " });
    expect(repo.createCategory).toHaveBeenCalledWith({ name: "Elétrica", code: "ELE" });
  });

  it("cria categoria e retorna o objeto criado", async () => {
    vi.spyOn(repo, "findCategoryByCode").mockResolvedValue(null);
    vi.spyOn(repo, "createCategory").mockResolvedValue(5);
    vi.spyOn(repo, "findCategoryById").mockResolvedValue(makeCategory({ id: 5, name: "Motores", code: "MOT" }));

    const result = await createNewCategory({ name: "Motores", code: "mot" });
    expect(result).toMatchObject({ id: 5, name: "Motores", code: "MOT" });
    expect(repo.findCategoryById).toHaveBeenCalledWith(5);
  });

  it("não chama createCategory se findCategoryByCode encontrar duplicata", async () => {
    vi.spyOn(repo, "findCategoryByCode").mockResolvedValue(makeCategory());
    vi.spyOn(repo, "createCategory");

    await expect(createNewCategory({ name: "Motores", code: "MOT" })).rejects.toThrow();
    expect(repo.createCategory).not.toHaveBeenCalled();
  });
});

// ── updateExistingCategory ────────────────────────────────────────────────────

describe("updateExistingCategory", () => {
  it("lança NOT_FOUND quando categoria não existe", async () => {
    vi.spyOn(repo, "findCategoryById").mockResolvedValue(null);
    await expect(updateExistingCategory(99, { name: "X", code: "X" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lança VALIDATION quando name está vazio", async () => {
    vi.spyOn(repo, "findCategoryById").mockResolvedValue(makeCategory());
    await expect(updateExistingCategory(1, { name: "", code: "MOT" }))
      .rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança VALIDATION quando code está vazio", async () => {
    vi.spyOn(repo, "findCategoryById").mockResolvedValue(makeCategory());
    await expect(updateExistingCategory(1, { name: "Motores", code: "" }))
      .rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança DUPLICATE quando code pertence a outra categoria", async () => {
    vi.spyOn(repo, "findCategoryById").mockResolvedValue(makeCategory({ id: 1 }));
    vi.spyOn(repo, "findCategoryByCode").mockResolvedValue(makeCategory({ id: 2, code: "ELE" }));
    await expect(updateExistingCategory(1, { name: "Elétrica", code: "ELE" }))
      .rejects.toMatchObject({ code: "DUPLICATE" });
  });

  it("permite manter o mesmo code na atualização (sem DUPLICATE para si mesmo)", async () => {
    vi.spyOn(repo, "findCategoryById")
      .mockResolvedValueOnce(makeCategory({ id: 1, code: "MOT" }))
      .mockResolvedValueOnce(makeCategory({ id: 1, code: "MOT" }));
    vi.spyOn(repo, "findCategoryByCode").mockResolvedValue(makeCategory({ id: 1, code: "MOT" }));
    vi.spyOn(repo, "updateCategory").mockResolvedValue(undefined);

    await expect(updateExistingCategory(1, { name: "Motores v2", code: "MOT" })).resolves.toBeDefined();
    expect(repo.updateCategory).toHaveBeenCalled();
  });

  it("atualiza e retorna categoria atualizada", async () => {
    vi.spyOn(repo, "findCategoryById")
      .mockResolvedValueOnce(makeCategory({ id: 1 }))
      .mockResolvedValueOnce(makeCategory({ id: 1, name: "Elétrica", code: "ELE" }));
    vi.spyOn(repo, "findCategoryByCode").mockResolvedValue(null);
    vi.spyOn(repo, "updateCategory").mockResolvedValue(undefined);

    const result = await updateExistingCategory(1, { name: "Elétrica", code: "ELE" });
    expect(result).toMatchObject({ name: "Elétrica", code: "ELE" });
    expect(repo.updateCategory).toHaveBeenCalledWith(1, { name: "Elétrica", code: "ELE" });
  });
});

// ── deleteExistingCategory ────────────────────────────────────────────────────

describe("deleteExistingCategory", () => {
  it("lança NOT_FOUND quando categoria não existe", async () => {
    vi.spyOn(repo, "findCategoryById").mockResolvedValue(null);
    await expect(deleteExistingCategory(99))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lança HAS_PARTS quando categoria tem peças vinculadas", async () => {
    vi.spyOn(repo, "findCategoryById").mockResolvedValue(makeCategory());
    vi.spyOn(repo, "countPartsInCategory").mockResolvedValue(3);
    await expect(deleteExistingCategory(1))
      .rejects.toMatchObject({ code: "HAS_PARTS" });
  });

  it("mensagem de erro HAS_PARTS inclui o count de peças", async () => {
    vi.spyOn(repo, "findCategoryById").mockResolvedValue(makeCategory());
    vi.spyOn(repo, "countPartsInCategory").mockResolvedValue(5);
    await expect(deleteExistingCategory(1))
      .rejects.toThrow("5 peça(s)");
  });

  it("exclui categoria sem peças com sucesso", async () => {
    vi.spyOn(repo, "findCategoryById").mockResolvedValue(makeCategory());
    vi.spyOn(repo, "countPartsInCategory").mockResolvedValue(0);
    vi.spyOn(repo, "deleteCategory").mockResolvedValue(undefined);

    await expect(deleteExistingCategory(1)).resolves.toBeUndefined();
    expect(repo.deleteCategory).toHaveBeenCalledWith(1);
  });

  it("não chama deleteCategory se categoria tem peças", async () => {
    vi.spyOn(repo, "findCategoryById").mockResolvedValue(makeCategory());
    vi.spyOn(repo, "countPartsInCategory").mockResolvedValue(2);
    vi.spyOn(repo, "deleteCategory");

    await expect(deleteExistingCategory(1)).rejects.toThrow();
    expect(repo.deleteCategory).not.toHaveBeenCalled();
  });
});

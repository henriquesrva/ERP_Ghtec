const repo = require("../../src/modules/categoria_despesa/categoria_despesa.repository");
const svc  = require("../../src/modules/categoria_despesa/categoria_despesa.service");

const {
  getAllCategorias,
  getCategoriaById,
  createCategoria,
  updateCategoria,
  desativarCategoria,
} = svc;

function fakeCat(overrides = {}) {
  return {
    id:         1,
    nome:       "Material de Escritório",
    descricao:  null,
    ativo:      true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── getAllCategorias ───────────────────────────────────────────────────────────

describe("getAllCategorias", () => {
  it("delegates to repo.listCategoriasDespesa with apenasAtivas=true by default", async () => {
    const fake = [fakeCat()];
    const spy  = vi.spyOn(repo, "listCategoriasDespesa").mockResolvedValue(fake);

    await expect(getAllCategorias()).resolves.toEqual(fake);
    expect(spy).toHaveBeenCalledWith({ apenasAtivas: true });
  });

  it("passes apenasAtivas=false when requested", async () => {
    const spy = vi.spyOn(repo, "listCategoriasDespesa").mockResolvedValue([]);

    await getAllCategorias({ apenasAtivas: false });

    expect(spy).toHaveBeenCalledWith({ apenasAtivas: false });
  });
});

// ── getCategoriaById ──────────────────────────────────────────────────────────

describe("getCategoriaById", () => {
  it("delegates to repo.findCategoriaDespesaById", async () => {
    const fake = fakeCat({ id: 3 });
    vi.spyOn(repo, "findCategoriaDespesaById").mockResolvedValue(fake);

    await expect(getCategoriaById(3)).resolves.toEqual(fake);
  });
});

// ── createCategoria ───────────────────────────────────────────────────────────

describe("createCategoria", () => {
  it("throws VALIDATION when nome is empty", async () => {
    await expect(createCategoria({ nome: "" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createCategoria({ nome: "   " })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createCategoria({})).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("creates categoria and returns it", async () => {
    const createSpy = vi.spyOn(repo, "createCategoriaDespesa").mockResolvedValue(5);
    const findSpy   = vi.spyOn(repo, "findCategoriaDespesaById").mockResolvedValue(fakeCat({ id: 5, nome: "Serviços" }));

    const result = await createCategoria({ nome: "Serviços", descricao: "Desc" });

    expect(result.id).toBe(5);
    expect(createSpy).toHaveBeenCalledWith({ nome: "Serviços", descricao: "Desc" });
    expect(findSpy).toHaveBeenCalledWith(5);
  });
});

// ── updateCategoria ───────────────────────────────────────────────────────────

describe("updateCategoria", () => {
  it("throws NOT_FOUND when categoria does not exist", async () => {
    vi.spyOn(repo, "findCategoriaDespesaById").mockResolvedValue(null);

    await expect(updateCategoria(99, { nome: "X" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws VALIDATION when nome is empty", async () => {
    vi.spyOn(repo, "findCategoriaDespesaById").mockResolvedValue(fakeCat());

    await expect(updateCategoria(1, { nome: "" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(updateCategoria(1, { nome: "   " })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("updates and returns refreshed categoria", async () => {
    vi.spyOn(repo, "findCategoriaDespesaById")
      .mockResolvedValueOnce(fakeCat({ id: 1 }))
      .mockResolvedValueOnce(fakeCat({ id: 1, nome: "Novo Nome" }));
    const updateSpy = vi.spyOn(repo, "updateCategoriaDespesa").mockResolvedValue(undefined);

    const result = await updateCategoria(1, { nome: "Novo Nome" });

    expect(result.nome).toBe("Novo Nome");
    expect(updateSpy).toHaveBeenCalledWith(1, { nome: "Novo Nome" });
  });
});

// ── desativarCategoria ────────────────────────────────────────────────────────

describe("desativarCategoria", () => {
  it("throws NOT_FOUND when categoria does not exist", async () => {
    vi.spyOn(repo, "findCategoriaDespesaById").mockResolvedValue(null);

    await expect(desativarCategoria(99)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("calls desativarCategoriaDespesa for existing categoria", async () => {
    vi.spyOn(repo, "findCategoriaDespesaById").mockResolvedValue(fakeCat({ id: 3 }));
    const desSpy = vi.spyOn(repo, "desativarCategoriaDespesa").mockResolvedValue(undefined);

    await expect(desativarCategoria(3)).resolves.toBeUndefined();
    expect(desSpy).toHaveBeenCalledWith(3);
  });
});

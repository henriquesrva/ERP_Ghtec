const repo = require("../../src/modules/fornecedor/fornecedor.repository");
const svc  = require("../../src/modules/fornecedor/fornecedor.service");

const {
  getAllFornecedores,
  getFornecedorById,
  searchFornecedoresByQuery,
  getFornecedorDetalhesById,
  createNewFornecedor,
  updateExistingFornecedor,
  desativarFornecedorById,
} = svc;

function fakeFornecedor(overrides = {}) {
  return {
    id:                1,
    razao_social:      "Empresa Teste",
    nome_fantasia:     "Teste",
    cnpj:              "12.345.678/0001-90",
    inscricao_estadual: null,
    email:             null,
    telefone:          null,
    endereco:          null,
    cidade:            "São Paulo",
    estado:            "SP",
    cep:               null,
    observacoes:       null,
    ativo:             true,
    created_at:        new Date(),
    updated_at:        new Date(),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── getAllFornecedores ─────────────────────────────────────────────────────────

describe("getAllFornecedores", () => {
  it("delegates to repo.listAllFornecedores", async () => {
    const fake = [fakeFornecedor()];
    vi.spyOn(repo, "listAllFornecedores").mockResolvedValue(fake);

    await expect(getAllFornecedores({ includeInactive: false })).resolves.toEqual(fake);
  });
});

// ── getFornecedorById ──────────────────────────────────────────────────────────

describe("getFornecedorById", () => {
  it("delegates to repo.findFornecedorById", async () => {
    const fake = fakeFornecedor({ id: 3 });
    vi.spyOn(repo, "findFornecedorById").mockResolvedValue(fake);

    await expect(getFornecedorById(3)).resolves.toEqual(fake);
  });
});

// ── searchFornecedoresByQuery ─────────────────────────────────────────────────

describe("searchFornecedoresByQuery", () => {
  it("delegates to repo.searchFornecedores", async () => {
    const fake = [{ id: 2, razao_social: "Fornecedor ABC" }];
    vi.spyOn(repo, "searchFornecedores").mockResolvedValue(fake);

    await expect(searchFornecedoresByQuery("ABC", {})).resolves.toEqual(fake);
  });
});

// ── getFornecedorDetalhesById ─────────────────────────────────────────────────

describe("getFornecedorDetalhesById", () => {
  it("throws NOT_FOUND when repo returns null", async () => {
    vi.spyOn(repo, "getFornecedorDetalhes").mockResolvedValue(null);

    await expect(getFornecedorDetalhesById(99)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns details when found", async () => {
    const fake = { fornecedor: fakeFornecedor(), notas: [], contas: [] };
    vi.spyOn(repo, "getFornecedorDetalhes").mockResolvedValue(fake);

    await expect(getFornecedorDetalhesById(1)).resolves.toEqual(fake);
  });
});

// ── createNewFornecedor ───────────────────────────────────────────────────────

describe("createNewFornecedor", () => {
  it("throws VALIDATION when razao_social is empty", async () => {
    await expect(createNewFornecedor({ razao_social: "" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createNewFornecedor({ razao_social: "   " })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createNewFornecedor({})).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("throws DUPLICATE_CNPJ when CNPJ already exists", async () => {
    vi.spyOn(repo, "findFornecedorByCnpj").mockResolvedValue({ id: 5, razao_social: "Existente" });

    await expect(
      createNewFornecedor({ razao_social: "Nova Empresa", cnpj: "12.345.678/0001-90" })
    ).rejects.toMatchObject({ code: "DUPLICATE_CNPJ", existingId: 5 });
  });

  it("creates fornecedor and returns it", async () => {
    vi.spyOn(repo, "findFornecedorByCnpj").mockResolvedValue(null);
    const createSpy = vi.spyOn(repo, "createFornecedor").mockResolvedValue(7);
    const findSpy   = vi.spyOn(repo, "findFornecedorById").mockResolvedValue(fakeFornecedor({ id: 7 }));

    const result = await createNewFornecedor({ razao_social: "Nova Empresa", cnpj: "12.345.678/0001-90" });

    expect(result.id).toBe(7);
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ razao_social: "Nova Empresa" }));
    expect(findSpy).toHaveBeenCalledWith(7);
  });

  it("creates without CNPJ check when cnpj is absent", async () => {
    const createSpy = vi.spyOn(repo, "createFornecedor").mockResolvedValue(8);
    vi.spyOn(repo, "findFornecedorById").mockResolvedValue(fakeFornecedor({ id: 8 }));
    const cnpjSpy = vi.spyOn(repo, "findFornecedorByCnpj");

    await createNewFornecedor({ razao_social: "Sem CNPJ" });

    expect(cnpjSpy).not.toHaveBeenCalled();
    expect(createSpy).toHaveBeenCalled();
  });
});

// ── updateExistingFornecedor ──────────────────────────────────────────────────

describe("updateExistingFornecedor", () => {
  it("throws NOT_FOUND when fornecedor does not exist", async () => {
    vi.spyOn(repo, "findFornecedorById").mockResolvedValue(null);

    await expect(updateExistingFornecedor(99, { razao_social: "X" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws VALIDATION when razao_social is empty", async () => {
    vi.spyOn(repo, "findFornecedorById").mockResolvedValue(fakeFornecedor());

    await expect(updateExistingFornecedor(1, { razao_social: "" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("throws DUPLICATE_CNPJ when CNPJ belongs to another fornecedor", async () => {
    vi.spyOn(repo, "findFornecedorById").mockResolvedValue(fakeFornecedor({ id: 1 }));
    vi.spyOn(repo, "findFornecedorByCnpj").mockResolvedValue({ id: 5, razao_social: "Outro" });

    await expect(
      updateExistingFornecedor(1, { razao_social: "Empresa", cnpj: "11.111.111/0001-11" })
    ).rejects.toMatchObject({ code: "DUPLICATE_CNPJ" });
  });

  it("updates and returns refreshed fornecedor", async () => {
    vi.spyOn(repo, "findFornecedorById")
      .mockResolvedValueOnce(fakeFornecedor({ id: 1 }))
      .mockResolvedValueOnce(fakeFornecedor({ id: 1, razao_social: "Atualizada" }));
    vi.spyOn(repo, "findFornecedorByCnpj").mockResolvedValue(null);
    const updateSpy = vi.spyOn(repo, "updateFornecedor").mockResolvedValue(undefined);

    const result = await updateExistingFornecedor(1, { razao_social: "Atualizada" });

    expect(result.razao_social).toBe("Atualizada");
    expect(updateSpy).toHaveBeenCalledWith(1, expect.objectContaining({ razao_social: "Atualizada" }));
  });
});

// ── desativarFornecedorById ───────────────────────────────────────────────────

describe("desativarFornecedorById", () => {
  it("throws NOT_FOUND when fornecedor does not exist", async () => {
    vi.spyOn(repo, "findFornecedorById").mockResolvedValue(null);

    await expect(desativarFornecedorById(99)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("calls desativarFornecedor for existing fornecedor", async () => {
    vi.spyOn(repo, "findFornecedorById").mockResolvedValue(fakeFornecedor({ id: 2 }));
    const desSpy = vi.spyOn(repo, "desativarFornecedor").mockResolvedValue(undefined);

    await expect(desativarFornecedorById(2)).resolves.toBeUndefined();
    expect(desSpy).toHaveBeenCalledWith(2);
  });
});

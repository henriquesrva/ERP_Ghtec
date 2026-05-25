const repo = require("../../src/modules/responsavel/responsavel.repository");
const {
  getAllResponsaveis,
  getResponsavelById,
  searchResponsaveisByQuery,
  createNewResponsavel,
  deleteResponsavel,
} = require("../../src/modules/responsavel/responsavel.service");

const FAKE = { id: 1, nome: "João Silva", telefone: "11999990000", cargo: "Técnico", created_at: new Date("2026-01-01") };

afterEach(() => vi.restoreAllMocks());

// ── getAllResponsaveis ─────────────────────────────────────────────────────────

describe("getAllResponsaveis", () => {
  it("retorna lista vazia quando não há responsáveis", async () => {
    vi.spyOn(repo, "listAllResponsaveis").mockResolvedValue([]);
    expect(await getAllResponsaveis()).toEqual([]);
  });

  it("retorna responsáveis do repository", async () => {
    vi.spyOn(repo, "listAllResponsaveis").mockResolvedValue([FAKE]);
    const result = await getAllResponsaveis();
    expect(result).toHaveLength(1);
    expect(result[0].nome).toBe("João Silva");
  });
});

// ── getResponsavelById ────────────────────────────────────────────────────────

describe("getResponsavelById", () => {
  it("retorna registro do repository", async () => {
    vi.spyOn(repo, "findResponsavelById").mockResolvedValue(FAKE);
    expect(await getResponsavelById(1)).toEqual(FAKE);
  });

  it("retorna null quando não encontrado", async () => {
    vi.spyOn(repo, "findResponsavelById").mockResolvedValue(null);
    expect(await getResponsavelById(999)).toBeNull();
  });
});

// ── searchResponsaveisByQuery ──────────────────────────────────────────────────

describe("searchResponsaveisByQuery", () => {
  it("delega busca ao repository", async () => {
    vi.spyOn(repo, "searchResponsaveis").mockResolvedValue([FAKE]);
    const result = await searchResponsaveisByQuery("João");
    expect(result).toEqual([FAKE]);
    expect(repo.searchResponsaveis).toHaveBeenCalledWith("João");
  });
});

// ── createNewResponsavel ───────────────────────────────────────────────────────

describe("createNewResponsavel", () => {
  it("lança erro se nome estiver ausente", async () => {
    await expect(createNewResponsavel({})).rejects.toThrow("obrigatório");
  });

  it("lança erro se nome for apenas espaços", async () => {
    await expect(createNewResponsavel({ nome: "   " })).rejects.toThrow("obrigatório");
  });

  it("cria responsável e retorna o registro", async () => {
    vi.spyOn(repo, "createResponsavel").mockResolvedValue(1);
    vi.spyOn(repo, "findResponsavelById").mockResolvedValue(FAKE);
    const result = await createNewResponsavel({ nome: "João Silva", cargo: "Técnico" });
    expect(result).toEqual(FAKE);
    expect(repo.createResponsavel).toHaveBeenCalledWith({ nome: "João Silva", cargo: "Técnico" });
    expect(repo.findResponsavelById).toHaveBeenCalledWith(1);
  });
});

// ── deleteResponsavel ─────────────────────────────────────────────────────────

describe("deleteResponsavel", () => {
  it("lança NOT_FOUND se responsável não existe", async () => {
    vi.spyOn(repo, "findResponsavelById").mockResolvedValue(null);
    const err = await deleteResponsavel(999).catch((e) => e);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("exclui responsável existente", async () => {
    vi.spyOn(repo, "findResponsavelById").mockResolvedValue(FAKE);
    vi.spyOn(repo, "deleteResponsavelById").mockResolvedValue(undefined);
    await expect(deleteResponsavel(1)).resolves.toBeUndefined();
    expect(repo.deleteResponsavelById).toHaveBeenCalledWith(1);
  });

  it("não chama deleteResponsavelById se não encontrar", async () => {
    vi.spyOn(repo, "findResponsavelById").mockResolvedValue(null);
    vi.spyOn(repo, "deleteResponsavelById");
    await deleteResponsavel(999).catch(() => {});
    expect(repo.deleteResponsavelById).not.toHaveBeenCalled();
  });
});

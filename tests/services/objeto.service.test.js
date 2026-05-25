const repo = require("../../src/modules/objeto/objeto.repository");
const {
  getAllObjetos,
  getObjetoById,
  searchObjetosByQuery,
  createNewObjeto,
  updateObjetoService,
  deleteObjeto,
} = require("../../src/modules/objeto/objeto.service");

const FAKE = { id: 1, nome: "Instalação Elétrica", descricao: "Serviço elétrico", created_at: new Date("2026-01-01") };

afterEach(() => vi.restoreAllMocks());

// ── getAllObjetos ──────────────────────────────────────────────────────────────

describe("getAllObjetos", () => {
  it("retorna lista vazia quando não há objetos", async () => {
    vi.spyOn(repo, "listAllObjetos").mockResolvedValue([]);
    expect(await getAllObjetos()).toEqual([]);
  });

  it("retorna objetos do repository", async () => {
    vi.spyOn(repo, "listAllObjetos").mockResolvedValue([FAKE]);
    const result = await getAllObjetos();
    expect(result).toHaveLength(1);
    expect(result[0].nome).toBe("Instalação Elétrica");
  });
});

// ── getObjetoById ─────────────────────────────────────────────────────────────

describe("getObjetoById", () => {
  it("retorna registro do repository", async () => {
    vi.spyOn(repo, "findObjetoById").mockResolvedValue(FAKE);
    expect(await getObjetoById(1)).toEqual(FAKE);
  });

  it("retorna null quando não encontrado", async () => {
    vi.spyOn(repo, "findObjetoById").mockResolvedValue(null);
    expect(await getObjetoById(999)).toBeNull();
  });
});

// ── searchObjetosByQuery ───────────────────────────────────────────────────────

describe("searchObjetosByQuery", () => {
  it("delega busca ao repository", async () => {
    vi.spyOn(repo, "searchObjetos").mockResolvedValue([FAKE]);
    const result = await searchObjetosByQuery("elétrica");
    expect(result).toEqual([FAKE]);
    expect(repo.searchObjetos).toHaveBeenCalledWith("elétrica");
  });
});

// ── createNewObjeto ────────────────────────────────────────────────────────────

describe("createNewObjeto", () => {
  it("lança erro se nome estiver ausente", async () => {
    await expect(createNewObjeto({})).rejects.toThrow("obrigatório");
  });

  it("lança erro se nome for apenas espaços", async () => {
    await expect(createNewObjeto({ nome: "   " })).rejects.toThrow("obrigatório");
  });

  it("faz trim e cria objeto", async () => {
    vi.spyOn(repo, "createObjeto").mockResolvedValue(1);
    vi.spyOn(repo, "findObjetoById").mockResolvedValue(FAKE);
    const result = await createNewObjeto({ nome: "  Instalação Elétrica  ", descricao: "  Desc  " });
    expect(result).toEqual(FAKE);
    expect(repo.createObjeto).toHaveBeenCalledWith({ nome: "Instalação Elétrica", descricao: "Desc" });
  });

  it("define descricao como null quando ausente", async () => {
    vi.spyOn(repo, "createObjeto").mockResolvedValue(1);
    vi.spyOn(repo, "findObjetoById").mockResolvedValue(FAKE);
    await createNewObjeto({ nome: "Test" });
    expect(repo.createObjeto).toHaveBeenCalledWith({ nome: "Test", descricao: null });
  });
});

// ── updateObjetoService ────────────────────────────────────────────────────────

describe("updateObjetoService", () => {
  it("lança NOT_FOUND se objeto não existe", async () => {
    vi.spyOn(repo, "findObjetoById").mockResolvedValue(null);
    const err = await updateObjetoService(999, { nome: "X" }).catch((e) => e);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("lança erro se nome for vazio na atualização", async () => {
    vi.spyOn(repo, "findObjetoById").mockResolvedValue(FAKE);
    await expect(updateObjetoService(1, { nome: "" })).rejects.toThrow("obrigatório");
  });

  it("não chama updateObjeto se nome for inválido", async () => {
    vi.spyOn(repo, "findObjetoById").mockResolvedValue(FAKE);
    vi.spyOn(repo, "updateObjeto");
    await updateObjetoService(1, { nome: "" }).catch(() => {});
    expect(repo.updateObjeto).not.toHaveBeenCalled();
  });

  it("atualiza e retorna objeto atualizado", async () => {
    const updated = { ...FAKE, nome: "Novo Nome" };
    vi.spyOn(repo, "findObjetoById")
      .mockResolvedValueOnce(FAKE)
      .mockResolvedValueOnce(updated);
    vi.spyOn(repo, "updateObjeto").mockResolvedValue(undefined);
    const result = await updateObjetoService(1, { nome: "Novo Nome" });
    expect(result).toEqual(updated);
    expect(repo.updateObjeto).toHaveBeenCalledWith(1, { nome: "Novo Nome", descricao: null });
  });
});

// ── deleteObjeto ───────────────────────────────────────────────────────────────

describe("deleteObjeto", () => {
  it("lança NOT_FOUND se objeto não existe", async () => {
    vi.spyOn(repo, "findObjetoById").mockResolvedValue(null);
    const err = await deleteObjeto(999).catch((e) => e);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("exclui objeto existente", async () => {
    vi.spyOn(repo, "findObjetoById").mockResolvedValue(FAKE);
    vi.spyOn(repo, "deleteObjetoById").mockResolvedValue(undefined);
    await expect(deleteObjeto(1)).resolves.toBeUndefined();
    expect(repo.deleteObjetoById).toHaveBeenCalledWith(1);
  });

  it("não chama deleteObjetoById se não encontrar", async () => {
    vi.spyOn(repo, "findObjetoById").mockResolvedValue(null);
    vi.spyOn(repo, "deleteObjetoById");
    await deleteObjeto(999).catch(() => {});
    expect(repo.deleteObjetoById).not.toHaveBeenCalled();
  });
});

const repo = require("../../src/modules/client/client.repository");
const {
  getAllClients,
  getClientById,
  searchClientsByQuery,
  createNewClient,
  updateExistingClient,
  deleteClient,
  getClientProfitAnalysis,
} = require("../../src/modules/client/client.service");

const FAKE = {
  id:                  1,
  nome:                "Cliente Teste",
  razao_social:        "Empresa Ltda",
  nome_fantasia:       null,
  cnpj:                "11.222.333/0001-44",
  inscricao_estadual:  null,
  endereco:            "Rua A, 100",
  cidade:              "Belo Horizonte",
  estado:              "MG",
  cep:                 "30000-000",
  email:               "contato@empresa.com",
  telefone:            "(31) 99999-9999",
  contato_responsavel: null,
  observacoes:         null,
  has_parts_contract:  0,
  created_at:          new Date("2026-01-01"),
  updated_at:          new Date("2026-01-01"),
};

const VALID_DATA = {
  nome:         "Cliente Teste",
  razao_social: "Empresa Ltda",
  cnpj:         "11.222.333/0001-44",
  cidade:       "Belo Horizonte",
  estado:       "MG",
};

afterEach(() => vi.restoreAllMocks());

// ── getAllClients ──────────────────────────────────────────────────────────────

describe("getAllClients", () => {
  it("retorna lista vazia quando não há clientes", async () => {
    vi.spyOn(repo, "listAllClients").mockResolvedValue([]);
    expect(await getAllClients()).toEqual([]);
  });

  it("retorna clientes do repository", async () => {
    vi.spyOn(repo, "listAllClients").mockResolvedValue([FAKE]);
    const result = await getAllClients();
    expect(result).toHaveLength(1);
    expect(result[0].nome).toBe("Cliente Teste");
  });
});

// ── getClientById ─────────────────────────────────────────────────────────────

describe("getClientById", () => {
  it("retorna cliente do repository", async () => {
    vi.spyOn(repo, "findClientById").mockResolvedValue(FAKE);
    expect(await getClientById(1)).toEqual(FAKE);
  });

  it("retorna null quando não encontrado", async () => {
    vi.spyOn(repo, "findClientById").mockResolvedValue(null);
    expect(await getClientById(999)).toBeNull();
  });
});

// ── searchClientsByQuery ──────────────────────────────────────────────────────

describe("searchClientsByQuery", () => {
  it("delega busca ao repository", async () => {
    vi.spyOn(repo, "searchClients").mockResolvedValue([FAKE]);
    const result = await searchClientsByQuery("Empresa");
    expect(result).toEqual([FAKE]);
    expect(repo.searchClients).toHaveBeenCalledWith("Empresa");
  });
});

// ── createNewClient ───────────────────────────────────────────────────────────

describe("createNewClient", () => {
  it("lança VALIDATION se nome estiver vazio", async () => {
    const err = await createNewClient({ ...VALID_DATA, nome: "" }).catch((e) => e);
    expect(err.code).toBe("VALIDATION");
  });

  it("lança VALIDATION se nome for apenas espaços", async () => {
    const err = await createNewClient({ ...VALID_DATA, nome: "   " }).catch((e) => e);
    expect(err.code).toBe("VALIDATION");
  });

  it("lança DUPLICATE_CNPJ se CNPJ já existe", async () => {
    vi.spyOn(repo, "findClientByCnpj").mockResolvedValue(FAKE);
    const err = await createNewClient(VALID_DATA).catch((e) => e);
    expect(err.code).toBe("DUPLICATE_CNPJ");
    expect(err.existingId).toBe(1);
  });

  it("cria cliente sem CNPJ sem verificar duplicatas", async () => {
    vi.spyOn(repo, "findClientByCnpj");
    vi.spyOn(repo, "createClient").mockResolvedValue(2);
    vi.spyOn(repo, "findClientById").mockResolvedValue({ ...FAKE, id: 2, cnpj: null });
    const result = await createNewClient({ nome: "Novo Cliente" });
    expect(repo.findClientByCnpj).not.toHaveBeenCalled();
    expect(result.id).toBe(2);
  });

  it("cria cliente e retorna objeto completo", async () => {
    vi.spyOn(repo, "findClientByCnpj").mockResolvedValue(null);
    vi.spyOn(repo, "createClient").mockResolvedValue(1);
    vi.spyOn(repo, "findClientById").mockResolvedValue(FAKE);
    const result = await createNewClient(VALID_DATA);
    expect(result).toEqual(FAKE);
    expect(repo.createClient).toHaveBeenCalledWith(VALID_DATA);
  });

  it("não chama createClient se validação falhar", async () => {
    vi.spyOn(repo, "createClient");
    await createNewClient({ nome: "" }).catch(() => {});
    expect(repo.createClient).not.toHaveBeenCalled();
  });
});

// ── updateExistingClient ──────────────────────────────────────────────────────

describe("updateExistingClient", () => {
  it("lança NOT_FOUND se cliente não existe", async () => {
    vi.spyOn(repo, "findClientById").mockResolvedValue(null);
    const err = await updateExistingClient(999, VALID_DATA).catch((e) => e);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("lança VALIDATION se nome for vazio na atualização", async () => {
    vi.spyOn(repo, "findClientById").mockResolvedValue(FAKE);
    const err = await updateExistingClient(1, { ...VALID_DATA, nome: "" }).catch((e) => e);
    expect(err.code).toBe("VALIDATION");
  });

  it("lança DUPLICATE_CNPJ se CNPJ pertence a outro cliente", async () => {
    vi.spyOn(repo, "findClientById").mockResolvedValue(FAKE);
    vi.spyOn(repo, "findClientByCnpj").mockResolvedValue({ ...FAKE, id: 99 });
    const err = await updateExistingClient(1, VALID_DATA).catch((e) => e);
    expect(err.code).toBe("DUPLICATE_CNPJ");
  });

  it("não lança DUPLICATE_CNPJ se o CNPJ é do próprio cliente", async () => {
    vi.spyOn(repo, "findClientById").mockResolvedValue(FAKE);
    vi.spyOn(repo, "findClientByCnpj").mockResolvedValue(FAKE);
    vi.spyOn(repo, "updateClient").mockResolvedValue(undefined);
    await expect(updateExistingClient(1, VALID_DATA)).resolves.toEqual(FAKE);
  });

  it("atualiza e retorna cliente atualizado", async () => {
    vi.spyOn(repo, "findClientById").mockResolvedValue(FAKE);
    vi.spyOn(repo, "findClientByCnpj").mockResolvedValue(null);
    vi.spyOn(repo, "updateClient").mockResolvedValue(undefined);
    const result = await updateExistingClient(1, VALID_DATA);
    expect(repo.updateClient).toHaveBeenCalledWith(1, VALID_DATA);
    expect(result).toEqual(FAKE);
  });

  it("não chama updateClient se NOT_FOUND", async () => {
    vi.spyOn(repo, "findClientById").mockResolvedValue(null);
    vi.spyOn(repo, "updateClient");
    await updateExistingClient(999, VALID_DATA).catch(() => {});
    expect(repo.updateClient).not.toHaveBeenCalled();
  });
});

// ── deleteClient ──────────────────────────────────────────────────────────────

describe("deleteClient", () => {
  it("lança NOT_FOUND se cliente não existe", async () => {
    vi.spyOn(repo, "findClientById").mockResolvedValue(null);
    const err = await deleteClient(999).catch((e) => e);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("lança HAS_PROPOSALS se cliente tem propostas", async () => {
    vi.spyOn(repo, "findClientById").mockResolvedValue(FAKE);
    vi.spyOn(repo, "countClientProposals").mockReturnValue(3);
    const err = await deleteClient(1).catch((e) => e);
    expect(err.code).toBe("HAS_PROPOSALS");
    expect(err.proposalCount).toBe(3);
  });

  it("exclui cliente sem propostas", async () => {
    vi.spyOn(repo, "findClientById").mockResolvedValue(FAKE);
    vi.spyOn(repo, "countClientProposals").mockReturnValue(0);
    vi.spyOn(repo, "deleteClientById").mockResolvedValue(undefined);
    await expect(deleteClient(1)).resolves.toBeUndefined();
    expect(repo.deleteClientById).toHaveBeenCalledWith(1);
  });

  it("não chama deleteClientById se NOT_FOUND", async () => {
    vi.spyOn(repo, "findClientById").mockResolvedValue(null);
    vi.spyOn(repo, "deleteClientById");
    await deleteClient(999).catch(() => {});
    expect(repo.deleteClientById).not.toHaveBeenCalled();
  });

  it("não chama deleteClientById se HAS_PROPOSALS", async () => {
    vi.spyOn(repo, "findClientById").mockResolvedValue(FAKE);
    vi.spyOn(repo, "countClientProposals").mockReturnValue(1);
    vi.spyOn(repo, "deleteClientById");
    await deleteClient(1).catch(() => {});
    expect(repo.deleteClientById).not.toHaveBeenCalled();
  });
});

// ── getClientProfitAnalysis ───────────────────────────────────────────────────

describe("getClientProfitAnalysis", () => {
  it("retorna análise do repository", async () => {
    const fakeAnalysis = [{ client_id: 1, cliente_nome: "X", num_propostas: 2 }];
    vi.spyOn(repo, "getProfitAnalysis").mockReturnValue(fakeAnalysis);
    const result = await getClientProfitAnalysis();
    expect(result).toEqual(fakeAnalysis);
  });
});

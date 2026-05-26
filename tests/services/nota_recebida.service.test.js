const repo = require("../../src/modules/nota_recebida/nota_recebida.repository");
const svc  = require("../../src/modules/nota_recebida/nota_recebida.service");

const {
  getAllNotas,
  getNotaById,
  getNotaDetalhes,
  createNotaComContas,
  updateNotaExistente,
  cancelarNotaById,
} = svc;

function fakeNota(overrides = {}) {
  return {
    id:                   1,
    fornecedor_id:        10,
    numero_nota:          "001",
    serie:                "1",
    chave_acesso:         null,
    tipo_nota:            "produto",
    data_emissao:         new Date("2026-05-01"),
    data_entrada:         new Date("2026-05-02"),
    valor_total:          500.00,
    descricao:            "Compra de material",
    categoria_despesa_id: 2,
    arquivo_pdf:          null,
    arquivo_xml:          null,
    status:               "lancada",
    observacoes:          null,
    natureza_operacao:    null,
    cfop_principal:       null,
    modalidade_frete:     null,
    valor_frete:          null,
    valor_seguro:         null,
    valor_desconto:       null,
    valor_outras_despesas: null,
    valor_bc_icms:        null,
    valor_icms:           null,
    valor_ipi:            null,
    valor_pis:            null,
    valor_cofins:         null,
    valor_iss:            null,
    numero_protocolo:     null,
    data_autorizacao:     null,
    created_by:           1,
    created_at:           new Date(),
    updated_at:           new Date(),
    fornecedor_nome:      "Fornecedor Teste",
    fornecedor_cnpj:      null,
    categoria_nome:       "Materiais",
    criado_por_nome:      "Admin",
    ...overrides,
  };
}

function fakeItem(overrides = {}) {
  return {
    id:                    1,
    nota_recebida_id:      1,
    produto_id:            null,
    numero_item:           1,
    descricao:             "Parafuso M8",
    ncm:                   "73181500",
    valor_unitario:        10.0,
    valor_total:           100.0,
    quantidade:            10,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── getAllNotas ────────────────────────────────────────────────────────────────

describe("getAllNotas", () => {
  it("delega para repo.listNotasRecebidas", async () => {
    const fake = [fakeNota()];
    vi.spyOn(repo, "listNotasRecebidas").mockResolvedValue(fake);

    const result = await getAllNotas({ status: "lancada" });
    expect(result).toEqual(fake);
    expect(repo.listNotasRecebidas).toHaveBeenCalledWith({ status: "lancada" });
  });
});

// ── getNotaById ───────────────────────────────────────────────────────────────

describe("getNotaById", () => {
  it("retorna nota quando encontrada", async () => {
    const fake = fakeNota();
    vi.spyOn(repo, "findNotaById").mockResolvedValue(fake);

    await expect(getNotaById(1)).resolves.toEqual(fake);
  });

  it("lança NOT_FOUND quando nota não existe", async () => {
    vi.spyOn(repo, "findNotaById").mockResolvedValue(null);

    await expect(getNotaById(999)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ── getNotaDetalhes ───────────────────────────────────────────────────────────

describe("getNotaDetalhes", () => {
  it("retorna nota + itens + contas", async () => {
    const fake = fakeNota();
    const itens = [fakeItem()];
    vi.spyOn(repo, "findNotaById").mockResolvedValue(fake);
    vi.spyOn(repo, "listItensNota").mockResolvedValue(itens);
    vi.spyOn(repo, "findNotaContasPagar").mockReturnValue([]);

    const result = await getNotaDetalhes(1);
    expect(result).toEqual({ nota: fake, itens, contas: [] });
  });

  it("lança NOT_FOUND quando nota não existe", async () => {
    vi.spyOn(repo, "findNotaById").mockResolvedValue(null);

    await expect(getNotaDetalhes(999)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ── createNotaComContas ───────────────────────────────────────────────────────

describe("createNotaComContas", () => {
  const validData = {
    fornecedor_id:   10,
    data_entrada:    "2026-05-02",
    valor_total:     500,
    tipo_nota:       "produto",
    gerar_contas_pagar: false,
    itens: [],
  };

  it("cria nota válida sem itens e sem contas", async () => {
    const nota = fakeNota();
    vi.spyOn(repo, "checkDuplicataNota").mockResolvedValue(null);
    vi.spyOn(repo, "checkDuplicataChave").mockResolvedValue(null);
    vi.spyOn(repo, "createNotaComItens").mockResolvedValue(nota);

    await expect(createNotaComContas(validData, 1)).resolves.toEqual(nota);
    expect(repo.createNotaComItens).toHaveBeenCalledWith(
      expect.objectContaining({ fornecedor_id: 10, valor_total: 500 }),
      1
    );
  });

  it("cria nota com itens", async () => {
    const nota = fakeNota();
    const dataComItens = {
      ...validData,
      itens: [{ descricao: "Peça X", valor_total: 100 }],
    };
    vi.spyOn(repo, "checkDuplicataNota").mockResolvedValue(null);
    vi.spyOn(repo, "checkDuplicataChave").mockResolvedValue(null);
    vi.spyOn(repo, "createNotaComItens").mockResolvedValue(nota);

    await expect(createNotaComContas(dataComItens, 1)).resolves.toEqual(nota);
    expect(repo.createNotaComItens).toHaveBeenCalledWith(
      expect.objectContaining({ itens: [{ descricao: "Peça X", valor_total: 100 }] }),
      1
    );
  });

  it("cria nota com gerar_contas_pagar=true chama insertContasPagarBridge", async () => {
    const nota = fakeNota({ id: 5, valor_total: 200 });
    const dataComContas = {
      ...validData,
      gerar_contas_pagar:          true,
      parcelas_quantidade:          1,
      parcela_vencimento_inicial:   "2026-06-01",
      valor_total:                  200,
    };
    vi.spyOn(repo, "checkDuplicataNota").mockResolvedValue(null);
    vi.spyOn(repo, "checkDuplicataChave").mockResolvedValue(null);
    vi.spyOn(repo, "createNotaComItens").mockResolvedValue(nota);
    vi.spyOn(repo, "insertContasPagarBridge").mockImplementation(() => {});

    await createNotaComContas(dataComContas, 1);

    expect(repo.insertContasPagarBridge).toHaveBeenCalledOnce();
    const parcelas = repo.insertContasPagarBridge.mock.calls[0][0];
    expect(parcelas).toHaveLength(1);
    expect(parcelas[0]).toMatchObject({
      fornecedor_id:    10,
      nota_recebida_id: 5,
      valor:            200,
      status:           "em_aberto",
    });
  });

  it("lança VALIDATION se fornecedor_id ausente", async () => {
    const dataInvalid = { ...validData, fornecedor_id: null };
    await expect(createNotaComContas(dataInvalid, 1)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança VALIDATION se data_entrada ausente", async () => {
    const dataInvalid = { ...validData, data_entrada: null };
    await expect(createNotaComContas(dataInvalid, 1)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança VALIDATION se valor_total <= 0", async () => {
    const dataInvalid = { ...validData, valor_total: 0 };
    await expect(createNotaComContas(dataInvalid, 1)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança VALIDATION se tipo_nota inválido", async () => {
    const dataInvalid = { ...validData, tipo_nota: "despesa" };
    await expect(createNotaComContas(dataInvalid, 1)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança DUPLICATE_NOTA se já existe nota com mesmo número/série/fornecedor", async () => {
    vi.spyOn(repo, "checkDuplicataNota").mockResolvedValue({ id: 99 });
    const dataComNumero = { ...validData, numero_nota: "001", serie: "1" };

    await expect(createNotaComContas(dataComNumero, 1)).rejects.toMatchObject({
      code: "DUPLICATE_NOTA",
      existingId: 99,
    });
  });

  it("lança DUPLICATE_CHAVE se chave de acesso já existe", async () => {
    vi.spyOn(repo, "checkDuplicataNota").mockResolvedValue(null);
    vi.spyOn(repo, "checkDuplicataChave").mockResolvedValue({ id: 88 });
    const dataComChave = { ...validData, numero_nota: null, serie: null, chave_acesso: "ABCD1234" };

    await expect(createNotaComContas(dataComChave, 1)).rejects.toMatchObject({
      code: "DUPLICATE_CHAVE",
      existingId: 88,
    });
  });

  it("lança VALIDATION se item sem descrição", async () => {
    vi.spyOn(repo, "checkDuplicataNota").mockResolvedValue(null);
    vi.spyOn(repo, "checkDuplicataChave").mockResolvedValue(null);
    const dataComItemInvalido = {
      ...validData,
      itens: [{ descricao: "" }],
    };

    await expect(createNotaComContas(dataComItemInvalido, 1)).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

// ── updateNotaExistente ───────────────────────────────────────────────────────

describe("updateNotaExistente", () => {
  const validData = {
    fornecedor_id: 10,
    data_entrada:  "2026-05-02",
    valor_total:   600,
    tipo_nota:     "produto",
    itens: [],
  };

  it("atualiza nota válida", async () => {
    const existing = fakeNota();
    const updated  = fakeNota({ valor_total: 600 });
    vi.spyOn(repo, "findNotaById").mockResolvedValue(existing);
    vi.spyOn(repo, "checkDuplicataNota").mockResolvedValue(null);
    vi.spyOn(repo, "checkDuplicataChave").mockResolvedValue(null);
    vi.spyOn(repo, "updateNotaComItens").mockResolvedValue(updated);

    await expect(updateNotaExistente(1, validData, 1)).resolves.toEqual(updated);
  });

  it("lança NOT_FOUND se nota não existe", async () => {
    vi.spyOn(repo, "findNotaById").mockResolvedValue(null);

    await expect(updateNotaExistente(999, validData, 1)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lança VALIDATION se nota está cancelada", async () => {
    vi.spyOn(repo, "findNotaById").mockResolvedValue(fakeNota({ status: "cancelada" }));

    await expect(updateNotaExistente(1, validData, 1)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança VALIDATION se valor_total inválido", async () => {
    vi.spyOn(repo, "findNotaById").mockResolvedValue(fakeNota());
    const dataInvalid = { ...validData, valor_total: -10 };

    await expect(updateNotaExistente(1, dataInvalid, 1)).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

// ── cancelarNotaById ──────────────────────────────────────────────────────────

describe("cancelarNotaById", () => {
  it("cancela nota sem contas abertas", async () => {
    vi.spyOn(repo, "findNotaById").mockResolvedValue(fakeNota());
    vi.spyOn(repo, "countContasAbertas").mockReturnValue(0);
    vi.spyOn(repo, "cancelarNota").mockResolvedValue(undefined);

    await expect(cancelarNotaById(1, 1)).resolves.toBeUndefined();
    expect(repo.cancelarNota).toHaveBeenCalledWith(1);
  });

  it("lança NOT_FOUND se nota não existe", async () => {
    vi.spyOn(repo, "findNotaById").mockResolvedValue(null);

    await expect(cancelarNotaById(999, 1)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lança VALIDATION se nota já cancelada", async () => {
    vi.spyOn(repo, "findNotaById").mockResolvedValue(fakeNota({ status: "cancelada" }));

    await expect(cancelarNotaById(1, 1)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança HAS_CONTAS_ABERTAS se existem contas em aberto", async () => {
    vi.spyOn(repo, "findNotaById").mockResolvedValue(fakeNota());
    vi.spyOn(repo, "countContasAbertas").mockReturnValue(2);

    await expect(cancelarNotaById(1, 1)).rejects.toMatchObject({
      code:  "HAS_CONTAS_ABERTAS",
      count: 2,
    });
  });
});

// ── valores monetários e fiscais ──────────────────────────────────────────────

describe("valores monetários/fiscais", () => {
  it("cria nota com campos fiscais completos", async () => {
    const dataFiscal = {
      fornecedor_id:  10,
      data_entrada:   "2026-05-02",
      valor_total:    1000,
      tipo_nota:      "produto",
      valor_bc_icms:  900,
      valor_icms:     162,
      valor_ipi:      50,
      valor_pis:      6.5,
      valor_cofins:   30,
      gerar_contas_pagar: false,
      itens: [],
    };
    vi.spyOn(repo, "checkDuplicataNota").mockResolvedValue(null);
    vi.spyOn(repo, "checkDuplicataChave").mockResolvedValue(null);
    vi.spyOn(repo, "createNotaComItens").mockResolvedValue(fakeNota({ valor_bc_icms: 900 }));

    const result = await createNotaComContas(dataFiscal, 1);
    expect(repo.createNotaComItens).toHaveBeenCalledWith(
      expect.objectContaining({
        valor_bc_icms: 900,
        valor_icms:    162,
        valor_ipi:     50,
      }),
      1
    );
  });
});

// ── vinculação com produto/peça ───────────────────────────────────────────────

describe("vinculação com peça", () => {
  it("cria nota com item vinculado a produto_id", async () => {
    const nota = fakeNota();
    const dataComProduto = {
      fornecedor_id:      10,
      data_entrada:       "2026-05-02",
      valor_total:        100,
      tipo_nota:          "produto",
      gerar_contas_pagar: false,
      itens: [{ descricao: "Peça X", produto_id: 5, valor_total: 100, quantidade: 1 }],
    };
    vi.spyOn(repo, "checkDuplicataNota").mockResolvedValue(null);
    vi.spyOn(repo, "checkDuplicataChave").mockResolvedValue(null);
    vi.spyOn(repo, "createNotaComItens").mockResolvedValue(nota);

    await createNotaComContas(dataComProduto, 1);
    expect(repo.createNotaComItens).toHaveBeenCalledWith(
      expect.objectContaining({
        itens: [expect.objectContaining({ produto_id: 5 })],
      }),
      1
    );
  });
});

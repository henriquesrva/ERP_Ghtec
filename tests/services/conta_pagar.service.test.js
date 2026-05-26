const repo = require("../../src/modules/conta_pagar/conta_pagar.repository");
const svc  = require("../../src/modules/conta_pagar/conta_pagar.service");

const {
  getAllContas,
  getContaById,
  createNewConta,
  updateExistingConta,
  darBaixa,
  cancelar,
  getResumo,
} = svc;

function fakeConta(overrides = {}) {
  return {
    id:                    1,
    fornecedor_id:         10,
    nota_recebida_id:      null,
    categoria_despesa_id:  null,
    descricao:             "Compra de material",
    valor:                 500.00,
    data_emissao:          new Date("2026-05-01"),
    data_vencimento:       new Date("2026-06-01"),
    forma_pagamento:       null,
    status:                "em_aberto",
    data_pagamento:        null,
    valor_pago:            null,
    comprovante_pagamento: null,
    paid_by:               null,
    cancelled_by:          null,
    cancelled_at:          null,
    cancel_reason:         null,
    observacoes:           null,
    parcela_numero:        null,
    parcela_total:         null,
    created_by:            1,
    created_at:            new Date(),
    updated_at:            new Date(),
    atrasado:              0,
    fornecedor_nome:       "Fornecedor Teste",
    categoria_nome:        null,
    numero_nota:           null,
    serie:                 null,
    pago_por_nome:         null,
    cancelado_por_nome:    null,
    criado_por_nome:       "Admin",
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── getAllContas ───────────────────────────────────────────────────────────────

describe("getAllContas", () => {
  it("delega para repo.listContasPagar", async () => {
    const fake = [fakeConta()];
    vi.spyOn(repo, "listContasPagar").mockResolvedValue(fake);

    const result = await getAllContas({ status: "em_aberto" });
    expect(result).toEqual(fake);
    expect(repo.listContasPagar).toHaveBeenCalledWith({ status: "em_aberto" });
  });
});

// ── getContaById ──────────────────────────────────────────────────────────────

describe("getContaById", () => {
  it("retorna conta quando encontrada", async () => {
    const fake = fakeConta();
    vi.spyOn(repo, "findContaById").mockResolvedValue(fake);

    await expect(getContaById(1)).resolves.toEqual(fake);
  });

  it("lança NOT_FOUND quando conta não existe", async () => {
    vi.spyOn(repo, "findContaById").mockResolvedValue(null);

    await expect(getContaById(999)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ── createNewConta ────────────────────────────────────────────────────────────

describe("createNewConta", () => {
  const validData = {
    fornecedor_id:   10,
    descricao:       "Compra de material",
    valor:           500,
    data_emissao:    "2026-05-01",
    data_vencimento: "2026-06-01",
  };

  it("cria conta válida", async () => {
    const conta = fakeConta();
    vi.spyOn(repo, "createConta").mockResolvedValue(1);
    vi.spyOn(repo, "findContaById").mockResolvedValue(conta);

    await expect(createNewConta(validData, 1)).resolves.toEqual(conta);
    expect(repo.createConta).toHaveBeenCalledWith(
      expect.objectContaining({ fornecedor_id: 10, valor: 500, created_by: 1 })
    );
  });

  it("lança VALIDATION se fornecedor_id ausente", async () => {
    const dataInvalid = { ...validData, fornecedor_id: null };
    await expect(createNewConta(dataInvalid, 1)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança VALIDATION se descricao vazia", async () => {
    const dataInvalid = { ...validData, descricao: "   " };
    await expect(createNewConta(dataInvalid, 1)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança VALIDATION se valor <= 0", async () => {
    const dataInvalid = { ...validData, valor: 0 };
    await expect(createNewConta(dataInvalid, 1)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança VALIDATION se data_emissao ausente", async () => {
    const dataInvalid = { ...validData, data_emissao: null };
    await expect(createNewConta(dataInvalid, 1)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança VALIDATION se data_vencimento ausente", async () => {
    const dataInvalid = { ...validData, data_vencimento: null };
    await expect(createNewConta(dataInvalid, 1)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("passa nota_recebida_id e categoria_despesa_id opcionais", async () => {
    const dataComOpcionais = {
      ...validData,
      nota_recebida_id:     "5",
      categoria_despesa_id: "3",
    };
    const conta = fakeConta({ nota_recebida_id: 5, categoria_despesa_id: 3 });
    vi.spyOn(repo, "createConta").mockResolvedValue(1);
    vi.spyOn(repo, "findContaById").mockResolvedValue(conta);

    await createNewConta(dataComOpcionais, 1);
    expect(repo.createConta).toHaveBeenCalledWith(
      expect.objectContaining({ nota_recebida_id: 5, categoria_despesa_id: 3 })
    );
  });
});

// ── updateExistingConta ───────────────────────────────────────────────────────

describe("updateExistingConta", () => {
  const validData = {
    fornecedor_id:   10,
    descricao:       "Compra atualizada",
    valor:           600,
    data_emissao:    "2026-05-01",
    data_vencimento: "2026-07-01",
  };

  it("atualiza conta em aberto", async () => {
    const existing = fakeConta();
    const updated  = fakeConta({ valor: 600 });
    vi.spyOn(repo, "findContaById").mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);
    vi.spyOn(repo, "updateConta").mockResolvedValue(undefined);

    await expect(updateExistingConta(1, validData)).resolves.toEqual(updated);
  });

  it("lança NOT_FOUND se conta não existe", async () => {
    vi.spyOn(repo, "findContaById").mockResolvedValue(null);

    await expect(updateExistingConta(999, validData)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lança VALIDATION se conta está paga", async () => {
    vi.spyOn(repo, "findContaById").mockResolvedValue(fakeConta({ status: "pago" }));

    await expect(updateExistingConta(1, validData)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança VALIDATION se conta está cancelada", async () => {
    vi.spyOn(repo, "findContaById").mockResolvedValue(fakeConta({ status: "cancelado" }));

    await expect(updateExistingConta(1, validData)).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

// ── darBaixa ──────────────────────────────────────────────────────────────────

describe("darBaixa", () => {
  const validBaixa = {
    data_pagamento: "2026-06-01",
    valor_pago:     500,
    forma_pagamento: "pix",
  };

  it("dá baixa em conta em aberto", async () => {
    const existing = fakeConta();
    const paga     = fakeConta({ status: "pago", valor_pago: 500 });
    vi.spyOn(repo, "findContaById").mockResolvedValueOnce(existing).mockResolvedValueOnce(paga);
    vi.spyOn(repo, "baixarConta").mockResolvedValue(undefined);

    await expect(darBaixa(1, validBaixa, 1, null)).resolves.toEqual(paga);
    expect(repo.baixarConta).toHaveBeenCalledWith(1, expect.objectContaining({ paid_by: 1, valor_pago: 500 }));
  });

  it("lança NOT_FOUND se conta não existe", async () => {
    vi.spyOn(repo, "findContaById").mockResolvedValue(null);

    await expect(darBaixa(999, validBaixa, 1, null)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lança VALIDATION se conta já está paga", async () => {
    vi.spyOn(repo, "findContaById").mockResolvedValue(fakeConta({ status: "pago" }));

    await expect(darBaixa(1, validBaixa, 1, null)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança VALIDATION se conta está cancelada", async () => {
    vi.spyOn(repo, "findContaById").mockResolvedValue(fakeConta({ status: "cancelado" }));

    await expect(darBaixa(1, validBaixa, 1, null)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança VALIDATION se data_pagamento ausente", async () => {
    vi.spyOn(repo, "findContaById").mockResolvedValue(fakeConta());
    const baixaInvalida = { ...validBaixa, data_pagamento: null };

    await expect(darBaixa(1, baixaInvalida, 1, null)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança VALIDATION se valor_pago <= 0", async () => {
    vi.spyOn(repo, "findContaById").mockResolvedValue(fakeConta());
    const baixaInvalida = { ...validBaixa, valor_pago: 0 };

    await expect(darBaixa(1, baixaInvalida, 1, null)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança VALIDATION se forma_pagamento inválida", async () => {
    vi.spyOn(repo, "findContaById").mockResolvedValue(fakeConta());
    const baixaInvalida = { ...validBaixa, forma_pagamento: "criptomoeda" };

    await expect(darBaixa(1, baixaInvalida, 1, null)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("passa comprovante_path para baixarConta", async () => {
    const existing = fakeConta();
    const paga = fakeConta({ status: "pago" });
    vi.spyOn(repo, "findContaById").mockResolvedValueOnce(existing).mockResolvedValueOnce(paga);
    vi.spyOn(repo, "baixarConta").mockResolvedValue(undefined);

    await darBaixa(1, validBaixa, 1, "comprovantes/file.pdf");
    expect(repo.baixarConta).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ comprovante_pagamento: "comprovantes/file.pdf" })
    );
  });
});

// ── cancelar ──────────────────────────────────────────────────────────────────

describe("cancelar", () => {
  it("cancela conta em aberto", async () => {
    const existing   = fakeConta();
    const cancelada  = fakeConta({ status: "cancelado" });
    vi.spyOn(repo, "findContaById").mockResolvedValueOnce(existing).mockResolvedValueOnce(cancelada);
    vi.spyOn(repo, "cancelarConta").mockResolvedValue(undefined);

    await expect(cancelar(1, "motivo qualquer", 1)).resolves.toEqual(cancelada);
    expect(repo.cancelarConta).toHaveBeenCalledWith(1, { cancelled_by: 1, cancel_reason: "motivo qualquer" });
  });

  it("lança NOT_FOUND se conta não existe", async () => {
    vi.spyOn(repo, "findContaById").mockResolvedValue(null);

    await expect(cancelar(999, null, 1)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lança VALIDATION se conta já está cancelada", async () => {
    vi.spyOn(repo, "findContaById").mockResolvedValue(fakeConta({ status: "cancelado" }));

    await expect(cancelar(1, null, 1)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lança VALIDATION se conta já está paga", async () => {
    vi.spyOn(repo, "findContaById").mockResolvedValue(fakeConta({ status: "pago" }));

    await expect(cancelar(1, null, 1)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("passa cancel_reason null quando motivo não fornecido", async () => {
    const existing  = fakeConta();
    const cancelada = fakeConta({ status: "cancelado" });
    vi.spyOn(repo, "findContaById").mockResolvedValueOnce(existing).mockResolvedValueOnce(cancelada);
    vi.spyOn(repo, "cancelarConta").mockResolvedValue(undefined);

    await cancelar(1, undefined, 1);
    expect(repo.cancelarConta).toHaveBeenCalledWith(1, { cancelled_by: 1, cancel_reason: null });
  });
});

// ── getResumo ─────────────────────────────────────────────────────────────────

describe("getResumo", () => {
  it("delega para repo.getResumoFinanceiro", async () => {
    const fakeResumo = {
      totais:         { total_aberto: 1000, total_atrasado: 200, total_pago_mes: 500 },
      proxVencimentos: [],
      vencendo7dias:  { n: 3, total: 600 },
      porCategoria:   [],
    };
    vi.spyOn(repo, "getResumoFinanceiro").mockResolvedValue(fakeResumo);

    await expect(getResumo()).resolves.toEqual(fakeResumo);
    expect(repo.getResumoFinanceiro).toHaveBeenCalledOnce();
  });
});

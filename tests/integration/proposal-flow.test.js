// Testes de fluxo do proposal.service.js.
// O service usa referências de módulo (proposalRepo.fn()), então vi.spyOn()
// intercepta corretamente — mesmo padrão de pdfService já usado no projeto.

const proposalRepo = require("../../src/modules/proposal/proposal.repository");
const clientRepo   = require("../../src/modules/client/client.repository");
const partRepo     = require("../../src/modules/part/part.repository");
const kanbanRepo   = require("../../src/modules/kanban/kanban.repository");
const pdfService   = require("../../src/modules/proposal/proposal-pdf.service");

const {
  createProposalFlow,
  calculateTotal,
  markProposalExecuted,
  removeProposalExecution,
  registerBilling,
  canMarkExecution,
} = require("../../src/modules/proposal/proposal.service");

// ── Helpers ───────────────────────────────────────────────────────────────────

function fakeClient(overrides = {}) {
  return {
    id: 1, nome: "Cliente Teste", razao_social: null, cnpj: null,
    cidade: "BH", estado: "MG", endereco: null, cep: null,
    email: null, telefone: null, has_parts_contract: 0,
    ...overrides,
  };
}

function proposalPayload({ clienteId, numeroProposta = "FLOW-001", items, responsavel } = {}) {
  return {
    numero_proposta: numeroProposta,
    cliente_id:      clienteId,
    objeto_proposta: "Manutenção de equipamentos",
    cidade_emissao:  "Belo Horizonte",
    condicoes: {
      forma_pagamento: "Boleto",
      prazo_pagamento: "30 dias",
      prazo_entrega:   "7 dias",
      garantia:        "90 dias",
      validade:        "30 dias",
    },
    responsavel: responsavel || {
      nome:     "Responsável Teste",
      cargo:    "Gerente",
      email:    "resp@teste.com",
      telefone: "(31) 99999-9999",
    },
    responsible_user_id: null,
    responsible_name:    "Responsável Teste",
    responsible_role:    "Gerente",
    responsible_phone:   "(31) 99999-9999",
    items: items || [
      { descricao: "Peca Alpha", quantidade: 2, valor_unitario: 100, ncm: null },
      { descricao: "Peca Beta",  quantidade: 1, valor_unitario: 50,  ncm: null },
    ],
  };
}

// Configura spies padrão para o fluxo de criação de proposta.
// Retorna os spies para que os testes possam inspecionar chamadas.
function setupCreateSpies({ proposalId = 42, client = fakeClient() } = {}) {
  return {
    findClientById:          vi.spyOn(clientRepo,   "findClientById").mockResolvedValue(client),
    findClientByCnpj:        vi.spyOn(clientRepo,   "findClientByCnpj").mockResolvedValue(null),
    findClientsByExactName:  vi.spyOn(clientRepo,   "findClientsByExactName").mockResolvedValue([]),
    createClient:            vi.spyOn(clientRepo,   "createClient").mockResolvedValue(99),
    createProposalAtomic:    vi.spyOn(proposalRepo, "createProposalAtomic").mockResolvedValue(proposalId),
    updatePriceHistoryPartId:vi.spyOn(proposalRepo, "updatePriceHistoryPartId").mockResolvedValue(undefined),
    updateProposalPdfPath:   vi.spyOn(proposalRepo, "updateProposalPdfPath").mockResolvedValue(undefined),
    findPartByComposition:   vi.spyOn(partRepo,     "findPartByComposition").mockResolvedValue(null),
    createPart:              vi.spyOn(partRepo,     "createPart").mockResolvedValue(10),
    generateProposalPdf:     vi.spyOn(pdfService,   "generateProposalPdf").mockResolvedValue(undefined),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── calculateTotal ────────────────────────────────────────────────────────────

describe("calculateTotal", () => {
  it("retorna 0 para lista vazia", () => {
    expect(calculateTotal([])).toBe(0);
  });

  it("soma quantidade * valor_unitario de um único item", () => {
    expect(calculateTotal([{ quantidade: 2, valor_unitario: 50 }])).toBe(100);
  });

  it("soma múltiplos itens corretamente", () => {
    expect(calculateTotal([
      { quantidade: 2, valor_unitario: 100 },
      { quantidade: 3, valor_unitario: 10  },
    ])).toBe(230);
  });

  it("lida com valores decimais", () => {
    expect(calculateTotal([{ quantidade: 1, valor_unitario: 67.5 }])).toBeCloseTo(67.5);
  });

  it("coerce strings numéricas corretamente", () => {
    expect(calculateTotal([{ quantidade: "3", valor_unitario: "20" }])).toBe(60);
  });
});

// ── canMarkExecution ──────────────────────────────────────────────────────────

describe("canMarkExecution", () => {
  it("retorna true para admin",      () => expect(canMarkExecution("admin")).toBe(true));
  it("retorna true para tecnico",    () => expect(canMarkExecution("tecnico")).toBe(true));
  it("retorna false para user",      () => expect(canMarkExecution("user")).toBe(false));
  it("retorna false para comercial", () => expect(canMarkExecution("comercial")).toBe(false));
  it("retorna false para financeiro",() => expect(canMarkExecution("financeiro")).toBe(false));
});

// ── createProposalFlow ────────────────────────────────────────────────────────

describe("createProposalFlow", () => {
  it("retorna proposalId ao criar proposta válida", async () => {
    setupCreateSpies({ proposalId: 42 });
    const result = await createProposalFlow(proposalPayload({ clienteId: 1 }));
    expect(result.proposalId).toBe(42);
  });

  it("valor_total_extenso é gerado pelo backend — payload do frontend é ignorado", async () => {
    const spies = setupCreateSpies();
    let capturedProposalData;
    spies.createProposalAtomic.mockImplementation(async (pd) => { capturedProposalData = pd; return 42; });

    const data = proposalPayload({ clienteId: 1 });
    data.valor_total_extenso = "DEVE SER IGNORADO";
    await createProposalFlow(data);

    expect(capturedProposalData.valor_total_extenso).not.toBe("DEVE SER IGNORADO");
    expect(capturedProposalData.valor_total_extenso).toBeTruthy();
  });

  it("valor_total calculado corretamente (2*100 + 1*50 = 250)", async () => {
    const spies = setupCreateSpies();
    let capturedProposalData;
    spies.createProposalAtomic.mockImplementation(async (pd) => { capturedProposalData = pd; return 42; });

    await createProposalFlow(proposalPayload({ clienteId: 1 }));
    expect(capturedProposalData.valor_total).toBeCloseTo(250);
  });

  it("data_emissao é gerada pelo servidor (não vem do payload do frontend)", async () => {
    const spies = setupCreateSpies();
    let capturedProposalData;
    spies.createProposalAtomic.mockImplementation(async (pd) => { capturedProposalData = pd; return 42; });

    const data = proposalPayload({ clienteId: 1 });
    data.data_emissao = "DATA DO FRONTEND — deve ser ignorada";
    await createProposalFlow(data);

    expect(capturedProposalData.data_emissao).not.toBe("DATA DO FRONTEND — deve ser ignorada");
    expect(capturedProposalData.data_emissao).toBeTruthy();
  });

  it("snapshot da assinatura: responsavel_nome/cargo/telefone gravados na proposta", async () => {
    const spies = setupCreateSpies();
    let capturedProposalData;
    spies.createProposalAtomic.mockImplementation(async (pd) => { capturedProposalData = pd; return 42; });

    const data = proposalPayload({
      clienteId: 1,
      responsavel: { nome: "Maria Souza", cargo: "Diretora", email: "m@co.com", telefone: "31911" },
    });
    await createProposalFlow(data);

    expect(capturedProposalData.responsavel_nome).toBe("Maria Souza");
    expect(capturedProposalData.responsavel_cargo).toBe("Diretora");
    expect(capturedProposalData.responsavel_telefone).toBe("31911");
  });

  it("rejeita numero_proposta duplicado com código CONFLICT (Prisma P2002)", async () => {
    const spies = setupCreateSpies();
    const p2002 = new Error("Unique constraint failed");
    p2002.code = "P2002";
    spies.createProposalAtomic.mockRejectedValue(p2002);

    await expect(
      createProposalFlow(proposalPayload({ clienteId: 1, numeroProposta: "DUP-001" }))
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("auto-registro de peça: chama findPartByComposition e createPart quando sem part_id", async () => {
    const spies = setupCreateSpies();
    spies.findPartByComposition.mockResolvedValue(null);
    spies.createPart.mockResolvedValue(77);

    await createProposalFlow(proposalPayload({ clienteId: 1 }));

    expect(spies.findPartByComposition).toHaveBeenCalled();
    expect(spies.createPart).toHaveBeenCalled();
    expect(spies.updatePriceHistoryPartId).toHaveBeenCalledWith(42, expect.any(String), 77);
  });

  it("auto-registro de peça: reutiliza peça existente quando encontrada por composição", async () => {
    const spies = setupCreateSpies();
    spies.findPartByComposition.mockResolvedValue({ id: 55 });

    await createProposalFlow(proposalPayload({ clienteId: 1 }));

    expect(spies.createPart).not.toHaveBeenCalled();
    expect(spies.updatePriceHistoryPartId).toHaveBeenCalledWith(42, expect.any(String), 55);
  });

  it("usa part_id fornecido no item sem chamar createPart", async () => {
    const spies = setupCreateSpies();
    const data = proposalPayload({ clienteId: 1 });
    data.items = [{ descricao: "Peça X", quantidade: 1, valor_unitario: 100, part_id: 33 }];

    await createProposalFlow(data);

    expect(spies.findPartByComposition).not.toHaveBeenCalled();
    expect(spies.createPart).not.toHaveBeenCalled();
    expect(spies.updatePriceHistoryPartId).toHaveBeenCalledWith(42, "Peça X", 33);
  });

  it("cria cliente novo via dados inline quando cliente_id não é fornecido", async () => {
    const spies = setupCreateSpies();
    spies.createClient.mockResolvedValue(88);
    spies.findClientById.mockResolvedValue(fakeClient({ id: 88, nome: "Cliente Inline Novo" }));

    const data = proposalPayload({ numeroProposta: "INLINE-001" });
    delete data.cliente_id;
    data.cliente = { nome: "Cliente Inline Novo" };

    const result = await createProposalFlow(data);

    expect(spies.createClient).toHaveBeenCalled();
    expect(result.clienteIsNew).toBe(true);
    expect(result.clienteId).toBe(88);
  });

  it("reutiliza cliente existente quando nome inline bate com cadastro", async () => {
    const existingClient = fakeClient({ id: 5, nome: "Empresa ABC" });
    const spies = setupCreateSpies({ client: existingClient });
    spies.findClientsByExactName.mockResolvedValue([existingClient]);

    const data = proposalPayload({ numeroProposta: "REUSE-001" });
    delete data.cliente_id;
    data.cliente = { nome: "Empresa ABC" };

    const result = await createProposalFlow(data);

    expect(spies.createClient).not.toHaveBeenCalled();
    expect(result.clienteIsNew).toBe(false);
    expect(result.clienteId).toBe(5);
  });

  it("PDF é gerado — generateProposalPdf é chamado", async () => {
    const spies = setupCreateSpies();
    await createProposalFlow(proposalPayload({ clienteId: 1, numeroProposta: "MOCK-001" }));
    expect(spies.generateProposalPdf).toHaveBeenCalledOnce();
  });

  it("createProposalAtomic recebe dataProposta como Date object (não string)", async () => {
    const spies = setupCreateSpies();
    let capturedOpts;
    spies.createProposalAtomic.mockImplementation(async (_pd, _items, opts) => {
      capturedOpts = opts;
      return 42;
    });

    await createProposalFlow(proposalPayload({ clienteId: 1 }));
    expect(capturedOpts.dataProposta).toBeInstanceOf(Date);
  });
});

// ── markProposalExecuted ──────────────────────────────────────────────────────

describe("markProposalExecuted", () => {
  it("admin marca proposta como executada — chama setProposalExecution", async () => {
    vi.spyOn(proposalRepo, "findProposalRowById").mockResolvedValue({
      id: 1, kanban_status: "pendente_execucao", execution_completed: 0,
    });
    const setExec = vi.spyOn(proposalRepo, "setProposalExecution").mockResolvedValue(undefined);
    vi.spyOn(kanbanRepo, "addComment").mockReturnValue(undefined);

    await markProposalExecuted(1, {}, "admin", 10, "Admin");
    expect(setExec).toHaveBeenCalledWith(1, expect.objectContaining({
      execution_marked_by_user_id: 10,
    }));
  });

  it("tecnico marca proposta como executada", async () => {
    vi.spyOn(proposalRepo, "findProposalRowById").mockResolvedValue({
      id: 1, kanban_status: "pendente_execucao", execution_completed: 0,
    });
    const setExec = vi.spyOn(proposalRepo, "setProposalExecution").mockResolvedValue(undefined);
    vi.spyOn(kanbanRepo, "addComment").mockReturnValue(undefined);

    await markProposalExecuted(1, {}, "tecnico", 10, "Tec");
    expect(setExec).toHaveBeenCalled();
  });

  it("user não pode marcar execução — FORBIDDEN", async () => {
    await expect(markProposalExecuted(1, {}, "user", null, "U"))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("comercial não pode marcar execução — FORBIDDEN", async () => {
    await expect(markProposalExecuted(1, {}, "comercial", null, "C"))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("financeiro não pode marcar execução — FORBIDDEN", async () => {
    await expect(markProposalExecuted(1, {}, "financeiro", null, "F"))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("salva dados de execução fornecidos (data, responsável, OS)", async () => {
    vi.spyOn(proposalRepo, "findProposalRowById").mockResolvedValue({ id: 1, kanban_status: "pendente_execucao" });
    const setExec = vi.spyOn(proposalRepo, "setProposalExecution").mockResolvedValue(undefined);
    vi.spyOn(kanbanRepo, "addComment").mockReturnValue(undefined);

    await markProposalExecuted(
      1,
      { execution_date: "2026-05-20", executed_by: "João", execution_os: "OS-999" },
      "admin", 10, "Admin"
    );
    expect(setExec).toHaveBeenCalledWith(1, expect.objectContaining({
      execution_date: "2026-05-20",
      executed_by:    "João",
      execution_os:   "OS-999",
    }));
  });

  it("throws NOT_FOUND para proposta inexistente", async () => {
    vi.spyOn(proposalRepo, "findProposalRowById").mockResolvedValue(null);
    await expect(markProposalExecuted(9999, {}, "admin", null, "Admin"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ── removeProposalExecution ───────────────────────────────────────────────────

describe("removeProposalExecution", () => {
  it("user não pode remover execução — FORBIDDEN", async () => {
    await expect(removeProposalExecution(1, "user", null, "U"))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("ao remover execução de proposta em 'faturar', status volta para pendente_execucao", async () => {
    vi.spyOn(proposalRepo, "findProposalRowById").mockResolvedValue({
      id: 1, kanban_status: "faturar", execution_completed: 1,
    });
    vi.spyOn(proposalRepo, "clearProposalExecution").mockResolvedValue(undefined);
    const setStatus = vi.spyOn(proposalRepo, "setProposalKanbanStatus").mockResolvedValue(undefined);
    vi.spyOn(kanbanRepo, "addComment").mockReturnValue(undefined);

    const result = await removeProposalExecution(1, "admin", 10, "Admin");

    expect(result.autoMoved).toBe(true);
    expect(result.newStatus).toBe("pendente_execucao");
    expect(setStatus).toHaveBeenCalledWith(1, "pendente_execucao");
  });

  it("ao remover execução de proposta em 'faturado', status volta para pendente_execucao", async () => {
    vi.spyOn(proposalRepo, "findProposalRowById").mockResolvedValue({
      id: 1, kanban_status: "faturado", execution_completed: 1,
    });
    vi.spyOn(proposalRepo, "clearProposalExecution").mockResolvedValue(undefined);
    vi.spyOn(proposalRepo, "setProposalKanbanStatus").mockResolvedValue(undefined);
    vi.spyOn(kanbanRepo, "addComment").mockReturnValue(undefined);

    const result = await removeProposalExecution(1, "admin", 10, "Admin");
    expect(result.autoMoved).toBe(true);
    expect(result.newStatus).toBe("pendente_execucao");
  });

  it("ao remover execução de proposta em 'pendente_execucao', status não muda (autoMoved = false)", async () => {
    vi.spyOn(proposalRepo, "findProposalRowById").mockResolvedValue({
      id: 1, kanban_status: "pendente_execucao", execution_completed: 1,
    });
    vi.spyOn(proposalRepo, "clearProposalExecution").mockResolvedValue(undefined);
    const setStatus = vi.spyOn(proposalRepo, "setProposalKanbanStatus").mockResolvedValue(undefined);
    vi.spyOn(kanbanRepo, "addComment").mockReturnValue(undefined);

    const result = await removeProposalExecution(1, "admin", 10, "Admin");

    expect(result.autoMoved).toBe(false);
    expect(result.newStatus).toBe("pendente_execucao");
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("limpa execução — chama clearProposalExecution", async () => {
    vi.spyOn(proposalRepo, "findProposalRowById").mockResolvedValue({
      id: 1, kanban_status: "pendente_execucao", execution_completed: 1,
    });
    const clearExec = vi.spyOn(proposalRepo, "clearProposalExecution").mockResolvedValue(undefined);
    vi.spyOn(kanbanRepo, "addComment").mockReturnValue(undefined);

    await removeProposalExecution(1, "admin", 10, "Admin");
    expect(clearExec).toHaveBeenCalledWith(1);
  });
});

// ── registerBilling ───────────────────────────────────────────────────────────

describe("registerBilling", () => {
  it("rejeita invoice_number vazio — VALIDATION", async () => {
    await expect(registerBilling(1, { invoice_number: "" }, null, "Admin"))
      .rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejeita invoice_number ausente — VALIDATION", async () => {
    await expect(registerBilling(1, {}, null, "Admin"))
      .rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("grava invoice_number e outros dados — chama setProposalBilling", async () => {
    vi.spyOn(proposalRepo, "findProposalRowById").mockResolvedValue({
      id: 1, kanban_status: "faturar", execution_completed: 1,
    });
    const setBilling = vi.spyOn(proposalRepo, "setProposalBilling").mockResolvedValue(undefined);
    vi.spyOn(kanbanRepo, "addComment").mockReturnValue(undefined);

    await registerBilling(
      1,
      { invoice_number: "NF-9999", billing_date: "2026-05-20", billing_notes: "Pago via PIX" },
      10, "Admin"
    );
    expect(setBilling).toHaveBeenCalledWith(1, expect.objectContaining({
      invoice_number: "NF-9999",
      billing_date:   "2026-05-20",
      billing_notes:  "Pago via PIX",
    }));
  });

  it("throws NOT_FOUND para proposta inexistente", async () => {
    vi.spyOn(proposalRepo, "findProposalRowById").mockResolvedValue(null);
    await expect(registerBilling(9999, { invoice_number: "NF-0001" }, null, "Admin"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

const repo        = require("../../src/modules/kanban/kanban.repository");
const proposalRepo = require("../../src/modules/proposal/proposal.repository");
const kanbanSvc   = require("../../src/modules/kanban/kanban.service");

const {
  getAllCards,
  createTask,
  updateTask,
  moveTask,
  deleteTask,
  linkTaskToProposal,
  getComments,
  addComment,
} = kanbanSvc;

function fakeTask(overrides = {}) {
  return {
    id:                       1,
    title:                    "Tarefa Teste",
    description:              null,
    kanban_status:            "pendente_envio",
    kanban_status_updated_at: new Date(),
    created_by:               null,
    created_at:               new Date(),
    updated_at:               new Date(),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── getAllCards ────────────────────────────────────────────────────────────────

describe("getAllCards", () => {
  it("delegates to repo.listCards", async () => {
    const fake = [{ card_type: "task", id: 1, title: "T1" }];
    vi.spyOn(repo, "listCards").mockResolvedValue(fake);

    await expect(getAllCards()).resolves.toEqual(fake);
  });
});

// ── createTask ────────────────────────────────────────────────────────────────

describe("createTask", () => {
  it("throws VALIDATION when title is empty", async () => {
    await expect(createTask({ title: "" }, 1)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createTask({ title: "   " }, 1)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createTask({}, 1)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("creates task and returns mapped result", async () => {
    const fake = fakeTask({ id: 7, title: "Nova Tarefa" });
    const spy  = vi.spyOn(repo, "createTask").mockResolvedValue(fake);

    const result = await createTask({ title: "  Nova Tarefa  ", description: "Desc" }, 3);

    expect(result).toEqual(fake);
    expect(spy).toHaveBeenCalledWith({ title: "Nova Tarefa", description: "Desc", created_by: 3 });
  });
});

// ── updateTask ────────────────────────────────────────────────────────────────

describe("updateTask", () => {
  it("throws NOT_FOUND when task does not exist", async () => {
    vi.spyOn(repo, "findTaskById").mockResolvedValue(null);

    await expect(updateTask(99, { title: "X" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws VALIDATION when title is empty", async () => {
    vi.spyOn(repo, "findTaskById").mockResolvedValue(fakeTask());

    await expect(updateTask(1, { title: "" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("updates and returns mapped task", async () => {
    const updated = fakeTask({ title: "Atualizada" });
    vi.spyOn(repo, "findTaskById").mockResolvedValue(fakeTask());
    const spy = vi.spyOn(repo, "updateTask").mockResolvedValue(updated);

    const result = await updateTask(1, { title: "  Atualizada  ", description: "Nova desc" });

    expect(result).toEqual(updated);
    expect(spy).toHaveBeenCalledWith(1, { title: "Atualizada", description: "Nova desc" });
  });
});

// ── moveTask ──────────────────────────────────────────────────────────────────

describe("moveTask", () => {
  it("throws NOT_FOUND when task does not exist", async () => {
    vi.spyOn(repo, "findTaskById").mockResolvedValue(null);

    await expect(moveTask(99, "enviado", "admin")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws INVALID_STATUS for unknown status", async () => {
    vi.spyOn(repo, "findTaskById").mockResolvedValue(fakeTask());

    await expect(moveTask(1, "status_invalido", "admin")).rejects.toMatchObject({ code: "INVALID_STATUS" });
  });

  it("throws FORBIDDEN when moving task to enviado", async () => {
    vi.spyOn(repo, "findTaskById").mockResolvedValue(fakeTask({ kanban_status: "pendente_envio" }));

    await expect(moveTask(1, "enviado", "admin")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws FORBIDDEN when role has no permission for the move", async () => {
    vi.spyOn(repo, "findTaskById").mockResolvedValue(fakeTask({ kanban_status: "pendente_envio" }));

    await expect(moveTask(1, "aguardando_compra", "user")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("moves task and calls setTaskKanbanStatus when allowed", async () => {
    vi.spyOn(repo, "findTaskById").mockResolvedValue(fakeTask({ kanban_status: "pendente_envio" }));
    const spy = vi.spyOn(repo, "setTaskKanbanStatus").mockResolvedValue(undefined);

    await expect(moveTask(1, "aguardando_compra", "admin")).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith(1, "aguardando_compra");
  });

  it("allows comercial to move within range", async () => {
    vi.spyOn(repo, "findTaskById").mockResolvedValue(fakeTask({ kanban_status: "aguardando_compra" }));
    const spy = vi.spyOn(repo, "setTaskKanbanStatus").mockResolvedValue(undefined);

    await expect(moveTask(1, "comprado", "comercial")).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith(1, "comprado");
  });

  it("allows tecnico to move from aguardando_compra", async () => {
    vi.spyOn(repo, "findTaskById").mockResolvedValue(fakeTask({ kanban_status: "aguardando_compra" }));
    const spy = vi.spyOn(repo, "setTaskKanbanStatus").mockResolvedValue(undefined);

    await expect(moveTask(1, "comprado", "tecnico")).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith(1, "comprado");
  });

  it("financeiro can only move faturar <-> faturado", async () => {
    vi.spyOn(repo, "findTaskById").mockResolvedValue(fakeTask({ kanban_status: "faturar" }));
    const spy = vi.spyOn(repo, "setTaskKanbanStatus").mockResolvedValue(undefined);

    await expect(moveTask(1, "faturado", "financeiro")).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith(1, "faturado");
  });
});

// ── deleteTask ────────────────────────────────────────────────────────────────

describe("deleteTask", () => {
  it("throws FORBIDDEN for non-admin role", async () => {
    await expect(deleteTask(1, "comercial")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(deleteTask(1, "user")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(deleteTask(1, "tecnico")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws NOT_FOUND when task does not exist", async () => {
    vi.spyOn(repo, "findTaskById").mockResolvedValue(null);

    await expect(deleteTask(99, "admin")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("deletes comments then task for admin", async () => {
    vi.spyOn(repo, "findTaskById").mockResolvedValue(fakeTask({ id: 5 }));
    const delComments = vi.spyOn(repo, "deleteCommentsByCard").mockResolvedValue(undefined);
    const delTask     = vi.spyOn(repo, "deleteTask").mockResolvedValue(undefined);

    await expect(deleteTask(5, "admin")).resolves.toBeUndefined();
    expect(delComments).toHaveBeenCalledWith("task", 5);
    expect(delTask).toHaveBeenCalledWith(5);
  });
});

// ── linkTaskToProposal ────────────────────────────────────────────────────────

describe("linkTaskToProposal", () => {
  it("throws NOT_FOUND when task does not exist", async () => {
    vi.spyOn(repo, "findTaskById").mockResolvedValue(null);

    await expect(linkTaskToProposal(99, 1, { id: 1, nome: "Admin" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws NOT_FOUND when proposal does not exist", async () => {
    vi.spyOn(repo, "findTaskById").mockResolvedValue(fakeTask());
    vi.spyOn(proposalRepo, "findProposalRowById").mockResolvedValue(null);

    await expect(linkTaskToProposal(1, 99, { id: 1, nome: "Admin" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("adds comment, deletes task comments, deletes task on success", async () => {
    vi.spyOn(repo, "findTaskById").mockResolvedValue(fakeTask({ title: "Tarefa X", description: "Desc X" }));
    vi.spyOn(proposalRepo, "findProposalRowById").mockResolvedValue({ id: 10, numero_proposta: "P-001" });
    const addSpy    = vi.spyOn(repo, "addComment").mockResolvedValue({ id: 50 });
    const delComSpy = vi.spyOn(repo, "deleteCommentsByCard").mockResolvedValue(undefined);
    const delSpy    = vi.spyOn(repo, "deleteTask").mockResolvedValue(undefined);

    await expect(linkTaskToProposal(1, 10, { id: 2, nome: "Carlos" })).resolves.toBeUndefined();

    expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({
      card_type: "proposal",
      card_id:   10,
      user_id:   2,
      user_nome: "Carlos",
    }));
    expect(delComSpy).toHaveBeenCalledWith("task", 1);
    expect(delSpy).toHaveBeenCalledWith(1);
  });
});

// ── getComments ───────────────────────────────────────────────────────────────

describe("getComments", () => {
  it("delegates to repo.getComments", async () => {
    const fake = [{ id: 1, card_type: "task", card_id: 5, comment: "Olá" }];
    const spy  = vi.spyOn(repo, "getComments").mockResolvedValue(fake);

    await expect(getComments("task", 5)).resolves.toEqual(fake);
    expect(spy).toHaveBeenCalledWith("task", 5);
  });
});

// ── addComment ────────────────────────────────────────────────────────────────

describe("addComment", () => {
  it("throws VALIDATION when comment is empty", async () => {
    await expect(addComment({ cardType: "task", cardId: 1, userId: 1, userNome: "A", comment: "" }))
      .rejects.toMatchObject({ code: "VALIDATION" });
    await expect(addComment({ cardType: "task", cardId: 1, userId: 1, userNome: "A", comment: "   " }))
      .rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("adds comment and returns id", async () => {
    const spy = vi.spyOn(repo, "addComment").mockResolvedValue({ id: 42 });

    const result = await addComment({
      cardType: "proposal", cardId: 10, userId: 3, userNome: "Admin", comment: "  Comentário  ",
    });

    expect(result).toEqual({ id: 42 });
    expect(spy).toHaveBeenCalledWith({
      card_type: "proposal",
      card_id:   10,
      user_id:   3,
      user_nome: "Admin",
      comment:   "Comentário",
    });
  });

  it("stores user_nome as snapshot (not looked up)", async () => {
    vi.spyOn(repo, "addComment").mockResolvedValue({ id: 99 });

    const result = await addComment({
      cardType: "task", cardId: 5, userId: 7, userNome: "Snapshot Nome", comment: "ok",
    });

    expect(result).toEqual({ id: 99 });
  });
});

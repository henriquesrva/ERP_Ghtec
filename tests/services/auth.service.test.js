const repo = require("../../src/modules/auth/auth.repository");
const {
  loginUser,
  createNewUser,
  getAllUsers,
  changePassword,
  changeUserRole,
  deleteUser,
  updateSignature,
  ALLOWED_ROLES,
} = require("../../src/modules/auth/auth.service");

const FAKE_USER = {
  id:                 1,
  nome:               "Administrador",
  username:           "admin",
  password_hash:      "$2a$10$hashedpassword",
  role:               "admin",
  signature_cargo:    "Gerente",
  signature_telefone: "(31) 99999-0000",
  created_at:         new Date("2026-01-01"),
};

afterEach(() => vi.restoreAllMocks());

// ── ALLOWED_ROLES ──────────────────────────────────────────────────────────────

describe("ALLOWED_ROLES", () => {
  it("contém exatamente as 5 roles válidas", () => {
    expect(ALLOWED_ROLES).toEqual(["admin", "user", "comercial", "tecnico", "financeiro"]);
  });
});

// ── loginUser ──────────────────────────────────────────────────────────────────

describe("loginUser", () => {
  it("lança 400 se username ou password estiverem ausentes", async () => {
    await expect(loginUser("", "senha")).rejects.toMatchObject({ status: 400 });
    await expect(loginUser("user", "")).rejects.toMatchObject({ status: 400 });
  });

  it("lança 401 se usuário não encontrado", async () => {
    vi.spyOn(repo, "findUserByUsername").mockResolvedValue(null);
    await expect(loginUser("nao_existe", "senha123")).rejects.toMatchObject({ status: 401 });
  });

  it("lança 401 se senha incorreta", async () => {
    vi.spyOn(repo, "findUserByUsername").mockResolvedValue({ ...FAKE_USER, password_hash: "$2a$10$invalido" });
    await expect(loginUser("admin", "senha_errada")).rejects.toMatchObject({ status: 401 });
  });

  it("retorna id, nome, username, role sem expor password_hash", async () => {
    const bcrypt = require("bcryptjs");
    const hash = await bcrypt.hash("senha123", 1);
    vi.spyOn(repo, "findUserByUsername").mockResolvedValue({ ...FAKE_USER, password_hash: hash });
    const result = await loginUser("admin", "senha123");
    expect(result).toEqual({ id: 1, nome: "Administrador", username: "admin", role: "admin" });
    expect(result.password_hash).toBeUndefined();
  });
});

// ── createNewUser ─────────────────────────────────────────────────────────────

describe("createNewUser", () => {
  it("lança 400 se nome estiver vazio", async () => {
    await expect(
      createNewUser({ nome: "", username: "usuario1", password: "senha123", role: "user" })
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("Nome") });
  });

  it("lança 400 se username estiver vazio", async () => {
    await expect(
      createNewUser({ nome: "Fulano", username: "", password: "senha123", role: "user" })
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("Usuário") });
  });

  it("lança 400 se senha tiver menos de 6 caracteres", async () => {
    await expect(
      createNewUser({ nome: "Fulano", username: "fulano", password: "abc", role: "user" })
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("6 caracteres") });
  });

  it("lança 409 se username já existe", async () => {
    vi.spyOn(repo, "findUserByUsername").mockResolvedValue(FAKE_USER);
    await expect(
      createNewUser({ nome: "Outro", username: "admin", password: "senha123", role: "user" })
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("já está em uso") });
  });

  it("usa role 'user' quando role não está em ALLOWED_ROLES", async () => {
    vi.spyOn(repo, "findUserByUsername").mockResolvedValue(null);
    vi.spyOn(repo, "createUser").mockResolvedValue(2);
    const result = await createNewUser({ nome: "Super", username: "super", password: "senha123", role: "superadmin" });
    expect(result.role).toBe("user");
  });

  it("cria usuário com sucesso e retorna id, nome, username, role", async () => {
    vi.spyOn(repo, "findUserByUsername").mockResolvedValue(null);
    vi.spyOn(repo, "createUser").mockResolvedValue(5);
    const result = await createNewUser({ nome: "Novo", username: "novo", password: "senha123", role: "comercial" });
    expect(result).toMatchObject({ id: 5, nome: "Novo", username: "novo", role: "comercial" });
    expect(result.password_hash).toBeUndefined();
  });

  it("não chama createUser se validação falhar", async () => {
    vi.spyOn(repo, "createUser");
    await createNewUser({ nome: "", username: "x", password: "senha123" }).catch(() => {});
    expect(repo.createUser).not.toHaveBeenCalled();
  });

  it("faz hash da senha antes de persistir", async () => {
    vi.spyOn(repo, "findUserByUsername").mockResolvedValue(null);
    vi.spyOn(repo, "createUser").mockResolvedValue(1);
    await createNewUser({ nome: "N", username: "u", password: "senha123", role: "user" });
    const savedHash = repo.createUser.mock.calls[0][0].password_hash;
    expect(savedHash).not.toBe("senha123");
    expect(savedHash).toMatch(/^\$2[ab]\$10\$/);
  });
});

// ── getAllUsers ───────────────────────────────────────────────────────────────

describe("getAllUsers", () => {
  it("retorna lista do repository", async () => {
    vi.spyOn(repo, "listUsers").mockResolvedValue([FAKE_USER]);
    const result = await getAllUsers();
    expect(result).toHaveLength(1);
    expect(result[0].username).toBe("admin");
  });

  it("retorna lista vazia quando não há usuários", async () => {
    vi.spyOn(repo, "listUsers").mockResolvedValue([]);
    expect(await getAllUsers()).toEqual([]);
  });
});

// ── changePassword ────────────────────────────────────────────────────────────

describe("changePassword", () => {
  it("lança 400 se campos estiverem ausentes", async () => {
    await expect(changePassword(1, "", "nova123")).rejects.toMatchObject({ status: 400 });
    await expect(changePassword(1, "atual123", "")).rejects.toMatchObject({ status: 400 });
  });

  it("lança 400 se nova senha tiver menos de 6 caracteres", async () => {
    await expect(changePassword(1, "atual123", "abc")).rejects.toMatchObject({ status: 400 });
  });

  it("lança 404 se usuário não encontrado", async () => {
    vi.spyOn(repo, "findUserById").mockResolvedValue(null);
    await expect(changePassword(999, "atual123", "nova123")).rejects.toMatchObject({ status: 404 });
  });

  it("lança 401 se senha atual incorreta", async () => {
    vi.spyOn(repo, "findUserById").mockResolvedValue(FAKE_USER);
    vi.spyOn(repo, "findUserByUsername").mockResolvedValue({ ...FAKE_USER, password_hash: "$2a$10$invalido" });
    await expect(changePassword(1, "errada", "nova123")).rejects.toMatchObject({ status: 401 });
  });

  it("atualiza senha com sucesso", async () => {
    const bcrypt = require("bcryptjs");
    const hash = await bcrypt.hash("atual123", 1);
    vi.spyOn(repo, "findUserById").mockResolvedValue(FAKE_USER);
    vi.spyOn(repo, "findUserByUsername").mockResolvedValue({ ...FAKE_USER, password_hash: hash });
    vi.spyOn(repo, "updateUserPassword").mockResolvedValue(undefined);
    await expect(changePassword(1, "atual123", "nova123")).resolves.toBeUndefined();
    expect(repo.updateUserPassword).toHaveBeenCalledWith(1, expect.stringMatching(/^\$2[ab]\$/));
  });
});

// ── changeUserRole ────────────────────────────────────────────────────────────

describe("changeUserRole", () => {
  it("lança 400 para role inválida", async () => {
    await expect(changeUserRole(2, "superadmin", 1)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("Classe inválida"),
    });
  });

  it("lança 400 ao tentar rebaixar o último administrador", async () => {
    vi.spyOn(repo, "findUserById").mockResolvedValue({ ...FAKE_USER, role: "admin" });
    vi.spyOn(repo, "countAdmins").mockResolvedValue(1);
    await expect(changeUserRole(1, "user", 2)).rejects.toMatchObject({
      message: expect.stringContaining("último administrador"),
    });
  });

  it("não chama updateUserRole se role inválida", async () => {
    vi.spyOn(repo, "updateUserRole");
    await changeUserRole(1, "invalida", 2).catch(() => {});
    expect(repo.updateUserRole).not.toHaveBeenCalled();
  });

  it("promove user para comercial com sucesso", async () => {
    vi.spyOn(repo, "findUserById").mockResolvedValue({ ...FAKE_USER, role: "user" });
    vi.spyOn(repo, "countAdmins").mockResolvedValue(2);
    vi.spyOn(repo, "updateUserRole").mockResolvedValue(undefined);
    await expect(changeUserRole(2, "comercial", 1)).resolves.toBeUndefined();
    expect(repo.updateUserRole).toHaveBeenCalledWith(2, "comercial");
  });

  it("permite rebaixar admin quando há mais de um admin", async () => {
    vi.spyOn(repo, "findUserById").mockResolvedValue({ ...FAKE_USER, role: "admin" });
    vi.spyOn(repo, "countAdmins").mockResolvedValue(2);
    vi.spyOn(repo, "updateUserRole").mockResolvedValue(undefined);
    await expect(changeUserRole(2, "user", 1)).resolves.toBeUndefined();
  });
});

// ── deleteUser ────────────────────────────────────────────────────────────────

describe("deleteUser", () => {
  it("lança 400 ao tentar excluir o próprio usuário", async () => {
    await expect(deleteUser(1, 1)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("próprio usuário"),
    });
  });

  it("lança 400 ao tentar excluir o último administrador", async () => {
    vi.spyOn(repo, "findUserById").mockResolvedValue({ ...FAKE_USER, role: "admin" });
    vi.spyOn(repo, "countAdmins").mockResolvedValue(1);
    await expect(deleteUser(1, 2)).rejects.toMatchObject({
      message: expect.stringContaining("último administrador"),
    });
  });

  it("lança 400 ao tentar excluir o único usuário", async () => {
    vi.spyOn(repo, "findUserById").mockResolvedValue({ ...FAKE_USER, role: "user" });
    vi.spyOn(repo, "countAdmins").mockResolvedValue(0);
    vi.spyOn(repo, "countUsers").mockResolvedValue(1);
    await expect(deleteUser(1, 2)).rejects.toMatchObject({
      message: expect.stringContaining("único usuário"),
    });
  });

  it("exclui usuário com sucesso", async () => {
    vi.spyOn(repo, "findUserById").mockResolvedValue({ ...FAKE_USER, role: "user" });
    vi.spyOn(repo, "countAdmins").mockResolvedValue(1);
    vi.spyOn(repo, "countUsers").mockResolvedValue(3);
    vi.spyOn(repo, "deleteUserById").mockResolvedValue(undefined);
    await expect(deleteUser(2, 1)).resolves.toBeUndefined();
    expect(repo.deleteUserById).toHaveBeenCalledWith(2);
  });

  it("não chama deleteUserById se é o próprio usuário", async () => {
    vi.spyOn(repo, "deleteUserById");
    await deleteUser(1, 1).catch(() => {});
    expect(repo.deleteUserById).not.toHaveBeenCalled();
  });

  it("sucesso ao excluir admin quando há dois admins", async () => {
    vi.spyOn(repo, "findUserById").mockResolvedValue({ ...FAKE_USER, role: "admin" });
    vi.spyOn(repo, "countAdmins").mockResolvedValue(2);
    vi.spyOn(repo, "countUsers").mockResolvedValue(3);
    vi.spyOn(repo, "deleteUserById").mockResolvedValue(undefined);
    await expect(deleteUser(2, 1)).resolves.toBeUndefined();
  });
});

// ── updateSignature ───────────────────────────────────────────────────────────

describe("updateSignature", () => {
  it("lança 404 se usuário não encontrado", async () => {
    vi.spyOn(repo, "findUserById").mockResolvedValue(null);
    await expect(updateSignature(999, { cargo: "Técnico", telefone: "999" })).rejects.toMatchObject({ status: 404 });
  });

  it("atualiza assinatura com sucesso", async () => {
    vi.spyOn(repo, "findUserById").mockResolvedValue(FAKE_USER);
    vi.spyOn(repo, "updateUserSignature").mockResolvedValue(undefined);
    await expect(updateSignature(1, { cargo: "Técnico", telefone: "(31) 9999-0000" })).resolves.toBeUndefined();
    expect(repo.updateUserSignature).toHaveBeenCalledWith(1, { cargo: "Técnico", telefone: "(31) 9999-0000" });
  });

  it("converte string vazia de cargo para null", async () => {
    vi.spyOn(repo, "findUserById").mockResolvedValue(FAKE_USER);
    vi.spyOn(repo, "updateUserSignature").mockResolvedValue(undefined);
    await updateSignature(1, { cargo: "  ", telefone: "999" });
    expect(repo.updateUserSignature).toHaveBeenCalledWith(1, { cargo: null, telefone: "999" });
  });
});

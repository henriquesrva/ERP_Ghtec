const { clearAllTables } = require("../../tests/setup/testDb");
const { createTestAdmin, createTestUser } = require("../../tests/setup/fixtures");
const { createNewUser, deleteUser, changeUserRole, ALLOWED_ROLES } = require("../../src/modules/auth/auth.service");

beforeEach(clearAllTables);

// ─── createNewUser ────────────────────────────────────────────────────────────

describe("createNewUser", () => {
  it("rejeita quando nome está vazio", async () => {
    await expect(
      createNewUser({ nome: "", username: "usuario1", password: "senha123", role: "user" })
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("Nome") });
  });

  it("rejeita quando username está vazio", async () => {
    await expect(
      createNewUser({ nome: "Fulano", username: "", password: "senha123", role: "user" })
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("Usuário") });
  });

  it("rejeita senha com menos de 6 caracteres", async () => {
    await expect(
      createNewUser({ nome: "Fulano", username: "fulano", password: "abc", role: "user" })
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("6 caracteres") });
  });

  it("rejeita username duplicado (409)", async () => {
    createTestUser({ username: "repetido" });
    await expect(
      createNewUser({ nome: "Outro", username: "repetido", password: "senha123", role: "user" })
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("já está em uso") });
  });

  it("cria usuário com role 'user' quando role não está em ALLOWED_ROLES", async () => {
    const result = await createNewUser({
      nome: "Super",
      username: "superadmin",
      password: "senha123",
      role: "superadmin",
    });
    expect(result.role).toBe("user");
  });

  it("cria usuário com sucesso e retorna id, nome, username, role", async () => {
    const result = await createNewUser({
      nome: "Novo Usuário",
      username: "novo_usuario",
      password: "senha123",
      role: "comercial",
    });
    expect(result).toMatchObject({
      id: expect.any(Number),
      nome: "Novo Usuário",
      username: "novo_usuario",
      role: "comercial",
    });
  });
});

// ─── deleteUser ───────────────────────────────────────────────────────────────

describe("deleteUser", () => {
  it("lança erro ao tentar excluir o próprio usuário", () => {
    const admin = createTestAdmin();
    expect(() => deleteUser(admin.id, admin.id)).toThrow(
      expect.objectContaining({ message: expect.stringContaining("próprio usuário") })
    );
  });

  it("lança erro ao tentar excluir o último administrador", () => {
    const admin = createTestAdmin();
    const user = createTestUser({ username: "outro_usuario" });
    expect(() => deleteUser(admin.id, user.id)).toThrow(
      expect.objectContaining({ message: expect.stringContaining("último administrador") })
    );
  });

  it("lança erro quando é o único usuário do sistema (role=user)", () => {
    // Um único usuário não-admin: passa a checagem de "último admin" mas cai em "único usuário"
    const user = createTestUser({ username: "unico", role: "user" });
    expect(() => deleteUser(user.id, 9999)).toThrow(
      expect.objectContaining({ message: expect.stringContaining("único usuário") })
    );
  });

  it("sucesso ao excluir um admin quando há dois admins", () => {
    const admin1 = createTestAdmin({ username: "admin_principal" });
    const admin2 = createTestAdmin({ username: "admin_secundario" });
    expect(() => deleteUser(admin2.id, admin1.id)).not.toThrow();
  });
});

// ─── changeUserRole ───────────────────────────────────────────────────────────

describe("changeUserRole", () => {
  it("lança erro para role inválida", () => {
    const admin = createTestAdmin();
    const user = createTestUser({ username: "alvo" });
    expect(() => changeUserRole(user.id, "superadmin", admin.id)).toThrow(
      expect.objectContaining({ status: 400, message: expect.stringContaining("Classe inválida") })
    );
  });

  it("lança erro ao tentar rebaixar o último administrador", () => {
    const admin = createTestAdmin();
    const user = createTestUser({ username: "comum" });
    expect(() => changeUserRole(admin.id, "user", user.id)).toThrow(
      expect.objectContaining({ message: expect.stringContaining("último administrador") })
    );
  });

  it("sucesso ao promover um 'user' para 'comercial'", () => {
    const admin = createTestAdmin();
    const user = createTestUser({ username: "a_promover" });
    expect(() => changeUserRole(user.id, "comercial", admin.id)).not.toThrow();
  });
});

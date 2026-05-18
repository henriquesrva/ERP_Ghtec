const bcrypt = require("bcryptjs");
const repo = require("./auth.repository");

const ALLOWED_ROLES = ["admin", "user", "comercial", "tecnico", "financeiro"];

async function loginUser(username, password) {
  if (!username || !password) throw { status: 400, message: "Usuário e senha são obrigatórios." };
  const user = repo.findUserByUsername(username);
  if (!user) throw { status: 401, message: "Usuário ou senha incorretos." };
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw { status: 401, message: "Usuário ou senha incorretos." };
  return { id: user.id, nome: user.nome, username: user.username, role: user.role };
}

async function createNewUser(data) {
  const nome     = (data.nome     || "").trim();
  const username = (data.username || "").trim();
  const password = (data.password || "").trim();

  if (!nome)     throw { status: 400, message: "O campo Nome é obrigatório." };
  if (!username) throw { status: 400, message: "O campo Usuário é obrigatório." };
  if (password.length < 6) throw { status: 400, message: "A senha deve ter pelo menos 6 caracteres." };

  const existing = repo.findUserByUsername(username);
  if (existing) throw { status: 409, message: "Esse nome de usuário já está em uso." };

  const role = ALLOWED_ROLES.includes(data.role) ? data.role : "user";
  const password_hash = await bcrypt.hash(password, 10);
  const id = repo.createUser({ nome, username, password_hash, role });
  return { id, nome, username, role };
}

function getAllUsers() {
  return repo.listUsers();
}

async function changePassword(userId, currentPassword, newPassword) {
  if (!currentPassword || !newPassword) throw { status: 400, message: "Preencha todos os campos." };
  if (newPassword.length < 6) throw { status: 400, message: "A nova senha deve ter pelo menos 6 caracteres." };

  const user = repo.findUserById(userId);
  if (!user) throw { status: 404, message: "Usuário não encontrado." };

  const full = repo.findUserByUsername(user.username);
  const ok = await bcrypt.compare(currentPassword, full.password_hash);
  if (!ok) throw { status: 401, message: "Senha atual incorreta." };

  const newHash = await bcrypt.hash(newPassword, 10);
  repo.updateUserPassword(userId, newHash);
}

function changeUserRole(targetId, newRole, requestingUserId) {
  if (!ALLOWED_ROLES.includes(newRole)) throw { status: 400, message: "Classe inválida." };
  const target = repo.findUserById(targetId);
  if (!target) throw { status: 404, message: "Usuário não encontrado." };
  if (target.role === "admin" && newRole !== "admin" && repo.countAdmins() <= 1) {
    throw { status: 400, message: "Não é possível remover ou alterar o último administrador do sistema." };
  }
  repo.updateUserRole(targetId, newRole);
}

function deleteUser(id, requestingUserId) {
  if (id === requestingUserId) throw { status: 400, message: "Você não pode excluir o próprio usuário." };
  const target = repo.findUserById(id);
  if (target && target.role === "admin" && repo.countAdmins() <= 1) {
    throw { status: 400, message: "Não é possível remover ou alterar o último administrador do sistema." };
  }
  const total = repo.countUsers();
  if (total <= 1) throw { status: 400, message: "Não é possível excluir o único usuário do sistema." };
  repo.deleteUserById(id);
}

module.exports = { loginUser, createNewUser, getAllUsers, changePassword, changeUserRole, deleteUser, ALLOWED_ROLES };

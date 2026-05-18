const bcrypt = require("bcryptjs");
const repo = require("./auth.repository");

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

  const password_hash = await bcrypt.hash(password, 10);
  const id = repo.createUser({ nome, username, password_hash, role: data.role || "user" });
  return { id, nome, username, role: data.role || "user" };
}

function getAllUsers() {
  return repo.listUsers();
}

function deleteUser(id, requestingUserId) {
  if (id === requestingUserId) throw { status: 400, message: "Você não pode excluir o próprio usuário." };
  const total = repo.countUsers();
  if (total <= 1) throw { status: 400, message: "Não é possível excluir o único usuário do sistema." };
  repo.deleteUserById(id);
}

module.exports = { loginUser, createNewUser, getAllUsers, deleteUser };

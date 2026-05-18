const svc = require("./auth.service");
const repo = require("./auth.repository");

async function loginHandler(req, res) {
  try {
    const user = await svc.loginUser(req.body.username, req.body.password);
    req.session.userId   = user.id;
    req.session.userRole = user.role;
    res.json({ success: true, user });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || "Erro interno." });
  }
}

function logoutHandler(req, res) {
  req.session.destroy(() => {
    res.json({ success: true });
  });
}

function getMeHandler(req, res) {
  const user = repo.findUserById(req.session.userId);
  if (!user) return res.status(401).json({ success: false, message: "Não autenticado." });
  res.json({ success: true, user });
}

function listUsersHandler(req, res) {
  res.json(svc.getAllUsers());
}

async function createUserHandler(req, res) {
  if (req.session.userRole !== "admin") {
    return res.status(403).json({ success: false, message: "Apenas administradores podem criar usuários." });
  }
  try {
    const user = await svc.createNewUser(req.body);
    res.status(201).json({ success: true, user });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || "Erro interno." });
  }
}

async function changePasswordHandler(req, res) {
  try {
    await svc.changePassword(req.session.userId, req.body.currentPassword, req.body.newPassword);
    res.json({ success: true });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || "Erro interno." });
  }
}

function changeUserRoleHandler(req, res) {
  if (req.session.userRole !== "admin") {
    return res.status(403).json({ success: false, message: "Apenas administradores podem alterar classes." });
  }
  try {
    svc.changeUserRole(Number(req.params.id), req.body.role, req.session.userId);
    res.json({ success: true });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || "Erro interno." });
  }
}

function deleteUserHandler(req, res) {
  if (req.session.userRole !== "admin") {
    return res.status(403).json({ success: false, message: "Apenas administradores podem excluir usuários." });
  }
  try {
    svc.deleteUser(Number(req.params.id), req.session.userId);
    res.json({ success: true });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || "Erro interno." });
  }
}

module.exports = { loginHandler, logoutHandler, getMeHandler, listUsersHandler, createUserHandler, changePasswordHandler, changeUserRoleHandler, deleteUserHandler };

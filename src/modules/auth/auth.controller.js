const svc = require("./auth.service");
const repo = require("./auth.repository");

async function loginHandler(req, res) {
  try {
    const user = await svc.loginUser(req.body.username, req.body.password);
    req.session.userId   = user.id;
    req.session.userRole = user.role;
    req.session.userName = user.nome;
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

async function getMeHandler(req, res) {
  try {
    const user = await repo.findUserById(req.session.userId);
    if (!user) return res.status(401).json({ success: false, message: "Não autenticado." });
    res.json({ success: true, user });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || "Erro interno." });
  }
}

async function listUsersHandler(req, res) {
  try {
    res.json(await svc.getAllUsers());
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || "Erro interno." });
  }
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

async function changeUserRoleHandler(req, res) {
  if (req.session.userRole !== "admin") {
    return res.status(403).json({ success: false, message: "Apenas administradores podem alterar classes." });
  }
  try {
    await svc.changeUserRole(Number(req.params.id), req.body.role, req.session.userId);
    res.json({ success: true });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || "Erro interno." });
  }
}

async function deleteUserHandler(req, res) {
  if (req.session.userRole !== "admin") {
    return res.status(403).json({ success: false, message: "Apenas administradores podem excluir usuários." });
  }
  try {
    await svc.deleteUser(Number(req.params.id), req.session.userId);
    res.json({ success: true });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || "Erro interno." });
  }
}

async function updateSignatureHandler(req, res) {
  try {
    await svc.updateSignature(req.session.userId, req.body);
    const user = await repo.findUserById(req.session.userId);
    res.json({ success: true, signature_cargo: user.signature_cargo, signature_telefone: user.signature_telefone });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || "Erro interno." });
  }
}

module.exports = { loginHandler, logoutHandler, getMeHandler, listUsersHandler, createUserHandler, changePasswordHandler, changeUserRoleHandler, deleteUserHandler, updateSignatureHandler };

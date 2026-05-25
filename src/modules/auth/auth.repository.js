const prisma = require("../../db/prisma");

function mapUser(u) {
  if (!u) return null;
  return {
    id:                 u.id,
    nome:               u.nome,
    username:           u.username,
    password_hash:      u.passwordHash,
    role:               u.role,
    signature_cargo:    u.signatureCargo,
    signature_telefone: u.signatureTelefone,
    created_at:         u.createdAt,
    updated_at:         u.updatedAt,
  };
}

async function findUserByUsername(username) {
  return mapUser(await prisma.user.findUnique({ where: { username } }));
}

// Retorna usuário sem password_hash — preserva contrato original do SQLite.
async function findUserById(id) {
  const u = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, nome: true, username: true, role: true,
      signatureCargo: true, signatureTelefone: true, createdAt: true,
    },
  });
  if (!u) return null;
  return {
    id:                 u.id,
    nome:               u.nome,
    username:           u.username,
    role:               u.role,
    signature_cargo:    u.signatureCargo,
    signature_telefone: u.signatureTelefone,
    created_at:         u.createdAt,
  };
}

async function listUsers() {
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true, nome: true, username: true, role: true,
      signatureCargo: true, signatureTelefone: true, createdAt: true,
    },
  });
  return rows.map(u => ({
    id:                 u.id,
    nome:               u.nome,
    username:           u.username,
    role:               u.role,
    signature_cargo:    u.signatureCargo,
    signature_telefone: u.signatureTelefone,
    created_at:         u.createdAt,
  }));
}

async function createUser(data) {
  const row = await prisma.user.create({
    data: {
      nome:         data.nome,
      username:     data.username,
      passwordHash: data.password_hash,
      role:         data.role || "user",
    },
  });
  return row.id;
}

async function updateUserPassword(id, newHash) {
  await prisma.user.update({ where: { id }, data: { passwordHash: newHash } });
}

async function updateUserRole(id, role) {
  await prisma.user.update({ where: { id }, data: { role } });
}

async function updateUserSignature(id, { cargo, telefone }) {
  await prisma.user.update({
    where: { id },
    data: {
      signatureCargo:    cargo    || null,
      signatureTelefone: telefone || null,
    },
  });
}

async function deleteUserById(id) {
  await prisma.user.delete({ where: { id } });
}

async function countUsers() {
  return prisma.user.count();
}

async function countAdmins() {
  return prisma.user.count({ where: { role: "admin" } });
}

module.exports = {
  findUserByUsername,
  findUserById,
  listUsers,
  createUser,
  updateUserPassword,
  updateUserRole,
  updateUserSignature,
  deleteUserById,
  countUsers,
  countAdmins,
};

// Fixtures reutilizáveis para criação de dados de teste.
// Todas as funções inserem diretamente no banco (sem lógica de negócio)
// para manter os testes focados no que está sendo testado.

const db = require("../../src/db/connection");
const bcrypt = require("bcryptjs");

function createTestUser({ nome = "Usuário Teste", username = "usuario_teste", password = "senha123", role = "user" } = {}) {
  const hash = bcrypt.hashSync(password, 1); // rounds=1 para velocidade em testes
  const result = db.prepare(
    "INSERT INTO users (nome, username, password_hash, role) VALUES (?, ?, ?, ?)"
  ).run(nome, username, hash, role);
  return { id: Number(result.lastInsertRowid), nome, username, role };
}

function createTestAdmin({ nome = "Admin Teste", username = "admin_teste" } = {}) {
  return createTestUser({ nome, username, password: "admin123", role: "admin" });
}

function createTestClient({ nome = "Cliente Teste", cnpj = null } = {}) {
  const result = db.prepare(
    "INSERT INTO clients (nome, cnpj) VALUES (?, ?)"
  ).run(nome, cnpj);
  return { id: Number(result.lastInsertRowid), nome, cnpj };
}

function createTestCategory({ name = "Categoria Teste", code = "CAT" } = {}) {
  const result = db.prepare(
    "INSERT INTO part_categories (name, code) VALUES (?, ?)"
  ).run(name, code);
  return { id: Number(result.lastInsertRowid), name, code };
}

function createTestPart({ nome = "Peça Teste", preco_compra = 100.0, category_id = null, identity_code = null, codigo_interno = null } = {}) {
  const result = db.prepare(
    "INSERT INTO parts (nome, preco_compra, category_id, identity_code, codigo_interno) VALUES (?, ?, ?, ?, ?)"
  ).run(nome, preco_compra, category_id, identity_code, codigo_interno);
  return { id: Number(result.lastInsertRowid), nome, preco_compra };
}

function createTestProposal({ clienteId, numeroProposta = "PROP-001", dataProposta = "2026-01-01" } = {}) {
  const result = db.prepare(`
    INSERT INTO proposals (
      numero_proposta, cliente_id, cidade_emissao, data_emissao,
      objeto_proposta, forma_pagamento, prazo_pagamento, prazo_entrega,
      garantia, validade, valor_total, valor_total_extenso,
      responsavel_nome, responsavel_cargo, responsavel_email, responsavel_telefone,
      kanban_status, kanban_status_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente_envio', datetime('now'))
  `).run(
    numeroProposta, clienteId, "Belo Horizonte", dataProposta,
    "Fornecimento de peças", "Boleto", "30 dias", "7 dias",
    "90 dias", "30 dias", 1000.0, "mil reais",
    "Responsável Teste", "Gerente", "email@teste.com", "(31) 99999-9999"
  );
  return { id: Number(result.lastInsertRowid), numeroProposta, clienteId };
}

module.exports = {
  createTestUser,
  createTestAdmin,
  createTestClient,
  createTestCategory,
  createTestPart,
  createTestProposal,
};

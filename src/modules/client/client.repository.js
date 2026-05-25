const prisma = require("../../db/prisma");
const db = require("../../db/connection");
const { normalizeText } = require("../../shared/utils/normalize");

function mapClient(c) {
  if (!c) return null;
  return {
    id:                  c.id,
    nome:                c.nome,
    razao_social:        c.razaoSocial,
    nome_fantasia:       c.nomeFantasia,
    cnpj:                c.cnpj,
    inscricao_estadual:  c.inscricaoEstadual,
    endereco:            c.endereco,
    cidade:              c.cidade,
    estado:              c.estado,
    cep:                 c.cep,
    email:               c.email,
    telefone:            c.telefone,
    contato_responsavel: c.contatoResponsavel,
    observacoes:         c.observacoes,
    has_parts_contract:  c.hasPartsContract ? 1 : 0,
    created_at:          c.createdAt,
    updated_at:          c.updatedAt,
  };
}

async function listAllClients() {
  const rows = await prisma.client.findMany({ orderBy: { nome: "asc" } });
  return rows.map(mapClient);
}

async function findClientById(id) {
  return mapClient(await prisma.client.findUnique({ where: { id } }));
}

async function findClientByCnpj(cnpj) {
  const digits = cnpj ? cnpj.replace(/\D/g, "") : null;
  if (!digits) return null;
  // Client-side filter: normaliza e compara dígitos (GHTec tem poucos clientes)
  const candidates = await prisma.client.findMany({ where: { cnpj: { not: null } } });
  const match = candidates.find(c => c.cnpj && c.cnpj.replace(/\D/g, "") === digits);
  return mapClient(match || null);
}

async function findClientsByName(nome) {
  const rows = await prisma.client.findMany({
    where: { nome: { contains: nome, mode: "insensitive" } },
    orderBy: { id: "desc" },
    take: 5,
    select: { id: true, nome: true, razaoSocial: true, cnpj: true, cidade: true, estado: true },
  });
  return rows.map(r => ({
    id:           r.id,
    nome:         r.nome,
    razao_social: r.razaoSocial,
    cnpj:         r.cnpj,
    cidade:       r.cidade,
    estado:       r.estado,
  }));
}

async function findClientsByExactName(nome) {
  if (!nome || !nome.trim()) return [];
  const normInput = normalizeText(nome);
  const all = await prisma.client.findMany();
  return all.filter(c => normalizeText(c.nome) === normInput).map(mapClient);
}

async function searchClients(q) {
  const rows = await prisma.client.findMany({
    where: {
      OR: [
        { nome:         { contains: q, mode: "insensitive" } },
        { cnpj:         { contains: q, mode: "insensitive" } },
        { razaoSocial:  { contains: q, mode: "insensitive" } },
        { nomeFantasia: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { nome: "asc" },
    take: 10,
    select: {
      id: true, nome: true, razaoSocial: true, nomeFantasia: true,
      cnpj: true, cidade: true, estado: true, email: true, telefone: true,
    },
  });
  return rows.map(r => ({
    id:            r.id,
    nome:          r.nome,
    razao_social:  r.razaoSocial,
    nome_fantasia: r.nomeFantasia,
    cnpj:          r.cnpj,
    cidade:        r.cidade,
    estado:        r.estado,
    email:         r.email,
    telefone:      r.telefone,
  }));
}

async function createClient(data) {
  const row = await prisma.client.create({
    data: {
      nome:               data.nome               ?? null,
      razaoSocial:        data.razao_social        ?? null,
      nomeFantasia:       data.nome_fantasia       ?? null,
      cnpj:               data.cnpj                ?? null,
      inscricaoEstadual:  data.inscricao_estadual  ?? null,
      endereco:           data.endereco            ?? null,
      cidade:             data.cidade              ?? null,
      estado:             data.estado              ?? null,
      cep:                data.cep                 ?? null,
      email:              data.email               ?? null,
      telefone:           data.telefone            ?? null,
      contatoResponsavel: data.contato_responsavel ?? null,
      observacoes:        data.observacoes         ?? null,
      hasPartsContract:   !!data.has_parts_contract,
    },
  });
  return row.id;
}

async function updateClient(id, data) {
  await prisma.client.update({
    where: { id },
    data: {
      nome:               data.nome               ?? null,
      razaoSocial:        data.razao_social        ?? null,
      nomeFantasia:       data.nome_fantasia       ?? null,
      cnpj:               data.cnpj                ?? null,
      inscricaoEstadual:  data.inscricao_estadual  ?? null,
      endereco:           data.endereco            ?? null,
      cidade:             data.cidade              ?? null,
      estado:             data.estado              ?? null,
      cep:                data.cep                 ?? null,
      email:              data.email               ?? null,
      telefone:           data.telefone            ?? null,
      contatoResponsavel: data.contato_responsavel ?? null,
      observacoes:        data.observacoes         ?? null,
      hasPartsContract:   !!data.has_parts_contract,
    },
  });
}

async function deleteClientById(clientId) {
  await prisma.client.delete({ where: { id: clientId } });
}

// Bridge: queries proposals em SQLite até proposal migrar para Prisma.
function countClientProposals(clientId) {
  return db.prepare("SELECT COUNT(*) AS count FROM proposals WHERE cliente_id = ?").get(clientId).count;
}

// Bridge: JOIN entre proposals/clients/parts/price_history — todos ainda em SQLite.
// Quebra em produção para clientes criados após a migração; migrar quando proposal for para Prisma.
function getProfitAnalysis() {
  return db.prepare(`
    SELECT
      c.id AS client_id,
      c.nome AS cliente_nome,
      COUNT(DISTINCT p.id) AS num_propostas,
      SUM(pi.quantidade * pi.valor_unitario) AS valor_total_venda,
      SUM(CASE WHEN pt.preco_compra IS NOT NULL THEN pi.quantidade * pt.preco_compra END) AS custo_total,
      SUM(CASE WHEN pt.preco_compra IS NOT NULL THEN pi.quantidade * (pi.valor_unitario - pt.preco_compra) END) AS lucro_calculavel,
      SUM(CASE WHEN pt.preco_compra IS NOT NULL THEN pi.quantidade * pi.valor_unitario END) AS valor_venda_calculavel,
      SUM(CASE WHEN pt.preco_compra IS NULL OR pt.id IS NULL THEN 1 ELSE 0 END) AS itens_sem_custo,
      COUNT(pi.id) AS total_itens
    FROM proposals p
    JOIN clients c ON c.id = p.cliente_id
    JOIN proposal_items pi ON pi.proposal_id = p.id
    LEFT JOIN price_history ph ON ph.proposal_id = p.id
      AND ph.descricao_original = pi.descricao
      AND ph.id = (
        SELECT MIN(id) FROM price_history
        WHERE proposal_id = pi.proposal_id AND descricao_original = pi.descricao
      )
    LEFT JOIN parts pt ON pt.id = ph.part_id
    WHERE p.kanban_status = 'faturado'
    GROUP BY c.id, c.nome
    ORDER BY lucro_calculavel DESC
  `).all();
}

module.exports = {
  listAllClients,
  findClientById,
  findClientByCnpj,
  findClientsByName,
  findClientsByExactName,
  searchClients,
  createClient,
  updateClient,
  countClientProposals,
  deleteClientById,
  getProfitAnalysis,
};

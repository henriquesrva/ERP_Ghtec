const prisma = require("../../db/prisma");
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

async function countClientProposals(clientId) {
  return prisma.proposal.count({ where: { clienteId: clientId } });
}

async function getProfitAnalysis() {
  const rows = await prisma.$queryRaw`
    SELECT
      c.id                                                         AS client_id,
      c.nome                                                       AS cliente_nome,
      COUNT(DISTINCT p.id)::int                                    AS num_propostas,
      SUM(pi.quantidade * pi.valor_unitario)                       AS valor_total_venda,
      SUM(CASE WHEN pt.preco_compra IS NOT NULL
               THEN pi.quantidade * pt.preco_compra END)           AS custo_total,
      SUM(CASE WHEN pt.preco_compra IS NOT NULL
               THEN pi.quantidade * (pi.valor_unitario - pt.preco_compra) END) AS lucro_calculavel,
      SUM(CASE WHEN pt.preco_compra IS NOT NULL
               THEN pi.quantidade * pi.valor_unitario END)         AS valor_venda_calculavel,
      SUM(CASE WHEN pt.preco_compra IS NULL OR pt.id IS NULL
               THEN 1 ELSE 0 END)::int                             AS itens_sem_custo,
      COUNT(pi.id)::int                                            AS total_itens
    FROM proposals p
    JOIN clients c ON c.id = p.cliente_id
    JOIN proposal_items pi ON pi.proposal_id = p.id
    LEFT JOIN price_history ph
      ON  ph.proposal_id       = p.id
      AND ph.descricao_original = pi.descricao
      AND ph.id = (
        SELECT MIN(id) FROM price_history
        WHERE proposal_id = pi.proposal_id AND descricao_original = pi.descricao
      )
    LEFT JOIN parts pt ON pt.id = ph.part_id
    WHERE p.kanban_status = 'faturado'
    GROUP BY c.id, c.nome
    ORDER BY lucro_calculavel DESC NULLS LAST
  `;
  return rows.map(row => ({
    client_id:              Number(row.client_id),
    cliente_nome:           row.cliente_nome,
    num_propostas:          Number(row.num_propostas),
    valor_total_venda:      row.valor_total_venda !== null ? Number(row.valor_total_venda) : null,
    custo_total:            row.custo_total !== null ? Number(row.custo_total) : null,
    lucro_calculavel:       row.lucro_calculavel !== null ? Number(row.lucro_calculavel) : null,
    valor_venda_calculavel: row.valor_venda_calculavel !== null ? Number(row.valor_venda_calculavel) : null,
    itens_sem_custo:        Number(row.itens_sem_custo),
    total_itens:            Number(row.total_itens),
  }));
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

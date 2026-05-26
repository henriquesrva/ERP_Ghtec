const prisma = require("../../db/prisma");
const db     = require("../../db/connection"); // bridge: contas_pagar ainda em SQLite

function mapFornecedor(f) {
  if (!f) return null;
  return {
    id:                f.id,
    razao_social:      f.razaoSocial,
    nome_fantasia:     f.nomeFantasia,
    cnpj:              f.cnpj,
    inscricao_estadual: f.inscricaoEstadual,
    email:             f.email,
    telefone:          f.telefone,
    endereco:          f.endereco,
    cidade:            f.cidade,
    estado:            f.estado,
    cep:               f.cep,
    observacoes:       f.observacoes,
    ativo:             f.ativo,
    created_at:        f.createdAt,
    updated_at:        f.updatedAt,
  };
}

function stripCnpj(cnpj) {
  if (!cnpj) return null;
  return cnpj.replace(/\D/g, "");
}

async function listAllFornecedores({ includeInactive = false } = {}) {
  const fornecedores = await prisma.fornecedor.findMany({
    where:   includeInactive ? {} : { ativo: true },
    orderBy: { razaoSocial: "asc" },
    include: { _count: { select: { notasRecebidas: true } } },
  });
  return fornecedores.map((f) => {
    const mapped = mapFornecedor(f);
    const total_notas  = f._count.notasRecebidas;
    // Bridge: contas_pagar ainda em SQLite
    const total_contas = db.prepare("SELECT COUNT(*) AS n FROM contas_pagar WHERE fornecedor_id = ?").get(f.id)?.n ?? 0;
    return { ...mapped, total_notas, total_contas };
  });
}

async function findFornecedorById(id) {
  return mapFornecedor(await prisma.fornecedor.findUnique({ where: { id } }));
}

async function findFornecedorByCnpj(cnpj) {
  const digits = stripCnpj(cnpj);
  if (!digits) return null;
  const rows = await prisma.$queryRaw`
    SELECT id, razao_social, nome_fantasia, cnpj, ativo
    FROM fornecedores
    WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj,'.',''),'/',''),'-',''),' ','') = ${digits}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function searchFornecedores(q, { includeInactive = false } = {}) {
  const rows = await prisma.fornecedor.findMany({
    where: {
      AND: [
        includeInactive ? {} : { ativo: true },
        {
          OR: [
            { razaoSocial:  { contains: q, mode: "insensitive" } },
            { nomeFantasia: { contains: q, mode: "insensitive" } },
            { cnpj:         { contains: q, mode: "insensitive" } },
          ],
        },
      ],
    },
    select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, cidade: true, estado: true, ativo: true },
    orderBy: { razaoSocial: "asc" },
    take: 15,
  });
  return rows.map((f) => ({
    id:           f.id,
    razao_social: f.razaoSocial,
    nome_fantasia: f.nomeFantasia,
    cnpj:         f.cnpj,
    cidade:       f.cidade,
    estado:       f.estado,
    ativo:        f.ativo,
  }));
}

async function createFornecedor(data) {
  const f = await prisma.fornecedor.create({
    data: {
      razaoSocial:       data.razao_social       ?? null,
      nomeFantasia:      data.nome_fantasia       ?? null,
      cnpj:              data.cnpj               ?? null,
      inscricaoEstadual: data.inscricao_estadual  ?? null,
      email:             data.email              ?? null,
      telefone:          data.telefone           ?? null,
      endereco:          data.endereco           ?? null,
      cidade:            data.cidade             ?? null,
      estado:            data.estado             ?? null,
      cep:               data.cep                ?? null,
      observacoes:       data.observacoes        ?? null,
    },
  });
  return f.id;
}

async function updateFornecedor(id, data) {
  await prisma.fornecedor.update({
    where: { id },
    data: {
      razaoSocial:       data.razao_social       ?? null,
      nomeFantasia:      data.nome_fantasia       ?? null,
      cnpj:              data.cnpj               ?? null,
      inscricaoEstadual: data.inscricao_estadual  ?? null,
      email:             data.email              ?? null,
      telefone:          data.telefone           ?? null,
      endereco:          data.endereco           ?? null,
      cidade:            data.cidade             ?? null,
      estado:            data.estado             ?? null,
      cep:               data.cep                ?? null,
      observacoes:       data.observacoes        ?? null,
    },
  });
}

async function desativarFornecedor(id) {
  await prisma.fornecedor.update({ where: { id }, data: { ativo: false } });
}

// countVinculos: notas via Prisma, contas via bridge SQLite
async function countVinculos(id) {
  const notas  = await prisma.notaRecebida.count({ where: { fornecedorId: id } });
  const contas = db.prepare("SELECT COUNT(*) AS n FROM contas_pagar WHERE fornecedor_id = ?").get(id)?.n ?? 0;
  return { notas, contas };
}

async function getFornecedorDetalhes(id) {
  const f = await prisma.fornecedor.findUnique({ where: { id } });
  if (!f) return null;

  // notas: Prisma (migrado)
  const notasRaw = await prisma.notaRecebida.findMany({
    where:   { fornecedorId: id },
    include: { categoriaDespesa: { select: { nome: true } } },
    orderBy: { dataEntrada: "desc" },
    take:    20,
  });
  const notas = notasRaw.map((nr) => ({
    id:             nr.id,
    numero_nota:    nr.numeroNota,
    serie:          nr.serie,
    tipo_nota:      nr.tipoNota,
    data_entrada:   nr.dataEntrada,
    valor_total:    Number(nr.valorTotal),
    status:         nr.status,
    categoria_nome: nr.categoriaDespesa?.nome ?? null,
  }));

  // Bridge: contas ainda em SQLite
  const contas = db.prepare(`
    SELECT cp.id, cp.descricao, cp.valor, cp.data_vencimento,
           cp.status, cp.data_pagamento, cp.parcela_numero, cp.parcela_total,
           CASE WHEN cp.status = 'em_aberto' AND cp.data_vencimento < date('now') THEN 1 ELSE 0 END AS atrasado
    FROM contas_pagar cp
    WHERE cp.fornecedor_id = ?
    ORDER BY cp.data_vencimento ASC
    LIMIT 20
  `).all(id);

  return { fornecedor: mapFornecedor(f), notas, contas };
}

module.exports = {
  listAllFornecedores,
  findFornecedorById,
  findFornecedorByCnpj,
  searchFornecedores,
  createFornecedor,
  updateFornecedor,
  desativarFornecedor,
  countVinculos,
  getFornecedorDetalhes,
};

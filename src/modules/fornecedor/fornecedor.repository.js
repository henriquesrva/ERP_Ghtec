const prisma = require("../../db/prisma");

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
    include: { _count: { select: { notasRecebidas: true, contasPagar: true } } },
  });
  return fornecedores.map((f) => {
    const mapped = mapFornecedor(f);
    return {
      ...mapped,
      total_notas:  f._count.notasRecebidas,
      total_contas: f._count.contasPagar,
    };
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

async function countVinculos(id) {
  const [notas, contas] = await Promise.all([
    prisma.notaRecebida.count({ where: { fornecedorId: id } }),
    prisma.contaPagar.count({ where: { fornecedorId: id } }),
  ]);
  return { notas, contas };
}

async function getFornecedorDetalhes(id) {
  const f = await prisma.fornecedor.findUnique({ where: { id } });
  if (!f) return null;

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

  const contasRaw = await prisma.contaPagar.findMany({
    where:   { fornecedorId: id },
    orderBy: { dataVencimento: "asc" },
    take:    20,
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const contas = contasRaw.map(cp => ({
    id:              cp.id,
    descricao:       cp.descricao,
    valor:           Number(cp.valor),
    data_vencimento: cp.dataVencimento,
    status:          cp.status,
    data_pagamento:  cp.dataPagamento,
    parcela_numero:  cp.parcelaNumero,
    parcela_total:   cp.parcelaTotal,
    atrasado:        cp.status === "em_aberto" && cp.dataVencimento < today ? 1 : 0,
  }));

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

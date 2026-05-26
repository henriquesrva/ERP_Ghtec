const prisma = require("../../db/prisma");

function mapKanbanTask(t) {
  if (!t) return null;
  return {
    id:                       t.id,
    title:                    t.title,
    description:              t.description,
    kanban_status:            t.kanbanStatus,
    kanban_status_updated_at: t.kanbanStatusUpdatedAt,
    created_by:               t.createdById,
    created_at:               t.createdAt,
    updated_at:               t.updatedAt,
  };
}

function mapKanbanComment(c) {
  if (!c) return null;
  return {
    id:         c.id,
    card_type:  c.cardType,
    card_id:    c.cardId,
    user_id:    c.userId,
    user_nome:  c.userNome,
    comment:    c.comment,
    created_at: c.createdAt,
  };
}

// ── Cards (proposals + tasks combined) ───────────────────────────────────────

async function listCards() {
  const now = new Date();
  const cutoffEnviado  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const cutoffFaturado = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);

  const [proposals, tasks] = await Promise.all([
    prisma.proposal.findMany({
      where: {
        NOT: [
          { kanbanStatus: "enviado",  kanbanStatusUpdatedAt: { lt: cutoffEnviado  } },
          { kanbanStatus: "faturado", kanbanStatusUpdatedAt: { lt: cutoffFaturado } },
        ],
      },
      include: {
        cliente: { select: { nome: true } },
        items:   { orderBy: { itemOrdem: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.kanbanTask.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const proposalCards = proposals.map(p => ({
    card_type:                    "proposal",
    id:                           p.id,
    title:                        p.numeroProposta,
    description:                  null,
    kanban_status:                p.kanbanStatus,
    kanban_status_updated_at:     p.kanbanStatusUpdatedAt,
    created_at:                   p.createdAt,
    cliente_nome:                 p.cliente?.nome          ?? null,
    total:                        Number(p.valorTotal),
    pdf_path:                     p.pdfPath,
    created_by:                   null,
    execution_completed:          p.executionCompleted,
    execution_date:               p.executionDate,
    executed_by:                  p.executedBy,
    execution_os:                 p.executionOs,
    execution_details:            p.executionDetails,
    execution_marked_at:          p.executionMarkedAt,
    approval_date:                p.approvalDate,
    approval_notes:               p.approvalNotes,
    approval_attachment_path:     p.approvalAttachmentPath,
    approval_registered_at:       p.approvalRegisteredAt,
    billing_date:                 p.billingDate,
    invoice_number:               p.invoiceNumber,
    billing_notes:                p.billingNotes,
    billed_by_user_id:            p.billedByUserId,
    billed_at:                    p.billedAt,
    items_preview:                p.items.slice(0, 3).map(i => i.descricao).join("|||") || null,
    items_count:                  p.items.length,
  }));

  const taskCards = tasks.map(t => ({
    card_type:                    "task",
    id:                           t.id,
    title:                        t.title,
    description:                  t.description,
    kanban_status:                t.kanbanStatus,
    kanban_status_updated_at:     t.kanbanStatusUpdatedAt,
    created_at:                   t.createdAt,
    cliente_nome:                 null,
    total:                        null,
    pdf_path:                     null,
    created_by:                   t.createdById,
    execution_completed:          null,
    execution_date:               null,
    executed_by:                  null,
    execution_os:                 null,
    execution_details:            null,
    execution_marked_at:          null,
    approval_date:                null,
    approval_notes:               null,
    approval_attachment_path:     null,
    approval_registered_at:       null,
    billing_date:                 null,
    invoice_number:               null,
    billing_notes:                null,
    billed_by_user_id:            null,
    billed_at:                    null,
    items_preview:                null,
    items_count:                  null,
  }));

  const all = [...proposalCards, ...taskCards];
  all.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return all;
}

// ── Tasks CRUD ────────────────────────────────────────────────────────────────

async function createTask({ title, description, created_by }) {
  const t = await prisma.kanbanTask.create({
    data: {
      title,
      description: description || null,
      createdById: created_by  || null,
    },
  });
  return mapKanbanTask(t);
}

async function findTaskById(id) {
  const t = await prisma.kanbanTask.findUnique({ where: { id } });
  return mapKanbanTask(t);
}

async function updateTask(id, { title, description }) {
  const t = await prisma.kanbanTask.update({
    where: { id },
    data: { title, description: description || null },
  });
  return mapKanbanTask(t);
}

async function setTaskKanbanStatus(id, status) {
  await prisma.kanbanTask.update({
    where: { id },
    data:  { kanbanStatus: status, kanbanStatusUpdatedAt: new Date() },
  });
}

async function deleteTask(id) {
  await prisma.kanbanTask.delete({ where: { id } });
}

// ── Comments ──────────────────────────────────────────────────────────────────

// kanban_comments is a polymorphic relation (card_type + card_id).
// No FK constraint — validation is done in kanban.service.js.
async function getComments(cardType, cardId) {
  const rows = await prisma.kanbanComment.findMany({
    where:   { cardType, cardId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapKanbanComment);
}

async function addComment({ card_type, card_id, user_id, user_nome, comment }) {
  const c = await prisma.kanbanComment.create({
    data: {
      cardType: card_type,
      cardId:   card_id,
      userId:   user_id,
      userNome: user_nome,
      comment,
    },
  });
  return c;
}

async function deleteCommentsByCard(cardType, cardId) {
  await prisma.kanbanComment.deleteMany({ where: { cardType, cardId } });
}

module.exports = {
  listCards,
  createTask,
  findTaskById,
  updateTask,
  setTaskKanbanStatus,
  deleteTask,
  getComments,
  addComment,
  deleteCommentsByCard,
};

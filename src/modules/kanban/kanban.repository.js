const db = require("../../db/connection");

// ── Cards (proposals + tasks combined) ───────────────────────────────────────

function listCards() {
  return db.prepare(`
    SELECT
      'proposal'                        AS card_type,
      p.id                              AS id,
      p.numero_proposta                 AS title,
      NULL                              AS description,
      p.kanban_status,
      p.kanban_status_updated_at,
      p.created_at,
      c.nome                            AS cliente_nome,
      p.valor_total                     AS total,
      p.pdf_path,
      NULL                              AS created_by,
      p.execution_completed,
      p.execution_date,
      p.executed_by,
      p.execution_os,
      p.execution_details,
      p.execution_marked_at,
      p.approval_date,
      p.approval_notes,
      p.approval_attachment_path,
      p.approval_registered_at,
      p.billing_date,
      p.invoice_number,
      p.billing_notes,
      p.billed_by_user_id,
      p.billed_at,
      (SELECT GROUP_CONCAT(pi.descricao, '|||')
       FROM (SELECT pi2.descricao FROM proposal_items pi2
             WHERE pi2.proposal_id = p.id
             ORDER BY pi2.item_ordem ASC LIMIT 3) pi) AS items_preview,
      (SELECT COUNT(*) FROM proposal_items pi3 WHERE pi3.proposal_id = p.id) AS items_count
    FROM proposals p
    LEFT JOIN clients c ON c.id = p.cliente_id
    UNION ALL
    SELECT
      'task'              AS card_type,
      t.id                AS id,
      t.title,
      t.description,
      t.kanban_status,
      t.kanban_status_updated_at,
      t.created_at,
      NULL                AS cliente_nome,
      NULL                AS total,
      NULL                AS pdf_path,
      t.created_by,
      NULL                AS execution_completed,
      NULL                AS execution_date,
      NULL                AS executed_by,
      NULL                AS execution_os,
      NULL                AS execution_details,
      NULL                AS execution_marked_at,
      NULL                AS approval_date,
      NULL                AS approval_notes,
      NULL                AS approval_attachment_path,
      NULL                AS approval_registered_at,
      NULL                AS billing_date,
      NULL                AS invoice_number,
      NULL                AS billing_notes,
      NULL                AS billed_by_user_id,
      NULL                AS billed_at,
      NULL                AS items_preview,
      NULL                AS items_count
    FROM kanban_tasks t
    ORDER BY created_at ASC
  `).all();
}

// ── Tasks CRUD ────────────────────────────────────────────────────────────────

function createTask({ title, description, created_by }) {
  return db.prepare(`
    INSERT INTO kanban_tasks (title, description, created_by)
    VALUES (@title, @description, @created_by)
  `).run({ title, description: description || null, created_by: created_by || null });
}

function findTaskById(id) {
  return db.prepare(`SELECT * FROM kanban_tasks WHERE id = ?`).get(id);
}

function updateTask(id, { title, description }) {
  return db.prepare(`
    UPDATE kanban_tasks
    SET title = @title, description = @description, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({ id, title, description: description || null });
}

function setTaskKanbanStatus(id, status) {
  return db.prepare(`
    UPDATE kanban_tasks
    SET kanban_status = ?, kanban_status_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, id);
}

function deleteTask(id) {
  return db.prepare(`DELETE FROM kanban_tasks WHERE id = ?`).run(id);
}

// ── Comments ──────────────────────────────────────────────────────────────────

function getComments(cardType, cardId) {
  return db.prepare(`
    SELECT * FROM kanban_comments
    WHERE card_type = ? AND card_id = ?
    ORDER BY created_at ASC
  `).all(cardType, cardId);
}

function addComment({ card_type, card_id, user_id, user_nome, comment }) {
  return db.prepare(`
    INSERT INTO kanban_comments (card_type, card_id, user_id, user_nome, comment)
    VALUES (@card_type, @card_id, @user_id, @user_nome, @comment)
  `).run({ card_type, card_id, user_id, user_nome, comment });
}

function deleteCommentsByCard(cardType, cardId) {
  return db.prepare(`DELETE FROM kanban_comments WHERE card_type = ? AND card_id = ?`).run(cardType, cardId);
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

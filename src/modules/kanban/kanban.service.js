const repo = require("./kanban.repository");
const { canMoveKanban, KANBAN_STATUSES } = require("../proposal/proposal.service");

function getAllCards() {
  return repo.listCards();
}

function createTask(data, userId) {
  if (!data.title || !data.title.trim()) {
    const err = new Error("O título da tarefa é obrigatório.");
    err.code = "VALIDATION";
    throw err;
  }
  const result = repo.createTask({
    title: data.title.trim(),
    description: data.description || null,
    created_by: userId || null,
  });
  return repo.findTaskById(result.lastInsertRowid);
}

function updateTask(id, data) {
  const task = repo.findTaskById(id);
  if (!task) {
    const err = new Error("Tarefa não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (!data.title || !data.title.trim()) {
    const err = new Error("O título da tarefa é obrigatório.");
    err.code = "VALIDATION";
    throw err;
  }
  repo.updateTask(id, { title: data.title.trim(), description: data.description || null });
  return repo.findTaskById(id);
}

function moveTask(id, newStatus, userRole) {
  const task = repo.findTaskById(id);
  if (!task) {
    const err = new Error("Tarefa não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (!KANBAN_STATUSES.includes(newStatus)) {
    const err = new Error(`Status inválido: ${newStatus}.`);
    err.code = "INVALID_STATUS";
    throw err;
  }
  if (!canMoveKanban(userRole, task.kanban_status, newStatus)) {
    const err = new Error("Você não tem permissão para mover esta tarefa.");
    err.code = "FORBIDDEN";
    throw err;
  }
  repo.setTaskKanbanStatus(id, newStatus);
}

function deleteTask(id) {
  const task = repo.findTaskById(id);
  if (!task) {
    const err = new Error("Tarefa não encontrada.");
    err.code = "NOT_FOUND";
    throw err;
  }
  repo.deleteCommentsByCard("task", id);
  repo.deleteTask(id);
}

function getComments(cardType, cardId) {
  return repo.getComments(cardType, cardId);
}

function addComment({ cardType, cardId, userId, userNome, comment }) {
  if (!comment || !comment.trim()) {
    const err = new Error("O comentário não pode ser vazio.");
    err.code = "VALIDATION";
    throw err;
  }
  const result = repo.addComment({
    card_type: cardType,
    card_id: cardId,
    user_id: userId,
    user_nome: userNome,
    comment: comment.trim(),
  });
  return { id: result.lastInsertRowid };
}

module.exports = {
  getAllCards,
  createTask,
  updateTask,
  moveTask,
  deleteTask,
  getComments,
  addComment,
};

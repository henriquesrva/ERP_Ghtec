const svc = require("./kanban.service");

async function listCardsHandler(req, res) {
  try {
    return res.json(await svc.getAllCards());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao listar cards." });
  }
}

async function createTaskHandler(req, res) {
  try {
    const task = await svc.createTask(req.body, req.session.userId);
    return res.status(201).json({ success: true, task });
  } catch (err) {
    console.error(err);
    if (err.code === "VALIDATION") return res.status(400).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao criar tarefa." });
  }
}

async function updateTaskHandler(req, res) {
  try {
    const task = await svc.updateTask(Number(req.params.id), req.body);
    return res.json({ success: true, task });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND")  return res.status(404).json({ success: false, message: err.message });
    if (err.code === "VALIDATION") return res.status(400).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao atualizar tarefa." });
  }
}

async function moveTaskHandler(req, res) {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: "O campo 'status' é obrigatório." });
    await svc.moveTask(Number(req.params.id), status, req.session.userRole || "user");
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND")      return res.status(404).json({ success: false, message: err.message });
    if (err.code === "INVALID_STATUS") return res.status(400).json({ success: false, message: err.message });
    if (err.code === "FORBIDDEN")      return res.status(403).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao mover tarefa." });
  }
}

async function deleteTaskHandler(req, res) {
  try {
    await svc.deleteTask(Number(req.params.id), req.session.userRole || "user");
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") return res.status(404).json({ success: false, message: err.message });
    if (err.code === "FORBIDDEN") return res.status(403).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao excluir tarefa." });
  }
}

async function linkTaskToProposalHandler(req, res) {
  try {
    const role = req.session.userRole || "user";
    if (role !== "admin" && role !== "comercial") {
      return res.status(403).json({ success: false, message: "Apenas admin e comercial podem vincular tarefas a propostas." });
    }
    const taskId = Number(req.params.id);
    const { proposal_id } = req.body;
    if (!proposal_id) return res.status(400).json({ success: false, message: "proposal_id é obrigatório." });
    await svc.linkTaskToProposal(taskId, Number(proposal_id), {
      id:   req.session.userId,
      nome: req.session.userName || "Usuário",
    });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") return res.status(404).json({ success: false, message: err.message });
    if (err.code === "FORBIDDEN") return res.status(403).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao vincular tarefa." });
  }
}

async function getCommentsHandler(req, res) {
  try {
    const { type, id } = req.params;
    return res.json(await svc.getComments(type, Number(id)));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao carregar comentários." });
  }
}

async function addCommentHandler(req, res) {
  try {
    const { cardType, cardId, comment } = req.body;
    if (!cardType || !cardId) return res.status(400).json({ success: false, message: "cardType e cardId são obrigatórios." });
    const result = await svc.addComment({
      cardType,
      cardId:   Number(cardId),
      userId:   req.session.userId,
      userNome: req.session.userName || "Usuário",
      comment,
    });
    return res.status(201).json({ success: true, id: result.id });
  } catch (err) {
    console.error(err);
    if (err.code === "VALIDATION") return res.status(400).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao adicionar comentário." });
  }
}

module.exports = {
  listCardsHandler,
  createTaskHandler,
  updateTaskHandler,
  moveTaskHandler,
  deleteTaskHandler,
  linkTaskToProposalHandler,
  getCommentsHandler,
  addCommentHandler,
};

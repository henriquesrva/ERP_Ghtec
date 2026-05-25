const {
  getAllObjetos,
  getObjetoById,
  searchObjetosByQuery,
  createNewObjeto,
  updateObjetoService,
  deleteObjeto,
} = require("./objeto.service");

async function listObjetosHandler(req, res) {
  try {
    return res.json(await getAllObjetos());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao listar objetos." });
  }
}

async function getObjetoByIdHandler(req, res) {
  try {
    const o = await getObjetoById(Number(req.params.id));
    if (!o) return res.status(404).json({ success: false, message: "Objeto não encontrado." });
    return res.json(o);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao buscar objeto." });
  }
}

async function searchObjetosHandler(req, res) {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json([]);
    return res.json(await searchObjetosByQuery(q));
  } catch (err) {
    console.error(err);
    return res.status(500).json([]);
  }
}

async function createObjetoHandler(req, res) {
  try {
    const o = await createNewObjeto(req.body);
    return res.status(201).json({ success: true, objeto: o });
  } catch (err) {
    console.error(err);
    if (err.message.includes("obrigatório")) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Erro ao criar objeto." });
  }
}

async function updateObjetoHandler(req, res) {
  try {
    const o = await updateObjetoService(Number(req.params.id), req.body);
    return res.json({ success: true, objeto: o });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") return res.status(404).json({ success: false, message: err.message });
    if (err.message.includes("obrigatório")) return res.status(400).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao atualizar objeto." });
  }
}

async function deleteObjetoHandler(req, res) {
  try {
    await deleteObjeto(Number(req.params.id));
    return res.json({ success: true, message: "Objeto excluído com sucesso." });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Erro ao excluir objeto." });
  }
}

module.exports = {
  listObjetosHandler,
  getObjetoByIdHandler,
  searchObjetosHandler,
  createObjetoHandler,
  updateObjetoHandler,
  deleteObjetoHandler,
};

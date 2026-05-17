const {
  getAllObjetos,
  getObjetoById,
  searchObjetosByQuery,
  createNewObjeto,
  deleteObjeto,
} = require("./objeto.service");

function listObjetosHandler(req, res) {
  try {
    return res.json(getAllObjetos());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao listar objetos." });
  }
}

function getObjetoByIdHandler(req, res) {
  try {
    const o = getObjetoById(Number(req.params.id));
    if (!o) return res.status(404).json({ success: false, message: "Objeto não encontrado." });
    return res.json(o);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao buscar objeto." });
  }
}

function searchObjetosHandler(req, res) {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json([]);
    return res.json(searchObjetosByQuery(q));
  } catch (err) {
    console.error(err);
    return res.status(500).json([]);
  }
}

function createObjetoHandler(req, res) {
  try {
    const o = createNewObjeto(req.body);
    return res.status(201).json({ success: true, objeto: o });
  } catch (err) {
    console.error(err);
    if (err.message.includes("obrigatório")) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Erro ao criar objeto." });
  }
}

function deleteObjetoHandler(req, res) {
  try {
    deleteObjeto(Number(req.params.id));
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
  deleteObjetoHandler,
};

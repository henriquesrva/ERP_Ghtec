const {
  getAllCategorias,
  createCategoria,
  updateCategoria,
  desativarCategoria,
} = require("./categoria_despesa.service");

function listCategoriasHandler(req, res) {
  try {
    const apenasAtivas = req.query.todas !== "true";
    return res.json(getAllCategorias({ apenasAtivas }));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao listar categorias." });
  }
}

function createCategoriaHandler(req, res) {
  try {
    const cat = createCategoria(req.body);
    return res.status(201).json({ success: true, categoria: cat });
  } catch (err) {
    console.error(err);
    if (err.code === "VALIDATION") return res.status(400).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao criar categoria." });
  }
}

function updateCategoriaHandler(req, res) {
  try {
    const cat = updateCategoria(Number(req.params.id), req.body);
    return res.json({ success: true, categoria: cat });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND")  return res.status(404).json({ success: false, message: err.message });
    if (err.code === "VALIDATION") return res.status(400).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao atualizar categoria." });
  }
}

function desativarCategoriaHandler(req, res) {
  try {
    if (req.session.userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Apenas administradores podem desativar categorias." });
    }
    desativarCategoria(Number(req.params.id));
    return res.json({ success: true, message: "Categoria desativada." });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") return res.status(404).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao desativar categoria." });
  }
}

module.exports = {
  listCategoriasHandler,
  createCategoriaHandler,
  updateCategoriaHandler,
  desativarCategoriaHandler,
};

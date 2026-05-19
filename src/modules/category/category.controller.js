const svc = require("./category.service");

function listCategoriesHandler(req, res) {
  try {
    return res.json(svc.getAllCategories());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erro ao listar categorias." });
  }
}

function createCategoryHandler(req, res) {
  try {
    const cat = svc.createNewCategory(req.body);
    return res.status(201).json({ success: true, category: cat });
  } catch (err) {
    console.error(err);
    if (err.code === "VALIDATION") return res.status(400).json({ success: false, message: err.message });
    if (err.code === "DUPLICATE")  return res.status(409).json({ success: false, message: err.message, existingId: err.existingId });
    return res.status(500).json({ success: false, message: "Erro ao criar categoria." });
  }
}

function updateCategoryHandler(req, res) {
  try {
    const cat = svc.updateExistingCategory(Number(req.params.id), req.body);
    return res.json({ success: true, category: cat });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND")  return res.status(404).json({ success: false, message: err.message });
    if (err.code === "VALIDATION") return res.status(400).json({ success: false, message: err.message });
    if (err.code === "DUPLICATE")  return res.status(409).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao atualizar categoria." });
  }
}

function deleteCategoryHandler(req, res) {
  try {
    svc.deleteExistingCategory(Number(req.params.id));
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    if (err.code === "NOT_FOUND") return res.status(404).json({ success: false, message: err.message });
    if (err.code === "HAS_PARTS") return res.status(409).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: "Erro ao excluir categoria." });
  }
}

module.exports = { listCategoriesHandler, createCategoryHandler, updateCategoryHandler, deleteCategoryHandler };

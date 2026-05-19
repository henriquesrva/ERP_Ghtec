const db = require("../../db/connection");

function listAllCategories() {
  return db.prepare(`
    SELECT id, name, code, created_at, updated_at
    FROM part_categories
    ORDER BY name ASC
  `).all();
}

function findCategoryById(id) {
  return db.prepare(`SELECT * FROM part_categories WHERE id = ?`).get(id);
}

function findCategoryByCode(code) {
  return db.prepare(`SELECT * FROM part_categories WHERE code = ? LIMIT 1`).get(code);
}

function createCategory(data) {
  const result = db.prepare(`
    INSERT INTO part_categories (name, code) VALUES (@name, @code)
  `).run({ name: data.name, code: data.code });
  return result.lastInsertRowid;
}

function updateCategory(id, data) {
  db.prepare(`
    UPDATE part_categories SET name = @name, code = @code WHERE id = @id
  `).run({ id, name: data.name, code: data.code });
}

function deleteCategory(id) {
  db.prepare(`DELETE FROM part_categories WHERE id = ?`).run(id);
}

function countPartsInCategory(categoryId) {
  return db.prepare(`SELECT COUNT(*) AS n FROM parts WHERE category_id = ?`).get(categoryId).n;
}

module.exports = {
  listAllCategories,
  findCategoryById,
  findCategoryByCode,
  createCategory,
  updateCategory,
  deleteCategory,
  countPartsInCategory,
};

const db = require("../../db/connection");

function listConditions() {
  return db.prepare("SELECT * FROM commercial_conditions ORDER BY name ASC").all();
}

function getConditionById(id) {
  return db.prepare("SELECT * FROM commercial_conditions WHERE id = ?").get(id);
}

function searchConditions(q) {
  const pattern = `%${q}%`;
  return db.prepare(`
    SELECT * FROM commercial_conditions
    WHERE name LIKE ? OR forma_pagamento LIKE ? OR prazo_pagamento LIKE ?
    ORDER BY name ASC LIMIT 50
  `).all(pattern, pattern, pattern);
}

function createCondition(data) {
  const result = db.prepare(`
    INSERT INTO commercial_conditions
      (name, forma_pagamento, prazo_pagamento, prazo_entrega, garantia, validade)
    VALUES
      (@name, @forma_pagamento, @prazo_pagamento, @prazo_entrega, @garantia, @validade)
  `).run(data);
  return result.lastInsertRowid;
}

function updateCondition(id, data) {
  db.prepare(`
    UPDATE commercial_conditions
    SET name = @name,
        forma_pagamento = @forma_pagamento,
        prazo_pagamento = @prazo_pagamento,
        prazo_entrega   = @prazo_entrega,
        garantia        = @garantia,
        validade        = @validade
    WHERE id = @id
  `).run({ ...data, id });
}

function deleteCondition(id) {
  // Nullifica o vínculo em propostas antes de deletar (a condição é snapshot — os
  // campos de texto nas propostas preservam os valores originais).
  db.transaction(() => {
    db.prepare(`UPDATE proposals SET commercial_condition_id = NULL WHERE commercial_condition_id = ?`).run(id);
    db.prepare(`DELETE FROM commercial_conditions WHERE id = ?`).run(id);
  })();
}

module.exports = {
  listConditions,
  getConditionById,
  searchConditions,
  createCondition,
  updateCondition,
  deleteCondition,
};

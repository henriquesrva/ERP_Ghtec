const { clearAllTables } = require("../../tests/setup/testDb");
const { createTestCategory } = require("../../tests/setup/fixtures");
const { parsePrecoCompra, createNewPart } = require("../../src/modules/part/part.service");

beforeEach(clearAllTables);

// ── parsePrecoCompra ──────────────────────────────────────────────────────────

describe("parsePrecoCompra", () => {
  it("returns null for null", () => {
    expect(parsePrecoCompra(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parsePrecoCompra("")).toBeNull();
  });

  it("returns null for non-numeric string", () => {
    expect(parsePrecoCompra("abc")).toBeNull();
  });

  it("returns 0 for numeric 0", () => {
    expect(parsePrecoCompra(0)).toBe(0);
  });

  it("returns 100 for numeric 100", () => {
    expect(parsePrecoCompra(100)).toBe(100);
  });

  it("parses string '100' as 100", () => {
    expect(parsePrecoCompra("100")).toBe(100);
  });

  it("trata ponto como separador de milhar — '100.50' → 10050 (sem suporte ao formato US)", () => {
    expect(parsePrecoCompra("100.50")).toBe(10050);
  });

  it("parses Brazilian decimal string '100,50' as 100.5", () => {
    expect(parsePrecoCompra("100,50")).toBe(100.5);
  });

  it("parses Brazilian format '1.234,56' as 1234.56", () => {
    expect(parsePrecoCompra("1.234,56")).toBe(1234.56);
  });

  it("trata ponto como separador de milhar — '1234.56' → 123456 (ponto não é decimal)", () => {
    expect(parsePrecoCompra("1234.56")).toBe(123456);
  });

  it("returns negative value as-is (validation is caller's responsibility)", () => {
    expect(parsePrecoCompra(-5)).toBe(-5);
  });
});

// ── createNewPart ─────────────────────────────────────────────────────────────

describe("createNewPart", () => {
  it("throws when nome is missing", () => {
    expect(() => createNewPart({ preco_compra: 0 })).toThrow(/nome/i);
  });

  it("throws when preco_compra is null", () => {
    expect(() => createNewPart({ nome: "Peça X", preco_compra: null })).toThrow(/preço/i);
  });

  it("throws when preco_compra is missing (undefined)", () => {
    expect(() => createNewPart({ nome: "Peça X" })).toThrow(/preço/i);
  });

  it("throws when preco_compra is negative", () => {
    expect(() => createNewPart({ nome: "Peça X", preco_compra: -10 })).toThrow(/preço/i);
  });

  it("creates part with minimum required fields (nome + preco_compra = 0)", () => {
    const part = createNewPart({ nome: "Peça Mínima", preco_compra: 0 });
    expect(part).toBeDefined();
    expect(part.nome).toBe("Peça Mínima");
    expect(part.preco_compra).toBe(0);
  });

  it("creates part with category_id and identity_code → codigo_interno = '{cat.code}-{identity_code}'", () => {
    const cat = createTestCategory({ name: "Eletrônico", code: "EL" });
    const part = createNewPart({
      nome: "Resistor",
      preco_compra: 5.5,
      category_id: cat.id,
      identity_code: "001",
    });
    expect(part.codigo_interno).toBe("EL-001");
  });

  it("throws DUPLICATE_INTERNAL_CODE when two parts share the same category + identity_code", () => {
    const cat = createTestCategory({ name: "Eletrônico", code: "EL" });
    createNewPart({ nome: "Peça A", preco_compra: 10, category_id: cat.id, identity_code: "001" });

    const tryDuplicate = () =>
      createNewPart({ nome: "Peça B", preco_compra: 20, category_id: cat.id, identity_code: "001" });

    expect(tryDuplicate).toThrow();
    try {
      tryDuplicate();
    } catch (err) {
      expect(err.code).toBe("DUPLICATE_INTERNAL_CODE");
    }
  });

  it("creates part without category_id (no codigo_interno generated)", () => {
    const part = createNewPart({ nome: "Peça Sem Categoria", preco_compra: 15 });
    expect(part.codigo_interno).toBeFalsy();
  });
});

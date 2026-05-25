const { valorPorExtenso } = require("../../src/shared/utils/extensao");

describe("valorPorExtenso", () => {
  describe("existência da função", () => {
    it("deve exportar valorPorExtenso como função", () => {
      expect(typeof valorPorExtenso).toBe("function");
    });
  });

  describe("valores inteiros", () => {
    it("0 → 'zero reais'", () => {
      expect(valorPorExtenso(0)).toBe("zero reais");
    });

    it("1 → 'um real'", () => {
      expect(valorPorExtenso(1)).toBe("um real");
    });

    it("10 → 'dez reais'", () => {
      expect(valorPorExtenso(10)).toBe("dez reais");
    });

    it("25 → 'vinte e cinco reais'", () => {
      expect(valorPorExtenso(25)).toBe("vinte e cinco reais");
    });

    it("100 → 'cem reais'", () => {
      expect(valorPorExtenso(100)).toBe("cem reais");
    });

    it("1000 → 'mil reais'", () => {
      expect(valorPorExtenso(1000)).toBe("mil reais");
    });

    it("10000 → 'dez mil reais'", () => {
      expect(valorPorExtenso(10000)).toBe("dez mil reais");
    });

    it("1000000 → 'um milhão de reais'", () => {
      expect(valorPorExtenso(1000000)).toBe("um milhão de reais");
    });

    it("2000000 → 'dois milhões de reais'", () => {
      expect(valorPorExtenso(2000000)).toBe("dois milhões de reais");
    });
  });

  describe("valores com centavos", () => {
    it("25.50 → 'vinte e cinco reais e cinquenta centavos'", () => {
      expect(valorPorExtenso(25.50)).toBe("vinte e cinco reais e cinquenta centavos");
    });

    it("100.01 → 'cem reais e um centavo'", () => {
      expect(valorPorExtenso(100.01)).toBe("cem reais e um centavo");
    });

    it("123.45 → 'cento e vinte e três reais e quarenta e cinco centavos'", () => {
      expect(valorPorExtenso(123.45)).toBe("cento e vinte e três reais e quarenta e cinco centavos");
    });

    it("1234.56 → 'mil duzentos e trinta e quatro reais e cinquenta e seis centavos'", () => {
      expect(valorPorExtenso(1234.56)).toBe("mil duzentos e trinta e quatro reais e cinquenta e seis centavos");
    });

    it("1000000.99 → 'um milhão de reais e noventa e nove centavos'", () => {
      expect(valorPorExtenso(1000000.99)).toBe("um milhão de reais e noventa e nove centavos");
    });
  });

  describe("valores inválidos", () => {
    it("lança erro para valores negativos (-1)", () => {
      expect(() => valorPorExtenso(-1)).toThrow();
    });

    it("lança erro para Infinity", () => {
      expect(() => valorPorExtenso(Infinity)).toThrow();
    });

    it("lança erro para -Infinity", () => {
      expect(() => valorPorExtenso(-Infinity)).toThrow();
    });

    it("lança erro para NaN", () => {
      expect(() => valorPorExtenso(NaN)).toThrow();
    });

    it("o erro de valor negativo tem code='VALIDATION'", () => {
      expect(() => valorPorExtenso(-1)).toThrowError(
        expect.objectContaining({ code: "VALIDATION" })
      );
    });
  });
});

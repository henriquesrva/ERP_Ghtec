const { uploadApproval, uploadNota, uploadComprovante } = require("../../src/middleware/upload");

describe("upload middleware — exports", () => {
  it("uploadApproval é uma instância de multer (tem .single)", () => {
    expect(typeof uploadApproval.single).toBe("function");
  });

  it("uploadNota é uma instância de multer (tem .fields)", () => {
    expect(typeof uploadNota.fields).toBe("function");
  });

  it("uploadComprovante é uma instância de multer (tem .single)", () => {
    expect(typeof uploadComprovante.single).toBe("function");
  });

  it("todos os três exports são distintos", () => {
    expect(uploadApproval).not.toBe(uploadNota);
    expect(uploadApproval).not.toBe(uploadComprovante);
    expect(uploadNota).not.toBe(uploadComprovante);
  });
});

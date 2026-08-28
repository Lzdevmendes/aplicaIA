import { describe, it, expect } from "vitest";
import { cleanJobText } from "./job-text";

describe("cleanJobText", () => {
  it("colapsa linhas em branco repetidas", () => {
    const text = "Vaga de Back-end\n\n\n\nRequisitos:\n- Python";
    expect(cleanJobText(text)).toBe("Vaga de Back-end\n\nRequisitos:\n- Python");
  });

  it("colapsa linhas repetidas consecutivas (menu/rodapé duplicado do copy-paste)", () => {
    const text = "Início\nSobre\nVagas\nÍnício\nSobre\nVagas\nVaga de Back-end";
    expect(cleanJobText("Início\nSobre\nVagas\nVagas\nVaga de Back-end")).toBe(
      "Início\nSobre\nVagas\nVaga de Back-end",
    );
    // linhas repetidas não-consecutivas (ex: menu de novo lá embaixo) não são tocadas
    expect(cleanJobText(text)).toBe(text);
  });

  it("tira espaço/tab redundante e aparas as pontas", () => {
    expect(cleanJobText("  Vaga   de    Back-end  \n\tRequisitos:\t Python  ")).toBe(
      "Vaga de Back-end\nRequisitos: Python",
    );
  });

  it("normaliza quebras de linha CRLF", () => {
    expect(cleanJobText("linha 1\r\nlinha 2")).toBe("linha 1\nlinha 2");
  });
});

import { describe, it, expect } from "vitest";
import { isValidEmail, extractEmail } from "./email";

describe("isValidEmail", () => {
  it("aceita e-mails válidos", () => {
    expect(isValidEmail("rh@r030.tech")).toBe(true);
    expect(isValidEmail("fulano.silva@empresa.com.br")).toBe(true);
    expect(isValidEmail("  rh@r030.tech  ")).toBe(true);
  });

  it("rejeita string vazia", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("   ")).toBe(false);
  });

  it("rejeita lixo sem @ ou sem domínio", () => {
    expect(isValidEmail("fulano arroba empresa ponto com")).toBe(false);
    expect(isValidEmail("fulano@empresa")).toBe(false);
    expect(isValidEmail("fulano@")).toBe(false);
    expect(isValidEmail("@empresa.com")).toBe(false);
  });

  it("rejeita e-mail com espaço no meio", () => {
    expect(isValidEmail("fulano @empresa.com")).toBe(false);
  });
});

describe("extractEmail", () => {
  it("acha o único e-mail no meio de um texto de vaga", () => {
    const text = "Vaga de Back-end Pleno. Envie CV para rh@r030.tech até sexta.";
    expect(extractEmail(text)).toBe("rh@r030.tech");
  });

  it("devolve vazio quando não há e-mail", () => {
    expect(extractEmail("Vaga de Back-end Pleno, remoto, PJ.")).toBe("");
  });

  it("devolve vazio quando há mais de um candidato (ambíguo)", () => {
    const text = "Contato: rh@empresa.com. Dúvidas de privacidade: privacidade@empresa.com.";
    expect(extractEmail(text)).toBe("");
  });

  it("ignora duplicata do mesmo endereço", () => {
    const text = "rh@empresa.com aparece no topo e de novo no rodapé: rh@empresa.com";
    expect(extractEmail(text)).toBe("rh@empresa.com");
  });
});

import { describe, it, expect } from "vitest";
import { stripUnknownLinks } from "./link-guard";

describe("stripUnknownLinks", () => {
  it("mantém um link que bate com o perfil", () => {
    const body = "Veja meu github: https://github.com/fulano";
    const { body: out, stripped } = stripUnknownLinks(body, ["github.com/fulano"]);
    expect(out).toBe(body);
    expect(stripped).toEqual([]);
  });

  it("remove um link que não bate com nenhum link conhecido", () => {
    const body = "Confira https://github.com/outra-pessoa para mais.";
    const { body: out, stripped } = stripUnknownLinks(body, ["github.com/fulano"]);
    expect(out).not.toContain("github.com/outra-pessoa");
    expect(stripped).toEqual(["https://github.com/outra-pessoa"]);
  });

  it("remove qualquer link quando o perfil não tem nenhum", () => {
    const body = "Site: https://fulano.dev";
    const { stripped } = stripUnknownLinks(body, []);
    expect(stripped).toEqual(["https://fulano.dev"]);
  });

  it("ignora protocolo/www/barra final ao comparar", () => {
    const body = "https://www.fulano.dev/";
    const { stripped } = stripUnknownLinks(body, ["fulano.dev"]);
    expect(stripped).toEqual([]);
  });

  it("não mexe em corpo sem links", () => {
    const body = "Um e-mail comum, sem nenhum link.";
    const { body: out, stripped } = stripUnknownLinks(body, ["github.com/fulano"]);
    expect(out).toBe(body);
    expect(stripped).toEqual([]);
  });
});

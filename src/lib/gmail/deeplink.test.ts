import { describe, it, expect } from "vitest";
import { gmailComposeUrl, wouldTruncate } from "./deeplink";

describe("gmailComposeUrl", () => {
  it("aponta para o compositor do Gmail web", () => {
    const url = new URL(gmailComposeUrl({ to: "rh@r030.tech", subject: "s", body: "b" }));
    expect(url.host).toBe("mail.google.com");
    expect(url.searchParams.get("view")).toBe("cm");
  });

  it("preserva destinatário, assunto e corpo com acento", () => {
    const url = new URL(
      gmailComposeUrl({
        to: "rh@r030.tech",
        subject: "Candidatura — Back-end",
        body: "Olá!\nCorpo com acento: ção",
      }),
    );
    expect(url.searchParams.get("to")).toBe("rh@r030.tech");
    expect(url.searchParams.get("su")).toBe("Candidatura — Back-end");
    expect(url.searchParams.get("body")).toBe("Olá!\nCorpo com acento: ção");
  });

  it("escapa caracteres especiais (não quebra a URL)", () => {
    const url = gmailComposeUrl({
      to: "a@b.com",
      subject: "vaga & cargo = 100%",
      body: "linha 1 & linha 2",
    });
    // Parseia sem erro e recupera os valores originais.
    const parsed = new URL(url);
    expect(parsed.searchParams.get("subject") ?? parsed.searchParams.get("su")).toBe(
      "vaga & cargo = 100%",
    );
  });

  it("não corta corpos curtos", () => {
    const body = "corpo normal de e-mail, bem curto.";
    expect(wouldTruncate(body)).toBe(false);
    const url = new URL(gmailComposeUrl({ to: "a@b.com", subject: "s", body }));
    expect(url.searchParams.get("body")).toBe(body);
  });

  it("corta corpos longos demais e avisa", () => {
    const body = "x".repeat(7000);
    expect(wouldTruncate(body)).toBe(true);
    const url = new URL(gmailComposeUrl({ to: "a@b.com", subject: "s", body }));
    const truncated = url.searchParams.get("body")!;
    expect(truncated.length).toBeLessThan(body.length);
    expect(truncated).toContain("continue direto no Gmail");
  });
});

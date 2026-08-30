import { describe, it, expect } from "vitest";
import { generateEmail, type EmailTemplateInput } from "./email-template";

const baseInput: EmailTemplateInput = {
  candidate: {
    fullName: "Ana Silva",
    headline: "Desenvolvedora Back-end · Pleno",
    summary: "Construo APIs em Python há 4 anos, com foco em confiabilidade.",
    github: "",
    website: "",
  },
  job: {
    company: "R030",
    role: "Desenvolvedor(a) Back-end Pleno",
    skills: [
      { name: "Python", verdict: "match" },
      { name: "FastAPI", verdict: "match" },
      { name: "Kafka", verdict: "partial" },
    ],
  },
};

/** rng determinístico: sempre escolhe o primeiro candidato disponível. */
const pickFirst = () => 0;
/** rng determinístico: sempre escolhe o último candidato disponível. */
const pickLast = () => 0.999;

describe("generateEmail", () => {
  it("interpola empresa, cargo, skills que batem e nome na assinatura", () => {
    const email = generateEmail(baseInput, { rng: pickFirst });
    expect(email.subject).toContain("Desenvolvedor(a) Back-end Pleno");
    expect(email.body).toContain("R030");
    expect(email.body).toContain("Python");
    expect(email.body).toContain("Ana Silva");
  });

  it("nunca inclui link que não esteja no perfil (sem github/site aqui)", () => {
    const email = generateEmail(baseInput, { rng: pickFirst });
    expect(email.body).not.toMatch(/https?:\/\//);
  });

  it("inclui o github na assinatura só quando o perfil tem um", () => {
    const withGithub: EmailTemplateInput = {
      ...baseInput,
      candidate: { ...baseInput.candidate, github: "github.com/anasilva" },
    };
    // Varre várias sementes pra achar uma variante de assinatura com github.
    const emails = Array.from({ length: 40 }, (_, i) =>
      generateEmail(withGithub, { rng: () => (i % 40) / 40 }),
    );
    expect(emails.some((e) => e.body.includes("github.com/anasilva"))).toBe(true);
    // E o e-mail sem github nunca inventa um.
    const withoutGithub = Array.from({ length: 40 }, (_, i) =>
      generateEmail(baseInput, { rng: () => (i % 40) / 40 }),
    );
    expect(withoutGithub.every((e) => !e.body.includes("github.com"))).toBe(true);
  });

  it("omite o parágrafo de skills parciais quando só há 1 skill de match", () => {
    const oneMatch: EmailTemplateInput = {
      ...baseInput,
      job: {
        ...baseInput.job,
        skills: [
          { name: "Python", verdict: "match" },
          { name: "Kafka", verdict: "partial" },
        ],
      },
    };
    const email = generateEmail(oneMatch, { rng: pickFirst });
    expect(email.body).not.toContain("Kafka");
  });

  it("omite o parágrafo de skills parciais quando não há nenhuma parcial", () => {
    const noPartial: EmailTemplateInput = {
      ...baseInput,
      job: { ...baseInput.job, skills: [{ name: "Python", verdict: "match" }, { name: "FastAPI", verdict: "match" }] },
    };
    const email = generateEmail(noPartial, { rng: pickFirst });
    // Nenhuma menção a "área em evolução"/skill parcial nesse cenário.
    expect(email.body.toLowerCase()).not.toContain("evolução");
  });

  it("inclui o parágrafo de parciais quando há 2+ matches e alguma parcial", () => {
    const email = generateEmail(baseInput, { rng: pickFirst });
    expect(email.body).toContain("Kafka");
  });

  it("usa saudação sem empresa quando a vaga não trouxe empresa", () => {
    const noCompany: EmailTemplateInput = { ...baseInput, job: { ...baseInput.job, company: "" } };
    const email = generateEmail(noCompany, { rng: pickFirst });
    expect(email.body).not.toMatch(/time da\s*[,!]/i);
  });

  it("usa um cargo genérico quando a vaga não trouxe cargo", () => {
    const noRole: EmailTemplateInput = { ...baseInput, job: { ...baseInput.job, role: "" } };
    const email = generateEmail(noRole, { rng: pickFirst });
    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.body.length).toBeGreaterThan(0);
  });

  it("produz um corpo com várias quebras de parágrafo, terminando na assinatura", () => {
    const email = generateEmail(baseInput, { rng: pickFirst });
    const blocks = email.body.split("\n\n").filter(Boolean);
    expect(blocks.length).toBeGreaterThanOrEqual(4);
    expect(email.body.trim().endsWith("Ana Silva")).toBe(true);
  });

  it("varia a saída entre chamadas (não é sempre o mesmo texto)", () => {
    const emails = Array.from({ length: 20 }, () => generateEmail(baseInput));
    const unique = new Set(emails.map((e) => e.subject + e.body));
    expect(unique.size).toBeGreaterThan(1);
  });

  it("respeita recentIndices evitando repetir o mesmo índice quando há alternativa", () => {
    // pickFirst normalmente escolheria sempre o índice 0; com 0 marcado como
    // recente, deve escolher outro candidato disponível.
    const email = generateEmail(baseInput, {
      rng: pickFirst,
      recentIndices: { closing: [0] },
    });
    // Não afirmamos qual índice sai, só que o e-mail continua válido.
    expect(email.body.length).toBeGreaterThan(0);
    expect(email.usedIndices.closing).not.toBe(0);
  });

  it("devolve usedIndices, e reenviá-los como recentIndices muda o texto (regressão do 'Gerar de novo')", () => {
    const first = generateEmail(baseInput, { rng: pickFirst });
    expect(first.usedIndices.closing).toBeDefined();

    const second = generateEmail(baseInput, {
      rng: pickFirst,
      recentIndices: { closing: [first.usedIndices.closing!] },
    });

    expect(second.usedIndices.closing).not.toBe(first.usedIndices.closing);
  });

  it("last-candidate rng também produz e-mail válido (extremos do sorteio)", () => {
    const email = generateEmail(baseInput, { rng: pickLast });
    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.body.length).toBeGreaterThan(0);
  });
});

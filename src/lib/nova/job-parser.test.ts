import { describe, it, expect } from "vitest";
import { parseJobText } from "./job-parser";

describe("parseJobText", () => {
  it("extrai empresa/cargo/modelo/e-mail com rótulos explícitos (estilo copy-paste com labels)", () => {
    const text = `Vaga: Desenvolvedor(a) Back-end Pleno
Empresa: R030
Modelo: PJ · Remoto

Buscamos alguém com experiência em Python, FastAPI, PostgreSQL e Docker, atuando em APIs assíncronas. Diferencial: GraphQL e mensageria (Kafka).

Envie seu CV para rh@r030.tech
Fonte: LinkedIn`;

    const result = parseJobText(text, ["Python", "FastAPI", "PostgreSQL", "Docker"]);

    expect(result.company).toBe("R030");
    expect(result.role).toBe("Desenvolvedor(a) Back-end Pleno");
    expect(result.work_model).toBe("PJ · Remoto");
    expect(result.contact_email).toBe("rh@r030.tech");
    expect(result.source).toBe("LinkedIn");
  });

  it("acha o cargo por heurística de palavra-chave quando não há rótulo", () => {
    const text = `Analista de Dados Sênior

Trabalhando com SQL, Power BI e Python no time de growth. Remoto, CLT.`;
    const result = parseJobText(text, []);
    expect(result.role).toContain("Analista de Dados Sênior");
    expect(result.work_model).toBe("CLT · Remoto");
  });

  it("deixa empresa vazia quando não há rótulo explícito", () => {
    const text = `Desenvolvedor(a) Frontend Pleno — vaga remota, PJ. Buscamos experiência em React e TypeScript.`;
    const result = parseJobText(text, ["React"]);
    expect(result.company).toBe("");
  });

  it("classifica match, partial e miss comparando com o perfil do candidato", () => {
    const text = `Vaga: Engenheiro de Dados
Requisitos: Python, Kafka, GraphQL, Rust`;
    const result = parseJobText(text, ["Python", "RabbitMQ"]);

    const byName = Object.fromEntries(result.skills.map((s) => [s.name, s.verdict]));
    expect(byName["Python"]).toBe("match");
    expect(byName["Kafka"]).toBe("partial"); // candidato tem RabbitMQ, adjacente
    expect(byName["GraphQL"]).toBe("miss");
    expect(byName["Rust"]).toBe("miss");
  });

  it("reconhece aliases de skill (postgres, nodejs, k8s...)", () => {
    // "js" não é alias de JavaScript de propósito — colide com o ".js" de
    // Node.js/Vue.js/Next.js (ver skill-taxonomy.ts).
    const text = `Vaga: Backend Pleno. Requisitos: postgres, nodejs, k8s.`;
    const result = parseJobText(text, ["PostgreSQL", "Node.js", "Kubernetes"]);
    const names = result.skills.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(["PostgreSQL", "Node.js", "Kubernetes"]));
    expect(result.skills.every((s) => s.verdict === "match")).toBe(true);
  });

  it("limita a 8 skills, na ordem em que aparecem no texto", () => {
    const text = `Vaga: Full-stack. Requisitos: Python, TypeScript, React, Node.js, PostgreSQL, Docker, Kubernetes, AWS, GraphQL, Redis.`;
    const result = parseJobText(text, []);
    expect(result.skills).toHaveLength(8);
    expect(result.skills[0].name).toBe("Python");
    expect(result.skills[7].name).toBe("AWS");
  });

  it("contact_email vazio quando o texto tem mais de um e-mail (ambíguo)", () => {
    const text = `Vaga: Suporte N2. Contato: rh@empresa.com. Privacidade: privacidade@empresa.com.`;
    const result = parseJobText(text, []);
    expect(result.contact_email).toBe("");
  });

  it("nota de fallback quando nenhuma skill reconhecida bate ou é parcial", () => {
    const text = `Vaga: Analista Administrativo. Requisitos: organização e proatividade.`;
    const result = parseJobText(text, ["Python"]);
    expect(result.skills).toHaveLength(0);
    expect(result.note).toMatch(/nenhuma skill técnica clara/i);
  });

  it("não duplica skill quando uma é substring de outra mais específica (React Native, SQL Server)", () => {
    const text = `Vaga: Mobile Pleno. Requisitos: React Native, SQL Server, Firebase.`;
    const result = parseJobText(text, []);
    const names = result.skills.map((s) => s.name);
    expect(names).toContain("React Native");
    expect(names).toContain("SQL Server");
    expect(names).not.toContain("React");
    expect(names).not.toContain("SQL");
  });

  it("nota cita as skills que batem e as parciais", () => {
    const text = `Vaga: Backend. Requisitos: Python, Kafka.`;
    const result = parseJobText(text, ["Python", "RabbitMQ"]);
    expect(result.note).toContain("Python");
    expect(result.note).toContain("Kafka");
  });
});

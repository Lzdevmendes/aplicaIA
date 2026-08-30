import { EmailSchema, type GeneratedEmail, type JobExtraction } from "@/lib/ai/job-schemas";
import { stripUnknownLinks } from "@/lib/ai/link-guard";
import { joinNatural } from "./job-text";
import {
  OPENING_WITH_COMPANY,
  OPENING_NO_COMPANY,
  SKILLS_MATCH,
  SKILLS_PARTIAL,
  CLOSING,
  SIGNATURE,
  SUBJECT,
  type Phrase,
  type PhraseContext,
} from "./email-phrases";

export type EmailTemplateInput = {
  candidate: {
    fullName: string;
    headline: string;
    summary: string;
    github: string;
    website: string;
  };
  job: {
    company: string;
    role: string;
    skills: JobExtraction["skills"];
  };
};

export type Category = "opening" | "skillsMatch" | "skillsPartial" | "closing" | "signature" | "subject";

/** Cargo genérico quando o parser não conseguiu identificar o da vaga. */
const FALLBACK_ROLE = "posição em aberto";

function pick(
  phrases: Phrase[],
  ctx: PhraseContext,
  rng: () => number,
  recent: number[] = [],
): { text: string; index: number } | null {
  const candidates = phrases
    .map((fn, index) => ({ index, text: fn(ctx) }))
    .filter((p): p is { index: number; text: string } => p.text !== null);
  if (candidates.length === 0) return null;

  // Evita repetir um índice usado recentemente na mesma categoria, quando dá
  // pra escolher outra coisa — best-effort, não é garantia (ver email-template.ts).
  const fresh = candidates.filter((c) => !recent.includes(c.index));
  const pool = fresh.length > 0 ? fresh : candidates;
  // Clampa pro último índice válido: rng()===1 faria Math.floor bater em
  // pool.length (fora dos limites), descartando o parágrafo em silêncio.
  return pool[Math.min(Math.floor(rng() * pool.length), pool.length - 1)];
}

/**
 * Regras de supressão do parágrafo de skills parciais (ver design em
 * email-phrases.ts): nunca se a lista estiver vazia; nunca se só há 1 skill
 * de match no total (o e-mail vira "sei pouco e o resto estou aprendendo").
 */
function shouldIncludePartial(matchCount: number, partialCount: number): boolean {
  if (partialCount === 0) return false;
  if (matchCount <= 1) return false;
  return true;
}

export type EmailTemplateResult = GeneratedEmail & {
  /** Índice sorteado por categoria — devolver ao cliente permite marcar
   * como "recente" no próximo "Gerar de novo" e evitar repetir o texto. */
  usedIndices: Partial<Record<Category, number>>;
};

/**
 * Gera o e-mail de candidatura por template determinístico — sem IA. Troca
 * naturalidade adaptativa por zero custo e zero dependência de cota externa;
 * a variedade vem do banco de frases (email-phrases.ts) sorteado por
 * categoria a cada chamada.
 */
export function generateEmail(
  input: EmailTemplateInput,
  opts: { rng?: () => number; recentIndices?: Partial<Record<Category, number[]>> } = {},
): EmailTemplateResult {
  const rng = opts.rng ?? Math.random;
  const recent = opts.recentIndices ?? {};

  const matches = input.job.skills.filter((s) => s.verdict === "match").map((s) => s.name);
  const partials = input.job.skills.filter((s) => s.verdict === "partial").map((s) => s.name);

  const ctx: PhraseContext = {
    nome: input.candidate.fullName || "Candidato",
    empresa: input.job.company,
    cargo: input.job.role || FALLBACK_ROLE,
    headline: input.candidate.headline,
    summary: input.candidate.summary,
    github: input.candidate.github,
    site: input.candidate.website,
    skillsMatchText: joinNatural(matches),
    skillTop: matches[0] ?? "",
    skillsRestText: joinNatural(matches.slice(1)),
    skillsPartialText: joinNatural(partials),
  };

  const opening = ctx.empresa
    ? pick(OPENING_WITH_COMPANY, ctx, rng, recent.opening)
    : pick(OPENING_NO_COMPANY, ctx, rng, recent.opening);
  const skillsMatchParagraph = matches.length > 0 ? pick(SKILLS_MATCH, ctx, rng, recent.skillsMatch) : null;
  const skillsPartialParagraph = shouldIncludePartial(matches.length, partials.length)
    ? pick(SKILLS_PARTIAL, ctx, rng, recent.skillsPartial)
    : null;
  const closing = pick(CLOSING, ctx, rng, recent.closing);
  const signature = pick(SIGNATURE, ctx, rng, recent.signature);
  const subject = pick(SUBJECT, ctx, rng, recent.subject);

  const paragraphs = [
    opening?.text,
    skillsMatchParagraph?.text,
    skillsPartialParagraph?.text,
    closing?.text,
    signature?.text,
  ].filter((p): p is string => !!p);

  const body = paragraphs.join("\n\n");

  // Rede de segurança extra: mesmo controlando os links por construção
  // (só github/website do perfil, nunca inventados), roda o mesmo guard que
  // a rota do Gemini usava.
  const knownLinks = [input.candidate.github, input.candidate.website].filter(Boolean);
  const { body: cleanBody } = stripUnknownLinks(body, knownLinks);

  const result: GeneratedEmail = {
    subject: subject?.text ?? `Candidatura — ${ctx.cargo}`,
    body: cleanBody,
  };
  const parsed = EmailSchema.safeParse(result);
  const validated = parsed.success ? parsed.data : result;

  const usedIndices: Partial<Record<Category, number>> = {};
  if (opening) usedIndices.opening = opening.index;
  if (skillsMatchParagraph) usedIndices.skillsMatch = skillsMatchParagraph.index;
  if (skillsPartialParagraph) usedIndices.skillsPartial = skillsPartialParagraph.index;
  if (closing) usedIndices.closing = closing.index;
  if (signature) usedIndices.signature = signature.index;
  if (subject) usedIndices.subject = subject.index;

  return { ...validated, usedIndices };
}

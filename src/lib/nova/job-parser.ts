import { JobExtractionSchema, type JobExtraction } from "@/lib/ai/job-schemas";
import { extractEmail } from "./email";
import { cleanJobText, joinNatural } from "./job-text";
import { KNOWN_SKILLS, SKILL_ALIASES, PARTIAL_ADJACENCY, toCanonicalSkill } from "./skill-taxonomy";

const MAX_SKILLS = 8;

const JOB_BOARDS = [
  "LinkedIn",
  "Gupy",
  "Kenoby",
  "Indeed",
  "InfoJobs",
  "Catho",
  "Vagas.com",
  "Glassdoor",
  "Trampos.co",
  "Programathor",
];

const CONTRACT_TOKENS: [RegExp, string][] = [
  [/\bpj\b/i, "PJ"],
  [/\bclt\b/i, "CLT"],
  [/pessoa jur[íi]dica/i, "PJ"],
];

const LOCATION_TOKENS: [RegExp, string][] = [
  [/\bremoto\b/i, "Remoto"],
  [/\bh[íi]brido\b/i, "Híbrido"],
  [/\bpresencial\b/i, "Presencial"],
];

const COMPANY_LABEL = /empresa:\s*(.+)/i;
const ROLE_LABELS = [/vaga:\s*(.+)/i, /cargo:\s*(.+)/i, /t[íi]tulo:\s*(.+)/i, /posi[cç][ãa]o:\s*(.+)/i];

const ROLE_KEYWORDS =
  /\b(desenvolvedor|desenvolvedora|engenheiro|engenheira|analista|designer|product manager|gerente|coordenador|coordenadora|especialista|estagi[áa]rio|estagi[áa]ria|cientista de dados|arquiteto|arquiteta|devops|full[- ]?stack|front[- ]?end|back[- ]?end)\b/i;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Posição e tamanho da primeira ocorrência de uma skill (ou algum alias dela) no texto, ou null. */
function firstMatchOfSkill(skill: string, text: string): { index: number; length: number } | null {
  const terms = [skill, ...(SKILL_ALIASES[skill] ?? [])];
  let best: { index: number; length: number } | null = null;
  for (const term of terms) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(term)}(?![\\p{L}\\p{N}])`, "iu");
    const m = re.exec(text);
    if (m && (best === null || m.index < best.index)) best = { index: m.index, length: m[0].length };
  }
  return best;
}

function extractWorkModel(text: string): string {
  const contract = CONTRACT_TOKENS.find(([re]) => re.test(text))?.[1];
  const location = LOCATION_TOKENS.find(([re]) => re.test(text))?.[1];
  return [contract, location].filter(Boolean).join(" · ");
}

function extractSource(text: string): string {
  const lower = text.toLowerCase();
  return JOB_BOARDS.find((board) => lower.includes(board.toLowerCase())) ?? "";
}

function extractCompany(text: string): string {
  const m = COMPANY_LABEL.exec(text);
  return m?.[1] ? m[1].trim().replace(/\s+/g, " ") : "";
}

function extractRole(text: string): string {
  for (const re of ROLE_LABELS) {
    const m = re.exec(text);
    if (m?.[1]) return m[1].trim().replace(/\s+/g, " ");
  }

  // Sem rótulo explícito: procura nas primeiras linhas uma que pareça título
  // de cargo (contém palavra de cargo — "Desenvolvedor", "Analista" etc).
  const line = text.split("\n").slice(0, 6).find((l) => ROLE_KEYWORDS.test(l));
  return line ? line.trim().replace(/\s+/g, " ") : "";
}

function extractSkills(text: string, candidateSkills: string[]): JobExtraction["skills"] {
  const candidateCanonical = new Set(candidateSkills.map(toCanonicalSkill));

  const matched = KNOWN_SKILLS.map((skill) => ({ skill, match: firstMatchOfSkill(skill, text) })).filter(
    (s): s is { skill: string; match: { index: number; length: number } } => s.match !== null,
  );

  // Quando uma skill só aparece como parte de outra mais específica no mesmo
  // trecho (ex.: "React" dentro de "React Native", "SQL" dentro de "SQL
  // Server"), mantém só a mais longa — evita duas entradas redundantes ou
  // contraditórias pra um único requisito da vaga.
  const deduped = matched.filter(({ skill, match }) =>
    !matched.some(({ skill: otherSkill, match: other }) => {
      if (otherSkill === skill) return false;
      const end = match.index + match.length;
      const otherEnd = other.index + other.length;
      return other.index <= match.index && otherEnd >= end && other.length > match.length;
    }),
  );

  const found = deduped.sort((a, b) => a.match.index - b.match.index).slice(0, MAX_SKILLS);

  return found.map(({ skill }) => {
    if (candidateCanonical.has(skill)) return { name: skill, verdict: "match" as const };
    const adjacent = PARTIAL_ADJACENCY[skill] ?? [];
    if (adjacent.some((a) => candidateCanonical.has(a))) return { name: skill, verdict: "partial" as const };
    return { name: skill, verdict: "miss" as const };
  });
}

function buildNote(skills: JobExtraction["skills"]): string {
  const matches = skills.filter((s) => s.verdict === "match").map((s) => s.name);
  const partials = skills.filter((s) => s.verdict === "partial").map((s) => s.name);

  if (matches.length === 0 && partials.length === 0) {
    return "Nenhuma skill técnica clara em comum — destaque sua experiência e o interesse na vaga.";
  }

  const sentences: string[] = [];
  if (matches.length) sentences.push(`Enfatize ${joinNatural(matches)}.`);
  if (partials.length) sentences.push(`${joinNatural(partials)} você pode citar como área em evolução.`);
  return sentences.join(" ");
}

/**
 * Extrai os dados de uma vaga colada como texto, sem IA: rótulos explícitos
 * ("Empresa:", "Vaga:") quando existem, heurísticas de regex quando não, e o
 * dicionário de skill-taxonomy.ts pro match contra o perfil do candidato.
 *
 * Sem confiança suficiente num campo, ele fica vazio — mesma regra que o
 * prompt do Gemini já seguia ("vazio em vez de inventar"), agora garantida
 * por construção em vez de instrução.
 */
export function parseJobText(rawText: string, candidateSkills: string[]): JobExtraction {
  const text = cleanJobText(rawText);
  const skills = extractSkills(text, candidateSkills);

  const result: JobExtraction = {
    company: extractCompany(text),
    role: extractRole(text),
    work_model: extractWorkModel(text),
    source: extractSource(text),
    contact_email: extractEmail(text),
    skills,
    note: buildNote(skills),
  };

  // Rede de segurança estrutural — o shape acima já bate com o schema, mas
  // vale a validação explícita (é código nosso, mas ainda é código).
  const parsed = JobExtractionSchema.safeParse(result);
  return parsed.success ? parsed.data : result;
}

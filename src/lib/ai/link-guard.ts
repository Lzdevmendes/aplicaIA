/**
 * Última linha de defesa contra o modelo inventar um link plausível no corpo
 * do e-mail (github/site/portfólio) que não é nenhum dos links reais do
 * perfil. O prompt já pede para nunca inventar — isto pega o que passar.
 */

function normalize(link: string): string {
  return link
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

const URL_RE = /\bhttps?:\/\/[^\s<>"')]+|\bwww\.[^\s<>"')]+/gi;

export function stripUnknownLinks(
  body: string,
  knownLinks: string[],
): { body: string; stripped: string[] } {
  const known = knownLinks.filter(Boolean).map(normalize);
  const stripped: string[] = [];

  const next = body.replace(URL_RE, (match) => {
    const norm = normalize(match);
    const isKnown = known.some((k) => norm.includes(k) || k.includes(norm));
    if (isKnown) return match;
    stripped.push(match);
    return "";
  });

  return { body: next, stripped };
}

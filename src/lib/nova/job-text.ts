/**
 * Pré-limpeza determinística do texto colado da vaga: tira espaços/quebras
 * redundantes e linhas em branco ou repetidas em sequência (comum em
 * copy-paste de página com menu/rodapé). Usado antes do parser próprio
 * (job-parser.ts) e, no branch de print, antes do Gemini.
 */
export function cleanJobText(text: string): string {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim());

  const deduped: string[] = [];
  for (const line of lines) {
    const prev = deduped[deduped.length - 1];
    if (line === "" && prev === "") continue;
    if (line !== "" && line === prev) continue;
    deduped.push(line);
  }

  return deduped.join("\n").trim();
}

/** Junta uma lista em português natural: "X", "X e Y", "X, Y e Z". */
export function joinNatural(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/**
 * Validação leve de e-mail — o bastante para pegar o caso que quebra o envio
 * (extração da vaga trouxe lixo tipo "fulano arroba empresa" ou string vazia)
 * sem tentar validar RFC 5322 inteira.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

const EMAIL_SCAN_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

/**
 * Fallback determinístico: quando o Gemini não achou o e-mail de contato (ou
 * a chamada falhou), procura um endereço óbvio no texto colado da vaga. Só
 * retorna algo quando há exatamente um candidato — mais de um é ambíguo
 * (rodapé com e-mail de privacidade, por exemplo) e vazio é melhor que errado.
 */
export function extractEmail(text: string): string {
  const matches = [...new Set(text.match(EMAIL_SCAN_RE) ?? [])].filter(isValidEmail);
  return matches.length === 1 ? matches[0] : "";
}

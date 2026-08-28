/**
 * Monta o link que abre um rascunho pré-preenchido no Gmail web.
 *
 * É o fallback enquanto a verificação OAuth do Google não sai: o e-mail não é
 * enviado pela API, o usuário confere, anexa o CV na mão e clica enviar. O
 * anexo não vai automático por aqui — o Gmail não aceita anexo por URL.
 */

/**
 * Remove caracteres de controle (byte nulo, etc.) preservando quebras de linha.
 * Blindagem: se o texto chegar corrompido (ex.: uma geração antiga com bytes
 * nulos no lugar de acentos), o rascunho do Gmail sai limpo em vez de com
 * quadradinhos que o recrutador veria.
 */
function stripControl(s: string): string {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

// Limite conservador para o parâmetro `body`: navegadores e o próprio Gmail
// toleram URLs bem mais longas que isso, mas corpos gerados muito longos não
// têm por que se arriscar — corta e avisa em vez de deixar o link falhar.
const MAX_BODY_CHARS = 6000;
const TRUNCATION_NOTE = "\n\n[continue direto no Gmail — texto cortado aqui]";

/** true se o corpo passaria do limite e seria cortado por gmailComposeUrl. */
export function wouldTruncate(body: string): boolean {
  return stripControl(body).length > MAX_BODY_CHARS;
}

export function gmailComposeUrl(params: {
  to: string;
  subject: string;
  body: string;
}) {
  let body = stripControl(params.body);
  if (body.length > MAX_BODY_CHARS) {
    body = body.slice(0, MAX_BODY_CHARS - TRUNCATION_NOTE.length) + TRUNCATION_NOTE;
  }

  const q = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: params.to,
    su: stripControl(params.subject),
    body,
  });
  return `https://mail.google.com/mail/?${q.toString()}`;
}

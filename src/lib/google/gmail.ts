/**
 * Envio pela API do Gmail. Server-side apenas.
 *
 * O refresh token do usuário fica em google_accounts (tabela sem policy, só
 * service_role). Aqui ele vira um access token de curta duração e o e-mail é
 * montado como MIME multipart com o CV anexado.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";
const SEND_ENDPOINT =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

function googleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET não configurados");
  }
  return { clientId, clientSecret };
}

/** Troca o refresh token por um access token fresco. */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = googleCredentials();

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.access_token) {
    // invalid_grant = usuário revogou o acesso ou o refresh token expirou.
    console.error("[gmail] refresh token falhou", res.status, JSON.stringify(json));
    throw new Error(json.error_description ?? json.error ?? "falha ao renovar o token");
  }
  return json.access_token as string;
}

/**
 * Troca o `code` do fluxo "Conectar Gmail" (OAuth avulso, fora do login) por
 * um refresh token. Usado só em /api/google/connect/callback.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const { clientId, clientSecret } = googleCredentials();

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.access_token || !json.refresh_token) {
    throw new Error(
      json.error_description ?? json.error ?? "falha ao trocar o código pelo token",
    );
  }
  return { accessToken: json.access_token as string, refreshToken: json.refresh_token as string };
}

/** E-mail da conta Google que acabou de conceder acesso. */
export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json();
  if (!res.ok || !json.email) {
    throw new Error(json.error?.message ?? "falha ao obter o e-mail da conta Google");
  }
  return json.email as string;
}

/** Revoga o refresh token no Google. Best-effort — usado ao desconectar. */
export async function revokeToken(token: string): Promise<void> {
  await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}

export type EmailAttachment = {
  filename: string;
  mimeType: string;
  /** Conteúdo em base64 (sem quebras de linha). */
  base64: string;
};

/**
 * Monta a mensagem MIME (multipart/mixed) com corpo em texto e um anexo.
 * Função pura — a base do teste isolado do envio.
 */
export function buildMimeMessage(params: {
  to: string;
  from: string;
  subject: string;
  body: string;
  attachment?: EmailAttachment;
}): string {
  const boundary = `aplicaai_${Math.random().toString(36).slice(2)}`;
  // RFC 2047 para acento no assunto.
  const subjectEncoded = `=?UTF-8?B?${Buffer.from(params.subject, "utf-8").toString("base64")}?=`;

  const headers = [
    `To: ${params.to}`,
    `From: ${params.from}`,
    `Subject: ${subjectEncoded}`,
    "MIME-Version: 1.0",
  ];

  if (!params.attachment) {
    return [
      ...headers,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(params.body, "utf-8").toString("base64"),
    ].join("\r\n");
  }

  const a = params.attachment;
  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(params.body, "utf-8").toString("base64"),
    "",
    `--${boundary}`,
    `Content-Type: ${a.mimeType}; name="${a.filename}"`,
    `Content-Disposition: attachment; filename="${a.filename}"`,
    "Content-Transfer-Encoding: base64",
    "",
    a.base64,
    "",
    `--${boundary}--`,
  ].join("\r\n");
}

/** base64url sem padding, como a API do Gmail espera no campo `raw`. */
export function toBase64Url(mime: string): string {
  return Buffer.from(mime, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Envia e devolve o id da mensagem no Gmail. */
export async function sendGmail(params: {
  accessToken: string;
  mime: string;
}): Promise<string> {
  const res = await fetch(SEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: toBase64Url(params.mime) }),
  });

  const json = await res.json();
  if (!res.ok || !json.id) {
    console.error("[gmail] send falhou", res.status, JSON.stringify(json));
    throw new Error(json.error?.message ?? "falha ao enviar pelo Gmail");
  }
  return json.id as string;
}

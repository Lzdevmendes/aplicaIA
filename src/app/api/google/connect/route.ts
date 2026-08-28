import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const STATE_COOKIE = "google_connect_state";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

/**
 * Início do fluxo "Conectar Gmail" — OAuth avulso, fora do signInWithOAuth do
 * login. Pede só gmail.send (+ email, para exibir a conta conectada), com
 * consentimento próprio: quem clica aqui já sabe que vai autorizar o envio de
 * e-mails, diferente do login que não deveria pedir esse escopo.
 */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(`${origin}/perfil?erro=google_nao_configurado`);
  }

  const state = randomBytes(16).toString("hex");

  const authUrl = new URL(AUTH_ENDPOINT);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set(
    "redirect_uri",
    `${origin}/api/google/connect/callback`,
  );
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set(
    "scope",
    "https://www.googleapis.com/auth/gmail.send email",
  );
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/google/connect",
  });
  return response;
}

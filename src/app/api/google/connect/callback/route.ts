import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/crypto";
import { exchangeCodeForTokens, fetchGoogleEmail } from "@/lib/google/gmail";

const STATE_COOKIE = "google_connect_state";

/**
 * Callback do fluxo "Conectar Gmail". Troca o code, grava o refresh token
 * cifrado em google_accounts — nunca mexe na sessão de login do Supabase.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const googleError = searchParams.get("error");

  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  // Limpa o cookie de state incondicionalmente — de uso único.
  function withClearedState(res: NextResponse) {
    res.cookies.set(STATE_COOKIE, "", { path: "/api/google/connect", maxAge: 0 });
    return res;
  }

  if (googleError) {
    return withClearedState(
      NextResponse.redirect(`${origin}/perfil?erro=gmail_recusado`),
    );
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return withClearedState(
      NextResponse.redirect(`${origin}/perfil?erro=estado_invalido`),
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return withClearedState(NextResponse.redirect(`${origin}/login`));
  }

  try {
    const { accessToken, refreshToken } = await exchangeCodeForTokens(
      code,
      `${origin}/api/google/connect/callback`,
    );
    const email = await fetchGoogleEmail(accessToken);

    const admin = createAdminClient();
    await admin.from("google_accounts").upsert({
      user_id: user.id,
      email,
      refresh_token: encryptToken(refreshToken),
      scopes: ["https://www.googleapis.com/auth/gmail.send"],
    });

    return withClearedState(
      NextResponse.redirect(`${origin}/perfil?gmail=conectado`),
    );
  } catch (err) {
    console.error("[google/connect/callback]", err);
    return withClearedState(
      NextResponse.redirect(`${origin}/perfil?erro=falha_conectar_gmail`),
    );
  }
}

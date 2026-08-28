import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Troca o `code` do OAuth pela sessão e manda o usuário para dentro do app.
 *
 * Login com Google só pede escopo de perfil/e-mail — não grava nada em
 * google_accounts. Conectar o Gmail (gmail.send) é um fluxo à parte, iniciado
 * em /perfil e resolvido em /api/google/connect/callback.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/nova";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?erro=sem_codigo`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?erro=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}

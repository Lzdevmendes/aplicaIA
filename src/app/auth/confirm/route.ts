import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Verifica o token_hash que o Supabase manda por e-mail (link mágico,
 * confirmação de cadastro, recuperação de senha) e cria a sessão via cookie.
 *
 * Um único handler para os três fluxos: o `type` vem do próprio link do
 * Supabase e diz qual deles é.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/nova";

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?erro=link_invalido`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?erro=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}

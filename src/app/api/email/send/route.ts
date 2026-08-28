import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto";
import {
  refreshAccessToken,
  buildMimeMessage,
  sendGmail,
  type EmailAttachment,
} from "@/lib/google/gmail";
import { enforceRateLimits, RateLimitError, SEND_LIMITS } from "@/lib/ratelimit";

export const maxDuration = 60;

/**
 * Envia a candidatura pela API do Gmail, com o CV anexado.
 *
 * Só entra em ação para quem conectou o Gmail em /perfil (existe linha em
 * google_accounts) — a página /nova decide isso por usuário, não por env var.
 * Quem não conectou usa o deep link e nem chega aqui.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  try {
    await enforceRateLimits(supabase, SEND_LIMITS);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Limite de envios atingido. Tente mais tarde." },
        { status: 429 },
      );
    }
    throw err;
  }

  const body = await request.json().catch(() => null);
  const applicationId: string | undefined = body?.applicationId;
  const to: string | undefined = body?.to;
  const subject: string | undefined = body?.subject;
  const emailBody: string | undefined = body?.body;

  if (!to || !subject || !emailBody) {
    return NextResponse.json({ error: "dados do e-mail incompletos" }, { status: 400 });
  }

  // Refresh token vive em google_accounts (sem RLS) — só o admin client lê.
  // Por isso o filtro por user_id é manual e obrigatório aqui.
  const admin = createAdminClient();
  const { data: account } = await admin
    .from("google_accounts")
    .select("refresh_token, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account) {
    return NextResponse.json(
      { error: "Conecte sua conta Google para enviar pelo Gmail." },
      { status: 400 },
    );
  }

  // CV corrente vira anexo (opcional — dá para enviar sem).
  let attachment: EmailAttachment | undefined;
  const { data: cv } = await supabase
    .from("cv_files")
    .select("storage_path, filename")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .maybeSingle();

  if (cv) {
    const { data: blob } = await supabase.storage.from("cvs").download(cv.storage_path);
    if (blob) {
      attachment = {
        filename: cv.filename,
        mimeType: "application/pdf",
        base64: Buffer.from(await blob.arrayBuffer()).toString("base64"),
      };
    }
  }

  try {
    const accessToken = await refreshAccessToken(decryptToken(account.refresh_token));
    const mime = buildMimeMessage({
      to,
      from: account.email || user.email || "",
      subject,
      body: emailBody,
      attachment,
    });
    const gmailMessageId = await sendGmail({ accessToken, mime });

    // Marca a candidatura como enviada e registra o id da mensagem.
    if (applicationId) {
      await supabase
        .from("applications")
        .update({ status: "enviada", applied_at: new Date().toISOString() })
        .eq("id", applicationId);
      await supabase
        .from("application_emails")
        .update({ sent_at: new Date().toISOString(), gmail_message_id: gmailMessageId })
        .eq("application_id", applicationId);
    }

    return NextResponse.json({ ok: true, gmailMessageId });
  } catch (err) {
    console.error("[email/send]", err);
    return NextResponse.json(
      { error: "Falha ao enviar o e-mail. Tente de novo." },
      { status: 500 },
    );
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gemini, MODEL, THINKING, toGeminiSchema, withRetry, type Part } from "@/lib/ai/gemini";
import { loadProfileContext } from "@/lib/db/profile";
import { jobExtractSystem, JOB_EXTRACT_USER_IMAGE } from "@/lib/ai/prompts";
import { JobExtractionSchema } from "@/lib/ai/job-schemas";
import { enforceRateLimits, RateLimitError, AI_LIMITS } from "@/lib/ratelimit";
import { isValidEmail } from "@/lib/nova/email";
import { parseJobText } from "@/lib/nova/job-parser";

// 120s: dá espaço pro withRetry (até 6 tentativas em 503) no branch de imagem.
export const maxDuration = 120;

const IMAGE_MEDIA = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
type ImageMedia = (typeof IMAGE_MEDIA)[number];

// Caps de entrada: protegem memória e a cota do Gemini contra payloads abusivos.
const MAX_JOB_TEXT = 20_000; // caracteres
const MAX_IMAGE_B64 = 7_000_000; // ~5 MB de imagem em base64

/**
 * Recebe o texto ou o print de uma vaga e devolve os metadados + o match de
 * skills contra o perfil.
 *
 * Texto colado: parser próprio, determinístico, sem IA (job-parser.ts) — é o
 * caminho dominante e não depende mais da cota do Gemini. Print: continua no
 * Gemini, porque ler imagem sem OCR só o modelo faz (AGENTS.md proíbe OCR).
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
    await enforceRateLimits(supabase, AI_LIMITS);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde um instante e tente de novo." },
        { status: 429 },
      );
    }
    throw err;
  }

  const body = await request.json().catch(() => null);
  const jobText: string | undefined = body?.text;
  const imageData: string | undefined = body?.imageBase64;
  const imageMedia: string | undefined = body?.imageMediaType;

  if (typeof jobText === "string" && jobText.length > MAX_JOB_TEXT) {
    return NextResponse.json({ error: "Texto da vaga muito longo." }, { status: 413 });
  }
  if (typeof imageData === "string" && imageData.length > MAX_IMAGE_B64) {
    return NextResponse.json({ error: "Imagem muito grande (máx. ~5 MB)." }, { status: 413 });
  }

  if (typeof jobText === "string" && jobText.trim().length > 0) {
    const profile = await loadProfileContext(supabase, user.id);
    return NextResponse.json(parseJobText(jobText, profile.skills));
  }

  if (!imageData || !IMAGE_MEDIA.includes(imageMedia as ImageMedia)) {
    return NextResponse.json(
      { error: "envie o texto da vaga ou um print válido" },
      { status: 400 },
    );
  }

  const parts: Part[] = [
    { inlineData: { mimeType: imageMedia as ImageMedia, data: imageData } },
    { text: JOB_EXTRACT_USER_IMAGE },
  ];

  const profile = await loadProfileContext(supabase, user.id);

  async function generateOnce(contentParts: Part[]): Promise<string | undefined> {
    const response = await withRetry(() =>
      gemini().models.generateContent({
        model: MODEL,
        config: {
          systemInstruction: jobExtractSystem(profile.skills),
          responseMimeType: "application/json",
          responseJsonSchema: toGeminiSchema(JobExtractionSchema),
          thinkingConfig: THINKING,
        },
        contents: [{ role: "user", parts: contentParts }],
      }),
    );
    return response.text;
  }

  /** JSON.parse + safeParse num pacote só, sem lançar em payload inválido. */
  function tryParse(text: string | undefined) {
    if (!text) return { success: false as const, issues: undefined };
    try {
      const result = JobExtractionSchema.safeParse(JSON.parse(text));
      return result.success
        ? { success: true as const, data: result.data }
        : { success: false as const, issues: result.error.issues };
    } catch {
      return { success: false as const, issues: undefined };
    }
  }

  try {
    let text = await generateOnce(parts);
    let parsed = tryParse(text);

    if (!parsed.success) {
      console.error(
        "[job/extract] schema mismatch (1ª tentativa)",
        parsed.issues,
        text?.slice(0, 2000),
      );
      // Mesmo padrão do email/generate: falha de schema é diferente de
      // 429/500/503 (o que withRetry já cobre) — aqui o problema é o formato
      // da resposta, não instabilidade transitória, então vale uma
      // retentativa com hint em vez de desistir na primeira.
      text = await generateOnce([
        ...parts,
        {
          text:
            "A resposta anterior não seguiu o schema pedido. Devolva estritamente esse JSON, sem texto fora dele.",
        },
      ]);
      parsed = tryParse(text);
    }

    if (!text) {
      return NextResponse.json(
        { error: "Não consegui extrair os dados da vaga." },
        { status: 422 },
      );
    }
    if (!parsed.success) {
      console.error(
        "[job/extract] schema mismatch (2ª tentativa)",
        parsed.issues,
        text.slice(0, 2000),
      );
      return NextResponse.json(
        { error: "Os dados extraídos não bateram com o schema." },
        { status: 422 },
      );
    }

    // Um contact_email malformado (alucinação do modelo) não deve seguir
    // adiante — nem para o rascunho do Gmail, nem para o envio automático.
    let data = parsed.data;
    if (data.contact_email && !isValidEmail(data.contact_email)) {
      console.warn("[job/extract] contact_email inválido descartado", data.contact_email);
      data = { ...data, contact_email: "" };
    }

    return NextResponse.json(data);
  } catch (err) {
    // Ver o comentário em email/generate: o status do upstream vai no log.
    const status = (err as { status?: number })?.status;
    console.error("[job/extract]", status, err);
    const message =
      status === 503
        ? "O Gemini está sobrecarregado agora (alta demanda no tier gratuito). Tente de novo em alguns segundos."
        : "Falha ao ler a vaga. Tente de novo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

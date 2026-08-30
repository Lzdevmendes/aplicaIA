import { loadProfileContext } from "@/lib/db/profile";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimits, RateLimitError, AI_LIMITS } from "@/lib/ratelimit";
import { generateEmail, type Category } from "@/lib/nova/email-template";
import { NextResponse, type NextRequest } from "next/server";

const MAX_JOB_BYTES = 60_000; // o objeto job extraído nunca chega perto disso
const CATEGORIES: Category[] = [
  "opening",
  "skillsMatch",
  "skillsPartial",
  "closing",
  "signature",
  "subject",
];

/** Entrada do cliente não é confiável — aceita só números em arrays, por categoria conhecida. */
function sanitizeRecentIndices(input: unknown): Partial<Record<Category, number[]>> {
  if (!input || typeof input !== "object") return {};
  const out: Partial<Record<Category, number[]>> = {};
  for (const category of CATEGORIES) {
    const value = (input as Record<string, unknown>)[category];
    if (Array.isArray(value)) {
      const nums = value.filter((n): n is number => typeof n === "number");
      if (nums.length > 0) out[category] = nums;
    }
  }
  return out;
}

/**
 * Gera o e-mail de candidatura a partir do perfil + vaga + match, por
 * template determinístico (email-template.ts) — sem IA, sem custo, sem
 * depender da cota do Gemini.
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
  const job = body?.job;
  if (!job || typeof job.company !== "string") {
    return NextResponse.json(
      { error: "dados da vaga ausentes" },
      { status: 400 },
    );
  }
  if (JSON.stringify(job).length > MAX_JOB_BYTES) {
    return NextResponse.json({ error: "Dados da vaga muito grandes." }, { status: 413 });
  }

  const profile = await loadProfileContext(supabase, user.id);
  if (!profile.summary && profile.experiences.length === 0) {
    return NextResponse.json(
      { error: "Monte seu perfil antes de gerar o e-mail." },
      { status: 400 },
    );
  }

  const result = generateEmail(
    {
      candidate: {
        fullName: profile.full_name ?? "",
        headline: profile.headline ?? "",
        summary: profile.summary ?? "",
        github: profile.github ?? "",
        website: profile.website ?? "",
      },
      job: {
        company: typeof job.company === "string" ? job.company : "",
        role: typeof job.role === "string" ? job.role : "",
        skills: Array.isArray(job.skills) ? job.skills : [],
      },
    },
    { recentIndices: sanitizeRecentIndices(body?.recentIndices) },
  );

  return NextResponse.json(result);
}

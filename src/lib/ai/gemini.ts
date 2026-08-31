import { GoogleGenAI, ThinkingLevel, type ThinkingConfig } from "@google/genai";
import { z } from "zod";

/**
 * Cliente do Google Gemini. Server-side apenas — a chave nunca vai ao browser.
 * Nunca importar de um "use client".
 *
 * gemini-flash-latest: alias que o Google mantém apontando para o modelo flash
 * atual do tier gratuito. Lê PDF e imagem nativamente e devolve JSON
 * estruturado. Alimenta o parse do CV, a extração de vaga e a geração do e-mail.
 *
 * Por que o alias e não uma versão fixa: o `gemini-2.5-flash` fixo passou a
 * responder 404 "no longer available to new users". O alias evita esse
 * envelhecimento — sempre resolve para o flash vigente.
 */
let client: GoogleGenAI | null = null;

export function gemini() {
  if (!client) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY não configurada. Veja .env.example.");
    }
    // Sem timeout, o fetch da SDK pode ficar pendurado indefinidamente numa
    // conexão que trava (visto em prod: /api/job/extract preso em "Gerando…"
    // por minutos, sem nenhum erro nos logs — nada pra withRetry reagir,
    // porque não houve rejeição nenhuma). 25s por tentativa garante que toda
    // chamada falha de forma detectável dentro do maxDuration da rota.
    client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { timeout: 25_000 },
    });
  }
  return client;
}

export const MODEL = "gemini-flash-latest";

/**
 * Nível de raciocínio de toda chamada. O flash novo raciocina por padrão, o que
 * deixa a chamada lenta e estoura o tempo da função na Vercel; "low" mantém a
 * extração da vaga e a geração do e-mail em ~1,5–2,5s.
 *
 * NÃO voltar para `thinkingBudget: 0`: o alias gemini-flash-latest migrou para
 * o Gemini 3.x, que rejeita esse campo com 400 INVALID_ARGUMENT — foi o que
 * derrubou as três rotas de IA em produção. O 3.x usa `thinkingLevel`.
 */
export const THINKING: ThinkingConfig = { thinkingLevel: ThinkingLevel.LOW };

/**
 * Repete a chamada em erros transitórios do tier gratuito.
 *
 * 429 (cota por minuto) e 500 costumam ser blips curtos — 4 tentativas bastam.
 * 503 ("high demand... try again later") é o que mais aparece em picos de uso
 * do tier gratuito e pode durar mais que isso, então leva mais tentativas e um
 * backoff maior (visto em produção: sequências de 503 por >1min seguido).
 * Backoff exponencial com jitter, capado em 8s por tentativa.
 */
const RETRY_ATTEMPTS: Record<number, number> = { 429: 4, 500: 4, 503: 6 };

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      const maxAttempts = status !== undefined ? RETRY_ATTEMPTS[status] : undefined;
      if (maxAttempts === undefined || attempt >= maxAttempts - 1) throw err;
      const backoff = Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 500;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
}

/**
 * Converte um schema Zod para o JSON Schema que o Gemini aceita em
 * responseJsonSchema. Remove a chave `$schema` (o Gemini rejeita a meta-chave).
 */
export function toGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema) as Record<string, unknown>;
  delete js["$schema"];
  return js;
}

/** Parte de conteúdo: texto ou mídia (PDF/imagem) em base64. */
export type Part =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

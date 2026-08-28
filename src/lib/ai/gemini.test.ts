import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import { toGeminiSchema, withRetry } from "./gemini";

describe("toGeminiSchema", () => {
  it("remove a chave $schema (o Gemini rejeita a meta-chave)", () => {
    const js = toGeminiSchema(z.object({ nome: z.string() }));
    expect(js).not.toHaveProperty("$schema");
    expect(js).toHaveProperty("type", "object");
  });

  it("preserva a ordem das propriedades (o parse do CV depende disso)", () => {
    const js = toGeminiSchema(
      z.object({ a: z.string(), b: z.string(), c: z.string() }),
    );
    expect(Object.keys(js.properties as object)).toEqual(["a", "b", "c"]);
  });
});

describe("withRetry", () => {
  afterEach(() => vi.useRealTimers());

  it("retorna direto quando não há erro", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("repete em 503 e sucede na tentativa seguinte", async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValue("ok");

    const p = withRetry(fn);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("repete em 429 e 500 também", async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockRejectedValueOnce({ status: 500 })
      .mockResolvedValue("ok");

    const p = withRetry(fn);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("NÃO repete em erro não-transitório (ex: 400) — rethrow imediato", async () => {
    const err = { status: 400, message: "bad request" };
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("desiste após 4 tentativas em 429/500 e propaga o último erro", async () => {
    vi.useFakeTimers();
    const err = { status: 500 };
    const fn = vi.fn().mockRejectedValue(err);

    const p = withRetry(fn);
    // Anexa o catch antes de avançar os timers para não vazar unhandled rejection.
    const assertion = expect(p).rejects.toBe(err);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("503 leva mais tentativas que 429/500 (picos de alta demanda duram mais)", async () => {
    vi.useFakeTimers();
    const err = { status: 503 };
    const fn = vi.fn().mockRejectedValue(err);

    const p = withRetry(fn);
    const assertion = expect(p).rejects.toBe(err);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(6);
  });
});

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/ui/icons";

const inputCls =
  "w-full border border-border rounded-lg px-3.5 py-2.5 text-[13.5px] text-ink bg-bg outline-none focus:border-pine focus:bg-surface";

/**
 * Só é alcançável com sessão válida — o link de recuperação passa por
 * /auth/confirm, que já chama verifyOtp e cria a sessão antes de redirecionar
 * para cá.
 */
export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("A senha precisa de pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 sm:p-10 bg-bg">
      <div className="w-full max-w-[440px] text-center">
        <div className="w-12 h-12 rounded-[11px] bg-ink flex items-center justify-center mx-auto mb-6">
          <LogoMark size={24} />
        </div>

        <h1 className="font-display font-extrabold text-[26px] tracking-[-0.01em] m-0 mb-2.5">
          Nova senha
        </h1>

        {done ? (
          <>
            <p className="text-[13.5px] text-ink bg-surface border border-border rounded-lg px-4 py-3.5 text-left leading-[1.5] mb-5">
              Senha atualizada.
            </p>
            <a
              href="/nova"
              className="inline-block bg-pine text-white rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-pine-dark transition-colors"
            >
              Ir para o AplicaAI
            </a>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-2.5 text-left">
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Nova senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-pine text-white rounded-lg py-3 text-sm font-semibold cursor-pointer hover:bg-pine-dark transition-colors disabled:opacity-60"
            >
              {loading ? "Salvando…" : "Salvar nova senha"}
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-4 text-[13px] text-clay">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

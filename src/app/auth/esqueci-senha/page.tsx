"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/ui/icons";

const inputCls =
  "w-full border border-border rounded-lg px-3.5 py-2.5 text-[13.5px] text-ink bg-bg outline-none focus:border-pine focus:bg-surface";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=/auth/reset-password`,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 sm:p-10 bg-bg">
      <div className="w-full max-w-[440px] text-center">
        <div className="w-12 h-12 rounded-[11px] bg-ink flex items-center justify-center mx-auto mb-6">
          <LogoMark size={24} />
        </div>

        <h1 className="font-display font-extrabold text-[26px] tracking-[-0.01em] m-0 mb-2.5">
          Recuperar senha
        </h1>
        <p className="text-[14px] text-muted leading-[1.55] m-0 mb-7">
          Informe o e-mail da sua conta e mandamos um link para trocar a senha.
        </p>

        {sent ? (
          <p className="text-[13.5px] text-ink bg-surface border border-border rounded-lg px-4 py-3.5 text-left leading-[1.5]">
            Te mandamos um link para <strong>{email}</strong>. Confira sua caixa
            de entrada (e o spam).
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-2.5 text-left">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-pine text-white rounded-lg py-3 text-sm font-semibold cursor-pointer hover:bg-pine-dark transition-colors disabled:opacity-60"
            >
              {loading ? "Enviando…" : "Enviar link de recuperação"}
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-4 text-[13px] text-clay">
            {error}
          </p>
        )}

        <p className="text-xs text-faint leading-[1.5] mt-[18px]">
          <Link
            href="/login"
            className="underline underline-offset-2 hover:text-muted transition-colors"
          >
            Voltar para o login
          </Link>
        </p>
      </div>
    </main>
  );
}

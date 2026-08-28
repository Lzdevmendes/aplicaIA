"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/ui/icons";

const inputCls =
  "w-full border border-border rounded-lg px-3.5 py-2.5 text-[13.5px] text-ink bg-bg outline-none focus:border-pine focus:bg-surface";

type PasswordAction = "entrar" | "criar";

export default function LoginPage() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [passwordAction, setPasswordAction] = useState<PasswordAction>("entrar");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [signupSent, setSignupSent] = useState(false);

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Só perfil/e-mail aqui — gmail.send (escopo sensível, exige
        // verificação do app) foi movido para "Conectar Gmail" em /perfil,
        // um fluxo separado que não passa pelo login. Login não mostra mais
        // a tela de "app não verificado" do Google.
        scopes: "email profile",
      },
    });

    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/nova`,
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMagicLinkSent(true);
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();

    if (passwordAction === "criar") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/nova`,
        },
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      // Sem sessão de volta = confirmação de e-mail está ligada no Supabase.
      if (!data.session) {
        setSignupSent(true);
        return;
      }
      window.location.href = "/nova";
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    window.location.href = "/nova";
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 sm:p-10 bg-bg">
      <div className="w-full max-w-[440px] text-center">
        <div className="w-12 h-12 rounded-[11px] bg-ink flex items-center justify-center mx-auto mb-6">
          <LogoMark size={24} />
        </div>

        <div className="font-mono text-[11px] tracking-[0.16em] uppercase text-muted mb-3.5">
          AplicaAI
        </div>
        <h1 className="font-display font-extrabold text-[30px] tracking-[-0.01em] m-0 mb-2.5">
          Transforme a vaga em um e-mail pronto
        </h1>
        <p className="text-[14px] text-muted leading-[1.55] m-0 mb-7">
          Entre para começar.
        </p>

        <button
          onClick={signInWithGoogle}
          disabled={googleLoading}
          className="w-full bg-pine text-white rounded-lg py-3.5 text-sm font-semibold cursor-pointer hover:bg-pine-dark transition-colors disabled:opacity-60 disabled:cursor-default"
        >
          {googleLoading ? "Redirecionando…" : "Entrar com Google"}
        </button>

        <div className="flex items-center gap-3 my-5">
          <span className="flex-1 h-px bg-border" />
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">
            ou
          </span>
          <span className="flex-1 h-px bg-border" />
        </div>

        {!usePassword ? (
          magicLinkSent ? (
            <p className="text-[13.5px] text-ink bg-surface border border-border rounded-lg px-4 py-3.5 text-left leading-[1.5]">
              Te mandamos um link de acesso para <strong>{email}</strong>.
              Confira sua caixa de entrada (e o spam).
            </p>
          ) : (
            <form onSubmit={sendMagicLink} className="flex flex-col gap-2.5 text-left">
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
                className="w-full border border-border bg-surface rounded-lg py-3 text-sm font-semibold text-ink cursor-pointer hover:border-border3 transition-colors disabled:opacity-60"
              >
                {loading ? "Enviando…" : "Enviar link mágico"}
              </button>
            </form>
          )
        ) : signupSent ? (
          <p className="text-[13.5px] text-ink bg-surface border border-border rounded-lg px-4 py-3.5 text-left leading-[1.5]">
            Te mandamos um e-mail de confirmação para <strong>{email}</strong>.
            Clique no link para ativar a conta.
          </p>
        ) : (
          <form onSubmit={submitPassword} className="flex flex-col gap-2.5 text-left">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
            <input
              type="password"
              required
              autoComplete={passwordAction === "criar" ? "new-password" : "current-password"}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-white rounded-lg py-3 text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {loading
                ? "Aguarde…"
                : passwordAction === "criar"
                  ? "Criar conta"
                  : "Entrar"}
            </button>
            <div className="flex items-center justify-between text-[12.5px] text-muted">
              <button
                type="button"
                onClick={() =>
                  setPasswordAction((a) => (a === "entrar" ? "criar" : "entrar"))
                }
                className="text-pine font-medium hover:underline cursor-pointer bg-transparent border-none"
              >
                {passwordAction === "entrar" ? "Criar conta nova" : "Já tenho conta"}
              </button>
              {passwordAction === "entrar" && (
                <Link
                  href="/auth/esqueci-senha"
                  className="hover:underline hover:text-ink transition-colors"
                >
                  Esqueci a senha
                </Link>
              )}
            </div>
          </form>
        )}

        <button
          type="button"
          onClick={() => {
            setError(null);
            setMagicLinkSent(false);
            setSignupSent(false);
            setUsePassword((v) => !v);
          }}
          className="text-[12.5px] text-muted hover:text-ink transition-colors cursor-pointer bg-transparent border-none mt-3.5 underline underline-offset-2"
        >
          {usePassword ? "Prefiro usar link mágico" : "Prefiro usar senha"}
        </button>

        {error && (
          <p role="alert" className="mt-4 text-[13px] text-clay">
            {error}
          </p>
        )}

        <p className="text-xs text-faint leading-[1.5] mt-[18px]">
          Seus dados são privados. Você pode apagar tudo quando quiser.
        </p>
        <p className="text-xs text-faint leading-[1.5] mt-2">
          <Link
            href="/privacidade"
            className="underline underline-offset-2 hover:text-muted transition-colors"
          >
            Política de Privacidade
          </Link>
          {" · "}
          <Link
            href="/termos"
            className="underline underline-offset-2 hover:text-muted transition-colors"
          >
            Termos de Serviço
          </Link>
        </p>
      </div>
    </main>
  );
}

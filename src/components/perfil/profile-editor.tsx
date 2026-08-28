"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CvDropzone } from "@/components/onboarding/cv-dropzone";
import { Analyzing } from "@/components/onboarding/analyzing";
import { IconClose, IconUpload } from "@/components/ui/icons";
import { uploadAndParseCv } from "@/lib/cv/upload-and-parse";
import { saveProfile, deleteAccount } from "@/app/(app)/perfil/actions";
import type { EditableProfile } from "@/lib/ai/edit-schema";
import type { OnboardingStepKey } from "@/lib/ai/schemas";
import { ProfileView } from "./profile-view";
import { ProfileForm } from "./profile-form";
import { GmailConnectCard } from "./gmail-connect-card";

function initials(name: string) {
  if (!name.trim()) return "··";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function ProfileEditor({
  initial,
  gmail,
}: {
  initial: EditableProfile;
  gmail: { email: string; connectedAt: string } | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draft, setDraft] = useState<EditableProfile>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // View sempre reflete os dados frescos do servidor; draft só vive na edição.
  const isEmpty =
    !initial.summary &&
    initial.experiences.length === 0 &&
    initial.skills.length === 0;

  function startEdit() {
    setError(null);
    setDraft(initial);
    setMode("edit");
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await saveProfile(draft);
    setSaving(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setMode("view");
    router.refresh();
  }

  return (
    <section className="px-5 sm:px-10 pt-6 sm:pt-[34px] pb-[60px] max-w-[820px] mx-auto">
      <header className="mb-[26px]">
        <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-muted mb-2">
          AplicaAI · Perfil
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-ink text-pine-tint flex items-center justify-center font-display font-extrabold text-[22px] flex-none">
            {initials(mode === "edit" ? draft.full_name : initial.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-extrabold text-[28px] tracking-[-0.01em] m-0 truncate">
              {(mode === "edit" ? draft.full_name : initial.full_name) || "Seu perfil"}
            </h1>
            {(mode === "edit" ? draft.headline : initial.headline) && (
              <div className="text-sm text-muted mt-[3px] truncate">
                {mode === "edit" ? draft.headline : initial.headline}
              </div>
            )}
          </div>

          <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-2.5">
            {mode === "view" ? (
              <>
                <button
                  onClick={() => setUploadOpen(true)}
                  className="border border-border bg-surface rounded-lg px-[15px] py-2.5 text-[13px] font-medium flex items-center gap-2 hover:border-border3 transition-colors"
                >
                  <IconUpload size={15} />
                  Atualizar CV
                </button>
                <button
                  onClick={startEdit}
                  className="bg-pine text-white rounded-lg px-[15px] py-2.5 text-[13px] font-semibold hover:bg-pine-dark transition-colors"
                >
                  Editar perfil
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setMode("view")}
                  disabled={saving}
                  className="border border-border bg-surface rounded-lg px-[15px] py-2.5 text-[13px] font-medium hover:border-border3 transition-colors disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="bg-pine text-white rounded-lg px-[18px] py-2.5 text-[13px] font-semibold hover:bg-pine-dark transition-colors disabled:opacity-60"
                >
                  {saving ? "Salvando…" : "Salvar"}
                </button>
              </>
            )}
          </div>
        </div>
        {error && (
          <p role="alert" className="text-[13px] text-clay mt-3">
            {error}
          </p>
        )}
      </header>

      {isEmpty && mode === "view" && (
        <div className="mb-3.5 bg-surface border border-border rounded-lg shadow-flat px-5 py-4 flex items-center gap-3 text-[13px]">
          <span className="text-muted">
            Suba seu CV para preencher tudo automaticamente — ou edite à mão.
          </span>
          <button
            onClick={() => setUploadOpen(true)}
            className="ml-auto text-pine font-semibold hover:underline"
          >
            Subir currículo →
          </button>
        </div>
      )}

      {mode === "view" && <GmailConnectCard gmail={gmail} />}

      {mode === "view" ? (
        <ProfileView profile={initial} />
      ) : (
        <ProfileForm draft={draft} onChange={setDraft} />
      )}

      {mode === "view" && <DangerZone />}

      {uploadOpen && (
        <CvUploadModal
          onClose={() => setUploadOpen(false)}
          onDone={() => {
            setUploadOpen(false);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

function DangerZone() {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setDeleting(true);
    setError(null);
    const res = await deleteAccount();
    if (res?.error) {
      setError(res.error);
      setDeleting(false);
      return;
    }
    // Recarrega no login: limpa qualquer estado de sessão do cliente.
    window.location.href = "/login";
  }

  return (
    <div className="mt-10 pt-6 border-t border-border">
      <div className="rounded-lg border border-clay/30 bg-clay/[0.04] px-5 py-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold text-[15px] text-ink">Apagar minha conta</div>
          <p className="text-[13px] text-muted leading-[1.5] m-0 mt-0.5">
            Remove em definitivo seu perfil, CVs, candidaturas, tarefas e a conexão com o
            Gmail. Não dá para desfazer.
          </p>
        </div>
        <button
          onClick={() => setConfirming(true)}
          className="border border-clay/40 text-clay bg-surface rounded-lg px-[15px] py-2.5 text-[13px] font-semibold hover:bg-clay hover:text-white transition-colors"
        >
          Apagar minha conta
        </button>
      </div>

      {confirming && (
        <>
          <div
            onClick={() => !deleting && setConfirming(false)}
            className="fixed inset-0 bg-ink/30 z-[60] vp-settle"
            style={{ animationDuration: "0.2s" }}
          />
          <div
            role="dialog"
            aria-label="Confirmar exclusão da conta"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-[460px] max-w-[92vw] bg-bg border border-border rounded-[14px] shadow-drawer p-7 vp-settle"
          >
            <h2 className="font-display font-extrabold text-[20px] text-ink m-0 mb-2">
              Apagar sua conta?
            </h2>
            <p className="text-[13.5px] text-muted leading-[1.55] m-0 mb-5">
              Isto apaga em definitivo todos os seus dados — perfil, CVs, candidaturas,
              tarefas e a conexão com o Gmail. A ação é irreversível.
            </p>
            {error && <p role="alert" className="text-[13px] text-clay mb-3">{error}</p>}
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="border border-border bg-surface rounded-lg px-[15px] py-2.5 text-[13px] font-medium hover:border-border3 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={confirm}
                disabled={deleting}
                className="bg-clay text-white rounded-lg px-[18px] py-2.5 text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {deleting ? "Apagando…" : "Apagar tudo"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CvUploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [phase, setPhase] = useState<"drop" | "analyzing">("drop");
  const [done, setDone] = useState<Set<OnboardingStepKey>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setDone(new Set());
    setPhase("analyzing");
    try {
      await uploadAndParseCv(file, (step) => setDone((prev) => new Set(prev).add(step)));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "algo deu errado");
      setPhase("drop");
    }
  }

  return (
    <>
      <div
        onClick={phase === "drop" ? onClose : undefined}
        className="fixed inset-0 bg-ink/30 z-[60] vp-settle"
        style={{ animationDuration: "0.2s" }}
      />
      <div
        role="dialog"
        aria-label="Atualizar CV"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-[560px] max-w-[92vw] bg-bg border border-border rounded-[14px] shadow-drawer p-8 vp-settle"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-muted">
            Atualizar CV
          </div>
          {phase === "drop" && (
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="w-8 h-8 rounded-lg bg-surface border border-border text-muted flex items-center justify-center hover:text-ink hover:border-border3 transition-colors"
            >
              <IconClose size={16} />
            </button>
          )}
        </div>

        {phase === "drop" ? (
          <>
            <p className="text-[13.5px] text-muted leading-[1.55] m-0 mb-5">
              A gente relê seu currículo e atualiza os dados. O que você preencheu à
              mão e o CV não traz (preferências, links) fica preservado.
            </p>
            <CvDropzone onFile={handleFile} error={error} />
          </>
        ) : (
          <div className="text-center">
            <Analyzing done={done} />
          </div>
        )}
      </div>
    </>
  );
}

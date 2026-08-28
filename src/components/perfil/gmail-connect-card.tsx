"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { disconnectGmail } from "@/app/(app)/perfil/actions";
import { IconEnvelope, IconCheckCircle } from "@/components/ui/icons";

export function GmailConnectCard({
  gmail,
}: {
  gmail: { email: string; connectedAt: string } | null;
}) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function disconnect() {
    setDisconnecting(true);
    setError(null);
    const res = await disconnectGmail();
    setDisconnecting(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mb-3.5 bg-surface border border-border rounded-lg shadow-flat px-5 py-4">
      <div className="flex items-center gap-3">
        {gmail ? (
          <IconCheckCircle size={18} />
        ) : (
          <IconEnvelope size={18} color="#6B7076" />
        )}
        <div className="min-w-0 flex-1 text-[13px]">
          {gmail ? (
            <>
              <div className="font-medium text-ink">
                Gmail conectado — {gmail.email}
              </div>
              <div className="text-muted mt-0.5">
                Os e-mails saem automáticos, com o CV já anexado.
              </div>
            </>
          ) : (
            <>
              <div className="font-medium text-ink">Conectar Gmail</div>
              <div className="text-muted mt-0.5">
                Sem conectar, o botão &quot;Enviar&quot; abre um rascunho no Gmail e
                você anexa o CV na mão. Conectando, o envio (com o CV
                anexado) fica automático. O Google ainda mostra a tela de
                &quot;app não verificado&quot; até a verificação sair — clique em
                &quot;Avançado&quot; para continuar.
              </div>
            </>
          )}
        </div>

        {gmail ? (
          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="ml-auto border border-border bg-bg rounded-lg px-3.5 py-2 text-[12.5px] font-medium text-ink cursor-pointer hover:border-border3 transition-colors disabled:opacity-60 shrink-0"
          >
            {disconnecting ? "Desconectando…" : "Desconectar"}
          </button>
        ) : (
          <a
            href="/api/google/connect"
            className="ml-auto bg-pine text-white rounded-lg px-3.5 py-2 text-[12.5px] font-semibold hover:bg-pine-dark transition-colors shrink-0"
          >
            Conectar Gmail
          </a>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[12.5px] text-clay mt-2.5">
          {error}
        </p>
      )}
    </div>
  );
}

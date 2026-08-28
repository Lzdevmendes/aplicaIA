import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { NovaFlow } from "@/components/nova/nova-flow";

export default async function NovaCandidaturaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [cvRes, draftsRes, weekRes, googleRes] = await Promise.all([
    supabase
      .from("cv_files")
      .select("filename, size_bytes")
      .eq("user_id", user.id)
      .eq("is_current", true)
      .maybeSingle(),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "rascunho"),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("applied_at", "is", null)
      .gte("applied_at", startOfWeek()),
    // google_accounts não tem RLS — admin client, sempre filtrado à mão.
    createAdminClient()
      .from("google_accounts")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  // Envio automático (com CV anexado) para quem conectou o Gmail em /perfil;
  // senão cai no rascunho manual do Gmail.
  const sendMode = googleRes.data ? "api" : "deeplink";

  return (
    <section className="px-5 sm:px-10 pt-6 sm:pt-[34px] pb-12 max-w-[1320px] mx-auto">
      <PageHeader
        eyebrow="Nova candidatura"
        title="Transforme a vaga em um e-mail pronto"
        size={34}
      >
        <div className="font-mono text-[11px] text-muted text-right leading-[1.7] pb-1">
          <div>
            rascunhos&nbsp;·&nbsp;<span className="text-ink">{draftsRes.count ?? 0}</span>
          </div>
          <div>
            esta semana&nbsp;·&nbsp;
            <span className="text-ink">{weekRes.count ?? 0} enviadas</span>
          </div>
        </div>
      </PageHeader>

      {!cvRes.data && (
        <div className="mb-6 bg-surface border border-border rounded-lg shadow-flat px-5 py-4 flex items-center gap-3 text-[13px]">
          <span className="text-muted">
            Você ainda não tem um CV para anexar.
          </span>
          <Link
            href="/onboarding"
            className="ml-auto text-pine font-semibold hover:underline"
          >
            Subir currículo →
          </Link>
        </div>
      )}

      <NovaFlow cv={cvRes.data ?? null} sendMode={sendMode} />
    </section>
  );
}

function startOfWeek() {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = (day + 6) % 7; // segunda como início
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString();
}

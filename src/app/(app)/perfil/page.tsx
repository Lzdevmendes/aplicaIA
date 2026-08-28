import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ProfileEditor } from "@/components/perfil/profile-editor";
import type { EditableProfile } from "@/lib/ai/edit-schema";

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // A RLS já restringe ao usuário; o .eq() é redundante mas deixa a intenção
  // explícita para quem ler a query.
  const [profileRes, skillsRes, expRes, eduRes, certRes, googleRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("profile_skills").select("skill").eq("user_id", user.id).order("position"),
    supabase.from("experiences").select("*").eq("user_id", user.id).order("position"),
    supabase.from("education").select("*").eq("user_id", user.id).order("position"),
    supabase.from("certifications").select("*").eq("user_id", user.id).order("position"),
    // google_accounts não tem RLS (tabela fechada) — precisa do admin client,
    // sempre filtrado por user_id na mão. Uso permitido por AGENTS.md.
    createAdminClient()
      .from("google_accounts")
      .select("email, connected_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const p = profileRes.data;

  // Normaliza para o shape do editor (nunca null — string vazia).
  const initial: EditableProfile = {
    full_name: p?.full_name ?? "",
    headline: p?.headline ?? "",
    seniority: p?.seniority ?? "",
    summary: p?.summary ?? "",
    contract: p?.contract ?? "",
    work_model: p?.work_model ?? "",
    salary_range: p?.salary_range ?? "",
    github: p?.github ?? "",
    linkedin: p?.linkedin ?? "",
    website: p?.website ?? "",
    skills: (skillsRes.data ?? []).map((s) => s.skill),
    experiences: (expRes.data ?? []).map((e) => ({
      role: e.role,
      company: e.company ?? "",
      period: e.period ?? "",
      note: e.note ?? "",
    })),
    education: (eduRes.data ?? []).map((e) => ({
      course: e.course,
      school: e.school ?? "",
      period: e.period ?? "",
    })),
    certifications: (certRes.data ?? []).map((c) => ({
      name: c.name,
      issuer: c.issuer ?? "",
    })),
  };

  return (
    <ProfileEditor
      initial={initial}
      gmail={
        googleRes.data
          ? { email: googleRes.data.email, connectedAt: googleRes.data.connected_at }
          : null
      }
    />
  );
}

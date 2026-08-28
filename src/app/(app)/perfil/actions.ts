"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { EditableProfileSchema, type EditableProfile } from "@/lib/ai/edit-schema";
import { decryptToken } from "@/lib/crypto";
import { revokeToken } from "@/lib/google/gmail";
import type { Json } from "@/lib/db/types";

/**
 * Grava a edição manual do perfil. Envia todos os campos → a RPC
 * replace_profile grava tudo (edição é autoritativa, inclusive limpar).
 * Sujeito à RLS: a função grava só no perfil do usuário logado.
 */
export async function saveProfile(profile: EditableProfile) {
  const parsed = EditableProfileSchema.safeParse(profile);
  if (!parsed.success) {
    return { error: "perfil inválido" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "não autenticado" };

  const { error } = await supabase.rpc("replace_profile", {
    p_profile: parsed.data as unknown as Json,
  });
  if (error) return { error: error.message };

  revalidatePath("/perfil");
  return { ok: true };
}

/**
 * Exclusão de conta self-service (direito de exclusão da LGPD).
 *
 * Precisa do admin client (service_role): um usuário não apaga a própria linha
 * em auth.users pela RLS. Deletar o usuário dispara o cascade que limpa todas as
 * tabelas por usuário, incluindo google_accounts (revoga o acesso ao Gmail). O
 * Storage NÃO cai no cascade — os CVs são apagados na mão antes.
 */
export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "não autenticado" };

  const admin = createAdminClient();

  try {
    // 1. Apaga os arquivos do usuário no bucket cvs (cvs/<user_id>/*).
    const { data: files } = await admin.storage.from("cvs").list(user.id);
    if (files && files.length > 0) {
      await admin.storage
        .from("cvs")
        .remove(files.map((f) => `${user.id}/${f.name}`));
    }

    // 2. Apaga o usuário — cascade limpa perfil, candidaturas, tarefas,
    //    google_accounts e o resto das tabelas por usuário.
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  } catch (err) {
    console.error("[deleteAccount]", err);
    return { error: "Falha ao apagar a conta. Tente de novo." };
  }

  await supabase.auth.signOut();
  return { ok: true };
}

/**
 * Desconecta o Gmail: revoga o token no Google (best-effort — se falhar, a
 * linha é apagada mesmo assim, já que o usuário pediu para sair) e apaga a
 * linha de google_accounts. O envio volta a cair no rascunho manual.
 */
export async function disconnectGmail() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "não autenticado" };

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("google_accounts")
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (account) {
    try {
      await revokeToken(decryptToken(account.refresh_token));
    } catch (err) {
      console.error("[disconnectGmail] falha ao revogar no Google", err);
    }
  }

  const { error } = await admin
    .from("google_accounts")
    .delete()
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/perfil");
  return { ok: true };
}

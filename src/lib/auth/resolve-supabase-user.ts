import type { SupabaseClient, User } from "@supabase/supabase-js";
import { crmRoleToWmsRole, pickHighestWmsRole } from "./wms-rbac";
import { isUserRole, ROLE_LABEL, type AppUser, type UserRole } from "./types";

/** El rol de autorización sale de mps_profiles, nunca de user_metadata. */
export function crmRoleFromProfile(raw: unknown): UserRole {
  return isUserRole(raw) ? raw : "pending";
}

export function displayNameFromAuth(
  authUser: Pick<User, "email" | "user_metadata">,
  profileName?: string | null,
): string {
  const trimmed = profileName?.trim();
  if (trimmed) return trimmed;
  const meta = authUser.user_metadata ?? {};
  if (typeof meta.full_name === "string" && meta.full_name.trim()) return meta.full_name.trim();
  if (typeof meta.name === "string" && meta.name.trim()) return meta.name.trim();
  return authUser.email?.split("@")[0] || "Usuario";
}

export async function resolveSupabaseAppUser(
  sb: SupabaseClient,
  authUser: User,
): Promise<AppUser> {
  const { data: profile } = await sb
    .from("mps_profiles")
    .select("role, full_name, email")
    .eq("id", authUser.id)
    .maybeSingle();

  const crmRole = crmRoleFromProfile(profile?.role);
  const name = displayNameFromAuth(authUser, profile?.full_name ?? null);

  let wmsRole = crmRoleToWmsRole(crmRole);
  let organizationId: string | null = null;

  const { data: roleRows, error: roleErr } = await sb
    .from("wms_user_roles")
    .select("role_code, organization_id")
    .eq("user_id", authUser.id);

  if (!roleErr && roleRows?.length) {
    wmsRole = pickHighestWmsRole(roleRows.map((r) => r.role_code));
    const first = roleRows[0] as { organization_id?: string } | undefined;
    organizationId = first?.organization_id ?? null;
  }

  return {
    id: authUser.id,
    email: authUser.email ?? "",
    name,
    role: crmRole,
    roleLabel: ROLE_LABEL[crmRole],
    avatarInitial: name.slice(0, 1).toUpperCase(),
    provider: "supabase",
    wmsRole,
    organizationId,
  };
}

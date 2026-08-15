/**
 * Perfil personal por userId.
 * Solo el propio usuario (o admin al inspeccionar) debe leer estos datos.
 */

export interface UserProfile {
  userId: string;
  fullName: string;
  jobTitle: string;
  about: string;
  company: string;
  department: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  twitter: string;
  website: string;
  /** data URL (PNG/JPG/WebP) — máx ~3MB en cliente */
  avatarDataUrl: string | null;
  updatedAt: string;
}

const PROFILE_PREFIX = "mps-user-profile-v1:";
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

function key(userId: string) {
  return `${PROFILE_PREFIX}${userId}`;
}

export function emptyProfile(userId: string, seed?: { name?: string; email?: string; roleLabel?: string }): UserProfile {
  return {
    userId,
    fullName: seed?.name ?? "",
    jobTitle: seed?.roleLabel ?? "",
    about: "",
    company: "Campo Norte",
    department: "",
    email: seed?.email ?? "",
    phone: "",
    location: "",
    linkedin: "",
    github: "",
    twitter: "",
    website: "",
    avatarDataUrl: null,
    updatedAt: new Date().toISOString(),
  };
}

export function loadUserProfile(
  userId: string,
  seed?: { name?: string; email?: string; roleLabel?: string },
): UserProfile {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return emptyProfile(userId, seed);
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    const base = emptyProfile(userId, seed);
    return {
      ...base,
      ...parsed,
      userId,
      avatarDataUrl:
        typeof parsed.avatarDataUrl === "string" ? parsed.avatarDataUrl : null,
      updatedAt: parsed.updatedAt ?? base.updatedAt,
    };
  } catch {
    return emptyProfile(userId, seed);
  }
}

export function saveUserProfile(profile: UserProfile): void {
  const next = { ...profile, updatedAt: new Date().toISOString() };
  localStorage.setItem(key(profile.userId), JSON.stringify(next));
}

/**
 * Solo el dueño o un admin privilegiado pueden leer el perfil de otro.
 * Devuelve null si no hay permiso (no filtra datos parcialmente).
 */
export function canViewProfile(
  viewerId: string,
  viewerIsAdmin: boolean,
  targetUserId: string,
): boolean {
  return viewerId === targetUserId || viewerIsAdmin;
}

export function readProfileIfAllowed(
  viewerId: string,
  viewerIsAdmin: boolean,
  targetUserId: string,
  seed?: { name?: string; email?: string; roleLabel?: string },
): UserProfile | null {
  if (!canViewProfile(viewerId, viewerIsAdmin, targetUserId)) return null;
  return loadUserProfile(targetUserId, seed);
}

export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Formato no válido. Usa PNG, JPG o WebP.");
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("La imagen supera 3 MB.");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("No se pudo leer la imagen"));
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo"));
    reader.readAsDataURL(file);
  });
}

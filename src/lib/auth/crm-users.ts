/**
 * Usuarios del panel CRM (demo local).
 * Persistidos en localStorage; seed = LOCAL_TEAM_USERS.
 * Con Supabase Auth la creación real va por el dashboard; aquí solo listado informativo.
 */

import {
  LOCAL_TEAM_USERS,
  ROLE_LABEL,
  type AppUser,
  type UserRole,
} from "./types";

export const CRM_USERS_KEY = "mps-crm-users-v1";

export type CrmPanelUser = AppUser & { password: string };

function seedUsers(): CrmPanelUser[] {
  return LOCAL_TEAM_USERS.map((u) => ({ ...u }));
}

function stripPassword(u: CrmPanelUser): AppUser {
  const { password: _p, ...safe } = u;
  return safe;
}

export function loadCrmUsers(): CrmPanelUser[] {
  try {
    const raw = localStorage.getItem(CRM_USERS_KEY);
    if (!raw) {
      const seeded = seedUsers();
      localStorage.setItem(CRM_USERS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as CrmPanelUser[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = seedUsers();
      localStorage.setItem(CRM_USERS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return parsed.map((u) => ({
      ...u,
      roleLabel: ROLE_LABEL[u.role] ?? u.roleLabel,
      provider: "local" as const,
    }));
  } catch {
    return seedUsers();
  }
}

function persist(users: CrmPanelUser[]): void {
  localStorage.setItem(CRM_USERS_KEY, JSON.stringify(users));
}

export function listCrmUsersSafe(): AppUser[] {
  return loadCrmUsers().map(stripPassword);
}

export function findCrmUser(
  email: string,
  password: string,
): AppUser | null {
  const normalized = email.trim().toLowerCase();
  const match = loadCrmUsers().find(
    (u) => u.email === normalized && u.password === password,
  );
  if (!match) return null;
  return stripPassword(match);
}

export function createCrmUser(input: {
  email: string;
  password: string;
  name?: string;
  role: UserRole;
}): AppUser {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Email no válido");
  }
  if (input.password.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres");
  }
  const users = loadCrmUsers();
  if (users.some((u) => u.email === email)) {
    throw new Error("Ya existe un usuario con ese email");
  }
  const name =
    input.name?.trim() ||
    email.split("@")[0]?.replace(/[._]/g, " ") ||
    "Usuario";
  const next: CrmPanelUser = {
    id: `local-${crypto.randomUUID()}`,
    email,
    name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
    role: input.role,
    roleLabel: ROLE_LABEL[input.role],
    avatarInitial: name.slice(0, 1).toUpperCase(),
    provider: "local",
    password: input.password,
  };
  users.push(next);
  persist(users);
  return stripPassword(next);
}

export function updateCrmUserRole(id: string, role: UserRole): AppUser {
  const users = loadCrmUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) throw new Error("Usuario no encontrado");
  users[idx] = {
    ...users[idx],
    role,
    roleLabel: ROLE_LABEL[role],
  };
  persist(users);
  return stripPassword(users[idx]);
}

export function resetCrmUsersToSeed(): AppUser[] {
  const seeded = seedUsers();
  persist(seeded);
  return seeded.map(stripPassword);
}

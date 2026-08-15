export type UserRole = "admin" | "ops" | "booking" | "guide";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  roleLabel: string;
  avatarInitial: string;
  /** local = demo equipo; supabase = Auth real */
  provider: "local" | "supabase";
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Dirección",
  ops: "Almacén",
  booking: "Office",
  guide: "Planta",
};

/**
 * Cuentas demo del equipo Campo Norte (solo cuando NO hay Supabase — ver
 * `allowLocalDemoAuth()`). Estas credenciales viajan en el bundle del cliente:
 * son públicas por definición y solo dan acceso a datos semilla ficticios.
 *
 * La contraseña se puede rotar sin tocar código con `VITE_DEMO_PASSWORD`.
 * Con Supabase configurado, estas cuentas quedan desactivadas por completo.
 */
const DEMO_PASSWORD =
  (import.meta.env.VITE_DEMO_PASSWORD as string | undefined)?.trim() || "norte2026";

export const LOCAL_TEAM_USERS: Array<AppUser & { password: string }> = [
  {
    id: "local-sofia",
    email: "sofia@camponorte.demo",
    name: "Sofía Navarro",
    role: "admin",
    roleLabel: "Dirección",
    avatarInitial: "S",
    provider: "local",
    password: DEMO_PASSWORD,
  },
  {
    id: "local-marta",
    email: "marta@camponorte.demo",
    name: "Marta Vega",
    role: "booking",
    roleLabel: "Office",
    avatarInitial: "M",
    provider: "local",
    password: DEMO_PASSWORD,
  },
  {
    id: "local-luis",
    email: "luis@camponorte.demo",
    name: "Luis Ortega",
    role: "ops",
    roleLabel: "Almacén",
    avatarInitial: "L",
    provider: "local",
    password: DEMO_PASSWORD,
  },
  {
    id: "local-jorge",
    email: "jorge@camponorte.demo",
    name: "Jorge Peña",
    role: "guide",
    roleLabel: "Planta",
    avatarInitial: "J",
    provider: "local",
    password: DEMO_PASSWORD,
  },
];

export const LOCAL_AUTH_KEY = "mps-auth-user-v1";

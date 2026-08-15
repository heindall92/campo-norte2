import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSupabase, getSupabaseEnv } from "@/lib/supabase/client";
import { allowLocalDemoAuth, setForceLocalHub } from "@/lib/runtime";
import { trackAccess } from "@/lib/access-log";
import {
  LOCAL_AUTH_KEY,
  ROLE_LABEL,
  type AppUser,
  type UserRole,
} from "./types";
import { findCrmUser } from "./crm-users";
import { useIdleSessionTimeout } from "./useIdleSessionTimeout";
import { clearLastActivity } from "@/lib/security-settings";

export interface AuthContextValue {
  ready: boolean;
  user: AppUser | null;
  supabaseReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function roleFromMeta(raw: unknown): UserRole {
  if (raw === "admin" || raw === "ops" || raw === "booking" || raw === "guide") return raw;
  return "ops";
}

function userFromLocalStorage(): AppUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppUser;
  } catch {
    return null;
  }
}

function signInLocalDemo(normalized: string, password: string): AppUser {
  if (!allowLocalDemoAuth()) {
    throw new Error(
      "Login demo desactivado. Usa un usuario de Supabase Auth o pide VITE_ALLOW_DEMO_AUTH=true.",
    );
  }
  const match = findCrmUser(normalized, password);
  if (!match) {
    throw new Error(
      "Email o contraseña incorrectos. Demo: sofia@camponorte.demo / norte2026",
    );
  }
  localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(match));
  setForceLocalHub(true);
  void trackAccess("login", match);
  return match;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const supabaseReady = getSupabaseEnv().configured;

  useEffect(() => {
    let cancelled = false;
    const sb = getSupabase();

    async function boot() {
      // Sesión demo local (prioridad si el operador entró con cuenta equipo)
      if (allowLocalDemoAuth()) {
        const local = userFromLocalStorage();
        if (local?.provider === "local") {
          setForceLocalHub(true);
          setUser(local);
          setReady(true);
          return;
        }
      }

      if (sb) {
        const { data } = await sb.auth.getSession();
        if (cancelled) return;
        const session = data.session;
        if (session?.user) {
          setForceLocalHub(false);
          const meta = session.user.user_metadata ?? {};
          const name =
            (meta.full_name as string) ||
            (meta.name as string) ||
            session.user.email?.split("@")[0] ||
            "Usuario";
          const role = roleFromMeta(meta.role);
          setUser({
            id: session.user.id,
            email: session.user.email ?? "",
            name,
            role,
            roleLabel: ROLE_LABEL[role],
            avatarInitial: name.slice(0, 1).toUpperCase(),
            provider: "supabase",
          });
        } else {
          setUser(null);
        }

        const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
          if (!next?.user) {
            // No borrar sesión demo local
            const local = allowLocalDemoAuth() ? userFromLocalStorage() : null;
            if (local?.provider === "local") {
              setUser(local);
              return;
            }
            setUser(null);
            return;
          }
          localStorage.removeItem(LOCAL_AUTH_KEY);
          setForceLocalHub(false);
          const meta = next.user.user_metadata ?? {};
          const name =
            (meta.full_name as string) ||
            (meta.name as string) ||
            next.user.email?.split("@")[0] ||
            "Usuario";
          const role = roleFromMeta(meta.role);
          setUser({
            id: next.user.id,
            email: next.user.email ?? "",
            name,
            role,
            roleLabel: ROLE_LABEL[role],
            avatarInitial: name.slice(0, 1).toUpperCase(),
            provider: "supabase",
          });
        });

        setReady(true);
        return () => sub.subscription.unsubscribe();
      }

      if (!cancelled) {
        if (!allowLocalDemoAuth()) {
          setUser(null);
        } else {
          setUser(userFromLocalStorage());
        }
        setReady(true);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const normalized = email.trim().toLowerCase();
    const sb = getSupabase();

    if (sb) {
      const { error } = await sb.auth.signInWithPassword({
        email: normalized,
        password,
      });
      if (!error) {
        localStorage.removeItem(LOCAL_AUTH_KEY);
        setForceLocalHub(false);
        // El onAuthStateChange / getSession rellenará user; trackeamos por email
        void trackAccess("login", {
          id: normalized,
          email: normalized,
          name: normalized.split("@")[0] || "Usuario",
          provider: "supabase",
        });
        return;
      }
      // Fallback pitch: cuentas demo del equipo → Hub local (semilla)
      if (allowLocalDemoAuth()) {
        try {
          const match = signInLocalDemo(normalized, password);
          setUser(match);
          window.location.reload();
          return;
        } catch {
          throw new Error(
            `${error.message} · Demo equipo: sofia@camponorte.demo / norte2026`,
          );
        }
      }
      throw new Error(error.message);
    }

    const match = signInLocalDemo(normalized, password);
    setUser(match);
  }, []);

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (sb) {
      await sb.auth.signOut();
    }
    localStorage.removeItem(LOCAL_AUTH_KEY);
    setForceLocalHub(false);
    clearLastActivity();
    setUser(null);
  }, []);

  useIdleSessionTimeout(Boolean(user) && ready, signOut);

  // Sesión ya abierta (reload / pestaña): 1 ping/día para saber que volvieron
  useEffect(() => {
    if (!ready || !user) return;
    void trackAccess("session", user);
  }, [ready, user]);

  const value = useMemo(
    () => ({ ready, user, supabaseReady, signIn, signOut }),
    [ready, user, supabaseReady, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

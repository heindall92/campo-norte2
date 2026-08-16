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
import { CAMPO_NORTE_ORG } from "@/lib/wms/org";
import { crmRoleToWmsRole } from "./wms-rbac";
import { resolveSupabaseAppUser } from "./resolve-supabase-user";
import { LOCAL_AUTH_KEY, ROLE_LABEL, type AppUser } from "./types";
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

function withDemoRbac(user: AppUser): AppUser {
  return {
    ...user,
    roleLabel: ROLE_LABEL[user.role] ?? user.roleLabel,
    wmsRole: user.wmsRole ?? crmRoleToWmsRole(user.role),
    organizationId: user.organizationId ?? CAMPO_NORTE_ORG.id,
  };
}

function userFromLocalStorage(): AppUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppUser;
    if (parsed?.provider !== "local") return null;
    return withDemoRbac(parsed);
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
  const user = withDemoRbac(match);
  localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(user));
  setForceLocalHub(true);
  void trackAccess("login", user);
  return user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const supabaseReady = getSupabaseEnv().configured;

  useEffect(() => {
    let cancelled = false;
    let authGen = 0;
    const sb = getSupabase();

    async function boot() {
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
          const appUser = await resolveSupabaseAppUser(sb, session.user);
          if (cancelled) return;
          setUser(appUser);
        } else {
          setUser(null);
        }

        const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
          const my = ++authGen;
          if (!next?.user) {
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
          void resolveSupabaseAppUser(sb, next.user).then((appUser) => {
            if (cancelled || my !== authGen) return;
            setUser(appUser);
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
        void trackAccess("login", {
          id: normalized,
          email: normalized,
          name: normalized.split("@")[0] || "Usuario",
          provider: "supabase",
        });
        return;
      }
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

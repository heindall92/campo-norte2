import { Badge } from "@/components/CrmChrome";
import { isDemoMode, supabaseConfigured } from "@/lib/runtime";
import type { Lang } from "@/lib/i18n";
import { useWmsLive } from "./useWmsLive";

export function WmsModeBadge({ lang }: { lang: Lang }) {
  const { snap, persistMode } = useWmsLive();
  const demo = isDemoMode();
  const revision = snap.ledgerRevision ?? 0;
  const store = persistMode === "postgres" ? "Postgres" : "local";
  const authNote =
    demo && supabaseConfigured()
      ? lang === "es"
        ? " · Auth listo"
        : " · Auth ready"
      : "";
  return (
    <Badge tone={demo ? "warn" : persistMode === "postgres" ? "good" : "warn"}>
      {demo
        ? lang === "es"
          ? `DEMO · ${store} · rev ${revision}${authNote}`
          : `DEMO · ${store} · rev ${revision}${authNote}`
        : lang === "es"
          ? `PRODUCCIÓN · ${store} · rev ${revision}`
          : `PRODUCTION · ${store} · rev ${revision}`}
    </Badge>
  );
}

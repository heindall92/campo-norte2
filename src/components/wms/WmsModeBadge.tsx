import { Badge } from "@/components/CrmChrome";
import { isDemoMode, runtimeMode, supabaseConfigured } from "@/lib/runtime";
import type { Lang } from "@/lib/i18n";

export function WmsModeBadge({ lang }: { lang: Lang }) {
  const mode = runtimeMode();
  const demo = isDemoMode();
  return (
    <Badge tone={demo ? "warn" : "good"}>
      {demo
        ? lang === "es"
          ? `DEMO · semilla${supabaseConfigured() ? " (Auth listo, Hub local)" : ""}`
          : `DEMO · seed${supabaseConfigured() ? " (Auth ready, local hub)" : ""}`
        : lang === "es"
          ? `PRODUCCIÓN · ${mode}`
          : `PRODUCTION · ${mode}`}
    </Badge>
  );
}

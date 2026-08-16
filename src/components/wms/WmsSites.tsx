import { Badge, Card } from "@/components/CrmChrome";
import type { Lang } from "@/lib/i18n";
import {
  CAMPO_NORTE_ORG,
  occupancyByZone,
  onboardSite,
  ZONE_LABEL,
  type WarehouseZone,
  type WmsSnapshot,
} from "@/lib/wms";
import { Building2, Check, MapPin, Plus, Warehouse } from "lucide-react";
import { useState } from "react";
import { useWmsLive } from "./useWmsLive";

export function WmsSitesPanel({ lang }: { lang: Lang }) {
  const { snap, commit } = useWmsLive();
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("ES");
  const [aisles, setAisles] = useState("");
  const [bays, setBays] = useState(4);
  const [levels, setLevels] = useState(4);
  const [zone, setZone] = useState<WarehouseZone>("seco");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  function persist(next: WmsSnapshot) {
    commit(next);
  }

  function submit() {
    const result = onboardSite(snap, {
      orgId: snap.org.id,
      city,
      region,
      country,
      aisles: aisles.split(/[,\s]+/),
      bays,
      levels,
      zone,
    });
    if (!result.ok) {
      setOkMsg(null);
      const err = {
        city_required: { es: "Indica la ciudad", en: "City is required" },
        duplicate_code: { es: "Código de centro duplicado", en: "Duplicate site code" },
        wrong_org: { es: "Este centro no pertenece al tenant", en: "Site does not belong to this tenant" },
        aisle_invalid: { es: "Pasillos: letras A–Z (máx. 2)", en: "Aisles: letters A–Z (max 2)" },
        layout_too_big: { es: "Layout demasiado grande (máx. 6 pasillos / 8 bahías / 4 niveles)", en: "Layout too large (max 6 aisles / 8 bays / 4 levels)" },
      }[result.error][lang];
      setFeedback(err);
      return;
    }
    persist(result.snap);
    setFeedback(null);
    setOkMsg(
      lang === "es"
        ? `Centro ${result.site.code} dado de alta · ${result.site.slotsTotal} huecos libres`
        : `Site ${result.site.code} onboarded · ${result.site.slotsTotal} empty slots`,
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
          <Building2 className="h-3.5 w-3.5" />
          {snap.org.legalName} · org_id {snap.org.id}
        </p>
        <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
          {lang === "es" ? "Centros · onboarding" : "Sites · onboarding"}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--ink-muted)]">
          {lang === "es"
            ? "Alta de hub en el tenant Campo Norte. DEMO filtra por org_id; PRODUCTION aísla con RLS en Postgres."
            : "Onboard a hub in the Campo Norte tenant. DEMO filters by org_id; PRODUCTION isolates with Postgres RLS."}
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {snap.sites.map((site) => {
          const slots = snap.slots.filter((s) => s.siteId === site.id);
          const occ = occupancyByZone(slots);
          const occupied = slots.filter((s) => s.status === "ocupado" || s.status === "reservado").length;
          return (
            <Card key={site.id} title={site.name} subtitle={`${site.code} · ${site.city}`}>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge tone="brand">{site.country}</Badge>
                <Badge tone="neutral">{site.region}</Badge>
                {site.temperatureModes.slice(0, 3).map((z) => (
                  <Badge key={z} tone="neutral">
                    {ZONE_LABEL[z][lang]}
                  </Badge>
                ))}
              </div>
              <p className="inline-flex items-center gap-1.5 text-sm text-[var(--ink)]">
                <Warehouse className="h-4 w-4 text-[var(--accent)]" />
                {occupied}/{slots.length} {lang === "es" ? "huecos ocupados" : "slots occupied"}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-[var(--ink-muted)]">
                {occ.slice(0, 4).map((z) => (
                  <li key={z.zone} className="flex justify-between">
                    <span>{ZONE_LABEL[z.zone as WarehouseZone]?.[lang] ?? z.zone}</span>
                    <span>{z.pct}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      <Card
        title={lang === "es" ? "Dar de alta un centro" : "Onboard a site"}
        subtitle={
          lang === "es"
            ? "Escribe la ciudad y el layout reales. No hay presets inventados."
            : "Type the real city and layout. No invented presets."
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            {lang === "es" ? "Ciudad" : "City"}
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm font-medium normal-case tracking-normal text-[var(--ink)]"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            {lang === "es" ? "Región" : "Region"}
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm font-medium normal-case tracking-normal text-[var(--ink)]"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            {lang === "es" ? "País" : "Country"}
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm font-medium normal-case tracking-normal text-[var(--ink)]"
            >
              <option value="ES">ES · España</option>
              <option value="CH">CH · Schweiz</option>
              <option value="DE">DE · Deutschland</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            {lang === "es" ? "Zona principal" : "Main zone"}
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value as WarehouseZone)}
              className="mt-1 w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm font-medium normal-case tracking-normal text-[var(--ink)]"
            >
              {(["seco", "fresco", "congelado"] as const).map((z) => (
                <option key={z} value={z}>
                  {ZONE_LABEL[z][lang]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            {lang === "es" ? "Pasillos" : "Aisles"}
            <input
              value={aisles}
              onChange={(e) => setAisles(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm font-medium normal-case tracking-normal text-[var(--ink)]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              {lang === "es" ? "Bahías" : "Bays"}
              <input
                type="number"
                min={1}
                max={8}
                value={bays}
                onChange={(e) => setBays(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm font-medium normal-case tracking-normal text-[var(--ink)]"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              {lang === "es" ? "Niveles" : "Levels"}
              <input
                type="number"
                min={1}
                max={4}
                value={levels}
                onChange={(e) => setLevels(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm font-medium normal-case tracking-normal text-[var(--ink)]"
              />
            </label>
          </div>
        </div>

        {feedback && (
          <p className="mt-3 rounded-xl bg-[var(--warn-bg)] px-3 py-2 text-xs font-semibold text-[var(--warn-ink)]">
            {feedback}
          </p>
        )}
        {okMsg && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[color-mix(in_oklab,var(--ok)_16%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--ok)]">
            <Check className="h-3.5 w-3.5" />
            {okMsg}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          {lang === "es" ? "Alta en el tenant" : "Onboard to tenant"}
        </button>
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
          <MapPin className="h-3.5 w-3.5" />
          {CAMPO_NORTE_ORG.plan} · {lang === "es" ? "muelle M se crea solo" : "dock aisle M is added for you"}
        </p>
      </Card>
    </div>
  );
}

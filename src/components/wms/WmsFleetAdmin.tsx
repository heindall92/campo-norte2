import { Badge, Card } from "@/components/CrmChrome";
import type { Lang } from "@/lib/i18n";
import {
  assignFleetCharger,
  createFleetUnit,
  FLEET_KIND_LABEL,
  reportFleetBattery,
  type FleetKind,
  type FleetStatus,
} from "@/lib/wms";
import { cn } from "@/lib/utils";
import {
  Battery,
  BatteryCharging,
  Forklift,
  Layers,
  MoveHorizontal,
  PlugZap,
  ScanBarcode,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useWmsLive } from "./useWmsLive";

function statusTone(s: FleetStatus): "good" | "warn" | "bad" | "neutral" {
  if (s === "operativa") return "good";
  if (s === "cargando") return "warn";
  return "bad";
}

function kindIcon(kind: FleetKind) {
  if (kind === "toro" || kind === "transpaleta") return MoveHorizontal;
  if (kind === "recogepedidos") return ScanBarcode;
  if (kind === "apilador") return Layers;
  if (kind === "montacargas" || kind === "contrapesada") return Forklift;
  return Forklift;
}

const KINDS = Object.keys(FLEET_KIND_LABEL) as FleetKind[];

export function WmsFleetPanel({ lang }: { lang: Lang }) {
  const { snap, commit } = useWmsLive();
  const opMap = useMemo(() => new Map(snap.operators.map((o) => [o.id, o])), [snap.operators]);
  const [code, setCode] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [kind, setKind] = useState<FleetKind>("contrapesada");
  const [siteId, setSiteId] = useState(snap.sites[0]?.id ?? "");

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
          {lang === "es" ? "Flota eléctrica" : "Electric fleet"}
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          {lang === "es"
            ? "Carretillas, toritos, montacargas y retráctiles. El % de batería solo cambia si un operario lo informa: el cargador de pared no tiene telemetría en el navegador."
            : "Forklifts, walkies, high-lifts and reach trucks. Battery % changes only when reported — the wall charger has no browser telemetry."}
        </p>
      </header>

      <Card
        title={lang === "es" ? "Cargadores de pared" : "Wall chargers"}
        subtitle={
          lang === "es"
            ? "Asignación física. Sin Jungheinrich ISM / Toyota I_Site / Crown InfoLink conectados."
            : "Physical assignment. No Jungheinrich ISM / Toyota I_Site / Crown InfoLink linked."
        }
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {snap.chargers.map((c) => {
            const unit = snap.fleet.find((f) => f.id === c.assignedFleetId);
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm"
              >
                <span className="inline-flex items-center gap-2">
                  <PlugZap className="h-4 w-4 text-[var(--accent)]" />
                  {c.code} · {c.zone}
                </span>
                <Badge tone={unit ? "warn" : "neutral"}>{unit?.code ?? (lang === "es" ? "libre" : "free")}</Badge>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title={lang === "es" ? "Alta de equipo" : "Add equipment"}>
        <form
          className="grid gap-2 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            const result = createFleetUnit(snap, {
              code,
              brand,
              model,
              kind,
              siteId,
              costPerHour: 0,
            });
            if (result.ok) {
              commit(result.snap);
              setCode("");
              setBrand("");
              setModel("");
            }
          }}
        >
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="FL-E-XX"
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
          />
          <input
            required
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder={lang === "es" ? "Marca" : "Brand"}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          />
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={lang === "es" ? "Modelo" : "Model"}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as FleetKind)}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {FLEET_KIND_LABEL[k][lang]}
              </option>
            ))}
          </select>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          >
            {snap.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.city}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
          >
            {lang === "es" ? "Agregar equipo" : "Add unit"}
          </button>
        </form>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {snap.fleet.map((f) => {
          const op = f.operatorId ? opMap.get(f.operatorId) : null;
          const waves = snap.pickWaves.filter((w) => w.fleetId === f.id);
          const site = snap.sites.find((s) => s.id === f.siteId);
          const Icon = kindIcon(f.kind);
          const charger = snap.chargers.find((c) => c.id === f.chargerId);
          const source =
            f.batterySource === "manual"
              ? lang === "es"
                ? "reporte manual"
                : "manual report"
              : f.batterySource === "seed"
                ? lang === "es"
                  ? "semilla local · no es el cargador"
                  : "local seed · not the charger"
                : lang === "es"
                  ? "sin lectura"
                  : "no reading";
          return (
            <Card key={f.id} title={`${f.code} · ${f.brand}`} subtitle={f.model}>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge tone={statusTone(f.status)}>{f.status}</Badge>
                <Badge tone={f.kind === "retractil_doble" || f.kind === "montacargas" ? "warn" : "neutral"}>
                  <Icon className="mr-1 inline h-3 w-3" />
                  {FLEET_KIND_LABEL[f.kind][lang]}
                </Badge>
                {site && <Badge tone="neutral">{site.city}</Badge>}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[var(--ink-muted)]">
                    {f.status === "cargando" ? (
                      <BatteryCharging className="h-3.5 w-3.5" />
                    ) : (
                      <Battery className="h-3.5 w-3.5" />
                    )}
                    {lang === "es" ? "Batería" : "Battery"}
                  </span>
                  <span
                    className={cn(
                      "font-semibold",
                      f.batteryPct != null && f.batteryPct < 25 && "text-[var(--danger)]",
                    )}
                  >
                    {f.batteryPct == null ? "—" : `${f.batteryPct}%`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${f.batteryPct ?? 0}%`,
                      background:
                        f.batteryPct == null
                          ? "transparent"
                          : f.batteryPct < 25
                            ? "var(--danger)"
                            : "var(--accent)",
                    }}
                  />
                </div>
                <p className="text-[11px] text-[var(--ink-muted)]">{source}</p>
                <label className="block text-xs text-[var(--ink-muted)]">
                  {lang === "es" ? "Informar % real" : "Report real %"}
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder={f.batteryPct == null ? "—" : String(f.batteryPct)}
                    className="mt-1 w-full rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-sm"
                    onBlur={(e) => {
                      if (e.target.value === "") return;
                      const result = reportFleetBattery(snap, f.id, Number(e.target.value));
                      if (result.ok) commit(result.snap);
                    }}
                  />
                </label>
                <label className="block text-xs text-[var(--ink-muted)]">
                  {lang === "es" ? "Cargador de pared" : "Wall charger"}
                  <select
                    value={f.chargerId ?? ""}
                    className="mt-1 w-full rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-sm"
                    onChange={(e) => {
                      const result = assignFleetCharger(snap, f.id, e.target.value || null);
                      if (result.ok) commit(result.snap);
                    }}
                  >
                    <option value="">{lang === "es" ? "Sin asignar" : "Unassigned"}</option>
                    {snap.chargers
                      .filter((c) => c.siteId === f.siteId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code}
                        </option>
                      ))}
                  </select>
                </label>
                {charger && (
                  <p className="text-[11px] text-[var(--ink-muted)]">
                    {lang === "es"
                      ? `${charger.code} no envía % al dashboard.`
                      : `${charger.code} does not send % to the dashboard.`}
                  </p>
                )}
                <div className="flex justify-between text-[var(--ink-muted)]">
                  <span>{lang === "es" ? "Operario" : "Operator"}</span>
                  <span className="font-medium text-[var(--ink)]">{op?.name ?? "—"}</span>
                </div>
                {waves.length > 0 && (
                  <div className="flex justify-between text-[var(--ink-muted)]">
                    <span>{lang === "es" ? "Ola asignada" : "Assigned wave"}</span>
                    <span className="font-medium text-[var(--ink)]">
                      {waves.map((w) => w.code).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

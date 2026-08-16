import { Badge, Card } from "@/components/CrmChrome";
import type { Lang } from "@/lib/i18n";
import {
  addPackStation,
  mockCarrierAdapter,
  openMockLabelPrint,
  openPackPackage,
  openPackPackagePrint,
  setOrgSsccPrefix,
  type PackError,
} from "@/lib/wms";
import { Package, Printer, ScanBarcode } from "lucide-react";
import { useState } from "react";
import { useWmsLive } from "./useWmsLive";

const PACK_ERR: Record<PackError, { es: string; en: string }> = {
  order_missing: { es: "Pedido no encontrado", en: "Order missing" },
  order_done: { es: "Ese pedido ya salió", en: "That order already shipped" },
  station_missing: { es: "Estación no encontrada", en: "Station missing" },
  station_site: { es: "La estación no es de ese centro", en: "Station is not at that site" },
  code_required: { es: "Escribe el código de la estación", en: "Type the station code" },
  name_required: { es: "Escribe el nombre de la estación", en: "Type the station name" },
  site_missing: { es: "Centro no encontrado", en: "Site missing" },
  station_dup: { es: "Ese código de estación ya existe en el centro", en: "That station code already exists here" },
  sscc_required: { es: "Escribe el SSCC o configura un prefijo", en: "Type the SSCC or set a prefix" },
  sscc_taken: { es: "Ese SSCC ya está en el registro", en: "That SSCC is already in the registry" },
  prefix_required: { es: "Sin prefijo hay que escribir el SSCC", en: "Without a prefix you must type the SSCC" },
  sscc_exhausted: { es: "No quedan SSCC libres bajo ese prefijo", en: "No free SSCC left under that prefix" },
  invalid_measure: { es: "Peso o medidas no válidos", en: "Invalid weight or dims" },
  line_missing: { es: "Línea no encontrada", en: "Line missing" },
  line_order: { es: "Esa línea no es de este pedido", en: "That line is not on this order" },
  package_missing: { es: "Bulto no encontrado", en: "Package missing" },
};

function emptyToNull(value: string): string | null {
  const t = value.trim();
  return t.length ? t : null;
}

function optionalNumber(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  return Number(t);
}

export function WmsPackCard({ lang }: { lang: Lang }) {
  const { snap, commit } = useWmsLive();
  const [prefix, setPrefix] = useState(snap.org.ssccPrefix ?? "");
  const [siteId, setSiteId] = useState(snap.sites[0]?.id ?? "");
  const [stCode, setStCode] = useState("");
  const [stName, setStName] = useState("");
  const [orderId, setOrderId] = useState("");
  const [stationId, setStationId] = useState("");
  const [sscc, setSscc] = useState("");
  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const openOrders = snap.outbound.filter((o) => o.status !== "expedido");
  const stations = (snap.packStations ?? []).filter((s) => !siteId || s.warehouseId === siteId);
  const packages = (snap.packPackages ?? []).slice(0, 12);

  function apply(
    result: { ok: true; snap: typeof snap; sscc?: string } | { ok: false; error: PackError },
    okEs: string,
    okEn: string,
  ) {
    if (!result.ok) {
      setOkMsg(null);
      setMsg(PACK_ERR[result.error][lang]);
      return;
    }
    commit(result.snap);
    setMsg(null);
    setOkMsg(lang === "es" ? okEs : okEn);
  }

  return (
    <Card
      title={lang === "es" ? "Packing · SSCC de bulto" : "Packing · package SSCC"}
      subtitle={
        lang === "es"
          ? "Estaciones y peso/medidas solo si se escriben. El SSCC se genera únicamente con prefijo configurado; si no, se teclea. La etiqueta no fabrica tracking."
          : "Stations and weight/dims only if written. SSCC is generated only with a configured prefix; otherwise you type it. The label does not invent tracking."
      }
    >
      <form
        className="mb-3 grid gap-2 md:grid-cols-[1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          apply(setOrgSsccPrefix(snap, emptyToNull(prefix)), "Prefijo guardado", "Prefix saved");
        }}
      >
        <label className="grid gap-1 text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">
          {lang === "es" ? "Prefijo SSCC (escrito)" : "SSCC prefix (written)"}
          <input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder={lang === "es" ? "Vacío = hay que escribir el SSCC" : "Empty = type the SSCC"}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm normal-case tracking-normal text-[var(--ink)]"
          />
        </label>
        <button type="submit" className="self-end rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white">
          {lang === "es" ? "Guardar prefijo" : "Save prefix"}
        </button>
      </form>

      <form
        className="mb-3 grid gap-2 md:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          apply(
            addPackStation(snap, { warehouseId: siteId, code: stCode, name: stName }),
            "Estación dada de alta",
            "Station added",
          );
          setStCode("");
          setStName("");
        }}
      >
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
        <input
          required
          value={stCode}
          onChange={(e) => setStCode(e.target.value)}
          placeholder={lang === "es" ? "Código mesa" : "Station code"}
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
        />
        <input
          required
          value={stName}
          onChange={(e) => setStName(e.target.value)}
          placeholder={lang === "es" ? "Nombre" : "Name"}
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-full border border-[var(--glass-border)] px-3 py-2 text-sm font-semibold">
          {lang === "es" ? "Alta estación" : "Add station"}
        </button>
      </form>

      {stations.length > 0 && (
        <p className="mb-3 flex flex-wrap gap-1.5 text-[11px] text-[var(--ink-muted)]">
          {stations.map((s) => (
            <Badge key={s.id}>{s.code}</Badge>
          ))}
        </p>
      )}

      <form
        className="mb-3 grid gap-2 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          apply(
            openPackPackage(snap, {
              orderId,
              stationId: emptyToNull(stationId),
              sscc: emptyToNull(sscc),
              weightKg: optionalNumber(weight),
              dimLengthCm: optionalNumber(length),
              dimWidthCm: optionalNumber(width),
              dimHeightCm: optionalNumber(height),
            }),
            "Bulto abierto",
            "Package opened",
          );
          setSscc("");
          setWeight("");
          setLength("");
          setWidth("");
          setHeight("");
        }}
      >
        <select
          required
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
        >
          <option value="">{lang === "es" ? "Pedido" : "Order"}</option>
          {openOrders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.code} · {o.customer}
            </option>
          ))}
        </select>
        <select
          value={stationId}
          onChange={(e) => setStationId(e.target.value)}
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
        >
          <option value="">{lang === "es" ? "Estación (opcional)" : "Station (optional)"}</option>
          {(snap.packStations ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} · {s.name}
            </option>
          ))}
        </select>
        <input
          value={sscc}
          onChange={(e) => setSscc(e.target.value)}
          placeholder={
            snap.org.ssccPrefix
              ? lang === "es"
                ? "SSCC (vacío = generar con prefijo)"
                : "SSCC (empty = generate with prefix)"
              : lang === "es"
                ? "SSCC escrito"
                : "Written SSCC"
          }
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
        />
        <input
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder={lang === "es" ? "Peso kg (opcional)" : "Weight kg (optional)"}
          inputMode="decimal"
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
        />
        <input
          value={length}
          onChange={(e) => setLength(e.target.value)}
          placeholder={lang === "es" ? "Largo cm" : "Length cm"}
          inputMode="decimal"
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
        />
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            placeholder={lang === "es" ? "Ancho" : "Width"}
            inputMode="decimal"
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
          />
          <input
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder={lang === "es" ? "Alto" : "Height"}
            inputMode="decimal"
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
          />
          <button type="submit" className="rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white">
            {lang === "es" ? "Abrir bulto" : "Open package"}
          </button>
        </div>
      </form>

      {msg && <p className="mb-2 text-xs font-semibold text-[var(--danger)]">{msg}</p>}
      {okMsg && <p className="mb-2 text-xs font-semibold text-[var(--ok)]">{okMsg}</p>}

      {packages.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
          <Package className="size-4" />
          {lang === "es" ? "Ningún bulto escrito todavía." : "No packages written yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {packages.map((pkg) => {
            const order = snap.outbound.find((o) => o.id === pkg.orderId);
            return (
              <li
                key={pkg.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-sunken)] px-3 py-2"
              >
                <span className="text-sm">
                  <span className="inline-flex items-center gap-1.5 font-mono font-semibold">
                    <ScanBarcode className="size-3.5" />
                    {pkg.sscc}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[var(--ink-muted)]">
                    {order?.code ?? pkg.orderId}
                    {pkg.weightKg != null ? ` · ${pkg.weightKg} kg` : ""}
                    {pkg.dimLengthCm != null && pkg.dimWidthCm != null && pkg.dimHeightCm != null
                      ? ` · ${pkg.dimLengthCm}×${pkg.dimWidthCm}×${pkg.dimHeightCm} cm`
                      : ""}
                  </span>
                </span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--glass-border)] px-3 py-1.5 text-xs font-semibold"
                  onClick={() => openPackPackagePrint(snap, pkg.id, lang)}
                >
                  <Printer className="size-3.5" />
                  {lang === "es" ? "Imprimir" : "Print"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const SHIP_ERR: Record<string, { es: string; en: string }> = {
  order_missing: { es: "Pedido no encontrado", en: "Order missing" },
  order_done: { es: "Ese pedido ya salió", en: "That order already shipped" },
  shipment_missing: { es: "No hay expedición", en: "No shipment" },
  shipment_cancelled: { es: "Esa expedición está cancelada", en: "Shipment cancelled" },
  already_shipped: { es: "Ya está expedido", en: "Already shipped" },
};

export function WmsShipCard({ lang }: { lang: Lang }) {
  const { snap, commit } = useWmsLive();
  const [orderId, setOrderId] = useState("");
  const [tracking, setTracking] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const openOrders = snap.outbound.filter((o) => o.status !== "expedido");
  const shipments = (snap.shipments ?? []).slice(0, 8);

  return (
    <Card
      title={lang === "es" ? "Expedición · MockCarrierAdapter" : "Shipping · MockCarrierAdapter"}
      subtitle={
        lang === "es"
          ? "Adapter etiquetado MOCK. El tracking solo se guarda si lo escribes. Expedir sin tracking sigue siendo válido. No es SEUR ni DHL."
          : "MOCK-labelled adapter. Tracking is stored only if you type it. Shipping without tracking stays valid. Not SEUR or DHL."
      }
    >
      <form
        className="mb-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          const result = mockCarrierAdapter.createShipment(snap, orderId, emptyToNull(tracking));
          if (!result.ok) {
            setMsg(SHIP_ERR[result.error]?.[lang] ?? result.error);
            return;
          }
          commit(result.snap);
          setMsg(null);
          setTracking("");
        }}
      >
        <select
          required
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
        >
          <option value="">{lang === "es" ? "Pedido" : "Order"}</option>
          {openOrders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.code} · {o.customer}
            </option>
          ))}
        </select>
        <input
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder={lang === "es" ? "Tracking escrito (opcional)" : "Written tracking (optional)"}
          className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
        />
        <button type="submit" className="rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white">
          {lang === "es" ? "Abrir MOCK" : "Open MOCK"}
        </button>
      </form>
      {msg && <p className="mb-2 text-xs font-semibold text-[var(--danger)]">{msg}</p>}
      {shipments.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)]">
          {lang === "es" ? "Ninguna expedición abierta." : "No open shipments."}
        </p>
      ) : (
        <ul className="space-y-2">
          {shipments.map((s) => {
            const order = snap.outbound.find((o) => o.id === s.orderId);
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-sunken)] px-3 py-2"
              >
                <span className="text-sm">
                  <span className="font-mono text-xs font-semibold">{order?.code ?? s.orderId}</span>
                  {" · "}
                  {s.status}
                  <span className="mt-0.5 block text-[11px] text-[var(--ink-muted)]">
                    {s.tracking ?? (lang === "es" ? "sin tracking" : "no tracking")}
                    {s.mock ? " · MOCK" : ""}
                  </span>
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    className="rounded-full border border-[var(--glass-border)] px-3 py-1.5 text-xs font-semibold"
                    onClick={() => openMockLabelPrint(snap, s.id, lang)}
                  >
                    {lang === "es" ? "Etiqueta MOCK" : "MOCK label"}
                  </button>
                  {s.status !== "SHIPPED" && s.status !== "CANCELLED" && (
                    <button
                      type="button"
                      className="rounded-full border border-[var(--glass-border)] px-3 py-1.5 text-xs font-semibold"
                      onClick={() => {
                        const result = mockCarrierAdapter.cancelShipment(snap, s.id);
                        if (!result.ok) {
                          setMsg(SHIP_ERR[result.error]?.[lang] ?? result.error);
                          return;
                        }
                        commit(result.snap);
                        setMsg(null);
                      }}
                    >
                      {lang === "es" ? "Cancelar" : "Cancel"}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

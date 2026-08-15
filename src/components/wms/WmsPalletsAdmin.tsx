import { Badge, Card } from "@/components/CrmChrome";
import type { Lang } from "@/lib/i18n";
import { createPallet, deletePallet, updatePallet, type PalletStatus } from "@/lib/wms";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useWmsLive } from "./useWmsLive";

function statusTone(s: string): "good" | "warn" | "bad" | "brand" | "neutral" {
  if (["en_ubicacion", "expedido"].includes(s)) return "good";
  if (["picking", "muelle", "en_transito"].includes(s)) return "warn";
  if (s === "cuarentena") return "bad";
  return "brand";
}

const STATUSES: PalletStatus[] = [
  "en_ubicacion",
  "en_transito",
  "picking",
  "muelle",
  "expedido",
  "cuarentena",
];

export function WmsPalletsPanel({ lang }: { lang: Lang }) {
  const { snap, commit } = useWmsLive();
  const skuMap = useMemo(() => new Map(snap.skus.map((s) => [s.id, s])), [snap.skus]);
  const slotMap = useMemo(() => new Map(snap.slots.map((s) => [s.id, s])), [snap.slots]);
  const [q, setQ] = useState("");
  const [siteId, setSiteId] = useState(snap.sites[0]?.id ?? "");
  const [skuId, setSkuId] = useState(snap.skus[0]?.id ?? "");
  const [qty, setQty] = useState(48);
  const [lot, setLot] = useState("");
  const [supplier, setSupplier] = useState("");
  const [slotId, setSlotId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const freeSlots = snap.slots.filter(
    (s) => s.siteId === siteId && s.status === "libre" && s.aisle !== "M",
  );
  const rows = snap.pallets
    .filter((p) => {
      if (!q.trim()) return true;
      const sku = skuMap.get(p.skuId);
      const hay = `${p.sscc} ${p.lot} ${sku?.name ?? ""} ${sku?.sku ?? ""}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    })
    .slice(0, 80);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
            {lang === "es" ? "Palets · SSCC" : "Pallets · SSCC"}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {lang === "es"
              ? "Alta, edición y baja de palets. El SSCC se genera si no lo escribes."
              : "Create, edit and remove pallets. SSCC is generated if you leave it blank."}
          </p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={lang === "es" ? "Buscar SSCC, lote, SKU…" : "Search SSCC, lot, SKU…"}
          className="w-full max-w-xs rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
        />
      </header>

      <Card title={lang === "es" ? "Agregar palet" : "Add pallet"}>
        <form
          className="grid gap-2 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            const result = createPallet(snap, {
              skuId,
              qty,
              lot,
              expiry: null,
              siteId,
              slotId: slotId || null,
              supplier,
            });
            if (!result.ok) {
              setMsg(lang === "es" ? "No se pudo crear el palet" : "Could not create pallet");
              return;
            }
            commit(result.snap);
            setLot("");
            setSupplier("");
            setSlotId("");
            setMsg(null);
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
          <select
            value={skuId}
            onChange={(e) => setSkuId(e.target.value)}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          >
            {snap.skus.map((s) => (
              <option key={s.id} value={s.id}>
                {s.sku} · {s.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          />
          <input
            value={lot}
            onChange={(e) => setLot(e.target.value)}
            placeholder={lang === "es" ? "Lote" : "Lot"}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          />
          <input
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder={lang === "es" ? "Proveedor" : "Supplier"}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          />
          <select
            value={slotId}
            onChange={(e) => setSlotId(e.target.value)}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          >
            <option value="">{lang === "es" ? "Sin hueco (muelle)" : "No slot (dock)"}</option>
            {freeSlots.slice(0, 80).map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white md:col-span-3"
          >
            <Plus className="h-4 w-4" />
            {lang === "es" ? "Agregar palet" : "Add pallet"}
          </button>
        </form>
        {msg && <p className="mt-2 text-xs font-semibold text-[var(--danger)]">{msg}</p>}
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
              <tr>
                <th className="pb-2 pr-3">SSCC</th>
                <th className="pb-2 pr-3">SKU</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Cant." : "Qty"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Hueco" : "Slot"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Estado" : "Status"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Caducidad" : "Expiry"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Proveedor" : "Supplier"}</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const sku = skuMap.get(p.skuId);
                const slot = p.slotId ? slotMap.get(p.slotId) : null;
                return (
                  <tr key={p.id} className="border-t border-[var(--glass-border)]">
                    <td className="py-2.5 pr-3 font-mono text-xs">{p.sscc}</td>
                    <td className="py-2.5 pr-3">
                      <p className="font-medium">{sku?.name ?? p.skuId}</p>
                      <p className="text-xs text-[var(--ink-muted)]">{sku?.sku}</p>
                    </td>
                    <td className="py-2.5 pr-3">
                      <input
                        type="number"
                        defaultValue={p.qty}
                        className="w-16 rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-sm"
                        onBlur={(e) => {
                          const result = updatePallet(snap, p.id, {
                            qty: Number(e.target.value),
                            lot: p.lot,
                            expiry: p.expiry,
                            supplier: p.supplier,
                            status: p.status,
                          });
                          if (result.ok) commit(result.snap);
                        }}
                      />
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{slot?.code ?? "—"}</td>
                    <td className="py-2.5 pr-3">
                      <select
                        value={p.status}
                        className={cn("rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-xs")}
                        onChange={(e) => {
                          const result = updatePallet(snap, p.id, {
                            qty: p.qty,
                            lot: p.lot,
                            expiry: p.expiry,
                            supplier: p.supplier,
                            status: e.target.value as PalletStatus,
                          });
                          if (result.ok) commit(result.snap);
                        }}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-[var(--ink-muted)]">{p.expiry ?? "—"}</td>
                    <td className="py-2.5 pr-3">{p.supplier}</td>
                    <td className="py-2.5">
                      <button
                        type="button"
                        className="rounded-full border border-[var(--glass-border)] p-1.5"
                        onClick={() => {
                          const result = deletePallet(snap, p.id);
                          if (result.ok) commit(result.snap);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

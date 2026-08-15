import { Badge, Card } from "@/components/CrmChrome";
import type { Lang } from "@/lib/i18n";
import { createAsn, deleteAsn, receiveAsnPallet, updateAsn, type InboundAsn } from "@/lib/wms";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useWmsLive } from "./useWmsLive";

function statusTone(s: string): "good" | "warn" | "bad" | "brand" | "neutral" {
  if (s === "cerrado") return "good";
  if (["en_muelle", "descargando", "ubicando"].includes(s)) return "warn";
  return "brand";
}

const STATUSES: InboundAsn["status"][] = [
  "previsto",
  "en_muelle",
  "descargando",
  "ubicando",
  "cerrado",
];

export function WmsInboundPanel({ lang }: { lang: Lang }) {
  const { snap, commit } = useWmsLive();
  const [supplier, setSupplier] = useState("");
  const [dock, setDock] = useState("M-01");
  const [eta, setEta] = useState("2026-08-16T09:00");
  const [siteId, setSiteId] = useState(snap.sites[0]?.id ?? "");
  const [lines, setLines] = useState(4);
  const [palletsExpected, setPalletsExpected] = useState(8);
  const [recvSku, setRecvSku] = useState(snap.skus[0]?.id ?? "");
  const [recvQty, setRecvQty] = useState(48);
  const [recvLot, setRecvLot] = useState("");
  const [recvMsg, setRecvMsg] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
          {lang === "es" ? "Recepción · ASN" : "Receiving · ASN"}
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          {lang === "es"
            ? "Crear, editar estado de muelle y cerrar la entrada. No se fabrica mercancía al crear el ASN."
            : "Create, edit dock status and close inbound. Creating an ASN does not invent goods."}
        </p>
      </header>

      <Card title={lang === "es" ? "Nueva recepción" : "New inbound"}>
        <form
          className="grid gap-2 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            const result = createAsn(snap, {
              supplier,
              eta: new Date(eta).toISOString(),
              dock,
              siteId,
              lines,
              palletsExpected,
            });
            if (result.ok) {
              commit(result.snap);
              setSupplier("");
            }
          }}
        >
          <input
            required
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder={lang === "es" ? "Proveedor" : "Supplier"}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          />
          <input
            value={dock}
            onChange={(e) => setDock(e.target.value)}
            placeholder="M-01"
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
          />
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
            type="number"
            min={1}
            value={lines}
            onChange={(e) => setLines(Number(e.target.value))}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={1}
            value={palletsExpected}
            onChange={(e) => setPalletsExpected(Number(e.target.value))}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white md:col-span-3"
          >
            <Plus className="h-4 w-4" />
            {lang === "es" ? "Crear ASN" : "Create ASN"}
          </button>
        </form>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {snap.inbound.map((asn) => {
          const pct = asn.palletsExpected
            ? Math.round((asn.palletsDone / asn.palletsExpected) * 100)
            : 0;
          return (
            <Card key={asn.id} title={asn.code} subtitle={asn.supplier}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <select
                  value={asn.status}
                  className="rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-xs"
                  onChange={(e) => {
                    const result = updateAsn(snap, asn.id, {
                      status: e.target.value as InboundAsn["status"],
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
                <Badge tone={statusTone(asn.status)}>{asn.status}</Badge>
                <input
                  value={asn.dock}
                  className="w-20 rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 font-mono text-xs"
                  onBlur={(e) => {
                    const result = updateAsn(snap, asn.id, { dock: e.target.value });
                    if (result.ok) commit(result.snap);
                  }}
                />
                <button
                  type="button"
                  className="ml-auto rounded-full border border-[var(--glass-border)] p-1.5"
                  onClick={() => {
                    const result = deleteAsn(snap, asn.id);
                    if (result.ok) commit(result.snap);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mb-2 flex justify-between text-sm text-[var(--ink-muted)]">
                <span>
                  {asn.palletsDone}/{asn.palletsExpected} {lang === "es" ? "palets" : "pallets"}
                </span>
                <span>{asn.lines} lines</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-[var(--ink-muted)]">
                ETA {new Date(asn.eta).toLocaleString(lang === "es" ? "es-ES" : "en-GB")}
              </p>
              {asn.status !== "cerrado" && asn.palletsDone < asn.palletsExpected && (
                <form
                  className="mt-3 grid gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const result = receiveAsnPallet(snap, asn.id, {
                      skuId: recvSku,
                      qty: recvQty,
                      lot: recvLot,
                    });
                    if (!result.ok) {
                      setRecvMsg(
                        lang === "es"
                          ? "No hay hueco de muelle libre o el ASN no admite más palets"
                          : "No free dock slot or ASN is complete",
                      );
                      return;
                    }
                    commit(result.snap);
                    setRecvLot("");
                    setRecvMsg(null);
                  }}
                >
                  <select
                    value={recvSku}
                    onChange={(e) => setRecvSku(e.target.value)}
                    className="rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-xs"
                  >
                    {snap.skus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.sku} · {s.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={recvQty}
                      onChange={(e) => setRecvQty(Number(e.target.value))}
                      className="w-20 rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-xs"
                    />
                    <input
                      value={recvLot}
                      onChange={(e) => setRecvLot(e.target.value)}
                      placeholder={lang === "es" ? "Lote" : "Lot"}
                      className="flex-1 rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-xs"
                    />
                    <button
                      type="submit"
                      className="rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-semibold text-white"
                    >
                      {lang === "es" ? "Recepcionar" : "Receive"}
                    </button>
                  </div>
                </form>
              )}
              {recvMsg && <p className="mt-2 text-xs font-semibold text-[var(--danger)]">{recvMsg}</p>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

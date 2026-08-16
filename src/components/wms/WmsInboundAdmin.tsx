import { Badge, Card } from "@/components/CrmChrome";
import type { Lang } from "@/lib/i18n";
import {
  addAsnLine,
  closeAsnIfLocated,
  closeAsnLine,
  createAsn,
  decideQc,
  deleteAsn,
  incidentsForAsn,
  linesForAsn,
  palletCanPutaway,
  palletQcStatus,
  putawayReceivedPallet,
  rankPutawayCandidates,
  receiveAgainstLine,
  receiveAsnPallet,
  suggestPutawaySlot,
  updateAsn,
  type InboundAsn,
} from "@/lib/wms";
import { ArrowDownToLine, Plus, ShieldCheck, ShieldX, Trash2 } from "lucide-react";
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
  const [recvLineId, setRecvLineId] = useState("");
  const [damagedQty, setDamagedQty] = useState(0);
  const [lineSku, setLineSku] = useState(snap.skus[0]?.id ?? "");
  const [lineQty, setLineQty] = useState(48);
  const [lineLot, setLineLot] = useState("");
  const [recvMsg, setRecvMsg] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
          {lang === "es" ? "Recepción · ASN" : "Receiving · ASN"}
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          {lang === "es"
            ? "Líneas ASN escritas, incidencias con qty real y QC antes de ubicar. La pistola sigue recepcionando palets en muelle. Un palet en cuarentena no pica."
            : "Written ASN lines, incidents with real qty and QC before putaway. The gun still receives pallets on dock. A quarantined pallet is not picked."}
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
          const asnLines = linesForAsn(snap, asn.id);
          const incidents = incidentsForAsn(snap, asn.id);
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
                <span>
                  {asnLines.length}/{asn.lines} {lang === "es" ? "líneas escritas" : "written lines"}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-[var(--ink-muted)]">
                ETA {new Date(asn.eta).toLocaleString(lang === "es" ? "es-ES" : "en-GB")}
              </p>

              {asn.status !== "cerrado" && (
                <form
                  className="mt-3 grid gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const result = addAsnLine(snap, asn.id, {
                      skuId: lineSku,
                      expectedQty: lineQty,
                      expectedLot: lineLot,
                    });
                    if (!result.ok) {
                      setRecvMsg(
                        lang === "es"
                          ? "No se pudo añadir la línea (SKU o ASN cerrado)"
                          : "Could not add line (SKU or ASN closed)",
                      );
                      return;
                    }
                    commit(result.snap);
                    setLineLot("");
                    setRecvMsg(null);
                  }}
                >
                  <p className="text-[11px] font-semibold text-[var(--ink-muted)]">
                    {lang === "es" ? "Añadir línea (SKU y qty escritos)" : "Add line (written SKU and qty)"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={lineSku}
                      onChange={(e) => setLineSku(e.target.value)}
                      className="flex-1 rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-xs"
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
                      value={lineQty}
                      onChange={(e) => setLineQty(Number(e.target.value))}
                      className="w-16 rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-xs"
                    />
                    <input
                      value={lineLot}
                      onChange={(e) => setLineLot(e.target.value)}
                      placeholder={lang === "es" ? "Lote esperado" : "Expected lot"}
                      className="w-24 rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-xs"
                    />
                    <button
                      type="submit"
                      className="rounded-full border border-[var(--glass-border)] px-2 py-1 text-[11px] font-semibold"
                    >
                      {lang === "es" ? "Línea" : "Line"}
                    </button>
                  </div>
                </form>
              )}

              {asnLines.length > 0 && (
                <ul className="mt-2 space-y-1 text-[11px]">
                  {asnLines.map((line) => {
                    const sku = snap.skus.find((s) => s.id === line.skuId);
                    return (
                      <li key={line.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          {sku?.sku} · {line.receivedQty}/{line.expectedQty}
                          {line.expectedLot ? ` · ${line.expectedLot}` : ""} · {line.status}
                        </span>
                        {line.status !== "closed" && (
                          <button
                            type="button"
                            className="shrink-0 text-[var(--danger)]"
                            onClick={() => {
                              const result = closeAsnLine(snap, line.id);
                              if (result.ok) commit(result.snap);
                            }}
                          >
                            {lang === "es" ? "Cerrar (faltante)" : "Close (shortage)"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {asn.status !== "cerrado" && asn.palletsDone < asn.palletsExpected && (
                <form
                  className="mt-3 grid gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const result = recvLineId
                      ? receiveAgainstLine(snap, asn.id, recvLineId, {
                          qty: recvQty,
                          lot: recvLot,
                          skuId: recvSku,
                          damagedQty,
                        })
                      : receiveAsnPallet(snap, asn.id, {
                          skuId: recvSku,
                          qty: recvQty,
                          lot: recvLot,
                        });
                    if (!result.ok) {
                      setRecvMsg(
                        lang === "es"
                          ? "No hay hueco de muelle, la línea no admite esa recepción o el ASN está completo"
                          : "No free dock slot, line rejected the receipt, or ASN is complete",
                      );
                      return;
                    }
                    commit(result.snap);
                    setRecvLot("");
                    setDamagedQty(0);
                    setRecvMsg(null);
                  }}
                >
                  {asnLines.some((l) => l.status !== "closed") && (
                    <select
                      value={recvLineId}
                      onChange={(e) => {
                        setRecvLineId(e.target.value);
                        const line = asnLines.find((l) => l.id === e.target.value);
                        if (line) {
                          setRecvSku(line.skuId);
                          setRecvQty(Math.max(1, line.expectedQty - line.receivedQty));
                          setRecvLot(line.expectedLot ?? "");
                        }
                      }}
                      className="rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-xs"
                    >
                      <option value="">
                        {lang === "es" ? "Pistola (sin línea)" : "Gun (no line)"}
                      </option>
                      {asnLines
                        .filter((l) => l.status !== "closed")
                        .map((l) => {
                          const sku = snap.skus.find((s) => s.id === l.skuId);
                          return (
                            <option key={l.id} value={l.id}>
                              {sku?.sku} · {l.receivedQty}/{l.expectedQty}
                            </option>
                          );
                        })}
                    </select>
                  )}
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
                      className="w-16 rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-xs"
                    />
                    <input
                      value={recvLot}
                      onChange={(e) => setRecvLot(e.target.value)}
                      placeholder={lang === "es" ? "Lote" : "Lot"}
                      className="flex-1 rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-xs"
                    />
                    <input
                      type="number"
                      min={0}
                      value={damagedQty}
                      onChange={(e) => setDamagedQty(Number(e.target.value))}
                      title={lang === "es" ? "Dañado" : "Damaged"}
                      className="w-14 rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-xs"
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

              {incidents.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[11px] text-[var(--danger)]">
                  {incidents.map((inc) => (
                    <li key={inc.id}>
                      {inc.kind} · {inc.qty} ud. · {inc.note}
                    </li>
                  ))}
                </ul>
              )}

              {(() => {
                const dockPals = snap.pallets.filter(
                  (p) => p.asnId === asn.id && (p.status === "muelle" || p.status === "cuarentena"),
                );
                if (dockPals.length === 0) {
                  if (asn.status === "ubicando" && asn.palletsDone >= asn.palletsExpected) {
                    return (
                      <button
                        type="button"
                        className="mt-3 rounded-full bg-[var(--accent)] px-3 py-1.5 text-[11px] font-semibold text-white"
                        onClick={() => {
                          const result = closeAsnIfLocated(snap, asn.id);
                          if (result.ok) commit(result.snap);
                        }}
                      >
                        {lang === "es" ? "Cerrar ASN" : "Close ASN"}
                      </button>
                    );
                  }
                  return null;
                }
                return (
                  <ul className="mt-3 space-y-2">
                    {dockPals.map((pal) => {
                      const sku = snap.skus.find((s) => s.id === pal.skuId);
                      const ranked = rankPutawayCandidates(snap, pal, { limit: 1 })[0];
                      const dest = ranked ? snap.slots.find((s) => s.id === ranked.slotId) : suggestPutawaySlot(snap, pal);
                      const qc = palletQcStatus(pal);
                      const canPut = palletCanPutaway(pal);
                      return (
                        <li
                          key={pal.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] px-2 py-1.5 text-xs"
                        >
                          <span className="min-w-0">
                            <span className="font-mono font-semibold">{pal.sscc.slice(-8)}</span>
                            <span className="mt-0.5 block truncate text-[var(--ink-muted)]">
                              {sku?.name} · {pal.qty} · QC {qc}
                              {canPut ? ` → ${dest?.code ?? "—"}${ranked ? ` · ${ranked.travelPct}%` : ""}` : ""}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            {qc === "PENDING" && (
                              <>
                                <button
                                  type="button"
                                  className="rounded-full border border-[var(--glass-border)] p-1"
                                  title={lang === "es" ? "Aprobar QC" : "Approve QC"}
                                  onClick={() => {
                                    const result = decideQc(snap, pal.id, "APPROVED");
                                    if (result.ok) commit(result.snap);
                                  }}
                                >
                                  <ShieldCheck className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded-full border border-[var(--glass-border)] p-1"
                                  title={lang === "es" ? "Cuarentena" : "Quarantine"}
                                  onClick={() => {
                                    const result = decideQc(snap, pal.id, "QUARANTINED");
                                    if (result.ok) commit(result.snap);
                                  }}
                                >
                                  <ShieldX className="h-3 w-3" />
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              disabled={!dest || !canPut}
                              className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                              onClick={() => {
                                if (!dest) return;
                                const result = putawayReceivedPallet(snap, pal.id, dest.code, null);
                                if (!result.ok) {
                                  setRecvMsg(
                                    lang === "es"
                                      ? "No se pudo ubicar: QC pendiente, destino ocupado o palet no está en muelle"
                                      : "Could not put away: QC pending, dest busy or pallet not on dock",
                                  );
                                  return;
                                }
                                commit(result.snap);
                                setRecvMsg(null);
                              }}
                            >
                              <ArrowDownToLine className="h-3 w-3" />
                              {lang === "es" ? "Ubicar" : "Putaway"}
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
              {recvMsg && <p className="mt-2 text-xs font-semibold text-[var(--danger)]">{recvMsg}</p>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

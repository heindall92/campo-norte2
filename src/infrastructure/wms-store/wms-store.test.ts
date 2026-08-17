import { describe, expect, it } from "vitest";
import {
  canWriteWmsProduction,
  createMemoryRfOutbox,
  createMemoryStorage,
  createDemoWmsAdapter,
  isDemoWmsEmail,
  mergeRfOutbox,
  overlayFulfillment,
  overlayStock,
  productionBootstrapSnapshot,
  productionPlantSnapshot,
  palletStockPayload,
  ledgerStockPayload,
  stockCommitBatches,
  stripFloorForPostgres,
  stripStockForFloor,
  fulfillmentPayload,
  toPostgresOrgId,
  WMS_PG_ORG_ID,
  WMS_SNAPSHOT_ORG_ID,
} from "@/infrastructure/wms-store";
import { confirmPick } from "@/lib/wms/picking";
import { receiveAgainstAsn } from "@/lib/wms/receiving";
import { packOrderWithSscc } from "@/lib/wms/packing";
import { shipOutboundOrder, stageOrderToDock } from "@/lib/wms/outbound";
import { confirmRfTaskOrQueue } from "@/lib/wms/offline-sync";
import { buildRfQueue, startRfSession } from "@/lib/wms/rf";
import { scopeSnapshotToOrg } from "@/lib/wms/org";
import { buildWmsSeed } from "@/lib/wms/seed";
import { hydrateInventory } from "@/lib/wms/inventory";
import type { RfOutboxItem } from "@/lib/wms/types";

describe("canWriteWmsProduction", () => {
  it("bloquea login demo local y emails @camponorte.demo", () => {
    expect(
      canWriteWmsProduction({ provider: "local", email: "sofia@camponorte.demo" }),
    ).toBe(false);
    expect(
      canWriteWmsProduction({ provider: "supabase", email: "sofia@camponorte.demo" }),
    ).toBe(false);
    expect(canWriteWmsProduction(null)).toBe(false);
    expect(isDemoWmsEmail("Luis@CampoNorte.demo")).toBe(true);
  });

  it("sin Supabase configurado no escribe Postgres", () => {
    expect(
      canWriteWmsProduction({ provider: "supabase", email: "ops@empresa.es" }),
    ).toBe(false);
  });
});

describe("org mapping", () => {
  it("mapea org-camponorte al UUID de migraciones", () => {
    expect(toPostgresOrgId(WMS_SNAPSHOT_ORG_ID)).toBe(WMS_PG_ORG_ID);
    expect(toPostgresOrgId(WMS_PG_ORG_ID)).toBe(WMS_PG_ORG_ID);
    expect(toPostgresOrgId(null)).toBe(WMS_PG_ORG_ID);
  });
});

describe("mapper overlay", () => {
  it("HU es la fuente de qty; el floor no arrastra stock jsonb", () => {
    const seed = hydrateInventory(buildWmsSeed());
    const floor = stripStockForFloor(seed);
    expect(floor.pallets.every((p) => p.qty === 0)).toBe(true);
    expect(floor.ledger).toEqual([]);
    const live = seed.pallets[0]!;
    const overlaid = overlayStock(
      floor,
      [
        {
          external_id: live.id,
          sscc: live.sscc,
          qty_base: 17,
          status: "en_ubicacion",
          location_code: seed.slots.find((s) => s.id === live.slotId)?.code ?? null,
          lot_code: live.lot,
          sku_code: live.skuId,
          received_at: live.receivedAt,
          warehouse_code: live.siteId,
        },
      ],
      [
        {
          id: "tx-1",
          type: "RECEIPT",
          qty_base: 17,
          occurred_at: "2026-08-15T08:00:00.000Z",
          correlation_id: "c1",
          idempotency_key: "k1",
          reason: "test",
          sku: live.skuId,
          pallet_external_id: live.id,
        },
      ],
    );
    expect(overlaid.pallets.find((p) => p.id === live.id)?.qty).toBe(17);
    expect(overlaid.ledger?.[0]?.qty).toBe(17);
    expect(overlaid.org.rlsMode).toBe("postgres");
  });

  it("dos HU en el mismo hueco no se pisan: el segundo se queda sin slot", () => {
    const seed = hydrateInventory(buildWmsSeed());
    const slot = seed.slots.find((s) => s.code === "A-01-01-1")!;
    const overlaid = overlayStock(
      stripStockForFloor(seed),
      [
        {
          external_id: "pal-a",
          sscc: "003841009000000001",
          qty_base: 10,
          status: "en_ubicacion",
          location_code: slot.code,
          lot_code: "L1",
          sku_code: "sku-arroz",
          received_at: "2026-08-15T08:00:00.000Z",
          warehouse_code: "site-sev",
        },
        {
          external_id: "pal-b",
          sscc: "003841009000000002",
          qty_base: 11,
          status: "en_ubicacion",
          location_code: slot.code,
          lot_code: "L2",
          sku_code: "sku-arroz",
          received_at: "2026-08-15T08:00:00.000Z",
          warehouse_code: "site-sev",
        },
      ],
      [],
    );
    const a = overlaid.pallets.find((p) => p.id === "pal-a")!;
    const b = overlaid.pallets.find((p) => p.id === "pal-b")!;
    expect(a.slotId).toBe(slot.id);
    expect(b.slotId).toBeNull();
    expect(overlaid.slots.find((s) => s.id === slot.id)?.palletId).toBe("pal-a");
  });

  it("planta de producción trae operación para recorrer las fases", () => {
    const plant = productionPlantSnapshot();
    expect(plant.pallets.length).toBeGreaterThan(20);
    expect(plant.inbound.length).toBeGreaterThan(0);
    expect(plant.outbound.length).toBeGreaterThan(0);
    expect(plant.pickWaves.length).toBeGreaterThan(0);
    expect(plant.sites).toHaveLength(2);
    expect(plant.org.rlsMode).toBe("postgres");
    expect(plant.seededFromDemo).toBe(false);
    const ssccs = plant.pallets.map((p) => p.sscc);
    expect(new Set(ssccs).size).toBe(ssccs.length);
    const batches = stockCommitBatches(palletStockPayload(plant), ledgerStockPayload(plant), 80);
    expect(batches.some((b) => b.pallets.length > 0)).toBe(true);
    expect(batches.filter((b) => b.pallets.length > 0).every((b) => b.ledger.length === 0)).toBe(true);
    const palletIds = new Set(plant.pallets.map((p) => p.id));
    for (const batch of batches) {
      for (const tx of batch.ledger) {
        if (tx.palletId) expect(palletIds.has(tx.palletId)).toBe(true);
      }
    }
  });

  it("bootstrap de producción no hereda palets demo", () => {
    const boot = productionBootstrapSnapshot();
    expect(boot.pallets).toHaveLength(0);
    expect(boot.seededFromDemo).toBe(false);
    expect(boot.slots.every((s) => s.palletId === null)).toBe(true);
    const floor = stripStockForFloor(boot);
    expect(floor.pallets.every((p) => p.qty === 0)).toBe(true);
    expect(floor.sites.map((s) => s.id).sort()).toEqual(["site-hue", "site-sev"]);
  });

  it("overlay de org A no se mezcla al filtrar org B", () => {
    const seed = hydrateInventory(buildWmsSeed());
    const live = seed.pallets[0]!;
    const overlaid = overlayStock(stripStockForFloor(seed), [
      {
        external_id: live.id,
        sscc: live.sscc,
        qty_base: 9,
        status: "en_ubicacion",
        location_code: null,
        lot_code: live.lot,
        sku_code: live.skuId,
        received_at: live.receivedAt,
        warehouse_code: live.siteId,
      },
    ], []);
    const other = scopeSnapshotToOrg(overlaid, "org-intruso");
    expect(other.pallets).toHaveLength(0);
    expect(scopeSnapshotToOrg(overlaid, seed.org.id).pallets.some((p) => p.id === live.id)).toBe(true);
  });
});

describe("fulfillment overlay", () => {
  it("tablas reemplazan pedidos y olas; jsonb se usa si las tablas están vacías", () => {
    const plant = productionPlantSnapshot();
    const payload = fulfillmentPayload(plant);
    expect(payload.orders.length).toBe(plant.outbound.length);
    expect(payload.asns.length).toBe(plant.inbound.length);
    expect(payload.waves.length).toBe(plant.pickWaves.length);
    expect(payload.pickTasks.length).toBe(plant.pickWaves.reduce((n, w) => n + w.lines.length, 0));
    expect(payload.slots.length).toBe(plant.slots.length);

    const stripped = stripFloorForPostgres(plant);
    expect(stripped.outbound).toEqual([]);
    expect(stripped.inbound).toEqual([]);
    expect(stripped.pickWaves).toEqual([]);
    expect(stripped.pallets.every((p) => p.qty === 0)).toBe(true);
    expect(stripped.slots.length).toBe(plant.slots.length);

    const empty = overlayFulfillment(stripped, {
      orders: [],
      asns: [],
      waves: [],
      pickTasks: [],
    });
    expect(empty.outbound).toEqual([]);

    const restored = overlayFulfillment(stripped, payload);
    expect(restored.outbound.map((o) => o.code).sort()).toEqual(plant.outbound.map((o) => o.code).sort());
    expect(restored.inbound.map((a) => a.code).sort()).toEqual(plant.inbound.map((a) => a.code).sort());
    expect(restored.pickWaves.map((w) => w.id).sort()).toEqual(plant.pickWaves.map((w) => w.id).sort());
    const wave = plant.pickWaves[0]!;
    expect(restored.pickWaves.find((w) => w.id === wave.id)?.lines.length).toBe(wave.lines.length);
  });

  it("hueco bloqueado sale de locations; ocupado lo decide el stock", () => {
    const plant = productionPlantSnapshot();
    const slot = plant.slots.find((s) => s.status === "ocupado") ?? plant.slots[0]!;
    const overlaid = overlayFulfillment(plant, {
      slots: [
        {
          code: slot.code,
          siteId: slot.siteId,
          zone: slot.zone,
          aisle: slot.aisle,
          rack: slot.rack,
          level: slot.level,
          position: slot.position,
          pickFace: slot.pickFace,
          status: "bloqueado",
          capacityPallets: slot.capacityPallets,
        },
      ],
    });
    expect(overlaid.slots.find((s) => s.id === slot.id)?.status).toBe("bloqueado");
  });
});

describe("DemoWmsAdapter", () => {
  it("roundtrip save/load conserva un pick", () => {
    const adapter = createDemoWmsAdapter(createMemoryStorage());
    const snap = adapter.peek();
    const wave = snap.pickWaves.find(
      (w) => w.kind === "picking" && w.lines.some((l) => l.status === "pendiente" || l.status === "en_curso"),
    )!;
    const line = wave.lines.find((l) => l.status === "pendiente" || l.status === "en_curso")!;
    const slot = snap.slots.find((s) => s.id === line.slotId)!;
    const pallet = snap.pallets.find((p) => p.id === line.palletId)!;
    const picked = confirmPick(snap, wave.id, line.id, {
      slotCode: slot.code,
      sscc: pallet.sscc,
      qty: 1,
    });
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    return adapter.save(picked.snap).then(async () => {
      const loaded = await adapter.load();
      expect(loaded.pallets.find((p) => p.id === pallet.id)?.qty).toBe(
        picked.snap.pallets.find((p) => p.id === pallet.id)?.qty,
      );
    });
  });
});

describe("walkthrough recepción → ship", () => {
  it("recibe, pica, embala y expede sin negativos", async () => {
    const adapter = createDemoWmsAdapter(createMemoryStorage());
    let snap = adapter.peek();
    const asn = snap.inbound.find((a) => a.status !== "cerrado") ?? snap.inbound[0]!;
    const rec = receiveAgainstAsn(snap, asn.id, { skuId: "sku-arroz", qty: 2, lot: "L-WALK" });
    expect(rec.ok).toBe(true);
    if (!rec.ok) return;
    snap = rec.snap;

    const wave = snap.pickWaves.find(
      (w) => w.kind === "picking" && w.lines.some((l) => l.status === "pendiente" || l.status === "en_curso"),
    )!;
    const line = wave.lines.find((l) => l.status === "pendiente" || l.status === "en_curso")!;
    const slot = snap.slots.find((s) => s.id === line.slotId)!;
    const pallet = snap.pallets.find((p) => p.id === line.palletId)!;
    const picked = confirmPick(snap, wave.id, line.id, {
      slotCode: slot.code,
      sscc: pallet.sscc,
      qty: 1,
    });
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    snap = picked.snap;

    const order = snap.outbound.find((o) => o.code === line.orderCode) ?? snap.outbound[0]!;
    const packed = packOrderWithSscc(snap, order.id);
    if (packed.ok) snap = packed.snap;
    const staged = stageOrderToDock(snap, order.id);
    if (staged.ok) snap = staged.snap;
    const shipped = shipOutboundOrder(snap, order.id);
    if (shipped.ok) snap = shipped.snap;

    expect(snap.pallets.every((p) => p.qty >= 0)).toBe(true);
    await adapter.save(snap);
    const loaded = await adapter.load();
    expect(loaded.pallets.every((p) => p.qty >= 0)).toBe(true);
    expect((loaded.ledger ?? []).length).toBeGreaterThan(0);
  });
});

describe("RF IndexedDB fallback memoria", () => {
  it("merge por idempotency_key y cola offline", async () => {
    const store = createMemoryRfOutbox();
    const item: RfOutboxItem = {
      id: "obx-1",
      idempotencyKey: "k-rf-1",
      taskId: "t1",
      kind: "pick",
      payload: { from: "A-01-01-1", sscc: "1", to: null, qty: 1, waveId: null, lineId: null },
      status: "pending",
      queuedAt: "2026-08-15T10:00:00.000Z",
      flushedAt: null,
      conflictReason: null,
    };
    await store.put(item);
    await store.put({ ...item, queuedAt: "2026-08-15T10:01:00.000Z" });
    const listed = await store.list();
    expect(listed).toHaveLength(1);
    expect(mergeRfOutbox([], listed)[0]?.queuedAt).toBe("2026-08-15T10:01:00.000Z");

    const snap = hydrateInventory(buildWmsSeed());
    const task = buildRfQueue(snap, "site-sev").find((t) => t.kind === "pick");
    if (!task) return;
    const session = startRfSession(task);
    const queued = confirmRfTaskOrQueue(snap, session, "op-1", {
      online: false,
      idempotencyKey: "k-rf-walk",
    });
    expect(queued.ok).toBe(true);
    if (!queued.ok) return;
    expect(queued.queued).toBe(true);
    expect(queued.snap.rfOutbox?.some((i) => i.idempotencyKey === "k-rf-walk")).toBe(true);
  });
});

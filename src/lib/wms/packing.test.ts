import { describe, expect, it } from "vitest";
import {
  addPackStation,
  generatePackSscc,
  isSsccTaken,
  openPackPackage,
  packPackageLabelHtml,
  setOrgSsccPrefix,
} from "./packing";
import { buildWmsSeed } from "./seed";

describe("oleada 8 · packing + SSCC", () => {
  it("semilla no inventa estaciones ni bultos ni prefijo GS1", () => {
    const snap = buildWmsSeed();
    expect(snap.packStations).toEqual([]);
    expect(snap.packPackages).toEqual([]);
    expect(snap.org.ssccPrefix).toBeNull();
    expect(generatePackSscc(snap).ok).toBe(false);
    const generated = generatePackSscc(snap);
    if (!generated.ok) expect(generated.error).toBe("prefix_required");
  });

  it("dos bultos no comparten SSCC y el del palet queda ocupado", () => {
    const seed = buildWmsSeed();
    const order = seed.outbound.find((o) => o.status !== "expedido")!;
    const palletSscc = seed.pallets[0]!.sscc;
    const collide = openPackPackage(seed, { orderId: order.id, sscc: palletSscc });
    expect(collide.ok).toBe(false);
    if (!collide.ok) expect(collide.error).toBe("sscc_taken");

    const first = openPackPackage(seed, { orderId: order.id, sscc: "CN-CAJA-01", weightKg: 12.5 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.sscc).toBe("CN-CAJA-01");
    expect(first.snap.packPackages[0]?.weightKg).toBe(12.5);
    expect(isSsccTaken(first.snap, "CN-CAJA-01")).toBe(true);

    const dup = openPackPackage(first.snap, { orderId: order.id, sscc: "  CN-CAJA-01  " });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error).toBe("sscc_taken");

    const second = openPackPackage(first.snap, { orderId: order.id, sscc: "CN-CAJA-02" });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const codes = second.snap.packPackages.map((p) => p.sscc);
    expect(codes).toEqual(["CN-CAJA-02", "CN-CAJA-01"]);
    expect(new Set(codes).size).toBe(2);
  });

  it("genera solo con prefijo escrito y no fabrica un SSCC GS1 de 18 dígitos", () => {
    const seed = buildWmsSeed();
    const order = seed.outbound.find((o) => o.status !== "expedido")!;
    const prefixed = setOrgSsccPrefix(seed, " CNX- ");
    expect(prefixed.ok).toBe(true);
    if (!prefixed.ok) return;
    expect(prefixed.snap.org.ssccPrefix).toBe("CNX-");

    const a = openPackPackage(prefixed.snap, { orderId: order.id });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.sscc).toBe("CNX-000001");
    expect(a.sscc?.length).toBeLessThan(18);

    const b = openPackPackage(a.snap, { orderId: order.id });
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.sscc).toBe("CNX-000002");
    expect(b.sscc).not.toBe(a.sscc);
  });

  it("la etiqueta imprime el SSCC del registro y no fabrica tracking", () => {
    const seed = buildWmsSeed();
    const order = seed.outbound.find((o) => o.status !== "expedido")!;
    const withTrack = {
      ...seed,
      outbound: seed.outbound.map((o) => (o.id === order.id ? { ...o, tracking: "FAKE-TRACK-99" } : o)),
    };
    const stationed = addPackStation(withTrack, {
      warehouseId: order.siteId,
      code: "PK-1",
      name: "Mesa 1",
    });
    expect(stationed.ok).toBe(true);
    if (!stationed.ok) return;
    const opened = openPackPackage(stationed.snap, {
      orderId: order.id,
      stationId: stationed.stationId,
      sscc: "CN-ETQ-07",
      weightKg: 8,
      dimLengthCm: 40,
      dimWidthCm: 30,
      dimHeightCm: 25,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const html = packPackageLabelHtml(opened.snap, opened.packageId!, "es");
    expect(html).toBeTruthy();
    expect(html).toContain("CN-ETQ-07");
    expect(html).toContain("8 kg");
    expect(html).toContain("40×30×25 cm");
    expect(html).toContain("Sin tracking de transportista");
    expect(html).not.toContain("FAKE-TRACK-99");
    expect(html).not.toContain("tracking:");
  });
});

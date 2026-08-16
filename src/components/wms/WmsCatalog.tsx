import { Badge, Card } from "@/components/CrmChrome";
import type { Lang } from "@/lib/i18n";
import {
  categoryLabel,
  createCategory,
  createSku,
  deleteCategory,
  deleteSku,
  stockByCategory,
  skuAvailable,
  updateCategory,
  updateSku,
  type CatalogError,
  type Sku,
} from "@/lib/wms";
import { cn } from "@/lib/utils";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useWmsLive } from "./useWmsLive";

const ERR: Record<CatalogError, { es: string; en: string }> = {
  duplicate_sku: { es: "Ese SKU ya existe", en: "SKU already exists" },
  sku_missing: { es: "SKU no encontrado", en: "SKU missing" },
  sku_in_use: { es: "Hay palets vivos de este SKU", en: "Live pallets use this SKU" },
  category_missing: { es: "Categoría no encontrada", en: "Category missing" },
  category_in_use: { es: "Hay productos en esta categoría", en: "Products use this category" },
  system_category: { es: "Las categorías de sistema no se eliminan", en: "System categories cannot be deleted" },
  duplicate_category: { es: "Esa categoría ya existe", en: "Category already exists" },
  invalid_input: { es: "Faltan datos", en: "Missing data" },
  slot_missing: { es: "Hueco no encontrado", en: "Slot missing" },
  slot_busy: { es: "Hueco ocupado", en: "Slot busy" },
  pallet_missing: { es: "Palet no encontrado", en: "Pallet missing" },
  asn_missing: { es: "ASN no encontrado", en: "ASN missing" },
  operator_missing: { es: "Operario no encontrado", en: "Operator missing" },
  operator_vacant: { es: "Es una plaza vacante", en: "Vacant slot" },
  fleet_missing: { es: "Equipo no encontrado", en: "Fleet unit missing" },
  charger_missing: { es: "Cargador no encontrado", en: "Charger missing" },
  battery_invalid: { es: "Porcentaje no válido", en: "Invalid percentage" },
};

const emptySku = (category: string): Omit<Sku, "id"> => ({
  sku: "",
  name: "",
  category,
  uom: "caja",
  unitsPerPallet: 48,
  weightKg: 100,
  abc: "B",
  minStock: 10,
  maxStock: 200,
});

export function WmsStockPanel({ lang }: { lang: Lang }) {
  const { snap, commit } = useWmsLive();
  const byCat = stockByCategory(snap.pallets, snap.skus, lang, snap.categories);
  const unitsBySku = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of snap.pallets) {
      if (p.status === "expedido") continue;
      m.set(p.skuId, (m.get(p.skuId) ?? 0) + p.qty);
    }
    return m;
  }, [snap.pallets]);

  const [draft, setDraft] = useState(() => emptySku(snap.categories[0]?.id ?? "alimentacion_seca"));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [catEs, setCatEs] = useState("");
  const [catEn, setCatEn] = useState("");
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  function apply(result: { ok: true; snap: typeof snap } | { ok: false; error: CatalogError }) {
    if (!result.ok) {
      setFeedback(ERR[result.error][lang]);
      return;
    }
    commit(result.snap);
    setFeedback(null);
    setEditingId(null);
    setDraft(emptySku(result.snap.categories[0]?.id ?? draft.category));
  }

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
          {lang === "es" ? "Stock por categoría" : "Stock by category"}
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          {lang === "es"
            ? "Alta de productos y categorías. El stock vivo sale de palets, no se inventa."
            : "Add products and categories. Live stock comes from pallets — it is not invented."}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {byCat.map((c) => (
          <Card key={c.category} title={c.label}>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-3xl font-semibold text-[var(--ink)]">{c.pallets}</p>
                <p className="text-xs text-[var(--ink-muted)]">{lang === "es" ? "palets" : "pallets"}</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold text-[var(--ink)]">
                  {c.units.toLocaleString(lang === "es" ? "es-ES" : "en-GB")}
                </p>
                <p className="text-xs text-[var(--ink-muted)]">{lang === "es" ? "unidades" : "units"}</p>
              </div>
            </div>
            {c.belowMin > 0 && (
              <p className="mt-3 text-xs font-semibold text-[var(--danger)]">
                {c.belowMin} SKU {lang === "es" ? "bajo mínimo" : "below min"}
              </p>
            )}
          </Card>
        ))}
      </div>

      <Card
        title={lang === "es" ? "Categorías" : "Categories"}
        subtitle={lang === "es" ? "Crear o renombrar. Las de sistema no se borran." : "Create or rename. System ones stay."}
      >
        <ul className="mb-3 space-y-2">
          {snap.categories.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm"
            >
              {editCatId === c.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={catEs}
                    onChange={(e) => setCatEs(e.target.value)}
                    className="rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-sm"
                  />
                  <input
                    value={catEn}
                    onChange={(e) => setCatEn(e.target.value)}
                    className="rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white"
                    onClick={() => apply(updateCategory(snap, c.id, { labelEs: catEs, labelEn: catEn }))}
                  >
                    {lang === "es" ? "Guardar" : "Save"}
                  </button>
                </div>
              ) : (
                <span>
                  {lang === "es" ? c.labelEs : c.labelEn}
                  {c.system && (
                    <span className="ml-2 text-xs text-[var(--ink-muted)]">
                      {lang === "es" ? "sistema" : "system"}
                    </span>
                  )}
                </span>
              )}
              <span className="flex gap-1">
                <button
                  type="button"
                  className="rounded-full border border-[var(--glass-border)] p-1.5"
                  onClick={() => {
                    setEditCatId(c.id);
                    setCatEs(c.labelEs);
                    setCatEn(c.labelEn);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {!c.system && (
                  <button
                    type="button"
                    className="rounded-full border border-[var(--glass-border)] p-1.5"
                    onClick={() => apply(deleteCategory(snap, c.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <input
            value={catEs}
            onChange={(e) => setCatEs(e.target.value)}
            placeholder={lang === "es" ? "Nueva categoría" : "New category"}
            className="min-w-[10rem] flex-1 rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          />
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
            onClick={() => {
              apply(createCategory(snap, { code: catEs, labelEs: catEs, labelEn: catEn || catEs }));
              setCatEs("");
              setCatEn("");
            }}
          >
            <Plus className="h-4 w-4" />
            {lang === "es" ? "Crear categoría" : "Add category"}
          </button>
        </div>
      </Card>

      <Card title={lang === "es" ? "Catálogo SKU" : "SKU catalog"}>
        <form
          className="mb-4 grid gap-2 md:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            apply(editingId ? updateSku(snap, editingId, draft) : createSku(snap, draft));
          }}
        >
          <input
            required
            value={draft.sku}
            onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
            placeholder="SKU"
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 font-mono text-sm"
          />
          <input
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder={lang === "es" ? "Nombre" : "Name"}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          >
            {snap.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {lang === "es" ? c.labelEs : c.labelEn}
              </option>
            ))}
          </select>
          <select
            value={draft.abc}
            onChange={(e) => setDraft({ ...draft, abc: e.target.value as Sku["abc"] })}
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          >
            <option value="A">ABC A</option>
            <option value="B">ABC B</option>
            <option value="C">ABC C</option>
          </select>
          <input
            type="number"
            value={draft.minStock}
            onChange={(e) => setDraft({ ...draft, minStock: Number(e.target.value) })}
            placeholder="Min"
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={draft.maxStock}
            onChange={(e) => setDraft({ ...draft, maxStock: Number(e.target.value) })}
            placeholder="Max"
            className="rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            {editingId
              ? lang === "es"
                ? "Guardar producto"
                : "Save product"
              : lang === "es"
                ? "Agregar producto"
                : "Add product"}
          </button>
        </form>
        {feedback && <p className="mb-3 text-xs font-semibold text-[var(--danger)]">{feedback}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
              <tr>
                <th className="pb-2 pr-3">SKU</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Producto" : "Product"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Categoría" : "Category"}</th>
                <th className="pb-2 pr-3">ABC</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Stock" : "Stock"}</th>
                <th className="pb-2 pr-3">{lang === "es" ? "Disponible" : "Available"}</th>
                <th className="pb-2 pr-3">Min / Max</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {snap.skus.map((sku) => {
                const units = unitsBySku.get(sku.id) ?? 0;
                const low = units < sku.minStock;
                return (
                  <tr key={sku.id} className="border-t border-[var(--glass-border)]">
                    <td className="py-2.5 pr-3 font-mono text-xs">{sku.sku}</td>
                    <td className="py-2.5 pr-3">{sku.name}</td>
                    <td className="py-2.5 pr-3">{categoryLabel(sku.category, lang, snap.categories)}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={sku.abc === "A" ? "brand" : sku.abc === "B" ? "warn" : "neutral"}>
                        {sku.abc}
                      </Badge>
                    </td>
                    <td className={cn("py-2.5 pr-3 font-semibold", low && "text-[var(--danger)]")}>{units}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{skuAvailable(snap, sku.id)}</td>
                    <td className="py-2.5 pr-3 text-[var(--ink-muted)]">
                      {sku.minStock} / {sku.maxStock}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        className="mr-1 rounded-full border border-[var(--glass-border)] p-1.5"
                        onClick={() => {
                          setEditingId(sku.id);
                          setDraft({
                            sku: sku.sku,
                            name: sku.name,
                            category: sku.category,
                            uom: sku.uom,
                            unitsPerPallet: sku.unitsPerPallet,
                            weightKg: sku.weightKg,
                            abc: sku.abc,
                            minStock: sku.minStock,
                            maxStock: sku.maxStock,
                          });
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-[var(--glass-border)] p-1.5"
                        onClick={() => apply(deleteSku(snap, sku.id))}
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

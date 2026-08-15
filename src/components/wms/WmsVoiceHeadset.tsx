import { Badge, Card } from "@/components/CrmChrome";
import type { Lang } from "@/lib/i18n";
import {
  AISLE_GUIDE,
  aisleRangeLabel,
  buildVoicePrompt,
  familyForSku,
  speakVoicePrompt,
  stopVoicePrompt,
  type FloorTicket,
} from "@/lib/wms";
import { Headphones, MapPinned, Volume2, VolumeX } from "lucide-react";
import { useEffect } from "react";
import { useWmsLive } from "./useWmsLive";

export function WmsVoiceHeadset({
  lang,
  ticket,
}: {
  lang: Lang;
  ticket: Pick<FloorTicket, "storeName" | "aisle" | "slotCode" | "skuName" | "skuId" | "qty" | "pickPack">;
}) {
  const voice = buildVoicePrompt(ticket, lang);
  const family = familyForSku(ticket.skuId);

  useEffect(() => () => stopVoicePrompt(), []);

  return (
    <Card
      title={lang === "es" ? "Auriculares" : "Headset"}
      subtitle={
        lang === "es"
          ? "El aparato dicta pasillo, hueco y cantidad. Cajas enteras o unidades del contenedor."
          : "The device speaks aisle, slot and qty. Whole cases or units from the container."
      }
    >
      <p className="mb-3 flex items-start gap-2 text-sm text-[var(--ink)]">
        <Headphones className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
        {voice.text}
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <Badge tone={voice.pickPack === "contenedor" ? "warn" : "brand"}>
          {voice.pickPack === "contenedor"
            ? lang === "es"
              ? "Del contenedor"
              : "From container"
            : lang === "es"
              ? "Cajas"
              : "Cases"}
        </Badge>
        {family && (
          <Badge tone="neutral">
            {family.familyEs} · {aisleRangeLabel(family)}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
          onClick={() => speakVoicePrompt(voice.text, lang)}
        >
          <Volume2 className="h-4 w-4" />
          {lang === "es" ? "Oír ticket" : "Hear ticket"}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] px-3 py-2 text-sm font-semibold"
          onClick={() => stopVoicePrompt()}
        >
          <VolumeX className="h-4 w-4" />
          {lang === "es" ? "Silencio" : "Stop"}
        </button>
      </div>
    </Card>
  );
}

export function WmsAisleGuideCard({ lang }: { lang: Lang }) {
  const { snap } = useWmsLive();
  return (
    <Card
      title={lang === "es" ? "Guía de pasillos de planta" : "Floor aisle guide"}
      subtitle={
        lang === "es"
          ? "Relato de operario (8–37). El twin digital sigue en letras A/B/C hasta que el layout numérico esté en el snapshot. Sin SKU inventados."
          : "Operator account (8–37). The digital twin still uses letters A/B/C until a numeric layout is in the snapshot. No invented SKUs."
      }
    >
      <ul className="space-y-2 text-sm">
        {AISLE_GUIDE.filter((f) => f.id !== "secos").map((f) => {
          const named = f.skuIds
            .map((id) => snap.skus.find((s) => s.id === id)?.name)
            .filter(Boolean);
          return (
            <li
              key={f.id}
              className="flex items-start justify-between gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-sunken)] px-3 py-2"
            >
              <span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <MapPinned className="h-3.5 w-3.5 text-[var(--accent)]" />
                  {lang === "es" ? f.familyEs : f.familyEn}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--ink-muted)]">
                  {named.length
                    ? named.join(" · ")
                    : lang === "es"
                      ? "En planta; aún no hay ese artículo en el twin"
                      : "On the floor; that article is not in the twin yet"}
                </span>
              </span>
              <span className="font-mono text-xs font-semibold">{aisleRangeLabel(f)}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

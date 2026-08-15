import { Badge, Card } from "@/components/CrmChrome";
import type { Lang } from "@/lib/i18n";
import {
  AISLE_GUIDE,
  aisleRangeLabel,
  buildClosePrompt,
  buildVoicePrompt,
  familyForSku,
  loadHeadsetOn,
  remainderLabel,
  saveHeadsetOn,
  speakVoicePrompt,
  stopVoicePrompt,
  type CloseCueInput,
  type FloorTicket,
  type PickPack,
} from "@/lib/wms";
import { Headphones, MapPinned, Repeat, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useWmsLive } from "./useWmsLive";

export function WmsVoiceHeadset({
  lang,
  ticket,
  close,
  remaining,
  pickPack,
  autoSpeak = true,
}: {
  lang: Lang;
  ticket?: Pick<FloorTicket, "storeName" | "aisle" | "slotCode" | "skuName" | "skuId" | "qty" | "pickPack">;
  close?: CloseCueInput;
  remaining?: number | null;
  pickPack?: PickPack;
  autoSpeak?: boolean;
}) {
  const [headsetOn, setHeadsetOn] = useState(loadHeadsetOn);
  const voice = useMemo(() => {
    if (ticket) return { kind: "ticket" as const, ...buildVoicePrompt(ticket, lang) };
    if (close) return { kind: "close" as const, ...buildClosePrompt(close, lang) };
    return null;
  }, [ticket, close, lang]);
  const family = ticket ? familyForSku(ticket.skuId) : null;
  const pack = pickPack ?? ticket?.pickPack ?? "caja";
  const left = remainderLabel(remaining, pack, lang);

  useEffect(() => () => stopVoicePrompt(), []);

  useEffect(() => {
    if (!autoSpeak || !headsetOn || !voice) return;
    speakVoicePrompt(voice.text, lang);
  }, [autoSpeak, headsetOn, voice?.text, lang]);

  if (!voice) return null;
  const spoken = voice;

  function toggleHeadset() {
    const next = !headsetOn;
    setHeadsetOn(next);
    saveHeadsetOn(next);
    if (!next) stopVoicePrompt();
    else speakVoicePrompt(spoken.text, lang);
  }

  return (
    <Card
      title={lang === "es" ? "Auriculares" : "Headset"}
      subtitle={
        lang === "es"
          ? "El aparato dicta el ticket. Al marcar, el siguiente; al terminar el súper, fleje, etiqueta y muelle."
          : "The device speaks the ticket. After a mark, the next one; when the store is done, strap, label and dock."
      }
    >
      <p className="mb-3 flex items-start gap-2 text-sm text-[var(--ink)]">
        <Headphones className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
        {spoken.text}
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {spoken.kind === "ticket" ? (
          <Badge tone={pack === "contenedor" ? "warn" : "brand"}>
            {pack === "contenedor"
              ? lang === "es"
                ? "Del contenedor"
                : "From container"
              : lang === "es"
                ? "Cajas"
                : "Cases"}
          </Badge>
        ) : (
          <Badge tone="warn">{lang === "es" ? "Cierre de muelle" : "Dock close"}</Badge>
        )}
        {family && (
          <Badge tone="neutral">
            {family.familyEs} · {aisleRangeLabel(family)}
          </Badge>
        )}
        {left && <Badge tone="neutral">{left}</Badge>}
        <Badge tone={headsetOn ? "good" : "neutral"}>
          {headsetOn ? (lang === "es" ? "Dictando" : "Speaking") : lang === "es" ? "Silencio" : "Muted"}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
          onClick={() => speakVoicePrompt(spoken.text, lang)}
        >
          <Repeat className="h-4 w-4" />
          {lang === "es" ? "Repetir" : "Repeat"}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] px-3 py-2 text-sm font-semibold"
          onClick={toggleHeadset}
        >
          {headsetOn ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          {headsetOn
            ? lang === "es"
              ? "Quitar auriculares"
              : "Headset off"
            : lang === "es"
              ? "Poner auriculares"
              : "Headset on"}
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

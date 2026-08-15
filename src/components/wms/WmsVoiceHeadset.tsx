import { Badge, Card } from "@/components/CrmChrome";
import type { Lang } from "@/lib/i18n";
import {
  AISLE_GUIDE,
  aisleRangeLabel,
  buildArticlePrompt,
  buildClosePrompt,
  buildSlotRepeatPrompt,
  buildVoicePrompt,
  bumpVoiceRate,
  bumpVoiceVolume,
  familyForSku,
  loadHeadsetOn,
  loadVoicePrefs,
  parseVoiceCommand,
  remainderLabel,
  saveHeadsetOn,
  slotMatchesTake,
  speakVoicePrompt,
  stopVoicePrompt,
  type CloseCueInput,
  type FloorTicket,
  type PickPack,
  type VoiceCommand,
} from "@/lib/wms";
import {
  Headphones,
  MapPinned,
  Mic,
  Repeat,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWmsLive } from "./useWmsLive";

type HeadsetTicket = Pick<
  FloorTicket,
  "storeName" | "aisle" | "slotCode" | "skuName" | "skuId" | "qty" | "pickPack"
> & { stockInSlot?: number | null };

function browserSpeechRecognition(): { start: () => void; stop: () => void; lang: string; onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null } | null {
  if (typeof window === "undefined") return null;
  const Ctor = (
    window as unknown as {
      SpeechRecognition?: new () => ReturnType<typeof browserSpeechRecognition>;
      webkitSpeechRecognition?: new () => ReturnType<typeof browserSpeechRecognition>;
    }
  ).SpeechRecognition ?? (
    window as unknown as { webkitSpeechRecognition?: new () => ReturnType<typeof browserSpeechRecognition> }
  ).webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor();
}

export function WmsVoiceHeadset({
  lang,
  ticket,
  close,
  remaining,
  pickPack,
  autoSpeak = true,
  onConfirmOk,
  onReportMismatch,
}: {
  lang: Lang;
  ticket?: HeadsetTicket;
  close?: CloseCueInput;
  remaining?: number | null;
  pickPack?: PickPack;
  autoSpeak?: boolean;
  onConfirmOk?: (qty: number) => void;
  onReportMismatch?: () => void;
}) {
  const [headsetOn, setHeadsetOn] = useState(loadHeadsetOn);
  const [prefs, setPrefs] = useState(loadVoicePrefs);
  const [heard, setHeard] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<ReturnType<typeof browserSpeechRecognition>>(null);
  const voice = useMemo(() => {
    if (ticket) return { kind: "ticket" as const, ...buildVoicePrompt(ticket, lang) };
    if (close) return { kind: "close" as const, ...buildClosePrompt(close, lang) };
    return null;
  }, [ticket, close, lang]);
  const family = ticket ? familyForSku(ticket.skuId) : null;
  const pack = pickPack ?? ticket?.pickPack ?? "caja";
  const left = remainderLabel(remaining ?? ticket?.stockInSlot, pack, lang);
  const matches = ticket ? slotMatchesTake(ticket.stockInSlot, ticket.qty) : true;

  useEffect(() => () => stopVoicePrompt(), []);

  useEffect(() => {
    if (!autoSpeak || !headsetOn || !voice) return;
    speakVoicePrompt(voice.text, lang);
  }, [autoSpeak, headsetOn, voice?.text, lang]);

  function applyCommand(cmd: VoiceCommand) {
    if (cmd.kind === "volume_up") {
      setPrefs(bumpVoiceVolume(0.15));
      speakVoicePrompt(lang === "es" ? "Volumen más alto." : "Volume up.", lang);
      return;
    }
    if (cmd.kind === "volume_down") {
      setPrefs(bumpVoiceVolume(-0.15));
      speakVoicePrompt(lang === "es" ? "Volumen más bajo." : "Volume down.", lang);
      return;
    }
    if (cmd.kind === "faster") {
      setPrefs(bumpVoiceRate(0.15));
      speakVoicePrompt(lang === "es" ? "Más rápido." : "Faster.", lang);
      return;
    }
    if (cmd.kind === "repeat_slot" && ticket) {
      speakVoicePrompt(buildSlotRepeatPrompt(ticket, lang), lang);
      return;
    }
    if (cmd.kind === "article" && ticket) {
      speakVoicePrompt(buildArticlePrompt(ticket, lang), lang);
      return;
    }
    if (cmd.kind === "confirm") {
      onConfirmOk?.(cmd.qty);
    }
  }

  function hearUtterance(raw: string) {
    setHeard(raw);
    applyCommand(parseVoiceCommand(raw));
  }

  function toggleListen() {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = browserSpeechRecognition();
    if (!rec) {
      setHeard(lang === "es" ? "Este navegador no oye. Escribe o pulsa el mando." : "This browser cannot hear. Type or tap a command.");
      return;
    }
    rec.lang = lang === "es" ? "es-ES" : "en-GB";
    rec.onresult = (ev) => {
      const said = ev.results[0]?.[0]?.transcript ?? "";
      if (said) hearUtterance(said);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

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
          ? "El aparato dice cuánto hay en el hueco. Sube, baja, acelera, atrás, artículo. Cuando oigas la cantidad, di «N ok»."
          : "The device says how many are in the slot. Up, down, faster, back, article. When you hear the qty, say “N ok”."
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
        {left && <Badge tone={matches ? "neutral" : "bad"}>{left}</Badge>}
        {ticket && !matches && (
          <Badge tone="bad">{lang === "es" ? "No coincide · avisa al jefe" : "Mismatch · tell the lead"}</Badge>
        )}
        <Badge tone={headsetOn ? "good" : "neutral"}>
          {headsetOn ? (lang === "es" ? "Dictando" : "Speaking") : lang === "es" ? "Silencio" : "Muted"}
        </Badge>
        <Badge tone="neutral">
          {lang === "es" ? "Vol" : "Vol"} {Math.round(prefs.volume * 100)}% · {prefs.rate.toFixed(2)}×
        </Badge>
      </div>
      {ticket && (
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={!matches || !onConfirmOk}
            onClick={() => onConfirmOk?.(ticket.qty)}
          >
            {ticket.qty} ok
          </button>
          {onReportMismatch && (
            <button
              type="button"
              className="rounded-full border border-[var(--glass-border)] px-3 py-2 text-sm font-semibold"
              onClick={onReportMismatch}
            >
              {lang === "es" ? "No coincide" : "No match"}
            </button>
          )}
        </div>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            ["sube", { kind: "volume_up" as const }],
            ["baja", { kind: "volume_down" as const }],
            ["acelera", { kind: "faster" as const }],
            ["atrás", { kind: "repeat_slot" as const }],
            ["artículo", { kind: "article" as const }],
          ] as const
        ).map(([label, cmd]) => (
          <button
            key={label}
            type="button"
            className="rounded-full border border-[var(--glass-border)] px-3 py-1.5 text-xs font-semibold"
            onClick={() => applyCommand(cmd)}
          >
            {label}
          </button>
        ))}
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
          onClick={toggleListen}
        >
          <Mic className="h-4 w-4" />
          {listening
            ? lang === "es"
              ? "Oyendo…"
              : "Listening…"
            : lang === "es"
              ? "Hablar"
              : "Speak"}
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
      {heard && <p className="mt-2 text-xs text-[var(--ink-muted)]">«{heard}»</p>}
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

"use client";

import { WhatsAppSecureLink } from "@/components/WhatsAppSecureLink";
import { useNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { MessageCircle, Phone, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Hoja inferior con tirador: se cierra arrastrando, tocando el velo o con Escape.
 * Es el contenedor de las fichas de cliente y reserva en móvil.
 */
export function MobileSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [dragY, setDragY] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setDragY(0);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  function onPointerDown(e: React.PointerEvent) {
    startRef.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (startRef.current === null) return;
    setDragY(Math.max(0, e.clientY - startRef.current));
  }

  function onPointerEnd() {
    if (startRef.current === null) return;
    const travelled = dragY;
    startRef.current = null;
    if (travelled > 90) onClose();
    else setDragY(0);
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end" role="presentation">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-[color-mix(in_oklab,#0f172a_45%,transparent)] backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
        className={cn(
          "relative flex max-h-[88dvh] flex-col rounded-t-[1.75rem] bg-[var(--bg0)] shadow-[0_-18px_50px_rgba(3,8,18,.35)]",
          !dragY && "animate-[mps-sheet-in_.36s_cubic-bezier(.22,1.2,.36,1)]",
        )}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          className="grid touch-none place-items-center py-2.5"
        >
          <span className="h-1.5 w-10 rounded-full bg-[var(--field-border)]" />
        </div>
        <div className="flex items-center gap-3 px-4 pb-2">
          <h2 className="min-w-0 flex-1 truncate text-base font-bold text-[var(--ink)]">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--field-bg)] text-[var(--ink)]"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
        {/* `shrink-0` en los hijos: dentro de un flex con scroll, si no, las
            tarjetas se comprimen y recortan filas en vez de desplazarse. */}
        <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] [&>*]:shrink-0">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Llamar y WhatsApp, los dos botones que cierran cualquier ficha.
 * WhatsApp pasa por `WhatsAppSecureLink`: confirma el canal y abre el chat para
 * que el mensaje lo escriba una persona. Nada sale solo hacia el viajero.
 */
export function MobileContactActions({
  phone,
  lang,
  className,
}: {
  phone: string;
  lang: "es" | "en";
  className?: string;
}) {
  const { push } = useNotifications();
  const es = lang === "es";
  if (!phone) return null;

  return (
    <div className={cn("grid grid-cols-2 gap-2.5", className)}>
      <a
        href={`tel:${phone}`}
        onClick={() =>
          push({
            kind: "system",
            tone: "info",
            actor: phone,
            statusLabel: "LLAMADA",
            body: "Has iniciado una llamada (seguimiento humano)",
            detail: phone,
          })
        }
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-sm font-bold text-white shadow-[0_8px_20px_color-mix(in_oklab,var(--accent)_34%,transparent)]"
      >
        <Phone className="h-4 w-4" />
        {es ? "Llamar" : "Call"}
      </a>
      <WhatsAppSecureLink
        clientPhone={phone}
        title="WhatsApp"
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[color-mix(in_oklab,#16a34a_35%,transparent)] bg-[color-mix(in_oklab,#16a34a_12%,transparent)] p-0 text-sm font-bold text-[#15803d]"
      >
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </WhatsAppSecureLink>
    </div>
  );
}

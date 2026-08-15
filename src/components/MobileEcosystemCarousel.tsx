"use client";

import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Camera,
  CircleHelp,
  ExternalLink,
  Globe,
  MessageCircle,
  Play,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type EcosystemSlide = {
  id: string;
  /** Lámina de color: degradado + trama de líneas, sin imágenes remotas. */
  from: string;
  to: string;
  icon: LucideIcon;
  titleEs: string;
  titleEn: string;
  subEs: string;
  subEn: string;
  ctaEs: string;
  ctaEn: string;
  href?: string;
  action?: "support" | "ajustes";
};

const SLIDES: EcosystemSlide[] = [
  {
    id: "web",
    from: "var(--accent)",
    to: "var(--accent-2)",
    icon: Globe,
    titleEs: "Web oficial",
    titleEn: "Official website",
    subEs: "Lo publicado en example.com · sin vender, solo verificar",
    subEn: "What's live on example.com · verify, don't sell",
    ctaEs: "Abrir web",
    ctaEn: "Open site",
    href: "https://example.com",
  },
  {
    id: "instagram",
    from: "#a02cbb",
    to: "#f77737",
    icon: Camera,
    titleEs: "Instagram",
    titleEn: "Instagram",
    subEs: "Marca en redes · stories y pulso del día",
    subEn: "Brand pulse · stories and daily feed",
    ctaEs: "Abrir Instagram",
    ctaEn: "Open Instagram",
    href: "https://example.com",
  },
  {
    id: "youtube",
    from: "#b91c1c",
    to: "#f97316",
    icon: Play,
    titleEs: "YouTube",
    titleEn: "YouTube",
    subEs: "Canal oficial · contenido y rutas en vídeo",
    subEn: "Official channel · video content",
    ctaEs: "Abrir YouTube",
    ctaEn: "Open YouTube",
    href: "https://example.com",
  },
  {
    id: "facebook",
    from: "#1877f2",
    to: "#4f9cf9",
    icon: MessageCircle,
    titleEs: "Facebook",
    titleEn: "Facebook",
    subEs: "Página empresa · comunidad y mensajes",
    subEn: "Company page · community and inbox",
    ctaEs: "Abrir Facebook",
    ctaEn: "Open Facebook",
    href: "https://example.com",
  },
  {
    id: "support",
    from: "#0f766e",
    to: "#22c55e",
    icon: CircleHelp,
    titleEs: "Soporte y licencia",
    titleEn: "Support & license",
    subEs: "Growth OS · uso interno y documentación",
    subEn: "Growth OS · internal use and docs",
    ctaEs: "Ver soporte",
    ctaEn: "View support",
    action: "support",
  },
  {
    id: "settings",
    from: "#334155",
    to: "#64748b",
    icon: Settings,
    titleEs: "Ajustes del negocio",
    titleEn: "Business settings",
    subEs: "WhatsApp saliente · datos fiscales del CRM",
    subEn: "Outbound WhatsApp · CRM tax data",
    ctaEs: "Ir a ajustes",
    ctaEn: "Open settings",
    action: "ajustes",
  },
];

export function MobileEcosystemCarousel({
  lang,
  onOpenSupport,
  onOpenSettings,
}: {
  lang: Lang;
  onOpenSupport: () => void;
  onOpenSettings: () => void;
}) {
  const es = lang === "es";
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const pauseRef = useRef(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    function onScroll() {
      const node = scrollerRef.current;
      if (!node) return;
      const card = node.querySelector<HTMLElement>("[data-eco-card]");
      const width = card?.offsetWidth ?? node.clientWidth * 0.85;
      const gap = 12;
      const next = Math.round(node.scrollLeft / (width + gap));
      setIndex(Math.max(0, Math.min(SLIDES.length - 1, next)));
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (pauseRef.current) return;
      const node = scrollerRef.current;
      if (!node) return;
      const card = node.querySelector<HTMLElement>("[data-eco-card]");
      const width = card?.offsetWidth ?? node.clientWidth * 0.85;
      const gap = 12;
      const next = (index + 1) % SLIDES.length;
      node.scrollTo({ left: next * (width + gap), behavior: "smooth" });
      setIndex(next);
    }, 4800);
    return () => window.clearInterval(id);
  }, [index]);

  function activate(slide: EcosystemSlide) {
    if (slide.action === "support") {
      onOpenSupport();
      return;
    }
    if (slide.action === "ajustes") {
      onOpenSettings();
      return;
    }
    if (slide.href) {
      window.open(slide.href, "_blank", "noopener,noreferrer");
    }
  }

  function goTo(i: number) {
    const node = scrollerRef.current;
    if (!node) return;
    const card = node.querySelector<HTMLElement>("[data-eco-card]");
    const width = card?.offsetWidth ?? node.clientWidth * 0.85;
    const gap = 12;
    node.scrollTo({ left: i * (width + gap), behavior: "smooth" });
    setIndex(i);
  }

  return (
    <section className="mt-5">
      <div className="mb-2.5">
        <p className="text-sm font-bold text-[var(--ink)]">
          {es ? "Ecosistema oficial" : "Official ecosystem"}
        </p>
        <p className="text-[11px] text-[var(--ink-muted)]">
          {es
            ? "Canales de la empresa · no es escaparate de viajes"
            : "Company channels · not a trip storefront"}
        </p>
      </div>

      <div
        ref={scrollerRef}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onPointerDown={() => {
          pauseRef.current = true;
        }}
        onPointerUp={() => {
          window.setTimeout(() => {
            pauseRef.current = false;
          }, 2500);
        }}
      >
        {SLIDES.map((slide) => {
          const Icon = slide.icon;
          return (
            <button
              key={slide.id}
              type="button"
              data-eco-card
              onClick={() => activate(slide)}
              className="relative h-[15rem] w-[88%] max-w-[24rem] shrink-0 snap-center overflow-hidden rounded-[1.5rem] text-left shadow-[0_12px_32px_color-mix(in_oklab,var(--ink)_18%,transparent)]"
            >
              <span
                aria-hidden
                className="absolute inset-0"
                style={{
                  backgroundImage: `linear-gradient(140deg, ${slide.from}, ${slide.to})`,
                }}
              />
              {/* Trama diagonal: da textura sin depender de imágenes externas */}
              <span
                aria-hidden
                className="absolute inset-0 opacity-55"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(115deg, rgba(255,255,255,.20) 0 1px, transparent 1px 13px)",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
              <div className="relative flex h-full flex-col justify-between p-4 text-white">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/18 backdrop-blur-md">
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-lg font-bold leading-tight">
                    {es ? slide.titleEs : slide.titleEn}
                  </p>
                  <p className="mt-1.5 text-xs leading-snug text-white/90 text-pretty">
                    {es ? slide.subEs : slide.subEn}
                  </p>
                  {/* La píldora vive sobre la lámina de color: tinta fija, no `--ink`
                      (en tema oscuro sería blanco sobre blanco). */}
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-bold text-[#0f172a]">
                    {es ? slide.ctaEs : slide.ctaEn}
                    {slide.href && <ExternalLink className="h-3.5 w-3.5" />}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`${es ? "Ir a" : "Go to"} ${es ? s.titleEs : s.titleEn}`}
            onClick={() => goTo(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === index
                ? "w-5 bg-[var(--accent)]"
                : "w-1.5 bg-[color-mix(in_oklab,var(--ink)_25%,transparent)]",
            )}
          />
        ))}
      </div>
    </section>
  );
}

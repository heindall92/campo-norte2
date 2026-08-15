/**
 * Catálogo de integraciones del ecosistema Campo Norte.
 * Misma anatomía que la demo de referencia (tarjeta + estado + Conectar),
 * con herramientas reales del Growth OS — no las de terceros ajenos.
 */

export type IntegrationStatus = "conectado" | "parcial" | "no_conectado";

export type IntegrationCategory = "finanzas" | "crm" | "comunicaciones" | "datos" | "automatizacion";

export interface IntegrationDef {
  id: string;
  name: string;
  category: IntegrationCategory;
  descriptionEs: string;
  descriptionEn: string;
  href: string;
  /** Cómo se considera "conectado" en este entorno. */
  detect: () => IntegrationStatus;
}

export const INTEGRATION_CATEGORY_LABEL: Record<
  IntegrationCategory,
  { es: string; en: string }
> = {
  finanzas: { es: "Finanzas y cobros", en: "Finance & payments" },
  crm: { es: "CRM y datos", en: "CRM & data" },
  comunicaciones: { es: "Comunicaciones", en: "Communications" },
  datos: { es: "Almacenamiento", en: "Storage" },
  automatizacion: { es: "Automatización", en: "Automation" },
};

function envOn(key: string): boolean {
  const v = (import.meta.env[key] as string | undefined)?.trim();
  return Boolean(v);
}

function localFlag(id: string): boolean {
  try {
    return localStorage.getItem(`mps-integration-${id}`) === "1";
  } catch {
    return false;
  }
}

export function setIntegrationConnected(id: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(`mps-integration-${id}`, "1");
    else localStorage.removeItem(`mps-integration-${id}`);
  } catch {
    /* ignore */
  }
}

export const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "stripe",
    name: "Stripe",
    category: "finanzas",
    descriptionEs: "Cobros con tarjeta y señales de reserva. El CRM registra el canal; el envío lo hace Stripe.",
    descriptionEn: "Card payments and booking deposits. CRM records the channel; Stripe takes the charge.",
    href: "https://dashboard.stripe.com",
    detect: () => (localFlag("stripe") || envOn("VITE_STRIPE_PUBLISHABLE_KEY") ? "conectado" : "no_conectado"),
  },
  {
    id: "sepa",
    name: "SEPA / Transferencia",
    category: "finanzas",
    descriptionEs: "Transferencias y conciliaciones manuales contra facturas Veri*FACTU.",
    descriptionEn: "Bank transfers reconciled manually against Veri*FACTU invoices.",
    href: "#",
    detect: () => (localFlag("sepa") ? "conectado" : "parcial"),
  },
  {
    id: "brevo",
    name: "Brevo",
    category: "comunicaciones",
    descriptionEs: "Email marketing. Content Factory prepara plantillas; el envío sigue siendo humano.",
    descriptionEn: "Email marketing. Content Factory drafts templates; sending stays human.",
    href: "https://app.brevo.com",
    detect: () => (localFlag("brevo") || envOn("VITE_BREVO_API_KEY") ? "conectado" : "no_conectado"),
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    category: "comunicaciones",
    descriptionEs: "Enlaces seguros y guiones. Nunca autoenvío al viajero (regla de oro).",
    descriptionEn: "Secure links and scripts. Never auto-send to the traveller (golden rule).",
    href: "https://business.whatsapp.com",
    detect: () => (localFlag("whatsapp") ? "conectado" : "parcial"),
  },
  {
    id: "supabase",
    name: "Supabase",
    category: "datos",
    descriptionEs: "Auth + Hub Postgres (leads, clientes, reservas). Si hay VITE_SUPABASE_*, está activo.",
    descriptionEn: "Auth + Postgres Hub. Active when VITE_SUPABASE_* is set.",
    href: "https://supabase.com/dashboard",
    detect: () =>
      envOn("VITE_SUPABASE_URL") && envOn("VITE_SUPABASE_ANON_KEY") ? "conectado" : "no_conectado",
  },
  {
    id: "vercel",
    name: "Vercel",
    category: "automatizacion",
    descriptionEs: "Hosting, cron del lazo de leads y variables de entorno de API.",
    descriptionEn: "Hosting, lead-loop cron and API env vars.",
    href: "https://vercel.com/dashboard",
    detect: () => (typeof window !== "undefined" && /vercel\.app$/.test(window.location.hostname) ? "conectado" : "parcial"),
  },
  {
    id: "n8n",
    name: "n8n / Make",
    category: "automatizacion",
    descriptionEs: "Flujos visibles: formulario → Hub → aviso interno. Sin escritura al viajero.",
    descriptionEn: "Visible flows: form → Hub → internal alert. No traveller writes.",
    href: "https://n8n.io",
    detect: () => (localFlag("n8n") ? "conectado" : "no_conectado"),
  },
  {
    id: "drive",
    name: "Google Drive",
    category: "datos",
    descriptionEs: "Carpeta de facturas y docs de expedición (lectura humana / futura OCR).",
    descriptionEn: "Invoice and expedition docs folder (human read / future OCR).",
    href: "https://drive.google.com",
    detect: () => (localFlag("drive") ? "conectado" : "no_conectado"),
  },
];

export function listIntegrationsByCategory(): {
  category: IntegrationCategory;
  items: Array<IntegrationDef & { status: IntegrationStatus }>;
}[] {
  const order: IntegrationCategory[] = [
    "finanzas",
    "comunicaciones",
    "datos",
    "crm",
    "automatizacion",
  ];
  return order
    .map((category) => ({
      category,
      items: INTEGRATIONS.filter((i) => i.category === category).map((i) => ({
        ...i,
        status: i.detect(),
      })),
    }))
    .filter((g) => g.items.length > 0);
}

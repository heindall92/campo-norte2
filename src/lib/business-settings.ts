/** Datos del negocio (WhatsApp saliente + fiscales) — localStorage. */

import { COMPANY } from "@/lib/assumptions";

export const BUSINESS_SETTINGS_KEY = "mps-business-settings-v1";

export interface BusinessSettings {
  /** Teléfono WhatsApp de negocio (dígitos / E.164 libre) */
  whatsapp: string;
  /** Alias futuro de WhatsApp (@usuario), sin @ obligatorio */
  whatsappAlias: string;
  legalName: string;
  cif: string;
  fiscalAddress: string;
  contactEmail: string;
}

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  whatsapp: "",
  whatsappAlias: "",
  legalName: COMPANY.legal,
  cif: "",
  fiscalAddress: "",
  contactEmail: COMPANY.email,
};

export function loadBusinessSettings(): BusinessSettings {
  try {
    const raw = localStorage.getItem(BUSINESS_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_BUSINESS_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<BusinessSettings>;
    return {
      whatsapp: typeof parsed.whatsapp === "string" ? parsed.whatsapp : "",
      whatsappAlias: typeof parsed.whatsappAlias === "string" ? parsed.whatsappAlias : "",
      legalName:
        typeof parsed.legalName === "string" ? parsed.legalName : DEFAULT_BUSINESS_SETTINGS.legalName,
      cif: typeof parsed.cif === "string" ? parsed.cif : "",
      fiscalAddress: typeof parsed.fiscalAddress === "string" ? parsed.fiscalAddress : "",
      contactEmail:
        typeof parsed.contactEmail === "string"
          ? parsed.contactEmail
          : DEFAULT_BUSINESS_SETTINGS.contactEmail,
    };
  } catch {
    return { ...DEFAULT_BUSINESS_SETTINGS };
  }
}

export function saveBusinessSettings(next: BusinessSettings): void {
  localStorage.setItem(BUSINESS_SETTINGS_KEY, JSON.stringify(next));
}

export function normalizeWhatsappDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Mínimo 9 dígitos (móvil ES) o más con prefijo país. */
export function businessWhatsappConfigured(s: BusinessSettings = loadBusinessSettings()): boolean {
  return normalizeWhatsappDigits(s.whatsapp).length >= 9;
}

export function formatBusinessWhatsappLabel(s: BusinessSettings = loadBusinessSettings()): string {
  const alias = s.whatsappAlias.trim().replace(/^@+/, "");
  const digits = normalizeWhatsappDigits(s.whatsapp);
  if (alias && digits) return `@${alias} · ${digits}`;
  if (alias) return `@${alias}`;
  return digits || s.whatsapp.trim() || "—";
}

export function clientWaMeUrl(clientPhone: string): string {
  return `https://wa.me/${normalizeWhatsappDigits(clientPhone)}`;
}

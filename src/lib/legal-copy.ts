import { COMPANY } from "@/lib/assumptions";

/** Textos legales del Growth OS interno — GDPR / LOPDGDD. No sustituye asesoramiento jurídico. */

export const LEGAL_UPDATED = "2026-07-30";

export const legalSections = {
  aviso: {
    id: "aviso",
    titleEs: "Aviso legal",
    titleEn: "Legal notice",
    paragraphsEs: [
      `${COMPANY.legal} (“${COMPANY.name}”) es la entidad responsable de este entorno interno Growth OS / CRM. Web corporativa: ${COMPANY.website}. Contacto: ${COMPANY.email} · ${COMPANY.phone}.`,
      `Este panel es de uso exclusivo del equipo interno autorizado. El acceso está restringido mediante autenticación. Queda prohibido el uso por terceros no autorizados, la copia o la redistribución del software sin licencia comercial vigente.`,
      `Los datos mostrados en modo demo pueden ser semilla sintética. En producción, los datos pertenecen al tratamiento de ${COMPANY.legal} conforme a la Política de privacidad.`,
    ],
    paragraphsEn: [
      `${COMPANY.legal} (“${COMPANY.name}”) is the controller of this internal Growth OS / CRM. Corporate website: ${COMPANY.website}. Contact: ${COMPANY.email} · ${COMPANY.phone}.`,
      `This panel is for authorized internal staff only. Access requires authentication. Unauthorized use, copying or redistribution without a valid commercial license is forbidden.`,
      `Demo mode may show synthetic seed data. In production, data belongs to ${COMPANY.legal} under the Privacy Policy.`,
    ],
  },
  privacidad: {
    id: "privacidad",
    titleEs: "Política de privacidad",
    titleEn: "Privacy policy",
    paragraphsEs: [
      `Responsable del tratamiento: ${COMPANY.legal}. Finalidad: gestionar leads, clientes, reservas, logística, facturación y operaciones internas del Growth OS (CRM). Base legal: ejecución de relación contractual/precontractual con viajeros y clientes, e interés legítimo en la organización interna (art. 6.1.b y 6.1.f RGPD), sin perjuicio de otras bases cuando proceda.`,
      `Categorías de datos: identificación y contacto (nombre, email, teléfono, ciudad, DNI/NIF), datos de viaje y preferencias, scoring interno, LTV, pagos y facturación, logs de acceso del equipo. No se ceden datos a modelos de IA con la ficha íntegra; se aplica minimización y, cuando se use IA, contexto pseudonimizado.`,
      `Conservación: mientras dure la relación comercial y los plazos legales (fiscales/mercantiles). Derechos del interesado: acceso, rectificación, supresión, limitación, oposición y portabilidad ante ${COMPANY.email}, y reclamación ante la AEPD (www.aepd.es). Encargados del tratamiento típicos: infraestructura cloud (p. ej. Vercel, Supabase) bajo DPA cuando el sistema esté en producción real.`,
    ],
    paragraphsEn: [
      `Controller: ${COMPANY.legal}. Purpose: operate leads, clients, bookings, logistics, invoicing and internal Growth OS workflows. Legal bases: contract/pre-contract and legitimate interest in internal operations (GDPR art. 6.1.b and 6.1.f), without prejudice to others where applicable.`,
      `Data categories: identity and contact, trip preferences, internal scoring, LTV, payments/invoicing, staff access logs. Full customer records are not sent to AI models; minimization and pseudonymized context apply when AI is used.`,
      `Retention: for the commercial relationship and legal tax/commercial periods. Rights: access, rectification, erasure, restriction, objection and portability via ${COMPANY.email}, and complaint to the AEPD. Typical processors: cloud infra (e.g. Vercel, Supabase) under DPAs in real production.`,
    ],
  },
  cookies: {
    id: "cookies",
    titleEs: "Política de cookies",
    titleEn: "Cookie policy",
    paragraphsEs: [
      `Este CRM usa almacenamiento técnico necesario para funcionar: sesión de autenticación (Supabase Auth o sesión local del equipo), preferencias de interfaz y el Data Hub local (localStorage) cuando no hay backend. No utilizamos cookies de publicidad ni analítica de terceros que perfilen al usuario.`,
      `Al ser cookies/almacenamiento estrictamente necesarios para el servicio solicitado por el usuario autenticado, no se requiere banner de consentimiento ampliado (excepción de necesidad técnica). Puede borrar el almacenamiento local desde el navegador; ello cerrará la sesión y puede vaciar datos demo locales.`,
      `Si en el futuro se añaden cookies no esenciales (p. ej. analítica), se desplegará un banner de consentimiento previo y se actualizará esta política.`,
    ],
    paragraphsEn: [
      `This CRM uses necessary technical storage: auth session (Supabase Auth or local team session), UI preferences and the local Data Hub (localStorage) when no backend is configured. We do not use advertising or third-party profiling analytics cookies.`,
      `As these are strictly necessary for the authenticated service, an extended consent banner is not required. Clearing browser storage will sign you out and may wipe local demo data.`,
      `If non-essential cookies (e.g. analytics) are added later, a prior-consent banner will be shipped and this policy updated.`,
    ],
  },
} as const;

export type LegalSectionId = keyof typeof legalSections;

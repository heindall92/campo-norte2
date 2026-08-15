export type NotificationKind =
  | "lead"
  | "client"
  | "reservation"
  | "invoice"
  | "import"
  | "system"
  | "stock"
  | "fleet"
  | "ops";

export type NotificationTone = "ok" | "info" | "warn" | "danger";

export type AppSection =
  | "hub"
  | "dashboard"
  | "stock"
  | "huecos"
  | "picking"
  | "palets"
  | "flota"
  | "recepcion"
  | "expedicion"
  | "operarios"
  | "costes"
  | "leads"
  | "clientes"
  | "reservas"
  | "facturas"
  | "tesoreria"
  | "aprobaciones"
  | "equipo"
  | "contenido"
  | "conocimiento"
  | "automatizaciones"
  | "propuesta"
  | "slides"
  | "ajustes"
  | "usuarios";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  tone: NotificationTone;
  /** Nombre / entidad principal */
  actor: string;
  /** CONFIRMADA · MODIFICADA · CREADA · ELIMINADA… */
  statusLabel: string;
  body: string;
  detail?: string;
  createdAt: string;
  read: boolean;
  section?: AppSection;
  entityId?: string;
}

export const NOTIFICATIONS_KEY = "mps-notifications-v1";

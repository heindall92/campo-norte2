import type { Client, ContentDraft, Lead } from "@/lib/demo-data";
import type { Invoice, Reservation } from "@/lib/ops-data";

export type DataMode = "local" | "supabase";

export const HUB_VERSION = 1;
export const LOCAL_STORAGE_KEY = "mps-growth-os-hub-v1";

export interface HubMeta {
  version: number;
  mode: DataMode;
  seededFromDemo: boolean;
  lastSyncedAt: string | null;
  updatedAt: string;
}

export interface HubSnapshot {
  meta: HubMeta;
  leads: Lead[];
  clients: Client[];
  reservations: Reservation[];
  invoices: Invoice[];
  /** Content drafts stay local for now; optional in snapshot */
  contentDrafts?: ContentDraft[];
}

export interface ImportResult {
  added: number;
  updated: number;
  errors: string[];
}

export interface DataStore {
  mode: DataMode;
  load(): Promise<HubSnapshot>;
  save(snapshot: HubSnapshot): Promise<void>;
  /** True when remote credentials are present and usable */
  isConfigured(): boolean;
}

import {
  CLIENTS,
  CONTENT_DRAFTS,
  LEADS,
  type Client,
  type ContentDraft,
  type Lead,
} from "@/lib/demo-data";
import { INVOICES, RESERVATIONS, type Invoice, type Reservation } from "@/lib/ops-data";
import { HUB_VERSION, type DataMode, type HubSnapshot } from "./types";

export function buildSeedSnapshot(mode: DataMode = "local"): HubSnapshot {
  const now = new Date().toISOString();
  return {
    meta: {
      version: HUB_VERSION,
      mode,
      seededFromDemo: true,
      lastSyncedAt: now,
      updatedAt: now,
    },
    leads: structuredClone(LEADS) as Lead[],
    clients: structuredClone(CLIENTS) as Client[],
    reservations: structuredClone(RESERVATIONS) as Reservation[],
    invoices: structuredClone(INVOICES) as Invoice[],
    contentDrafts: structuredClone(CONTENT_DRAFTS) as ContentDraft[],
  };
}

export function blankLead(): Lead {
  const n = String(Math.floor(1100 + Math.random() * 800));
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: `L-${n}`,
    name: "",
    email: "",
    origin: "unknown",
    campaign: null,
    status: "nuevo",
    score: 40,
    scoreReasons: ["Alta manual / importación — completar origen y campaña"],
    interestRoute: null,
    vehicle: null,
    createdAt: today,
    lastTouchAt: today,
    owner: "Sofía",
  };
}

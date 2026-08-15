import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, getSupabaseEnv } from "@/lib/supabase/client";
import { forceLocalHub } from "@/lib/runtime";
import { buildSeedSnapshot } from "./seed";
import {
  HUB_VERSION,
  type DataStore,
  type HubSnapshot,
} from "./types";
import { normalizePaymentChannel, type Client, type Lead } from "@/lib/demo-data";
import type { Invoice, Reservation } from "@/lib/ops-data";

type Row = { id: string; payload: unknown; updated_at?: string };

export function supabaseConfigured(): boolean {
  return getSupabaseEnv().configured;
}

export function preferredDataMode(): "local" | "supabase" {
  const forced = (import.meta.env.VITE_DATA_MODE as string | undefined)?.trim();
  if (forced === "local") return "local";
  // Login demo local fuerza Hub semilla aunque haya Supabase en el entorno
  if (forceLocalHub()) return "local";
  if (forced === "supabase" || supabaseConfigured()) return "supabase";
  return "local";
}

export class SupabaseDataStore implements DataStore {
  mode = "supabase" as const;

  isConfigured() {
    return supabaseConfigured();
  }

  private getClient(): SupabaseClient {
    const client = getSupabase();
    if (!client) {
      throw new Error("Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
    }
    return client;
  }

  async load(): Promise<HubSnapshot> {
    const sb = this.getClient();
    const [leads, clients, reservations, invoices, metaRow] = await Promise.all([
      sb.from("mps_leads").select("id,payload"),
      sb.from("mps_clients").select("id,payload"),
      sb.from("mps_reservations").select("id,payload"),
      sb.from("mps_invoices").select("id,payload"),
      sb.from("mps_hub_meta").select("payload").eq("id", "default").maybeSingle(),
    ]);

    for (const res of [leads, clients, reservations, invoices]) {
      if (res.error) throw new Error(res.error.message);
    }
    if (metaRow.error) throw new Error(metaRow.error.message);

    const leadRows = (leads.data ?? []) as Row[];
    const clientRows = (clients.data ?? []) as Row[];
    const reservationRows = (reservations.data ?? []) as Row[];
    const invoiceRows = (invoices.data ?? []) as Row[];

    const empty =
      leadRows.length === 0 &&
      clientRows.length === 0 &&
      reservationRows.length === 0 &&
      invoiceRows.length === 0;

    if (empty) {
      const seed = buildSeedSnapshot("supabase");
      await this.save(seed);
      return seed;
    }

    const metaPayload = (metaRow.data?.payload ?? {}) as HubSnapshot["meta"];
    const now = new Date().toISOString();

    return {
      meta: {
        version: HUB_VERSION,
        mode: "supabase",
        seededFromDemo: metaPayload.seededFromDemo ?? false,
        lastSyncedAt: now,
        updatedAt: metaPayload.updatedAt ?? now,
      },
      leads: leadRows.map((r) => r.payload as Lead),
      clients: clientRows.map((r) => {
        const c = r.payload as Client;
        return { ...c, paymentMethod: normalizePaymentChannel(c.paymentMethod) };
      }),
      reservations: reservationRows.map((r) => {
        const res = r.payload as Reservation;
        return { ...res, paymentChannel: normalizePaymentChannel(res.paymentChannel) };
      }),
      invoices: invoiceRows.map((r) => {
        const inv = r.payload as Invoice;
        return { ...inv, paymentChannel: normalizePaymentChannel(inv.paymentChannel) };
      }),
    };
  }

  async save(snapshot: HubSnapshot): Promise<void> {
    const sb = this.getClient();
    const now = new Date().toISOString();

    const upsertTable = async (table: string, rows: { id: string; payload: unknown }[]) => {
      // Replace strategy: delete missing ids, upsert current
      const { data: existing, error: readErr } = await sb.from(table).select("id");
      if (readErr) throw new Error(readErr.message);
      const keep = new Set(rows.map((r) => r.id));
      const toDelete = ((existing ?? []) as { id: string }[])
        .map((r) => r.id)
        .filter((id) => !keep.has(id));
      if (toDelete.length) {
        const { error } = await sb.from(table).delete().in("id", toDelete);
        if (error) throw new Error(error.message);
      }
      if (rows.length) {
        const { error } = await sb.from(table).upsert(
          rows.map((r) => ({ id: r.id, payload: r.payload, updated_at: now })),
          { onConflict: "id" },
        );
        if (error) throw new Error(error.message);
      }
    };

    await upsertTable(
      "mps_leads",
      snapshot.leads.map((l) => ({ id: l.id, payload: l })),
    );
    await upsertTable(
      "mps_clients",
      snapshot.clients.map((c) => ({ id: c.id, payload: c })),
    );
    await upsertTable(
      "mps_reservations",
      snapshot.reservations.map((r) => ({ id: r.id, payload: r })),
    );
    await upsertTable(
      "mps_invoices",
      snapshot.invoices.map((i) => ({ id: i.id, payload: i })),
    );

    const meta = {
      ...snapshot.meta,
      version: HUB_VERSION,
      mode: "supabase" as const,
      updatedAt: now,
      lastSyncedAt: now,
    };

    const { error: metaErr } = await sb.from("mps_hub_meta").upsert(
      { id: "default", payload: meta, updated_at: now },
      { onConflict: "id" },
    );
    if (metaErr) throw new Error(metaErr.message);
  }
}

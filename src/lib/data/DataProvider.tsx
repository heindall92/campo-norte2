import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Client, Lead } from "@/lib/demo-data";
import { useNotifications } from "@/lib/notifications";
import type { Invoice, Reservation } from "@/lib/ops-data";
import { RESERVATION_STATUS_LABEL } from "@/lib/ops-data";
import {
  exportClientsCsv,
  exportLeadsCsv,
  importClientsFromCsv,
  importLeadsFromCsv,
} from "./csv";
import { LocalDataStore } from "./local-store";
import { buildSeedSnapshot } from "./seed";
import { preferredDataMode, SupabaseDataStore } from "./supabase-store";
import type { DataMode, DataStore, HubMeta, HubSnapshot, ImportResult } from "./types";

type PersistSlice = Partial<
  Pick<HubSnapshot, "leads" | "clients" | "reservations" | "invoices">
>;

export interface DataHubContextValue {
  ready: boolean;
  loading: boolean;
  error: string | null;
  mode: DataMode;
  meta: HubMeta | null;
  leads: Lead[];
  clients: Client[];
  reservations: Reservation[];
  invoices: Invoice[];
  saveLead: (lead: Lead) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  saveClient: (client: Client) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  saveReservation: (reservation: Reservation) => Promise<void>;
  deleteReservation: (id: string) => Promise<void>;
  saveInvoice: (invoice: Invoice) => Promise<void>;
  importLeadsCsv: (text: string) => Promise<ImportResult>;
  importClientsCsv: (text: string) => Promise<ImportResult>;
  importSnapshotJson: (text: string) => Promise<void>;
  exportSnapshot: () => HubSnapshot;
  getLeadsCsv: () => string;
  getClientsCsv: () => string;
  resetToSeed: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

const DataHubContext = createContext<DataHubContextValue | null>(null);

function createStore(): DataStore {
  const mode = preferredDataMode();
  if (mode === "supabase") {
    const remote = new SupabaseDataStore();
    if (remote.isConfigured()) return remote;
  }
  return new LocalDataStore();
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = item;
    return next;
  }
  return [item, ...list];
}

export function DataHubProvider({ children }: { children: ReactNode }) {
  const notify = useNotifications();
  const [store] = useState<DataStore>(() => createStore());
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<HubSnapshot | null>(null);
  const snapshotRef = useRef<HubSnapshot | null>(null);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const persist = useCallback(
    async (slice: PersistSlice, metaPatch?: Partial<HubMeta>) => {
      const prev = snapshotRef.current;
      if (!prev) return;
      const next: HubSnapshot = {
        ...prev,
        ...slice,
        meta: {
          ...prev.meta,
          ...metaPatch,
          seededFromDemo: metaPatch?.seededFromDemo ?? false,
          updatedAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
        },
      };
      snapshotRef.current = next;
      setSnapshot(next);
      try {
        await store.save(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar en el Data Hub");
        throw err;
      }
    },
    [store],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await store.load();
      const next = {
        ...data,
        meta: {
          ...data.meta,
          updatedAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
        },
      };
      snapshotRef.current = next;
      setSnapshot(next);
      try {
        await store.save(next);
      } catch {
        /* load ok even if stamp save fails */
      }
      window.dispatchEvent(new Event("mps-hub-refreshed"));
    } catch (err) {
      if (store.mode === "supabase") {
        try {
          const local = new LocalDataStore();
          const data = await local.load();
          const next = {
            ...data,
            meta: {
              ...data.meta,
              updatedAt: new Date().toISOString(),
              lastSyncedAt: new Date().toISOString(),
            },
          };
          snapshotRef.current = next;
          setSnapshot(next);
          setError(
            `Supabase no disponible (${err instanceof Error ? err.message : "error"}). Usando Data Hub local.`,
          );
          window.dispatchEvent(new Event("mps-hub-refreshed"));
        } catch (localErr) {
          const seed = buildSeedSnapshot("local");
          snapshotRef.current = seed;
          setSnapshot(seed);
          setError(localErr instanceof Error ? localErr.message : "No se pudo cargar el Hub");
        }
      } else {
        const seed = buildSeedSnapshot("local");
        snapshotRef.current = seed;
        setSnapshot(seed);
        setError(err instanceof Error ? err.message : "No se pudo cargar el Hub");
      }
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<DataHubContextValue>(() => {
    const leads = snapshot?.leads ?? [];
    const clients = snapshot?.clients ?? [];
    const reservations = snapshot?.reservations ?? [];
    const invoices = snapshot?.invoices ?? [];
    const meta = snapshot?.meta ?? null;

    return {
      ready,
      loading,
      error,
      mode: store.mode,
      meta,
      leads,
      clients,
      reservations,
      invoices,
      clearError: () => setError(null),
      refresh,
      saveLead: async (lead) => {
        const current = snapshotRef.current?.leads ?? [];
        const existed = current.some((l) => l.id === lead.id);
        await persist({ leads: upsertById(current, lead) });
        notify.push({
          kind: "lead",
          tone: existed ? "info" : "ok",
          actor: lead.name || lead.id,
          statusLabel: existed ? "MODIFICADO" : "CREADO",
          body: existed
            ? `Has actualizado el lead (${lead.status} · score ${lead.score})`
            : `Has creado el lead · origen ${lead.origin}`,
          detail: `${lead.email} · owner ${lead.owner}`,
          section: "leads",
          entityId: lead.id,
        });
      },
      deleteLead: async (id) => {
        const current = snapshotRef.current?.leads ?? [];
        const lead = current.find((l) => l.id === id);
        await persist({ leads: current.filter((l) => l.id !== id) });
        notify.push({
          kind: "lead",
          tone: "danger",
          actor: lead?.name ?? id,
          statusLabel: "ELIMINADO",
          body: "Has eliminado el lead del Hub",
          section: "leads",
          entityId: id,
        });
      },
      saveClient: async (client) => {
        const current = snapshotRef.current?.clients ?? [];
        const existed = current.some((c) => c.id === client.id);
        await persist({ clients: upsertById(current, client) });
        notify.push({
          kind: "client",
          tone: existed ? "info" : "ok",
          actor: client.name || client.id,
          statusLabel: existed ? "MODIFICADO" : "CREADO",
          body: existed
            ? `Has actualizado la ficha 360º (${client.segment})`
            : "Has dado de alta un cliente",
          detail: `${client.email} · ${client.phone}`,
          section: "clientes",
          entityId: client.id,
        });
      },
      deleteClient: async (id) => {
        const current = snapshotRef.current?.clients ?? [];
        const client = current.find((c) => c.id === id);
        await persist({ clients: current.filter((c) => c.id !== id) });
        notify.push({
          kind: "client",
          tone: "danger",
          actor: client?.name ?? id,
          statusLabel: "ELIMINADO",
          body: "Has eliminado el cliente del Hub",
          section: "clientes",
          entityId: id,
        });
      },
      saveReservation: async (reservation) => {
        const current = snapshotRef.current?.reservations ?? [];
        const prev = current.find((r) => r.id === reservation.id);
        const existed = Boolean(prev);
        const statusChanged = prev && prev.status !== reservation.status;
        await persist({ reservations: upsertById(current, reservation) });
        const label = !existed
          ? "CREADA"
          : statusChanged
            ? reservation.status === "reservado"
              ? "CONFIRMADA"
              : reservation.status.toUpperCase()
            : "MODIFICADA";
        notify.push({
          kind: "reservation",
          tone: !existed || statusChanged ? "ok" : "info",
          actor: reservation.clientName,
          statusLabel: label,
          body: !existed
            ? "Has creado la reserva"
            : statusChanged
              ? `Has cambiado el estado a ${RESERVATION_STATUS_LABEL[reservation.status]}`
              : "Has modificado la reserva",
          detail: `${reservation.tripName} · ${reservation.departureAt} · ${reservation.id}`,
          section: "reservas",
          entityId: reservation.id,
        });
      },
      deleteReservation: async (id) => {
        const current = snapshotRef.current;
        const r = current?.reservations.find((x) => x.id === id);
        await persist({
          reservations: (current?.reservations ?? []).filter((x) => x.id !== id),
          invoices: (current?.invoices ?? []).filter((inv) => inv.reservationId !== id),
        });
        notify.push({
          kind: "reservation",
          tone: "danger",
          actor: r?.clientName ?? id,
          statusLabel: "ELIMINADA",
          body: "Has eliminado la reserva y su logística",
          detail: r ? `${r.tripName} · ${r.departureAt}` : id,
          section: "reservas",
          entityId: id,
        });
      },
      saveInvoice: async (invoice) => {
        const current = snapshotRef.current?.invoices ?? [];
        const existed = current.some((i) => i.id === invoice.id);
        await persist({ invoices: upsertById(current, invoice) });
        notify.push({
          kind: "invoice",
          tone: "info",
          actor: invoice.clientName,
          statusLabel: existed ? "MODIFICADA" : "EMITIDA",
          body: `${invoice.number} · ${invoice.status}`,
          detail: invoice.expedition,
          section: "facturas",
          entityId: invoice.id,
        });
      },
      importLeadsCsv: async (text) => {
        const current = snapshotRef.current?.leads ?? [];
        const result = importLeadsFromCsv(text, current);
        await persist({ leads: result.leads });
        notify.push({
          kind: "import",
          tone: "ok",
          actor: "Data Hub",
          statusLabel: "IMPORTACIÓN",
          body: `Leads: +${result.added} · actualizados ${result.updated}`,
          section: "hub",
        });
        return { added: result.added, updated: result.updated, errors: result.errors };
      },
      importClientsCsv: async (text) => {
        const current = snapshotRef.current?.clients ?? [];
        const result = importClientsFromCsv(text, current);
        await persist({ clients: result.clients });
        notify.push({
          kind: "import",
          tone: "ok",
          actor: "Data Hub",
          statusLabel: "IMPORTACIÓN",
          body: `Clientes: +${result.added} · actualizados ${result.updated}`,
          section: "hub",
        });
        return { added: result.added, updated: result.updated, errors: result.errors };
      },
      importSnapshotJson: async (text) => {
        const parsed = JSON.parse(text) as HubSnapshot;
        if (!parsed?.leads || !parsed?.clients) {
          throw new Error("JSON inválido: se esperaba un snapshot del Hub");
        }
        const next: HubSnapshot = {
          ...parsed,
          meta: {
            ...parsed.meta,
            mode: store.mode,
            seededFromDemo: false,
            updatedAt: new Date().toISOString(),
            lastSyncedAt: new Date().toISOString(),
          },
        };
        await store.save(next);
        snapshotRef.current = next;
        setSnapshot(next);
        notify.push({
          kind: "system",
          tone: "ok",
          actor: "Data Hub",
          statusLabel: "RESTAURADO",
          body: "Snapshot JSON restaurado en el Hub",
          section: "hub",
        });
      },
      exportSnapshot: () => snapshotRef.current ?? buildSeedSnapshot(store.mode),
      getLeadsCsv: () => exportLeadsCsv(snapshotRef.current?.leads ?? []),
      getClientsCsv: () => exportClientsCsv(snapshotRef.current?.clients ?? []),
      resetToSeed: async () => {
        const seed = buildSeedSnapshot(store.mode);
        await store.save(seed);
        snapshotRef.current = seed;
        setSnapshot(seed);
        notify.push({
          kind: "system",
          tone: "warn",
          actor: "Data Hub",
          statusLabel: "RESET",
          body: "Hub restablecido a la semilla demo",
          section: "hub",
        });
      },
    };
  }, [ready, loading, error, snapshot, store, persist, refresh, notify]);

  return <DataHubContext.Provider value={value}>{children}</DataHubContext.Provider>;
}

export function useDataHub(): DataHubContextValue {
  const ctx = useContext(DataHubContext);
  if (!ctx) {
    throw new Error("useDataHub debe usarse dentro de DataHubProvider");
  }
  return ctx;
}

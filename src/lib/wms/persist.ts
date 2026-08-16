/**
 * Persistencia del snapshot WMS.
 * Demo / forceLocalHub → localStorage (semilla).
 * Producción + Supabase → wms_ledgers (Postgres es la fuente).
 * Nunca escribe el service role ni passwords.
 */

import { getSupabase } from "@/lib/supabase/client";
import { forceLocalHub, runtimeMode, supabaseConfigured, type RuntimeMode } from "@/lib/runtime";
import { normalizeWmsSnapshot, snapshotLooksUsable } from "./normalize";
import { authorizeWmsWrite, type AuthzError, type WmsActor } from "./permissions";
import type { WmsSnapshot } from "./types";

export const WMS_LEDGER_TABLE = "wms_ledgers";

export type LedgerPushError = AuthzError | "revision_conflict" | "demo_local_only" | "remote_unavailable";

export type LedgerPushResult =
  | { ok: true; revision: number; remote: boolean }
  | { ok: false; error: LedgerPushError };

export function shouldUseRemoteLedger(input: {
  mode: RuntimeMode;
  forceLocalHub: boolean;
  supabaseConfigured: boolean;
}): boolean {
  return input.mode === "production" && input.supabaseConfigured && !input.forceLocalHub;
}

export function remoteLedgerEnabled(): boolean {
  return shouldUseRemoteLedger({
    mode: runtimeMode(),
    forceLocalHub: forceLocalHub(),
    supabaseConfigured: supabaseConfigured(),
  });
}

/**
 * Revisión local vs la última conocida en remoto.
 * Tras `applyInventoryTx` el snap ya incrementó; un mutate de planta no.
 */
export function resolvePushRevision(current: number, expectedRevision: number): number | null {
  if (current === expectedRevision) return current + 1;
  if (current === expectedRevision + 1) return current;
  return null;
}

export function prepareLedgerPush(input: {
  snap: WmsSnapshot;
  actor: WmsActor | null;
  expectedRevision: number;
  requireActor: boolean;
  remote: boolean;
}): LedgerPushResult {
  if (!input.remote) return { ok: false, error: "demo_local_only" };
  const gate = authorizeWmsWrite(input.snap, input.actor, "stock.write", undefined, input.requireActor);
  if (!gate.ok) return gate;
  const current = input.snap.ledgerRevision ?? 0;
  const revision = resolvePushRevision(current, input.expectedRevision);
  if (revision == null) return { ok: false, error: "revision_conflict" };
  return { ok: true, revision, remote: true };
}

export async function pullRemoteLedger(orgId: string): Promise<WmsSnapshot | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client
    .from(WMS_LEDGER_TABLE)
    .select("payload, revision")
    .eq("org_code", orgId)
    .maybeSingle();
  if (error || !data?.payload) return null;
  const payload = data.payload as WmsSnapshot;
  return { ...payload, ledgerRevision: typeof data.revision === "number" ? data.revision : payload.ledgerRevision ?? 0 };
}

export async function pushRemoteLedger(
  snap: WmsSnapshot,
  actor: WmsActor | null,
  expectedRevision: number,
): Promise<LedgerPushResult> {
  const remote = remoteLedgerEnabled();
  const prepared = prepareLedgerPush({
    snap,
    actor,
    expectedRevision,
    requireActor: remote,
    remote,
  });
  if (!prepared.ok) return prepared;
  const client = getSupabase();
  if (!client) return { ok: false, error: "remote_unavailable" };

  const next: WmsSnapshot = { ...snap, ledgerRevision: prepared.revision };
  const { data, error } = await client.rpc("save_wms_ledger", {
    p_org_code: snap.org.id,
    p_expected: expectedRevision,
    p_payload: next,
  });
  if (error) {
    if (error.message?.includes("revision_conflict")) return { ok: false, error: "revision_conflict" };
    return { ok: false, error: "remote_unavailable" };
  }
  const revision = typeof data === "number" ? data : prepared.revision;
  return { ok: true, revision, remote: true };
}

/**
 * Hidrata desde Postgres si hay fila. No sube la semilla demo automáticamente.
 */
export async function hydrateRemoteLedger(local: WmsSnapshot): Promise<WmsSnapshot | null> {
  if (!remoteLedgerEnabled()) return null;
  const pulled = await pullRemoteLedger(local.org.id);
  if (!pulled || !snapshotLooksUsable(pulled)) return null;
  return normalizeWmsSnapshot(pulled);
}

export type RemoteCommitMode = "local" | "postgres" | "conflict";

export async function commitRemoteLedger(
  previous: WmsSnapshot,
  next: WmsSnapshot,
  actor: WmsActor | null,
): Promise<{ snap: WmsSnapshot; mode: RemoteCommitMode }> {
  if (!remoteLedgerEnabled()) return { snap: next, mode: "local" };
  const result = await pushRemoteLedger(next, actor, previous.ledgerRevision ?? 0);
  if (result.ok) {
    const snap = result.revision === next.ledgerRevision ? next : { ...next, ledgerRevision: result.revision };
    return { snap, mode: "postgres" };
  }
  if (result.error === "revision_conflict") {
    const pulled = await pullRemoteLedger(next.org.id);
    if (pulled && snapshotLooksUsable(pulled)) {
      return { snap: normalizeWmsSnapshot(pulled), mode: "conflict" };
    }
  }
  return { snap: next, mode: "local" };
}

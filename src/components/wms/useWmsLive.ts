import { useAuth } from "@/lib/auth";
import {
  bindWmsAdapter,
  getRfOutboxStore,
  mergeRfOutbox,
  resolveWmsAdapter,
} from "@/infrastructure/wms-store";
import type { WmsSnapshot } from "@/lib/wms";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useWmsLive() {
  const { user } = useAuth();
  const adapter = useMemo(
    () => resolveWmsAdapter(user),
    [user?.id, user?.provider, user?.email],
  );
  const [snap, setSnap] = useState(() => adapter.peek());

  useEffect(() => {
    bindWmsAdapter(adapter);
    setSnap(adapter.peek());
    let cancelled = false;
    void (async () => {
      const loaded = await adapter.load(user?.organizationId);
      if (cancelled) return;
      const queued = await getRfOutboxStore().list();
      const next = queued.length
        ? { ...loaded, rfOutbox: mergeRfOutbox(loaded.rfOutbox, queued) }
        : loaded;
      setSnap(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [adapter, user?.organizationId]);

  const commit = useCallback(
    (next: WmsSnapshot) => {
      setSnap(next);
      void adapter.save(next, user);
    },
    [adapter, user],
  );

  return { snap, commit };
}

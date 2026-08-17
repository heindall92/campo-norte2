import { useAuth } from "@/lib/auth";
import {
  bindWmsAdapter,
  getRfOutboxStore,
  mergeRfOutbox,
  resolveWmsAdapter,
} from "@/infrastructure/wms-store";
import { clearWmsSyncError, publishWmsSyncError } from "@/lib/wms/sync-status";
import type { WmsSnapshot } from "@/lib/wms";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useWmsLive() {
  const { user } = useAuth();
  const adapter = useMemo(
    () => resolveWmsAdapter(user),
    [user?.id, user?.provider, user?.email],
  );
  const [snap, setSnap] = useState(() => adapter.peek());
  const saveSeq = useRef(0);

  useEffect(() => {
    bindWmsAdapter(adapter);
    setSnap(adapter.peek());
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await adapter.load(user?.organizationId);
        if (cancelled) return;
        const queued = await getRfOutboxStore().list();
        const next = queued.length
          ? { ...loaded, rfOutbox: mergeRfOutbox(loaded.rfOutbox, queued) }
          : loaded;
        setSnap(next);
        clearWmsSyncError();
      } catch (err) {
        console.error("wms load failed", err);
        publishWmsSyncError("load", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adapter, user?.organizationId]);

  const commit = useCallback(
    (next: WmsSnapshot) => {
      const seq = ++saveSeq.current;
      setSnap(next);
      void adapter
        .save(next, user)
        .then(() => {
          if (seq !== saveSeq.current) return;
          clearWmsSyncError();
        })
        .catch(async (err) => {
          console.error("wms save failed", err);
          if (seq !== saveSeq.current) return;
          publishWmsSyncError("save", err);
          try {
            const loaded = await adapter.load(user?.organizationId);
            if (seq !== saveSeq.current) return;
            setSnap(loaded);
          } catch (loadErr) {
            publishWmsSyncError("load", loadErr);
          }
        });
    },
    [adapter, user],
  );

  return { snap, commit };
}

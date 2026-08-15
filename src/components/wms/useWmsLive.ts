import { loadWmsSnapshot, saveWmsSnapshot, type WmsSnapshot } from "@/lib/wms";
import { useCallback, useState } from "react";

export function useWmsLive() {
  const [snap, setSnap] = useState(() => loadWmsSnapshot());
  const commit = useCallback((next: WmsSnapshot) => {
    saveWmsSnapshot(next);
    setSnap(next);
  }, []);
  return { snap, commit };
}

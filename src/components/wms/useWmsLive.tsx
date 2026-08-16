import { useAuth } from "@/lib/auth";
import {
  actorFromAppUser,
  commitRemoteLedger,
  hydrateRemoteLedger,
  loadWmsSnapshot,
  remoteLedgerEnabled,
  saveWmsSnapshot,
  type WmsSnapshot,
} from "@/lib/wms";
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

export type WmsPersistMode = "local" | "postgres";

export type WmsLiveValue = {
  snap: WmsSnapshot;
  commit: (next: WmsSnapshot) => void;
  getSnap: () => WmsSnapshot;
  persistMode: WmsPersistMode;
  remoteReady: boolean;
};

const WmsLiveContext = createContext<WmsLiveValue | null>(null);

export function WmsLiveProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [snap, setSnap] = useState(() => loadWmsSnapshot());
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const genRef = useRef(0);
  const [persistMode, setPersistMode] = useState<WmsPersistMode>(() =>
    remoteLedgerEnabled() ? "postgres" : "local",
  );
  const [remoteReady, setRemoteReady] = useState(() => !remoteLedgerEnabled());

  useEffect(() => {
    if (!remoteLedgerEnabled()) {
      setPersistMode("local");
      setRemoteReady(true);
      return;
    }
    setPersistMode("postgres");
    if (!user) {
      setRemoteReady(true);
      return;
    }
    let cancelled = false;
    void hydrateRemoteLedger(snapRef.current).then((pulled) => {
      if (cancelled) return;
      setRemoteReady(true);
      if (!pulled) return;
      saveWmsSnapshot(pulled);
      snapRef.current = pulled;
      setSnap(pulled);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const getSnap = useCallback(() => snapRef.current, []);

  const commit = useCallback(
    (next: WmsSnapshot) => {
      const previous = snapRef.current;
      const gen = ++genRef.current;
      saveWmsSnapshot(next);
      snapRef.current = next;
      setSnap(next);
      const actor = actorFromAppUser(next, user);
      void commitRemoteLedger(previous, next, actor).then((result) => {
        if (gen !== genRef.current) return;
        if (result.mode === "postgres") setPersistMode("postgres");
        if (result.snap === next) return;
        saveWmsSnapshot(result.snap);
        snapRef.current = result.snap;
        setSnap(result.snap);
      });
    },
    [user],
  );

  const value = useMemo(
    () => ({ snap, commit, getSnap, persistMode, remoteReady }),
    [snap, commit, getSnap, persistMode, remoteReady],
  );

  return <WmsLiveContext.Provider value={value}>{children}</WmsLiveContext.Provider>;
}

export function useWmsLive(): WmsLiveValue {
  const ctx = useContext(WmsLiveContext);
  if (!ctx) {
    throw new Error("useWmsLive debe usarse dentro de WmsLiveProvider");
  }
  return ctx;
}

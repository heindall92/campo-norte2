import { useEffect, useState } from "react";
import {
  loadViewMode,
  resolveIsMobile,
  VIEW_MODE_EVENT,
  MOBILE_MQ,
} from "@/lib/view-mode";

export { MOBILE_MQ } from "@/lib/view-mode";

/** True cuando debe usarse el shell móvil (forzado o por breakpoint). */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? resolveIsMobile() : false,
  );

  useEffect(() => {
    const sync = () => setMobile(resolveIsMobile(loadViewMode()));
    sync();
    const mq = window.matchMedia(MOBILE_MQ);
    mq.addEventListener("change", sync);
    window.addEventListener(VIEW_MODE_EVENT, sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener(VIEW_MODE_EVENT, sync);
    };
  }, []);

  return mobile;
}

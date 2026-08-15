import {
  MOBILE_SUCCESS_EVENT,
  MOBILE_TICKET_EVENT,
  type MobileSuccessPayload,
  type MobileTicketPayload,
} from "@/lib/mobile-confirm";
import { MobileSuccessDialog } from "@/components/MobileSuccessDialog";
import { MobileTicketConfirm } from "@/components/MobileTicketConfirm";
import type { Lang } from "@/lib/i18n";
import { useEffect, useState } from "react";

/** Escucha el bus de confirmaciones móviles y renderiza L1 / L2. */
export function MobileConfirmHost({ lang }: { lang: Lang }) {
  const [success, setSuccess] = useState<MobileSuccessPayload | null>(null);
  const [ticket, setTicket] = useState<MobileTicketPayload | null>(null);

  useEffect(() => {
    function onSuccess(e: Event) {
      const detail = (e as CustomEvent<MobileSuccessPayload>).detail;
      if (detail) setSuccess(detail);
    }
    function onTicket(e: Event) {
      const detail = (e as CustomEvent<MobileTicketPayload>).detail;
      if (detail) setTicket(detail);
    }
    window.addEventListener(MOBILE_SUCCESS_EVENT, onSuccess);
    window.addEventListener(MOBILE_TICKET_EVENT, onTicket);
    return () => {
      window.removeEventListener(MOBILE_SUCCESS_EVENT, onSuccess);
      window.removeEventListener(MOBILE_TICKET_EVENT, onTicket);
    };
  }, []);

  const es = lang === "es";

  return (
    <>
      <MobileSuccessDialog
        open={!!success}
        title={success?.title ?? ""}
        description={success?.description}
        doneLabel={es ? "Hecho" : "Done"}
        onDone={() => setSuccess(null)}
      />
      <MobileTicketConfirm
        open={!!ticket}
        title={ticket?.title ?? ""}
        subtitle={ticket?.subtitle}
        headline={ticket?.headline ?? ""}
        meta={ticket?.meta}
        fields={ticket?.fields ?? []}
        chips={ticket?.chips}
        primaryLabel={ticket?.primaryLabel ?? (es ? "Hecho" : "Done")}
        onPrimary={() => {
          const nav = ticket?.navigateTo;
          setTicket(null);
          if (nav) {
            window.dispatchEvent(new CustomEvent("mps-navigate", { detail: nav }));
          }
        }}
      />
    </>
  );
}

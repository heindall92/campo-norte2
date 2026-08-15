import { useAuth } from "@/lib/auth";
import { CookieNotice } from "@/components/CookieNotice";
import { LeadCaptureForm } from "@/components/LeadCaptureForm";
import { LegalPage } from "@/components/LegalPage";
import { LoginScreen } from "@/components/LoginScreen";
import { MpsCrmApp } from "@/components/MpsCrmApp";

function path() {
  return window.location.pathname.replace(/\/+$/, "");
}

export default function App() {
  const { ready, user } = useAuth();

  // Captura pública: sin sesión, es la puerta por la que entran los leads.
  if (path() === "/captura") {
    return <LeadCaptureForm />;
  }

  if (path() === "/legal") {
    return (
      <>
        <LegalPage />
        <CookieNotice />
      </>
    );
  }

  if (!ready) {
    return (
      <div className="mps-crm mps-bg flex min-h-screen items-center justify-center text-sm text-[var(--ink-muted)]">
        Cargando sesión…
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginScreen />
        <CookieNotice />
      </>
    );
  }

  return (
    <>
      <MpsCrmApp />
      <CookieNotice />
    </>
  );
}

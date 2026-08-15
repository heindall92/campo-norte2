import { useAuth, canAccessSection, canManageCrmUsers } from "@/lib/auth";
import { useDataHub } from "@/lib/data";
import { useNotifications, type AppSection } from "@/lib/notifications";
import { loadUserProfile } from "@/lib/user-profile";
import type { UserPrefs } from "@/lib/user-prefs";
import { t, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { showMobileSuccess } from "@/lib/mobile-confirm";
import {
  MobileViewSwitchOverlay,
  MOBILE_VIEW_NOTICE_KEY,
} from "@/components/MobileViewSwitchOverlay";
import { MobileProfileScreen } from "@/components/MobileProfileScreen";
import { MobileConfirmHost } from "@/components/MobileConfirmHost";
import { MobileNotificationsSheet } from "@/components/MobileNotificationsSheet";
import { MobileEcosystemCarousel } from "@/components/MobileEcosystemCarousel";
import { MobileHomeSummary } from "@/components/MobileHomeSummary";
import { MobileClientsScreen } from "@/components/MobileClientsScreen";
import { MobileBookingsScreen } from "@/components/MobileBookingsScreen";
import { MobileLeadsScreen } from "@/components/MobileLeadsScreen";
import { ClientFormModal, blankClient } from "@/components/ClientFormModal";
import { ReservationFormModal, blankReservation } from "@/components/ReservationFormModal";
import type { Client } from "@/lib/demo-data";
import type { Reservation } from "@/lib/ops-data";
import { SupportModal } from "@/components/SupportModal";
import { UnreadDot } from "@/components/UnreadDot";
import {
  Bell,
  BookOpen,
  ContactRound,
  Layers,
  CalendarDays,
  ClipboardList,
  Database,
  FileText,
  Gauge,
  Home,
  LayoutDashboard,
  Plus,
  Presentation,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Wallet,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

const QUICK: {
  id: AppSection;
  labelEs: string;
  labelEn: string;
  icon: LucideIcon;
}[] = [
  { id: "dashboard", labelEs: "Torre", labelEn: "Tower", icon: LayoutDashboard },
  { id: "stock", labelEs: "Stock", labelEn: "Stock", icon: Gauge },
  { id: "huecos", labelEs: "Huecos", labelEn: "Slots", icon: Layers },
  { id: "picking", labelEs: "Picar", labelEn: "Pick", icon: Gauge },
  { id: "palets", labelEs: "Palets", labelEn: "Pallets", icon: CalendarDays },
  { id: "flota", labelEs: "Flota", labelEn: "Fleet", icon: Database },
];

const MORE_SECTIONS: { id: AppSection; labelEs: string; labelEn: string; icon: LucideIcon }[] = [
  { id: "recepcion", labelEs: "Recepción", labelEn: "Receiving", icon: ClipboardList },
  { id: "expedicion", labelEs: "Expedición", labelEn: "Outbound", icon: Presentation },
  { id: "operarios", labelEs: "Operarios", labelEn: "Operators", icon: Users },
  { id: "costes", labelEs: "Costes", labelEn: "Costs", icon: Wallet },
  { id: "facturas", labelEs: "Facturas", labelEn: "Invoices", icon: FileText },
  { id: "tesoreria", labelEs: "Tesorería", labelEn: "Treasury", icon: Wallet },
  { id: "aprobaciones", labelEs: "Aprobaciones", labelEn: "Approvals", icon: ShieldCheck },
  { id: "equipo", labelEs: "Equipo", labelEn: "Team", icon: ContactRound },
  { id: "clientes", labelEs: "Clientes", labelEn: "Clients", icon: Users },
  { id: "leads", labelEs: "Comercial", labelEn: "Commercial", icon: Gauge },
  { id: "reservas", labelEs: "Reservas", labelEn: "Bookings", icon: CalendarDays },
  { id: "contenido", labelEs: "Contenido", labelEn: "Content", icon: Sparkles },
  { id: "conocimiento", labelEs: "Conocimiento", labelEn: "Knowledge", icon: BookOpen },
  { id: "automatizaciones", labelEs: "Automatizaciones", labelEn: "Automations", icon: Workflow },
  { id: "propuesta", labelEs: "Propuesta", labelEn: "Pitch", icon: ClipboardList },
  { id: "slides", labelEs: "Presentación", labelEn: "Slides", icon: Presentation },
  { id: "hub", labelEs: "Hub", labelEn: "Hub", icon: Database },
  { id: "ajustes", labelEs: "Ajustes", labelEn: "Settings", icon: Settings },
];

/**
 * Secciones cuya cabecera muestra el título: las pantallas nativas (leads,
 * clientes, reservas) ya lo llevan dentro, y repetirlo sería redundante.
 */
const SECTION_TITLE_KEY: Partial<Record<AppSection, string>> = {
  dashboard: "nav_dashboard",
  stock: "nav_stock",
  huecos: "nav_slots",
  picking: "nav_picking",
  palets: "nav_pallets",
  flota: "nav_fleet",
  recepcion: "nav_inbound",
  expedicion: "nav_outbound",
  operarios: "nav_operators",
  costes: "nav_costs",
  hub: "nav_hub",
  facturas: "nav_invoices",
  tesoreria: "nav_treasury",
  aprobaciones: "nav_approvals",
  equipo: "nav_team",
  contenido: "nav_content",
  conocimiento: "nav_knowledge",
  automatizaciones: "nav_automations",
  propuesta: "nav_pitch",
  slides: "nav_slides",
  ajustes: "nav_settings",
  usuarios: "nav_users",
};

type MobileTab = "home" | "clientes" | "reservas" | "cuenta";

export function MobileCrmShell({
  lang,
  section,
  onNavigate,
  onOpenProfile,
  onLangChange,
  prefs,
  onPrefsChange,
  children,
}: {
  lang: Lang;
  section: AppSection;
  onNavigate: (s: AppSection) => void;
  onOpenProfile: () => void;
  onLangChange: (l: Lang) => void;
  prefs: UserPrefs;
  onPrefsChange: (p: UserPrefs) => void;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const hub = useDataHub();
  const { unreadCount, markAllRead } = useNotifications();
  const [showHome, setShowHome] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [cuentaOpen, setCuentaOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [createForm, setCreateForm] = useState<
    { kind: "client"; data: Client } | { kind: "reservation"; data: Reservation } | null
  >(null);
  const es = lang === "es";

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await hub.refresh();
      showMobileSuccess({
        title: es ? "Hub actualizado" : "Hub updated",
        description: es
          ? "Leads, clientes, reservas y facturas recargados."
          : "Leads, clients, bookings and invoices reloaded.",
      });
    } catch {
      showMobileSuccess({
        title: es ? "No se pudo actualizar" : "Could not refresh",
        description: es
          ? "Revisa la conexión o el Data Hub."
          : "Check your connection or Data Hub.",
      });
    } finally {
      setRefreshing(false);
    }
  }

  async function saveNewClient(client: Client) {
    try {
      await hub.saveClient(client);
      setCreateForm(null);
      showMobileSuccess({
        title: es ? "Cliente creado" : "Client created",
        description: `${client.name} · ${es ? "ya está en el Hub" : "is now in the Hub"}`,
      });
    } catch {
      showMobileSuccess({
        title: es ? "No se pudo guardar" : "Could not save",
        description: es
          ? "Revisa la conexión o el Data Hub."
          : "Check your connection or the Data Hub.",
      });
    }
  }

  async function saveNewReservation(reservation: Reservation) {
    try {
      await hub.saveReservation(reservation);
      setCreateForm(null);
      showMobileSuccess({
        title: es ? "Reserva creada" : "Booking created",
        description: `${reservation.clientName || reservation.id} · ${
          es ? "ya está en el Hub" : "is now in the Hub"
        }`,
      });
    } catch {
      showMobileSuccess({
        title: es ? "No se pudo guardar" : "Could not save",
        description: es
          ? "Revisa la conexión o el Data Hub."
          : "Check your connection or the Data Hub.",
      });
    }
  }

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(MOBILE_VIEW_NOTICE_KEY)) setOverlayOpen(true);
    } catch {
      setOverlayOpen(true);
    }
  }, []);

  useEffect(() => {
    function onProfileSaved() {
      showMobileSuccess({
        title: lang === "es" ? "Listo" : "Successful",
        description:
          lang === "es"
            ? "Tu perfil se ha guardado correctamente."
            : "Your profile was saved successfully.",
      });
    }
    function onMarkRead() {
      setNotifOpen(true);
      markAllRead();
    }
    function onNavigateEvent(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (!detail) return;
      setCuentaOpen(false);
      setShowHome(false);
      setNotifOpen(false);
      onNavigate(detail as AppSection);
    }
    window.addEventListener("mps-profile-saved", onProfileSaved);
    window.addEventListener("mps-mark-notifications-read", onMarkRead);
    window.addEventListener("mps-navigate", onNavigateEvent);
    return () => {
      window.removeEventListener("mps-profile-saved", onProfileSaved);
      window.removeEventListener("mps-mark-notifications-read", onMarkRead);
      window.removeEventListener("mps-navigate", onNavigateEvent);
    };
  }, [lang, markAllRead, onNavigate]);

  useEffect(() => {
    if (section === "clientes" || section === "reservas") {
      setShowHome(false);
      setCuentaOpen(false);
    }
  }, [section]);

  const quickItems = useMemo(() => {
    if (!user) return QUICK;
    return QUICK.filter((q) => canAccessSection(user.role, q.id));
  }, [user]);

  const moreItems = useMemo(() => {
    if (!user) return MORE_SECTIONS;
    const quickIds = new Set(QUICK.map((q) => q.id));
    return MORE_SECTIONS.filter(
      (m) => !quickIds.has(m.id) && canAccessSection(user.role, m.id),
    );
  }, [user]);

  if (!user) return <>{children}</>;

  const profile = loadUserProfile(user.id, {
    name: user.name,
    email: user.email,
    roleLabel: user.roleLabel,
  });
  const displayName = profile.fullName.trim() || user.name;
  const firstName = displayName.split(" ")[0];

  const sectionTitleKey = SECTION_TITLE_KEY[section];
  const headerTitle = cuentaOpen
    ? es
      ? "Cuenta"
      : "Account"
    : sectionTitleKey
      ? t(lang, sectionTitleKey)
      : "";
  const canCreate =
    !showHome && !cuentaOpen && (section === "clientes" || section === "reservas");

  // Sin pestaña marcada cuando la sección abierta no es ninguna de las cuatro
  // (leads, facturas…): marcar «Inicio» ahí mentiría sobre dónde estás.
  let activeTab: MobileTab | null = null;
  if (cuentaOpen) activeTab = "cuenta";
  else if (showHome) activeTab = "home";
  else if (section === "clientes") activeTab = "clientes";
  else if (section === "reservas") activeTab = "reservas";

  function go(tab: MobileTab) {
    setMoreOpen(false);
    if (tab === "home") {
      setCuentaOpen(false);
      setShowHome(true);
      return;
    }
    if (tab === "clientes") {
      setCuentaOpen(false);
      setShowHome(false);
      onNavigate("clientes");
      return;
    }
    if (tab === "reservas") {
      setCuentaOpen(false);
      setShowHome(false);
      onNavigate("reservas");
      return;
    }
    setShowHome(false);
    setCuentaOpen(true);
  }

  function openNotifications() {
    setNotifOpen(true);
  }

  function openSection(id: AppSection) {
    setMoreOpen(false);
    setCuentaOpen(false);
    setShowHome(false);
    setNotifOpen(false);
    onNavigate(id);
  }

  return (
    <div className="mps-mobile relative min-h-[100dvh] bg-[var(--bg0)] text-[var(--ink)]">
      <MobileViewSwitchOverlay
        lang={lang}
        open={overlayOpen}
        onDone={() => setOverlayOpen(false)}
      />
      <MobileConfirmHost lang={lang} />
      <SupportModal
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        lang={lang}
      />
      {createForm?.kind === "client" && (
        <ClientFormModal
          lang={lang}
          mode="create"
          initial={createForm.data}
          onClose={() => setCreateForm(null)}
          onSave={(client) => void saveNewClient(client)}
        />
      )}
      {createForm?.kind === "reservation" && (
        <ReservationFormModal
          lang={lang}
          mode="create"
          initial={createForm.data}
          onClose={() => setCreateForm(null)}
          onSave={(reservation) => void saveNewReservation(reservation)}
        />
      )}

      <MobileNotificationsSheet
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        lang={lang}
        onNavigate={(s) => {
          setNotifOpen(false);
          openSection(s);
        }}
      />

      <header className="sticky top-0 z-40 border-b border-[color-mix(in_oklab,var(--ink)_6%,transparent)] bg-[color-mix(in_oklab,var(--bg0)_92%,white)] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          {showHome ? (
            <button
              type="button"
              onClick={() => {
                setCuentaOpen(true);
                setShowHome(false);
              }}
              className="flex min-h-11 min-w-0 items-center gap-2.5 text-left"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent)] text-sm font-bold text-white shadow-md">
                {profile.avatarDataUrl ? (
                  <img src={profile.avatarDataUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  user.avatarInitial
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold text-[var(--ink-muted)]">
                  {es ? "Buenos días" : "Good morning"}
                </span>
                <span className="block truncate text-base font-bold text-[var(--ink)]">
                  {firstName}
                </span>
              </span>
            </button>
          ) : headerTitle ? (
            <p className="min-h-11 min-w-0 flex-1 truncate py-2 font-[family-name:var(--mps-display)] text-xl text-[var(--ink)]">
              {headerTitle}
            </p>
          ) : (
            <span className="min-h-11 flex-1" aria-hidden />
          )}

          <div className="flex items-center gap-2">
            {showHome && (
              <button
                type="button"
                aria-label={es ? "Recargar Hub" : "Refresh Hub"}
                title={es ? "Recargar Hub" : "Refresh Hub"}
                disabled={refreshing}
                onClick={() => void handleRefresh()}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--field-bg)] text-[var(--ink)] shadow-sm disabled:opacity-60"
              >
                <RefreshCw
                  className={cn("h-5 w-5", refreshing && "animate-spin text-[var(--accent)]")}
                />
              </button>
            )}

            {/* Alta rápida donde tiene sentido crear: cliente y reserva */}
            {canCreate && (
              <button
                type="button"
                aria-label={
                  section === "clientes"
                    ? es
                      ? "Nuevo cliente"
                      : "New client"
                    : es
                      ? "Nueva reserva"
                      : "New booking"
                }
                title={
                  section === "clientes"
                    ? es
                      ? "Nuevo cliente"
                      : "New client"
                    : es
                      ? "Nueva reserva"
                      : "New booking"
                }
                onClick={() =>
                  setCreateForm(
                    section === "clientes"
                      ? { kind: "client", data: blankClient() }
                      : { kind: "reservation", data: blankReservation() },
                  )
                }
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-sm"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}

            <button
              type="button"
              aria-label={es ? "Notificaciones" : "Notifications"}
              onClick={openNotifications}
              className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[var(--field-bg)] text-[var(--ink)] shadow-sm"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && <UnreadDot className="right-2.5 top-2.5" />}
            </button>
          </div>
        </div>
      </header>

      {cuentaOpen ? (
        <div className="px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-3">
          <MobileProfileScreen
            lang={lang}
            prefs={prefs}
            onPrefsChange={onPrefsChange}
            onOpenProfile={onOpenProfile}
            onOpenNotifications={openNotifications}
            onNavigate={(s) => {
              setCuentaOpen(false);
              openSection(s);
            }}
            onLangChange={onLangChange}
          />
        </div>
      ) : showHome ? (
        <div className="px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-3">
          <MobileHomeSummary lang={lang} onNavigate={openSection} />

          <p className="mb-2 mt-5 text-sm font-bold text-[var(--ink)]">
            {es ? "Accesos rápidos" : "Quick access"}
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {quickItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openSection(item.id)}
                  className="flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-[1.15rem] bg-[var(--field-bg)] px-1 py-3 shadow-sm"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] text-[var(--accent)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[10px] font-semibold text-[var(--ink)]">
                    {es ? item.labelEs : item.labelEn}
                  </span>
                </button>
              );
            })}
          </div>

          <MobileEcosystemCarousel
            lang={lang}
            onOpenSupport={() => setSupportOpen(true)}
            onOpenSettings={() => openSection("ajustes")}
          />
        </div>
      ) : section === "clientes" ? (
        <main className="px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2">
          <MobileClientsScreen lang={lang} />
        </main>
      ) : section === "reservas" ? (
        <main className="px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2">
          <MobileBookingsScreen lang={lang} />
        </main>
      ) : section === "leads" ? (
        <main className="px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2">
          <MobileLeadsScreen lang={lang} />
        </main>
      ) : (
        <main className="px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-3">
          <div className="overflow-x-auto overflow-y-visible rounded-[1.25rem] border border-[color-mix(in_oklab,var(--ink)_8%,transparent)] bg-[var(--glass-strong)] p-2 shadow-sm sm:p-3">
            {children}
          </div>
        </main>
      )}

      {moreOpen && (
        <div
          className="fixed inset-0 z-50 bg-[color-mix(in_oklab,#0f172a_45%,transparent)]"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-[1.75rem] bg-[var(--glass-strong)] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--field-border)]" />
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-[var(--ink)]">
                {es ? "Más módulos" : "More modules"}
              </p>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setMoreOpen(false)}
                className="rounded-full p-2 text-[var(--ink-muted)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 pb-2">
              {moreItems.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => openSection(m.id)}
                    className="flex flex-col items-center gap-1.5 rounded-2xl bg-[var(--field-bg)] px-2 py-3"
                  >
                    <Icon className="h-5 w-5 text-[var(--accent)]" />
                    <span className="text-[10px] font-semibold text-[var(--ink)]">
                      {es ? m.labelEs : m.labelEn}
                    </span>
                  </button>
                );
              })}
              {canManageCrmUsers(user.role) && (
                <button
                  type="button"
                  onClick={() => openSection("usuarios")}
                  className="flex flex-col items-center gap-1.5 rounded-2xl bg-[var(--field-bg)] px-2 py-3"
                >
                  <UserRound className="h-5 w-5 text-[var(--accent)]" />
                  <span className="text-[10px] font-semibold text-[var(--ink)]">
                    {es ? "Usuarios" : "Users"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <nav
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]",
          (notifOpen || moreOpen || supportOpen) && "invisible",
        )}
        aria-hidden={notifOpen || moreOpen || supportOpen}
        aria-label={es ? "Navegación móvil" : "Mobile navigation"}
      >
        <div
          className="pointer-events-auto flex w-full max-w-md items-stretch justify-around gap-0.5 rounded-full border border-[color-mix(in_oklab,var(--accent)_40%,var(--glass-border))] bg-[color-mix(in_oklab,var(--glass-strong)_94%,transparent)] px-1.5 py-1.5 shadow-[0_10px_36px_color-mix(in_oklab,var(--ink)_22%,transparent),0_0_24px_color-mix(in_oklab,var(--accent)_18%,transparent)] backdrop-blur-xl"
        >
          <NavItem
            active={activeTab === "home"}
            label={es ? "Inicio" : "Home"}
            onClick={() => go("home")}
            icon={Home}
          />
          <NavItem
            active={activeTab === "clientes"}
            label={es ? "Clientes" : "Clients"}
            onClick={() => go("clientes")}
            icon={Users}
          />
          {/* Acción, no pestaña: elevada y sin estado activo, para que no se
              confunda «abrir módulos» con «estoy en esta sección». */}
          <button
            type="button"
            aria-label={es ? "Módulos" : "Modules"}
            title={es ? "Módulos" : "Modules"}
            onClick={() => setMoreOpen(true)}
            className="-mt-6 flex h-14 w-14 shrink-0 items-center justify-center self-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-white shadow-[0_10px_24px_color-mix(in_oklab,var(--accent)_45%,transparent)] ring-4 ring-[var(--bg0)] transition active:scale-95"
          >
            <Layers className="h-6 w-6" />
          </button>
          <NavItem
            active={activeTab === "reservas"}
            label={es ? "Reservas" : "Bookings"}
            onClick={() => go("reservas")}
            icon={CalendarDays}
          />
          <NavItem
            active={activeTab === "cuenta"}
            label={es ? "Cuenta" : "Account"}
            onClick={() => go("cuenta")}
            icon={UserRound}
          />
        </div>
      </nav>
    </div>
  );
}

function NavItem({
  active,
  label,
  onClick,
  icon: Icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-0.5"
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full transition",
          active
            ? "bg-[color-mix(in_oklab,var(--accent)_20%,transparent)] text-[var(--accent)] shadow-[0_0_12px_color-mix(in_oklab,var(--accent)_35%,transparent)]"
            : "text-[var(--ink-muted)]",
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
      </span>
      <span
        className={cn(
          "text-[9px] font-semibold tracking-wide",
          active ? "text-[var(--accent)]" : "text-[var(--ink-muted)]",
        )}
      >
        {label}
      </span>
    </button>
  );
}

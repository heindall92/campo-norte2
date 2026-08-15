import {
  AI_PROVIDER_DOCS,
  AI_PROVIDER_LABEL,
  applyIntelligenceToClient,
  applyScoreToLead,
  askKnowledgeStream,
  aiReady,
  clientsToContactThisMonth,
  classifyCustomer,
  deleteKnowledgeDoc,
  KNOWLEDGE_KIND_LABEL,
  loadAiSettings,
  loadKnowledgeDocs,
  monthsSinceTrip,
  priorityLabel,
  providerLabel,
  saveAiSettings,
  saveKnowledgeDocs,
  scoreLead,
  testAiConnection,
  upsertKnowledgeDoc,
  type AiProvider,
  type AiSettings,
  type KnowledgeAskResult,
  type KnowledgeDoc,
  type KnowledgeDocKind,
} from "@/lib/ai";
import { useNotifications } from "@/lib/notifications";
import { COMPANY, GOLDEN_RULE, MPS_ANNEX, MPS_ASSUMPTIONS, TEAM } from "@/lib/assumptions";
import { computeBusinessKpis } from "@/lib/business-kpis";
import {
  CONTENT_DRAFTS,
  EXPEDITIONS,
  EXPERIENCE_LABEL,
  KNOWLEDGE_ANSWERS,
  type KnowledgeItem,
  MONTHLY_KPIS,
  ORIGIN_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  ROUTE_LABEL,
  SEGMENT_LABEL,
  STATUS_LABEL,
  progressToMillion,
  routeMargins,
  type Client,
  type ClientSegment,
  type Lead,
  type LeadOrigin,
  type LeadStatus,
  type VehicleMode,
} from "@/lib/demo-data";
import {
  blankLead,
  computeLeadStats,
  computeOriginFromLeads,
  downloadTextFile,
  supabaseConfigured,
  useDataHub,
} from "@/lib/data";
import {
  canAccessSection,
  canEditAiSettings,
  canEditBusinessSettings,
  canManageCrmUsers,
  canViewDatabaseCard,
  useAuth,
} from "@/lib/auth";
import { allowClientAiKeys } from "@/lib/runtime";
import { sectionToAccessEvent, trackAccess } from "@/lib/access-log";
import type { AppSection } from "@/lib/notifications";
import { AppHeader } from "@/components/AppHeader";
import { MobileCrmShell } from "@/components/MobileCrmShell";
import { MobileLeadScoreSheet } from "@/components/MobileLeadScoreSheet";
import { useIsMobile } from "@/lib/use-is-mobile";
import { showMobileTicket } from "@/lib/mobile-confirm";
import { Badge, Card } from "@/components/CrmChrome";
import { EntityActionBar } from "@/components/EntityActionBar";
import { t, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  AutomationsEcosystemPanel,
  InvoicesVerifactuPanel,
  ReservationsPanel,
  clientPaymentTone,
} from "@/components/OpsPanels";
import { blankClient, ClientFormModal } from "@/components/ClientFormModal";
import { AppearanceCard } from "@/components/AppearanceCard";
import { AppleSwitch } from "@/components/AppleSwitch";
import { ViewModePicker } from "@/components/ViewModePicker";
import { ContentFactoryPanel } from "@/components/ContentFactoryPanel";
import { ProfileModal } from "@/components/ProfileModal";
import { SupportCard } from "@/components/SupportCard";
import { SupportModal } from "@/components/SupportModal";
import { UsersDirectoryPanel } from "@/components/UsersDirectoryPanel";
import { AttentionPanel } from "@/components/AttentionPanel";
import { ApprovalsPanel } from "@/components/ApprovalsPanel";
import { FiscalCalendarPanel } from "@/components/FiscalCalendarPanel";
import { IntegrationsPanel } from "@/components/IntegrationsPanel";
import { AiAssistantHost } from "@/components/AiAssistantHost";
import { UpcomingCashPanel } from "@/components/UpcomingCashPanel";
import {
  askAboutInvoice,
  askAboutLead,
  askAboutReservation,
  askAboutTopic,
  onAskRequested,
  requestAsk,
} from "@/lib/ai/ask-bus";
import {
  groupThreadsByRecency,
  listAiThreads,
  upsertAiThread,
  type AiThread,
} from "@/lib/ai/threads";
import { TreasuryPanel } from "@/components/TreasuryPanel";
import { PnLPanel } from "@/components/PnLPanel";
import { estimateTokens, formatTokenK, loadAiUsage, recordAiUsage } from "@/lib/ai/token-budget";
import { TeamOpsPanel } from "@/components/TeamOpsPanel";
import { CashFlowChart } from "@/components/ui/CashFlowChart";
import { ClosingProjection } from "@/components/ui/ClosingProjection";
import { ViewTotals } from "@/components/ui/ViewTotals";
import { buildTeamOps } from "@/lib/team-ops";
import { buildTreasury } from "@/lib/treasury";
import { coldByLabel, decayedScore } from "@/lib/ai/lead-scoring-core";
import { formatEur } from "@/lib/format";
import {
  applyUserPrefsToDocument,
  loadUserPrefs,
  saveUserPrefs,
  type UserPrefs,
} from "@/lib/user-prefs";
import { LeadPriorityModeSelect } from "@/components/LeadPriorityModeSelect";
import { useLeadPriorityMode } from "@/lib/use-lead-priority-mode";
import { leadPriorityModeLabel } from "@/lib/ai/lead-priority";
import {
  loadBusinessSettings,
  saveBusinessSettings,
  type BusinessSettings,
} from "@/lib/business-settings";
import {
  IDLE_TIMEOUT_OPTIONS,
  loadSecuritySettings,
  saveSecuritySettings,
  type IdleTimeoutMinutes,
  type SecuritySettings,
} from "@/lib/security-settings";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  BookOpen,
  Bot,
  Boxes,
  Building2,
  Car,
  Activity,
  CircleHelp,
  ClipboardList,
  Cloud,
  Database,
  Download,
  FileText,
  Forklift,
  Gauge,
  Grid3X3,
  HardDrive,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  MessageSquareWarning,
  Moon,
  Package,
  Pencil,
  Phone,
  Plug,
  Plus,
  Presentation,
  RefreshCw,
  Save,
  ScanBarcode,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Target,
  Truck,
  Upload,
  Users,
  ShieldCheck,
  ContactRound,
  UsersRound,
  Wallet,
  Warehouse,
  Workflow,
  CalendarDays,
  Zap,
} from "lucide-react";
import {
  WmsCostsPanel,
  WmsDashboardPanel,
  WmsFleetPanel,
  WmsInboundPanel,
  WmsOperatorsPanel,
  WmsOutboundPanel,
  WmsPalletsPanel,
  WmsStockPanel,
} from "@/components/wms/WmsPanels";
import { WmsPickingPanel, WmsSlotsPanel } from "@/components/wms/AislePicking";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Theme = "light" | "dark";
type Section = AppSection;

const NAV_IDS: { id: Section; icon: typeof LayoutDashboard; labelKey: string }[] = [
  { id: "dashboard", icon: Warehouse, labelKey: "nav_dashboard" },
  { id: "stock", icon: Boxes, labelKey: "nav_stock" },
  { id: "huecos", icon: Grid3X3, labelKey: "nav_slots" },
  { id: "picking", icon: ScanBarcode, labelKey: "nav_picking" },
  { id: "palets", icon: Package, labelKey: "nav_pallets" },
  { id: "flota", icon: Forklift, labelKey: "nav_fleet" },
  { id: "recepcion", icon: Truck, labelKey: "nav_inbound" },
  { id: "expedicion", icon: Package, labelKey: "nav_outbound" },
  { id: "operarios", icon: Users, labelKey: "nav_operators" },
  { id: "costes", icon: Wallet, labelKey: "nav_costs" },
  { id: "facturas", icon: FileText, labelKey: "nav_invoices" },
  { id: "tesoreria", icon: Wallet, labelKey: "nav_treasury" },
  { id: "aprobaciones", icon: ShieldCheck, labelKey: "nav_approvals" },
  { id: "conocimiento", icon: BookOpen, labelKey: "nav_knowledge" },
  { id: "leads", icon: Gauge, labelKey: "nav_leads" },
  { id: "clientes", icon: Users, labelKey: "nav_clients" },
  { id: "reservas", icon: CalendarDays, labelKey: "nav_reservations" },
  { id: "equipo", icon: ContactRound, labelKey: "nav_team" },
  { id: "contenido", icon: Sparkles, labelKey: "nav_content" },
  { id: "automatizaciones", icon: Workflow, labelKey: "nav_automations" },
  { id: "propuesta", icon: ClipboardList, labelKey: "nav_pitch" },
  { id: "hub", icon: Database, labelKey: "nav_hub" },
  { id: "slides", icon: Presentation, labelKey: "nav_slides" },
  { id: "ajustes", icon: Settings, labelKey: "nav_settings" },
];

const ORIGIN_COLORS_LIGHT: Record<LeadOrigin, string> = {
  web_form: "#0f766e",
  instagram: "#0369a1",
  referral: "#0f172a",
  brevo_click: "#b45309",
  feria: "#047857",
  unknown: "#94a3b8",
};

const ORIGIN_COLORS_DARK: Record<LeadOrigin, string> = {
  web_form: "#2dd4bf",
  instagram: "#38bdf8",
  referral: "#e2e8f0",
  brevo_click: "#fbbf24",
  feria: "#34d399",
  unknown: "#64748b",
};

function euro(n: number, lang: Lang) {
  return new Intl.NumberFormat(lang === "en" ? "en-GB" : "es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function Kpi({
  label,
  value,
  hint,
  compact,
}: {
  label: string;
  value: string;
  hint?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.25rem] border border-[color-mix(in_oklab,var(--ink)_6%,transparent)] bg-[var(--glass-strong)] shadow-sm backdrop-blur-md",
        compact ? "px-2.5 py-2" : "p-4",
      )}
    >
      <p
        className={cn(
          "font-semibold uppercase tracking-wide text-[var(--ink-muted)]",
          compact ? "text-[9px] leading-tight" : "text-xs",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "font-[family-name:var(--mps-display)] text-[var(--ink)]",
          compact ? "mt-0.5 text-xl leading-none" : "mt-2 text-2xl md:text-3xl",
        )}
      >
        {value}
      </p>
      {hint && !compact && <p className="mt-1 text-xs text-[var(--ink-muted)]">{hint}</p>}
    </div>
  );
}

function VehicleBadge({ vehicle }: { vehicle: VehicleMode | null }) {
  if (!vehicle) return <Badge>——</Badge>;
  return (
    <Badge tone="brand">
      {vehicle === "moto" ? <Bike className="mr-1 h-3 w-3" /> : <Car className="mr-1 h-3 w-3" />}
      {vehicle === "moto" ? "Moto" : "4x4"}
    </Badge>
  );
}

function scoreTone(score: number): "good" | "warn" | "bad" | "neutral" {
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  if (score >= 40) return "neutral";
  return "bad";
}


function SettingsGroup({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <header className="border-b border-[color-mix(in_oklab,var(--ink)_8%,transparent)] pb-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
          {label}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-[var(--ink-muted)] text-pretty">{description}</p>
        ) : null}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

type SettingsTabId = "personal" | "ai" | "uso" | "integrations" | "org" | "resources";

function SettingsPanel({
  lang,
  onPrefsChange,
}: {
  lang: Lang;
  onPrefsChange?: (prefs: UserPrefs) => void;
}) {
  const { user, supabaseReady } = useAuth();
  const hub = useDataHub();
  const isMobile = useIsMobile();
  const [ai, setAi] = useState<AiSettings>(() => loadAiSettings());
  const [aiFlash, setAiFlash] = useState<string | null>(null);
  const [biz, setBiz] = useState<BusinessSettings>(() => loadBusinessSettings());
  const [bizFlash, setBizFlash] = useState<string | null>(null);
  const [security, setSecurity] = useState<SecuritySettings>(() => loadSecuritySettings());
  const [securityFlash, setSecurityFlash] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>("personal");

  function persistAi(next: AiSettings) {
    setAi(next);
    saveAiSettings(next);
    setTestResult(null);
    setAiFlash(
      lang === "es"
        ? next.enabled
          ? `IA guardada · proveedor ${AI_PROVIDER_LABEL[next.provider]}`
          : "IA desactivada · se usará heurística / retrieval local"
        : next.enabled
          ? `AI saved · provider ${AI_PROVIDER_LABEL[next.provider]}`
          : "AI off · local heuristics / retrieval will be used",
    );
  }

  function persistBiz(next: BusinessSettings) {
    setBiz(next);
    saveBusinessSettings(next);
    setBizFlash(
      lang === "es"
        ? "Datos del negocio guardados · WhatsApp saliente protegido"
        : "Business data saved · outbound WhatsApp protected",
    );
  }

  function persistSecurity(next: SecuritySettings) {
    setSecurity(next);
    saveSecuritySettings(next);
    setSecurityFlash(
      lang === "es"
        ? `Sesión: cierre tras ${next.idleTimeoutMinutes} min de inactividad`
        : `Session: sign out after ${next.idleTimeoutMinutes} min idle`,
    );
  }

  async function runConnectionTest() {
    setTesting(true);
    setTestResult(null);
    setAiFlash(null);
    saveAiSettings(ai);
    try {
      const res = await testAiConnection(ai);
      setTestResult({
        ok: true,
        message:
          lang === "es"
            ? `API OK · ${AI_PROVIDER_LABEL[res.provider]} · modelo ${res.model} · respuesta: «${res.reply}»`
            : `API OK · ${AI_PROVIDER_LABEL[res.provider]} · model ${res.model} · reply: “${res.reply}”`,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          lang === "es"
            ? `Fallo de conexión: ${err instanceof Error ? err.message : String(err)}`
            : `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setTesting(false);
    }
  }

  const providers = Object.keys(AI_PROVIDER_LABEL) as AiProvider[];
  const fieldCls =
    "mps-field mt-1 w-full rounded-lg px-2.5 py-2 text-sm font-normal normal-case text-[var(--ink)]";
  const labelCls = "block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]";
  const showBusiness = canEditBusinessSettings(user?.role);
  const showAi = canEditAiSettings(user?.role);
  const showDb = canViewDatabaseCard(user?.role);
  const showOrg = showBusiness || showDb;

  const tabs = useMemo(() => {
    const list: {
      id: SettingsTabId;
      label: string;
      icon: typeof SlidersHorizontal;
      badge: number;
    }[] = [
      {
        id: "personal",
        label: lang === "es" ? "Personalización" : "Personalization",
        icon: SlidersHorizontal,
        badge: 2,
      },
    ];
    if (showAi) {
      list.push({
        id: "ai",
        label: lang === "es" ? "IA" : "AI",
        icon: Bot,
        badge: 1,
      });
      list.push({
        id: "uso",
        label: lang === "es" ? "Uso" : "Usage",
        icon: Activity,
        badge: 1,
      });
    }
    list.push({
      id: "integrations",
      label: lang === "es" ? "Integraciones" : "Integrations",
      icon: Plug,
      badge: 1,
    });
    if (showOrg) {
      list.push({
        id: "org",
        label: lang === "es" ? "Organización" : "Organization",
        icon: Building2,
        badge: (showBusiness ? 1 : 0) + (showDb ? 1 : 0),
      });
    }
    list.push({
      id: "resources",
      label: lang === "es" ? "Recursos" : "Resources",
      icon: CircleHelp,
      badge: 2,
    });
    return list;
  }, [lang, showAi, showBusiness, showDb, showOrg]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === settingsTab)) {
      setSettingsTab(tabs[0]?.id ?? "personal");
    }
  }, [tabs, settingsTab]);

  const appearanceBlock = (
    <div className="space-y-3">
      {user && (
        <AppearanceCard lang={lang} userId={user.id} onPrefsChange={onPrefsChange} />
      )}
      <ViewModePicker lang={lang === "es" ? "es" : "en"} variant="inline" />
    </div>
  );

  const securityCard = (
    <Card
      title={lang === "es" ? "Seguridad · sesión" : "Security · session"}
      subtitle={
        lang === "es"
          ? "Cierre automático por inactividad. También aplica si cierras la pestaña y vuelves después del tiempo límite."
          : "Auto sign-out on idle. Also applies if you close the tab and return after the timeout."
      }
    >
      <div className="flex w-full flex-col gap-3">
        <label className={`${labelCls} w-full`}>
          {lang === "es" ? "Cerrar sesión tras inactividad" : "Sign out after idle"}
          <select
            className={fieldCls}
            value={security.idleTimeoutMinutes}
            onChange={(e) =>
              persistSecurity({
                idleTimeoutMinutes: Number(e.target.value) as IdleTimeoutMinutes,
              })
            }
          >
            {IDLE_TIMEOUT_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} {lang === "es" ? "minutos" : "minutes"}
              </option>
            ))}
          </select>
        </label>
        <p className="flex items-start gap-2 text-xs text-[var(--ink-muted)] text-pretty">
          <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
          <span>
            {lang === "es"
              ? `Por defecto 15 min. Actual: ${security.idleTimeoutMinutes} min. Cualquier clic o tecla reinicia el contador.`
              : `Default 15 min. Current: ${security.idleTimeoutMinutes} min. Any click or key resets the timer.`}
          </span>
        </p>
        {securityFlash && <p className="text-sm text-[var(--accent)]">{securityFlash}</p>}
      </div>
    </Card>
  );

  const businessCard = showBusiness ? (
    <Card
      title={lang === "es" ? "Datos del negocio" : "Business details"}
      subtitle={
        lang === "es"
          ? "WhatsApp y datos fiscales. El CRM solo abre chats si este WhatsApp está configurado."
          : "WhatsApp and tax data. The CRM only opens chats if this WhatsApp is configured."
      }
    >
      <div className="grid w-full gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          {lang === "es" ? "WhatsApp (9 dígitos)" : "WhatsApp (digits)"}
          <input
            className={fieldCls}
            value={biz.whatsapp}
            inputMode="tel"
            placeholder="628691478"
            onChange={(e) => setBiz({ ...biz, whatsapp: e.target.value })}
          />
        </label>
        <label className={labelCls}>
          {lang === "es" ? "@alias WhatsApp (próximamente)" : "WhatsApp @alias (soon)"}
          <input
            className={fieldCls}
            value={biz.whatsappAlias}
            placeholder="camponorte"
            onChange={(e) =>
              setBiz({ ...biz, whatsappAlias: e.target.value.replace(/^@+/, "") })
            }
          />
        </label>
        <label className={labelCls}>
          {lang === "es" ? "Razón social" : "Legal name"}
          <input
            className={fieldCls}
            value={biz.legalName}
            onChange={(e) => setBiz({ ...biz, legalName: e.target.value })}
          />
        </label>
        <label className={labelCls}>
          CIF
          <input
            className={fieldCls}
            value={biz.cif}
            onChange={(e) => setBiz({ ...biz, cif: e.target.value })}
          />
        </label>
        <label className={labelCls}>
          {lang === "es" ? "Email de contacto" : "Contact email"}
          <input
            type="email"
            className={fieldCls}
            value={biz.contactEmail}
            onChange={(e) => setBiz({ ...biz, contactEmail: e.target.value })}
          />
        </label>
        <label className={labelCls}>
          {lang === "es" ? "Dirección fiscal" : "Tax address"}
          <input
            className={fieldCls}
            value={biz.fiscalAddress}
            onChange={(e) => setBiz({ ...biz, fiscalAddress: e.target.value })}
          />
        </label>
      </div>
      <p className="mt-3 text-xs text-[var(--ink-muted)] text-pretty">
        {lang === "es"
          ? "Al pulsar WhatsApp en un cliente confirmarás que el PC usa este número."
          : "When tapping WhatsApp on a client you confirm this PC uses that number."}
      </p>
      <div className="mt-4 flex w-full flex-col items-stretch gap-2">
        <button
          type="button"
          onClick={() => persistBiz(biz)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-center text-sm font-semibold leading-none text-white"
        >
          <Save className="h-4 w-4 shrink-0" aria-hidden />
          <span className="whitespace-nowrap">
            {lang === "es" ? "Guardar negocio" : "Save business"}
          </span>
        </button>
        {bizFlash && (
          <p className="text-center text-sm text-[var(--accent)]">{bizFlash}</p>
        )}
      </div>
    </Card>
  ) : null;

  const aiCard = showAi ? (
    <Card
      title={lang === "es" ? "IA · proveedores API" : "AI · API providers"}
      subtitle={
        lang === "es"
          ? "Ollama · OpenAI · Claude · Gemini. La IA solo clasifica; nunca habla con el viajero."
          : "Ollama · OpenAI · Claude · Gemini. AI only ranks; never messages the traveller."
      }
    >
      <div className="w-full space-y-4">
        <div className="rounded-xl border border-[var(--field-border)] bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] p-3 text-sm text-[var(--ink)] text-pretty">
          <p className="font-semibold">
            {lang === "es" ? "Regla de oro" : "Golden rule"}: {GOLDEN_RULE}
          </p>
          <p className="mt-1 text-[var(--ink-muted)]">
            {lang === "es" ? "Configuración:" : "Config:"}{" "}
            <strong className="text-[var(--ink)]">
              {aiReady(ai)
                ? lang === "es"
                  ? `lista · ${providerLabel(ai)} (falta probar API)`
                  : `ready · ${providerLabel(ai)} (API not tested yet)`
                : lang === "es"
                  ? "heurística local (sin API)"
                  : "local heuristics (no API)"}
            </strong>
          </p>
          {testResult && (
            <p
              className={cn(
                "mt-2 text-sm font-semibold",
                testResult.ok ? "text-[var(--ok)]" : "text-[var(--danger)]",
              )}
            >
              {testResult.ok
                ? lang === "es"
                  ? "Conexión API verificada"
                  : "API connection verified"
                : lang === "es"
                  ? "Conexión API fallida"
                  : "API connection failed"}
              : {testResult.message}
            </p>
          )}
        </div>

        <label className="flex gap-3 text-sm font-semibold text-[var(--ink)]">
          <input
            type="checkbox"
            checked={ai.enabled}
            onChange={(e) => persistAi({ ...ai, enabled: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          {lang === "es"
            ? "Activar IA para scoring / intelligence / knowledge"
            : "Enable AI for scoring / intelligence / knowledge"}
        </label>

        <div className="flex flex-wrap gap-2">
          {providers.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => persistAi({ ...ai, provider: p })}
              className={cn(
                "mps-choice rounded-full px-3 py-1.5 text-xs font-semibold transition",
                ai.provider === p && "is-active",
              )}
            >
              {AI_PROVIDER_LABEL[p]}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelCls}>
            {lang === "es" ? "Proveedor activo" : "Active provider"}
            <select
              className={fieldCls}
              value={ai.provider}
              onChange={(e) =>
                persistAi({ ...ai, provider: e.target.value as AiProvider })
              }
            >
              {providers.map((p) => (
                <option key={p} value={p}>
                  {AI_PROVIDER_LABEL[p]}
                </option>
              ))}
            </select>
          </label>

          <label className={labelCls}>
            {lang === "es" ? "Modelo" : "Model"}
            <input
              className={fieldCls}
              value={ai.models[ai.provider]}
              onChange={(e) =>
                setAi({
                  ...ai,
                  models: { ...ai.models, [ai.provider]: e.target.value },
                })
              }
              placeholder={
                ai.provider === "openai"
                  ? "gpt-4o-mini"
                  : ai.provider === "claude"
                    ? "claude-sonnet-4-20250514"
                    : ai.provider === "gemini"
                      ? "gemini-2.0-flash"
                      : "llama3.2"
              }
            />
          </label>

          {allowClientAiKeys() &&
            (ai.provider !== "ollama" || ai.ollamaMode === "cloud") && (
              <label className={`${labelCls} sm:col-span-2`}>
                API Key · {AI_PROVIDER_LABEL[ai.provider]}
                <span className="ml-2 font-normal normal-case text-[var(--warn-ink)]">
                  {lang === "es" ? "(solo demo local)" : "(local demo only)"}
                </span>
                <input
                  type="password"
                  autoComplete="off"
                  className={fieldCls}
                  value={ai.apiKeys[ai.provider]}
                  onChange={(e) =>
                    setAi({
                      ...ai,
                      apiKeys: { ...ai.apiKeys, [ai.provider]: e.target.value },
                    })
                  }
                  placeholder={
                    ai.provider === "openai"
                      ? "sk-…"
                      : ai.provider === "claude"
                        ? "sk-ant-…"
                        : ai.provider === "gemini"
                          ? "AIza…"
                          : "ollama_sk_…"
                  }
                />
              </label>
            )}

          {!allowClientAiKeys() &&
            (ai.provider !== "ollama" || ai.ollamaMode === "cloud") && (
              <p className="mps-settings-tile rounded-lg px-3 py-2 text-sm sm:col-span-2 text-pretty">
                {lang === "es"
                  ? "Producción: las API keys viven en variables de entorno de Vercel. No se pegan en el navegador."
                  : "Production: API keys live in Vercel env vars. They are not pasted in the browser."}
              </p>
            )}

          {ai.provider === "ollama" && (
            <>
              <label className={labelCls}>
                {lang === "es" ? "Modo Ollama" : "Ollama mode"}
                <select
                  className={fieldCls}
                  value={ai.ollamaMode}
                  onChange={(e) => {
                    const ollamaMode = e.target.value as AiSettings["ollamaMode"];
                    persistAi({
                      ...ai,
                      ollamaMode,
                      ollamaBaseUrl:
                        ollamaMode === "local"
                          ? "http://localhost:11434"
                          : "https://ollama.com",
                    });
                  }}
                >
                  <option value="cloud">Cloud · ollama.com</option>
                  <option value="local">Local · localhost:11434</option>
                </select>
              </label>
              <label className={labelCls}>
                Base URL
                <input
                  className={fieldCls}
                  value={ai.ollamaBaseUrl}
                  onChange={(e) => setAi({ ...ai, ollamaBaseUrl: e.target.value })}
                />
              </label>
            </>
          )}

          <label className={labelCls}>
            {lang === "es" ? "Máx. tokens de salida" : "Max output tokens"}
            <input
              type="number"
              min={128}
              max={4000}
              step={50}
              className={fieldCls}
              value={ai.maxOutputTokens}
              onChange={(e) =>
                setAi({
                  ...ai,
                  maxOutputTokens: Math.min(4000, Math.max(128, Number(e.target.value) || 600)),
                })
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)] sm:col-span-2">
            <input
              type="checkbox"
              checked={ai.conciseMode}
              onChange={(e) => setAi({ ...ai, conciseMode: e.target.checked })}
            />
            {lang === "es"
              ? "Respuestas cortas (tablas + lectura rápida) · ahorra API"
              : "Concise replies (tables + quick read) · saves API"}
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => persistAi(ai)}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
          >
            <Bot className="h-4 w-4" />
            {lang === "es" ? "Guardar IA" : "Save AI"}
          </button>
          <button
            type="button"
            disabled={testing || !ai.enabled}
            onClick={() => void runConnectionTest()}
            className="mps-choice inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 text-[var(--accent)]" />
            )}
            {lang === "es" ? "Probar conexión API" : "Test API connection"}
          </button>
          <a
            href={AI_PROVIDER_DOCS[ai.provider]}
            target="_blank"
            rel="noreferrer"
            className="mps-choice inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--ink)]"
          >
            {lang === "es" ? "Crear API key" : "Create API key"}
          </a>
        </div>
        {aiFlash && <p className="text-sm text-[var(--accent)]">{aiFlash}</p>}
        <p className="text-xs text-[var(--ink-muted)] text-pretty">
          {lang === "es"
            ? "«Configuración lista» ≠ API verificada. Pulsa «Probar conexión API» para llamar de verdad al proveedor. El tope de tokens limita cada respuesta. El consumo detallado está en la pestaña Uso."
            : "“Config ready” ≠ verified API. Hit “Test API connection” for a live call. Token cap limits each reply. Detailed usage lives in the Usage tab."}
        </p>
      </div>
    </Card>
  ) : null;

  const usageCard = (
    <Card
      title={lang === "es" ? "Uso del asistente" : "Assistant usage"}
      subtitle={
        lang === "es"
          ? "Estimación local de tokens · no es la factura del proveedor"
          : "Local token estimate · not the provider invoice"
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(() => {
          const u = loadAiUsage();
          const cells = [
            [lang === "es" ? "Mensajes" : "Messages", String(u.messages)],
            [lang === "es" ? "Conversaciones" : "Chats", String(u.conversations)],
            ["Tokens in", formatTokenK(u.inputTokens)],
            ["Tokens out", formatTokenK(u.outputTokens)],
          ] as const;
          return cells.map(([label, value]) => (
            <div key={label} className="mps-settings-tile rounded-lg px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                {label}
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--ink)]">{value}</p>
            </div>
          ));
        })()}
      </div>
      <p className="mt-3 text-xs text-[var(--ink-muted)] text-pretty">
        {lang === "es"
          ? "Tope actual de salida: "
          : "Current output cap: "}
        <strong className="text-[var(--ink)]">{ai.maxOutputTokens}</strong>
        {lang === "es"
          ? " tokens · modo conciso "
          : " tokens · concise mode "}
        <strong className="text-[var(--ink)]">{ai.conciseMode ? "ON" : "OFF"}</strong>
      </p>
    </Card>
  );

  const integrationsCard = <IntegrationsPanel lang={lang} />;

  const databaseCard = showDb ? (
    <Card
      title={lang === "es" ? "Base de datos" : "Database"}
      subtitle={
        lang === "es"
          ? "Supabase / Postgres · base de datos"
          : "Supabase / Postgres · Data Hub"
      }
    >
      <ul className="grid w-full gap-3 text-sm text-[var(--ink-muted)]">
        <li className="mps-settings-tile rounded-xl p-3">
          Modo Hub: <strong className="text-[var(--ink)]">{hub.mode}</strong>
        </li>
        <li className="mps-settings-tile rounded-xl p-3">
          Credenciales Supabase:{" "}
          <strong className="text-[var(--ink)]">
            {supabaseReady || supabaseConfigured()
              ? "detectadas"
              : "pendientes (.env.local)"}
          </strong>
        </li>
        <li className="mps-settings-tile rounded-xl p-3">
          Schema: <code className="text-[var(--accent)]">supabase/schema.sql</code>
        </li>
      </ul>
    </Card>
  ) : null;

  const legalCard = (
    <Card
      title={lang === "es" ? "Legal y privacidad" : "Legal & privacy"}
      subtitle={
        lang === "es"
          ? "Aviso legal · Privacidad · Cookies (RGPD / LOPDGDD)"
          : "Legal notice · Privacy · Cookies (GDPR)"
      }
    >
      <div className="flex w-full flex-col gap-4">
        <p className="text-sm text-[var(--ink-muted)] text-pretty">
          {lang === "es"
            ? "Para la demo interna basta la mención RGPD de la presentación. Antes de producción real: validar textos, firmar DPA con Vercel/Supabase y mantener el registro de actividades (art. 30)."
            : "For the internal demo, the pitch-deck GDPR note is enough. Before real production: validate copy, sign DPAs with Vercel/Supabase and keep the Art. 30 processing record."}
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/legal#aviso"
            className="mps-choice rounded-lg px-3 py-2 text-sm font-semibold text-[var(--ink)]"
          >
            {lang === "es" ? "Aviso legal" : "Legal notice"}
          </a>
          <a
            href="/legal#privacidad"
            className="mps-choice rounded-lg px-3 py-2 text-sm font-semibold text-[var(--ink)]"
          >
            {lang === "es" ? "Privacidad" : "Privacy"}
          </a>
          <a
            href="/legal#cookies"
            className="mps-choice rounded-lg px-3 py-2 text-sm font-semibold text-[var(--ink)]"
          >
            Cookies
          </a>
        </div>
      </div>
    </Card>
  );

  const mobileLayout = (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-x-8 lg:gap-y-10">
      <SettingsGroup
        label={lang === "es" ? "Personalización" : "Personalization"}
        description={
          lang === "es"
            ? "Cómo se ve el Growth OS en tu sesión."
            : "How Growth OS looks in your session."
        }
      >
        {appearanceBlock}
      </SettingsGroup>

      <SettingsGroup
        label={lang === "es" ? "Seguridad" : "Security"}
        description={
          lang === "es"
            ? "Control de sesión e inactividad."
            : "Session and idle controls."
        }
      >
        {securityCard}
      </SettingsGroup>

      {showBusiness && (
        <SettingsGroup
          label={lang === "es" ? "Organización" : "Organization"}
          description={
            lang === "es"
              ? "Datos del negocio y canal WhatsApp saliente."
              : "Business details and outbound WhatsApp channel."
          }
        >
          {businessCard}
        </SettingsGroup>
      )}

      {showAi && (
        <SettingsGroup
          label={lang === "es" ? "IA" : "AI"}
          description={
            lang === "es"
              ? "Proveedores de IA. Clasifican; nunca escriben al viajero."
              : "AI providers. They rank; never message travellers."
          }
        >
          {aiCard}
          {usageCard}
        </SettingsGroup>
      )}

      <SettingsGroup
        label={lang === "es" ? "Integraciones" : "Integrations"}
        description={
          lang === "es"
            ? "Stripe, Brevo, Supabase, WhatsApp, n8n y más del ecosistema."
            : "Stripe, Brevo, Supabase, WhatsApp, n8n and more of the stack."
        }
      >
        {integrationsCard}
      </SettingsGroup>

      {showDb && (
        <SettingsGroup
          label={lang === "es" ? "Sistema" : "System"}
          description={
            lang === "es"
              ? "Infraestructura de datos del Hub."
              : "Data Hub infrastructure."
          }
        >
          {databaseCard}
        </SettingsGroup>
      )}

      <SettingsGroup
        label={lang === "es" ? "Recursos" : "Resources"}
        description={
          lang === "es"
            ? "Legal, privacidad y soporte interno."
            : "Legal, privacy and internal support."
        }
      >
        {legalCard}
        <SupportCard lang={lang} />
      </SettingsGroup>
    </div>
  );

  const desktopTabPanel =
    settingsTab === "personal" ? (
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {appearanceBlock}
        {securityCard}
      </div>
    ) : settingsTab === "ai" ? (
      aiCard
    ) : settingsTab === "uso" ? (
      usageCard
    ) : settingsTab === "integrations" ? (
      integrationsCard
    ) : settingsTab === "org" ? (
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {businessCard}
        {databaseCard}
      </div>
    ) : (
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {legalCard}
        <SupportCard lang={lang} />
      </div>
    );

  const desktopLayout = (
    <div className="space-y-0">
      <div
        role="tablist"
        aria-label={lang === "es" ? "Secciones de ajustes" : "Settings sections"}
        className="flex flex-wrap gap-1.5 rounded-t-[1.75rem] bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] p-1.5"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = settingsTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSettingsTab(tab.id)}
              className={cn(
                "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition sm:justify-start sm:px-4",
                active
                  ? "bg-[var(--glass-strong)] text-[var(--ink)] shadow-[0_6px_18px_color-mix(in_oklab,var(--ink)_10%,transparent)]"
                  : "text-[var(--ink-muted)] hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] hover:text-[var(--ink)]",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  active
                    ? "bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-[var(--accent)]"
                    : "bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="truncate">{tab.label}</span>
              <span
                className={cn(
                  "ml-auto hidden h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold sm:inline-flex",
                  active
                    ? "bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] text-[var(--accent)]"
                    : "bg-[color-mix(in_oklab,var(--ink)_10%,transparent)] text-[var(--ink-muted)]",
                )}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        className="rounded-b-[1.75rem] rounded-tr-[1.75rem] border border-[var(--glass-border)] bg-[var(--glass-strong)] p-4 shadow-[0_10px_28px_color-mix(in_oklab,var(--ink)_8%,transparent)] md:p-6"
      >
        {desktopTabPanel}
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      {/* En móvil el shell ya muestra «Ajustes»: no repetir el H2. */}
      <header className={cn("space-y-1", isMobile && "space-y-0")}>
        {!isMobile && (
          <h2 className="font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)] md:text-3xl">
            {lang === "es" ? "Ajustes" : "Settings"}
          </h2>
        )}
        <p className="max-w-3xl text-sm text-[var(--ink-muted)] text-pretty">
          {lang === "es"
            ? "Preferencias personales, seguridad, negocio e integraciones. La cuenta y los usuarios del equipo viven en Usuarios y roles."
            : "Personal preferences, security, business and integrations. Account and team users live under Users & roles."}
        </p>
      </header>

      {isMobile ? mobileLayout : desktopLayout}
    </div>
  );
}

function HubPanel({ lang }: { lang: Lang }) {
  const hub = useDataHub();
  const isMobile = useIsMobile();
  const { mode } = useLeadPriorityMode();
  const { sorted } = computeLeadStats(hub.leads, new Date(), {
    mode,
    clients: hub.clients,
    lang,
  });
  const leadsFileRef = useRef<HTMLInputElement>(null);
  const clientsFileRef = useRef<HTMLInputElement>(null);
  const snapshotFileRef = useRef<HTMLInputElement>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const fields =
    lang === "es"
      ? [
          "ID",
          "Nombre",
          "NIF/DNI",
          "Origen",
          "Campaña",
          "Destino",
          "Moto/4x4",
          "Estado",
          "Score",
          "Pago (Stripe/SEPA…)",
          "Reserva / logística",
          "Factura REAV 05",
          "Responsable",
        ]
      : [
          "ID",
          "Name",
          "Tax ID",
          "Origin",
          "Campaign",
          "Destination",
          "Moto/4x4",
          "Status",
          "Score",
          "Payment (Stripe/SEPA…)",
          "Booking / logistics",
          "REAV 05 invoice",
          "Owner",
        ];

  async function onCsvFile(
    file: File | undefined,
    kind: "leads" | "clients",
  ) {
    if (!file) return;
    const text = await file.text();
    const result =
      kind === "leads" ? await hub.importLeadsCsv(text) : await hub.importClientsCsv(text);
    const msg =
      lang === "es"
        ? `Importados ${result.added} · actualizados ${result.updated}${result.errors.length ? ` · ${result.errors.length} avisos` : ""}`
        : `Added ${result.added} · updated ${result.updated}${result.errors.length ? ` · ${result.errors.length} warnings` : ""}`;
    setFlash(msg);
  }

  return (
    <div className="space-y-5">
      <Card
        title={isMobile ? undefined : t(lang, "hub_title")}
        subtitle={t(lang, "hub_sub")}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone={hub.mode === "supabase" ? "good" : "brand"}>
            {hub.mode === "supabase" ? (
              <span className="inline-flex items-center gap-1">
                <Cloud className="h-3 w-3" /> Postgres / Supabase
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <HardDrive className="h-3 w-3" /> Local · persistente
              </span>
            )}
          </Badge>
          {hub.meta?.seededFromDemo ? (
            <Badge tone="warn">
              {lang === "es" ? "Semilla demo (editable)" : "Demo seed (editable)"}
            </Badge>
          ) : (
            <Badge tone="good">
              {lang === "es" ? "Datos operativos" : "Operational data"}
            </Badge>
          )}
          <Badge>
            {hub.leads.length} leads · {hub.clients.length}{" "}
            {lang === "es" ? "clientes" : "clients"} · {hub.reservations.length}{" "}
            {lang === "es" ? "reservas" : "bookings"}
          </Badge>
          {hub.meta?.updatedAt && (
            <Badge tone="neutral">
              Sync {new Date(hub.meta.updatedAt).toLocaleString(lang === "en" ? "en-GB" : "es-ES")}
            </Badge>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {fields.map((f) => (
            <Badge key={f} tone="brand">
              {f}
            </Badge>
          ))}
        </div>

        <p className="text-sm text-[var(--ink-muted)]">
          {lang === "es"
            ? "Fase 1 activa: CRM conectado a la base de datos. Los cambios en leads, clientes, reservas y facturas se guardan. Importa Excel/CSV o conecta Supabase (Postgres) con .env.local."
            : "Phase 1 live: CRM wired to the Data Hub. Lead, client, booking and invoice edits persist. Import Excel/CSV or connect Supabase (Postgres) via .env.local."}
        </p>

        {hub.error && (
          <div className="mt-3 rounded-xl border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] px-3 py-2 text-sm text-[var(--danger)]">
            {hub.error}
            <button type="button" className="ml-2 underline" onClick={hub.clearError}>
              OK
            </button>
          </div>
        )}
        {flash && (
          <div className="mt-3 rounded-xl border border-[color-mix(in_oklab,var(--ok)_35%,transparent)] bg-[color-mix(in_oklab,var(--ok)_10%,transparent)] px-3 py-2 text-sm text-[var(--ok)]">
            {flash}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => leadsFileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
          >
            <Upload className="h-4 w-4" />
            {lang === "es" ? "Importar leads CSV" : "Import leads CSV"}
          </button>
          <button
            type="button"
            onClick={() => clientsFileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-strong)] px-3 py-2 text-sm font-semibold text-[var(--ink)]"
          >
            <Upload className="h-4 w-4" />
            {lang === "es" ? "Importar clientes CSV" : "Import clients CSV"}
          </button>
          <button
            type="button"
            onClick={() =>
              downloadTextFile(
                `camponorte-leads-${new Date().toISOString().slice(0, 10)}.csv`,
                hub.getLeadsCsv(),
                "text/csv;charset=utf-8",
              )
            }
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm font-semibold text-[var(--ink)]"
          >
            <Download className="h-4 w-4" />
            CSV leads
          </button>
          <button
            type="button"
            onClick={() =>
              downloadTextFile(
                `camponorte-clients-${new Date().toISOString().slice(0, 10)}.csv`,
                hub.getClientsCsv(),
                "text/csv;charset=utf-8",
              )
            }
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm font-semibold text-[var(--ink)]"
          >
            <Download className="h-4 w-4" />
            CSV clientes
          </button>
          <button
            type="button"
            onClick={() =>
              downloadTextFile(
                `camponorte-hub-backup-${new Date().toISOString().slice(0, 10)}.json`,
                JSON.stringify(hub.exportSnapshot(), null, 2),
                "application/json",
              )
            }
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm font-semibold text-[var(--ink)]"
          >
            <Download className="h-4 w-4" />
            Backup JSON
          </button>
          <button
            type="button"
            onClick={() => snapshotFileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm font-semibold text-[var(--ink)]"
          >
            <Upload className="h-4 w-4" />
            Restaurar JSON
          </button>
          <button
            type="button"
            onClick={() => void hub.refresh()}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm font-semibold text-[var(--ink)]"
          >
            <RefreshCw className="h-4 w-4" />
            {lang === "es" ? "Recargar" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => {
              const ok = window.confirm(
                lang === "es"
                  ? "¿Restablecer a la semilla demo? Se perderán los datos operativos de este Hub."
                  : "Reset to demo seed? Operational Hub data will be lost.",
              );
              if (ok) void hub.resetToSeed();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] px-3 py-2 text-sm font-semibold text-[var(--danger)]"
          >
            {lang === "es" ? "Reset semilla" : "Reset seed"}
          </button>
        </div>

        <input
          ref={leadsFileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            void onCsvFile(e.target.files?.[0], "leads");
            e.target.value = "";
          }}
        />
        <input
          ref={clientsFileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            void onCsvFile(e.target.files?.[0], "clients");
            e.target.value = "";
          }}
        />
        <input
          ref={snapshotFileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void file.text().then(async (text) => {
              await hub.importSnapshotJson(text);
              setFlash(lang === "es" ? "Snapshot restaurado" : "Snapshot restored");
            });
            e.target.value = "";
          }}
        />

        <div className="mt-4 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-3 text-sm text-[var(--ink-muted)]">
          <p className="font-semibold text-[var(--ink)]">
            {lang === "es" ? "Conectar Postgres (Supabase)" : "Connect Postgres (Supabase)"}
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>
              {lang === "es" ? "Ejecuta" : "Run"} <code className="text-[var(--accent)]">supabase/schema.sql</code>
            </li>
            <li>
              {lang === "es" ? "Copia" : "Copy"} <code className="text-[var(--accent)]">.env.example</code> →{" "}
              <code className="text-[var(--accent)]">.env.local</code>
            </li>
            <li>
              VITE_DATA_MODE=supabase · VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY
              {supabaseConfigured()
                ? lang === "es"
                  ? " (credenciales detectadas)"
                  : " (credentials detected)"
                : lang === "es"
                  ? " (aún no configurado)"
                  : " (not configured yet)"}
            </li>
            <li>
              {lang === "es"
                ? "Plantillas CSV en /templates/leads-import.csv y clients-import.csv"
                : "CSV templates at /templates/leads-import.csv and clients-import.csv"}
            </li>
          </ol>
        </div>
      </Card>

      <Card
        title={lang === "es" ? "Fichas del Hub · Quick Win" : "Hub records · Quick Win"}
        subtitle={
          lang === "es"
            ? "Los 12 campos mínimos en una memoria viva — misma fuente que Inteligencia de leads y Reservas"
            : "The 12 minimum fields in one live memory — same source as Lead Intelligence and Bookings"
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm text-[var(--ink)]">
            <thead className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
              <tr>
                <th className="py-2">ID</th>
                <th>{lang === "es" ? "Nombre" : "Name"}</th>
                <th>{lang === "es" ? "Origen" : "Origin"}</th>
                <th>{lang === "es" ? "Campaña" : "Campaign"}</th>
                <th>{lang === "es" ? "Destino" : "Destination"}</th>
                <th>{t(lang, "vehicle")}</th>
                <th>{lang === "es" ? "Estado" : "Status"}</th>
                <th>Score</th>
                <th>Owner</th>
                <th>{lang === "es" ? "Último toque" : "Last touch"}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((l) => (
                <tr key={l.id} className="border-t border-[var(--glass-border)]">
                  <td className="py-2.5 font-mono text-xs">{l.id}</td>
                  <td className="font-medium">{l.name}</td>
                  <td>{ORIGIN_LABEL[l.origin]}</td>
                  <td className="text-[var(--ink-muted)]">{l.campaign ?? "—"}</td>
                  <td>{l.interestRoute ? ROUTE_LABEL[l.interestRoute] : "—"}</td>
                  <td>
                    <VehicleBadge vehicle={l.vehicle} />
                  </td>
                  <td>
                    <Badge tone={l.status === "cualificado" || l.status === "reservado" ? "good" : "neutral"}>
                      {l.status}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={scoreTone(l.score)}>{l.score}</Badge>
                  </td>
                  <td>{l.owner}</td>
                  <td className="text-xs text-[var(--ink-muted)]">{l.lastTouchAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card
          title={lang === "es" ? "Cobertura de origen" : "Origin coverage"}
          subtitle={lang === "es" ? "Meta 6 meses: 95 % de leads con origen" : "6-month target: 95% of leads with origin"}
        >
          {(() => {
            const known = hub.leads.filter((l) => l.origin !== "unknown").length;
            const pct = hub.leads.length ? Math.round((known / hub.leads.length) * 100) : 0;
            return (
              <>
                <p className="font-[family-name:var(--mps-display)] text-4xl text-[var(--ink)]">
                  {pct}%
                </p>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  {known}/{hub.leads.length}{" "}
                  {lang === "es" ? "leads con origen conocido · meta 95 %" : "leads with known origin · 95% target"}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--glass)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-[var(--ink-muted)]">
                  {lang === "es"
                    ? "Sin origen = cuello de botella #1. Cada import CSV / UTM web cierra el gap hacia el 95 %."
                    : "Unknown origin = bottleneck #1. Every CSV import / web UTM closes the gap toward 95%."}
                </p>
              </>
            );
          })()}
        </Card>

        <Card
          title={lang === "es" ? "Cola operativa hoy" : "Ops queue today"}
          subtitle={lang === "es" ? "Qué debe tocar el equipo" : "What the team should touch"}
        >
          <ul className="space-y-2 text-sm text-[var(--ink)]">
            <li className="flex justify-between gap-2 border-b border-[var(--glass-border)] pb-2">
              <span className="text-[var(--ink-muted)]">
                {lang === "es" ? "Leads sin origen" : "Leads w/o origin"}
              </span>
              <Badge tone="warn">
                {hub.leads.filter((l) => l.origin === "unknown").length}
              </Badge>
            </li>
            <li className="flex justify-between gap-2 border-b border-[var(--glass-border)] pb-2">
              <span className="text-[var(--ink-muted)]">
                {lang === "es" ? "Score ≥ 80 (llamar hoy)" : "Score ≥ 80 (call today)"}
              </span>
              <Badge tone="good">{hub.leads.filter((l) => l.score >= 80).length}</Badge>
            </li>
            <li className="flex justify-between gap-2 border-b border-[var(--glass-border)] pb-2">
              <span className="text-[var(--ink-muted)]">
                {lang === "es" ? "Reservas en prep" : "Bookings in prep"}
              </span>
              <Badge>
                {hub.reservations.filter((r) => r.status === "prep_viaje" || r.status === "docs_pendientes").length}
              </Badge>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-[var(--ink-muted)]">
                {lang === "es" ? "Clientes dormidos / VIP" : "Dormant / VIP clients"}
              </span>
              <Badge tone="brand">
                {hub.clients.filter((c) => c.segment === "dormido" || c.segment === "vip").length}
              </Badge>
            </li>
          </ul>
        </Card>

        <Card
          title={lang === "es" ? "Encadenado Growth OS" : "Growth OS chain"}
          subtitle={lang === "es" ? "De captura a seguimiento humano" : "From capture to human follow-up"}
        >
          <ol className="space-y-2 text-sm text-[var(--ink)]">
            {(lang === "es"
              ? [
                  "Web / newsletter / Excel → base de datos",
                  "Puntuación clara → Inteligencia de leads",
                  "Reserva + logística → operaciones",
                  "Factura REAV 05 → gestoría",
                  "Aviso interno → Sofía / Marta llaman",
                ]
              : [
                  "Web / Brevo / Excel → Data Hub",
                  "Explainable score → Lead Intelligence",
                  "Booking + logistics → ops",
                  "REAV 05 invoice → tax advisor",
                  "Internal ping → Sofía / Marta call",
                ]
            ).map((step, i) => (
              <li key={step} className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs font-semibold text-[var(--accent)]">
            {lang === "es"
              ? "Nada escribe al viajero. La confianza la cierran personas."
              : "Nothing messages the traveler. People close the trust loop."}
          </p>
        </Card>
      </div>
    </div>
  );
}

/**
 * Tesorería — movimientos derivados de facturas y reservas.
 * La lógica vive en `@/lib/treasury`; aquí solo se conecta con el hub.
 */
function TreasurySection({ lang }: { lang: Lang }) {
  const hub = useDataHub();
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          {t(lang, "nav_treasury")}
        </h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {lang === "es"
            ? "Cobrado, pendiente y comprometido. Sin banco conectado: todo se deriva de facturas y reservas."
            : "Collected, receivable and committed. No bank connected: everything is derived from invoices and bookings."}
        </p>
      </header>
      <TreasuryPanel
        invoices={hub.invoices}
        reservations={hub.reservations}
        lang={lang}
        onAsk={(topic) => requestAsk(askAboutTopic(topic))}
        onOpen={(m) => {
          const target = m.category.includes("factura") || m.concept.includes("factura")
            ? "facturas"
            : "reservas";
          window.dispatchEvent(new CustomEvent("mps-navigate", { detail: target }));
        }}
      />
      <UpcomingCashPanel
        invoices={hub.invoices}
        reservations={hub.reservations}
        lang={lang}
        onOpen={(row) => {
          const target =
            row.source === "factura" ? "facturas" : row.source === "reserva" ? "reservas" : "equipo";
          window.dispatchEvent(new CustomEvent("mps-navigate", { detail: target }));
        }}
      />
      <PnLPanel invoices={hub.invoices} reservations={hub.reservations} lang={lang} />
      <FiscalCalendarPanel invoices={hub.invoices} lang={lang} />
    </div>
  );
}

/**
 * Aprobaciones — la regla de oro hecha interfaz.
 * La IA propone en segundo plano; nada sale sin OK de una persona.
 */
function ApprovalsSection({ lang }: { lang: Lang }) {
  const { user } = useAuth();
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          {t(lang, "nav_approvals")}
        </h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {lang === "es"
            ? "La IA redacta en segundo plano. Publicar o enviar sigue siendo decisión de una persona."
            : "The assistant drafts in the background. Publishing or sending stays a human decision."}
        </p>
      </header>
      <ApprovalsPanel
        drafts={CONTENT_DRAFTS}
        currentUser={user?.email ?? "equipo"}
        lang={lang}
      />
    </div>
  );
}

function TeamSection({ lang }: { lang: Lang }) {
  const hub = useDataHub();
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          {t(lang, "nav_team")}
        </h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {lang === "es"
            ? "Conexiones guía/ops ↔ expedición ↔ coste estimado. Sin nóminas inventadas."
            : "Guide/ops ↔ trip ↔ estimated cost links. No invented payroll."}
        </p>
      </header>
      <TeamOpsPanel
        reservations={hub.reservations}
        lang={lang}
        onOpenReservation={() =>
          window.dispatchEvent(new CustomEvent("mps-navigate", { detail: "reservas" }))
        }
      />
    </div>
  );
}

export function DashboardPanel({ lang, theme }: { lang: Lang; theme: Theme }) {
  const hub = useDataHub();
  const isMobile = useIsMobile();
  const { leads } = hub;
  const margins = routeMargins();
  const origins = computeOriginFromLeads(leads);
  const progress = progressToMillion();
  const dark = theme === "dark";
  const colors = dark ? ORIGIN_COLORS_DARK : ORIGIN_COLORS_LIGHT;
  const chart = "var(--chart-area)";
  const chart2 = "var(--chart-area-2)";
  const grid = "var(--chart-grid)";
  const tick = "var(--chart-tick)";
  const chartTooltip = {
    contentStyle: {
      background: "var(--chart-tooltip-bg)",
      border: "1px solid var(--chart-tooltip-border)",
      borderRadius: 12,
      color: "var(--text-primary)",
      padding: "10px 12px",
    },
    labelStyle: {
      color: "var(--text-primary)",
      fontWeight: 700,
      marginBottom: 6,
    },
    itemStyle: {
      color: "var(--text-secondary)",
      fontSize: 12,
    },
    cursor: {
      fill: "var(--chart-cursor)",
    },
  } as const;
  const team = buildTeamOps(hub.reservations);
  const treasury = buildTreasury({
    invoices: hub.invoices,
    reservations: hub.reservations,
    teamCostByMonth: team.costByDepartureMonth,
    teamPayable: team.pendingCost,
  });
  const cashChart = treasury.cashFlow.map((p) => ({
    label: p.label,
    entradas: p.cobrado,
    salidas: p.salidas,
    prevision: p.pendiente,
  }));
  const chartRevenue = MONTHLY_KPIS.map((m) => ({
    month: m.month,
    revenue: m.revenue,
    attributedPct: m.attributedPct,
  }));

  return (
    <div className={cn("space-y-5", isMobile && "space-y-3")}>
      <div className={cn("glass-panel rounded-2xl p-6", isMobile && "p-3.5")}>
        {/* Shell móvil ya muestra «Cuadro de mando»: no repetir el eyebrow. */}
        {!isMobile && (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            {t(lang, "nav_dashboard")}
          </p>
        )}
        <h2
          className={cn(
            "font-[family-name:var(--mps-display)] text-[var(--ink)]",
            isMobile ? "text-xl leading-tight" : "mt-2 text-3xl md:text-4xl",
          )}
        >
          {t(lang, "dash_title", {
            from: euro(MPS_ANNEX.revenueCurrent, lang),
            to: euro(MPS_ANNEX.revenueTarget2027, lang),
          })}
        </h2>
        <p
          className={cn(
            "mt-2 max-w-3xl text-[var(--ink-muted)]",
            isMobile ? "text-xs leading-snug text-pretty" : "text-sm md:text-base",
          )}
        >
          {t(lang, "dash_sub")}
        </p>
        <div className={cn("mt-4 h-3 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--ink)_12%,transparent)]", isMobile && "mt-3 h-2")}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, Math.round((MPS_ANNEX.revenueCurrent / MPS_ANNEX.revenueTarget2027) * 100))}%`,
              background: `linear-gradient(90deg, ${chart}, ${chart2})`,
            }}
          />
        </div>
        <div
          className={cn(
            "mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
            isMobile && "mt-3 grid-cols-2 gap-2",
          )}
        >
          <Kpi compact={isMobile} label={t(lang, "ytd")} value={euro(progress.ytd, lang)} />
          <Kpi
            compact={isMobile}
            label={t(lang, "pace")}
            value={euro(progress.pace, lang)}
            hint="YTD × 12/7"
          />
          <Kpi compact={isMobile} label={t(lang, "gap")} value={euro(progress.gap, lang)} />
          <Kpi
            compact={isMobile}
            label={t(lang, "travelers")}
            value={`${MPS_ANNEX.travelersCurrent}→${MPS_ANNEX.travelersTarget} · ${MPS_ANNEX.departuresCurrent}→${MPS_ANNEX.departuresTarget}`}
          />
        </div>
      </div>

      {/* Cola de acción: lo primero que se mira al abrir el panel. */}
      <AttentionPanel
        leads={hub.leads}
        reservations={hub.reservations}
        invoices={hub.invoices}
        avgTicket={MPS_ANNEX.revenueCurrent / Math.max(1, MPS_ANNEX.travelersCurrent)}
        lang={lang}
        onAsk={(item) => {
          const q =
            item.source === "lead"
              ? askAboutLead(item.title, item.reason)
              : item.source === "reserva"
                ? askAboutReservation(item.title, item.reason)
                : askAboutInvoice(item.title, item.reason);
          requestAsk(q);
        }}
        onResolve={(item) => {
          const target: Section =
            item.source === "lead" ? "leads" : item.source === "reserva" ? "reservas" : "facturas";
          window.dispatchEvent(new CustomEvent("mps-navigate", { detail: target }));
        }}
      />

      {!isMobile && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ClosingProjection
            actual={treasury.collected}
            receivable={treasury.receivable}
            payable={treasury.teamPayable}
            lang={lang}
          />
          <CashFlowChart
            data={cashChart}
            lang={lang}
            height={220}
            title={lang === "es" ? "Caja y previsión" : "Cash and forecast"}
            subtitle={
              lang === "es"
                ? "Misma estructura que Tesorería · entradas / equipo / previsión."
                : "Same structure as Treasury · inflows / team / forecast."
            }
          />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card
          title={t(lang, "revenue_attr")}
          subtitle={t(lang, "revenue_attr_sub")}
          className="lg:col-span-2"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartRevenue}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chart} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={chart} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={grid} strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: tick, fontSize: 12 }} />
                <YAxis tick={{ fill: tick, fontSize: 12 }} />
                <Tooltip
                  {...chartTooltip}
                  formatter={(value, name) =>
                    name === "revenue"
                      ? euro(Number(value ?? 0), lang)
                      : `${Number(value ?? 0)}%`
                  }
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={chart}
                  fill="url(#rev)"
                  name="revenue"
                />
                <Area
                  type="monotone"
                  dataKey="attributedPct"
                  stroke={chart2}
                  fillOpacity={0}
                  name="attributedPct"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={t(lang, "origin_title")} subtitle={t(lang, "origin_sub")}>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={origins}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={2}
                >
                  {origins.map((o) => (
                    <Cell key={o.origin} fill={colors[o.origin]} />
                  ))}
                </Pie>
                <Tooltip {...chartTooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1.5">
            {origins.map((o) => (
              <li
                key={o.origin}
                className="flex items-center justify-between text-sm text-[var(--ink)]"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: colors[o.origin] }}
                  />
                  {ORIGIN_LABEL[o.origin]}
                </span>
                <span className="font-semibold">{o.value}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card
        title={t(lang, "margin_title")}
        subtitle={t(lang, "margin_sub", { pct: MPS_ANNEX.marginTargetPct })}
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={margins.map((m) => ({
                name: ROUTE_LABEL[m.route].split("·")[0].trim(),
                marginPct: Number(m.marginPct.toFixed(1)),
                occupancy: Number(m.occupancy.toFixed(0)),
              }))}
            >
              <CartesianGrid stroke={grid} strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fill: tick, fontSize: 11 }} />
              <YAxis tick={{ fill: tick, fontSize: 12 }} />
              <Tooltip
                {...chartTooltip}
                formatter={(value) => `${Number(value ?? 0)}%`}
              />
              <Bar dataKey="marginPct" fill={chart} name="Margen %" radius={[6, 6, 0, 0]} />
              <Bar dataKey="occupancy" fill={chart2} name="Ocupación %" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm text-[var(--ink)]">
            <thead className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
              <tr>
                <th className="py-2">{t(lang, "expedition")}</th>
                <th>{t(lang, "vehicle")}</th>
                <th>{t(lang, "occupancy")}</th>
                <th>{t(lang, "revenue")}</th>
                <th>{t(lang, "margin")}</th>
                <th>{t(lang, "unknown_origin")}</th>
              </tr>
            </thead>
            <tbody>
              {margins.map((m) => (
                <tr key={m.id} className="border-t border-[var(--glass-border)]">
                  <td className="py-2.5 font-medium">{m.name}</td>
                  <td>
                    <VehicleBadge vehicle={m.vehicle} />
                  </td>
                  <td>
                    {m.booked}/{m.seats} ({m.occupancy.toFixed(0)}%)
                  </td>
                  <td>{euro(m.revenue, lang)}</td>
                  <td>
                    <Badge tone={m.marginPct >= 30 ? "good" : "warn"}>
                      {m.marginPct.toFixed(1)}%
                    </Badge>
                  </td>
                  <td>{m.originMix.unknown ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function LeadsPanel({ lang }: { lang: Lang }) {
  const hub = useDataHub();
  const { push } = useNotifications();
  const isMobile = useIsMobile();
  const { mode, setLeadPriorityMode } = useLeadPriorityMode();
  const { sorted, ranked, unknown, avg, total } = computeLeadStats(hub.leads, new Date(), {
    mode,
    clients: hub.clients,
    lang,
  });
  const whyById = new Map(ranked.map((r) => [r.lead.id, r.why]));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = sorted.find((l) => l.id === selectedId) ?? (isMobile ? null : sorted[0]) ?? null;
  const [scoring, setScoring] = useState(false);
  const [scoreSheetOpen, setScoreSheetOpen] = useState(false);
  const [showScoreDetail, setShowScoreDetail] = useState(false);

  useEffect(() => {
    if (!isMobile && selected && selectedId !== selected.id) setSelectedId(selected.id);
  }, [selected, selectedId, isMobile]);

  const viewTotals = useMemo(() => {
    let cooling = 0;
    let sumScore = 0;
    for (const lead of sorted) {
      sumScore += lead.score;
      const d = decayedScore(lead);
      if (d.base - d.effective >= 5) cooling += 1;
    }
    return {
      count: sorted.length,
      avg: sorted.length ? Math.round(sumScore / sorted.length) : 0,
      cooling,
    };
  }, [sorted]);

  const selectedDecay = selected ? decayedScore(selected) : null;
  const selectedCold = selected ? coldByLabel(selected, lang) : null;

  const statuses = Object.keys({
    nuevo: 1,
    en_contacto: 1,
    cualificado: 1,
    reservado: 1,
    descartado: 1,
  }) as LeadStatus[];

  async function patchSelected(patch: Partial<Lead>) {
    if (!selected) return;
    await hub.saveLead({
      ...selected,
      ...patch,
      lastTouchAt: new Date().toISOString().slice(0, 10),
    });
  }

  async function runScore() {
    if (!selected) return;
    setScoring(true);
    try {
      const linked =
        hub.clients.find((c) => c.email.toLowerCase() === selected.email.toLowerCase()) ?? null;
      const result = await scoreLead(selected, linked);
      const updated = applyScoreToLead(selected, result);
      await hub.saveLead(updated);
      push({
        kind: "lead",
        tone: result.score >= 80 ? "ok" : "info",
        actor: selected.name,
        statusLabel: lang === "es" ? "SCORE IA" : "AI SCORE",
        body:
          lang === "es"
            ? `Lead score ${result.score}/100 · ${priorityLabel(result.priority, "es")}`
            : `Lead score ${result.score}/100 · ${priorityLabel(result.priority, "en")}`,
        detail: result.reasons.slice(0, 3).join(" · "),
        section: "leads",
        entityId: selected.id,
      });
    } finally {
      setScoring(false);
    }
  }

  function selectLead(id: string) {
    setSelectedId(id);
    if (isMobile) setScoreSheetOpen(true);
  }

  return (
    <div className={cn("space-y-5", isMobile && "space-y-3")}>
      <div className={cn("grid gap-3 sm:grid-cols-3", isMobile && "grid-cols-3 gap-2")}>
        <Kpi compact={isMobile} label={t(lang, "leads_queue")} value={String(total)} />
        <Kpi compact={isMobile} label={t(lang, "score_avg")} value={String(avg)} />
        <Kpi compact={isMobile} label={t(lang, "without_origin")} value={String(unknown)} />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <button
          type="button"
          onClick={async () => {
            const lead = blankLead();
            lead.name = lang === "es" ? "Nuevo lead" : "New lead";
            lead.email = `lead-${lead.id.toLowerCase()}@pendiente.local`;
            await hub.saveLead(lead);
            setSelectedId(lead.id);
            if (isMobile) setScoreSheetOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          {lang === "es" ? "Añadir lead" : "Add lead"}
        </button>
        <LeadPriorityModeSelect
          value={mode}
          onChange={setLeadPriorityMode}
          lang={lang}
          className="min-w-[16rem] flex-1"
        />
        <span className="self-center text-xs text-[var(--ink-muted)]">
          {lang === "es"
            ? `Modo ${leadPriorityModeLabel(mode, "es")} · el score no se reescribe`
            : `${leadPriorityModeLabel(mode, "en")} mode · score is never rewritten`}
        </span>
      </div>

      <ViewTotals
        headline={{
          label: lang === "es" ? "Leads (vista)" : "Leads (view)",
          value: String(viewTotals.count),
        }}
        totals={[
          {
            label: lang === "es" ? "Score medio" : "Avg score",
            value: String(viewTotals.avg),
          },
          {
            label: lang === "es" ? "Se enfrían" : "Cooling",
            value: String(viewTotals.cooling),
            tone: viewTotals.cooling > 0 ? "negative" : "positive",
          },
          {
            label: lang === "es" ? "Sin origen" : "No origin",
            value: String(unknown),
          },
        ]}
      />

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-[var(--ink-muted)]">
          <input
            type="checkbox"
            checked={showScoreDetail}
            onChange={(e) => setShowScoreDetail(e.target.checked)}
            className="rounded"
          />
          {lang === "es" ? "Ver detalle del score" : "Show score detail"}
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card
          title={t(lang, "inbox")}
          subtitle={isMobile ? undefined : t(lang, "inbox_sub")}
          className={cn("lg:col-span-3", isMobile && "p-3")}
        >
          <ul className="divide-y divide-[var(--glass-border)]">
            {sorted.map((lead) => {
              const decay = decayedScore(lead);
              return (
              <li key={lead.id}>
                <button
                  type="button"
                  onClick={() => selectLead(lead.id)}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-lg px-1 text-left transition hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]",
                    isMobile ? "py-2" : "py-3",
                    selected?.id === lead.id &&
                      "bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]",
                  )}
                >
                  <div>
                    <p className="font-semibold text-[var(--ink)]">
                      {lead.name}{" "}
                      <span className="font-normal text-[var(--ink-muted)]">{lead.id}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-muted)]">
                      {whyById.get(lead.id) ?? ORIGIN_LABEL[lead.origin]}
                      <VehicleBadge vehicle={lead.vehicle} />
                    </p>
                    {showScoreDetail ? (
                      <p className="mt-1 text-[11px] tabular-nums text-[var(--ink-muted)]">
                        base {decay.base} → ef. {decay.effective} · {decay.days}d ·{" "}
                        {coldByLabel(lead, lang)}
                      </p>
                    ) : null}
                  </div>
                  <Badge tone={scoreTone(lead.score)}>{lead.score}</Badge>
                </button>
              </li>
            );
            })}
          </ul>
        </Card>
        {!isMobile && (
        <Card title={t(lang, "detail")} subtitle={t(lang, "detail_sub")} className="lg:col-span-2">
          {selected ? (
            <>
              <p className="font-[family-name:var(--mps-display)] text-xl text-[var(--ink)]">
                {selected.name}
              </p>
              <p className="text-sm text-[var(--ink-muted)]">{selected.email}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="brand">{ORIGIN_LABEL[selected.origin]}</Badge>
                <Badge>{selected.status}</Badge>
                <Badge>Owner: {selected.owner}</Badge>
                <VehicleBadge vehicle={selected.vehicle} />
                <Badge tone={scoreTone(selected.score)}>
                  {selected.score}/100 · {priorityLabel(priorityFromScoreSafe(selected.score), lang)}
                </Badge>
              </div>
              <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                {lang === "es" ? "Estado (humano)" : "Status (human)"}
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-2 text-sm text-[var(--ink)]"
                  value={selected.status}
                  onChange={(e) => void patchSelected({ status: e.target.value as LeadStatus })}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                {lang === "es" ? "Origen / UTM" : "Origin / UTM"}
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-2 text-sm text-[var(--ink)]"
                  value={selected.origin}
                  onChange={(e) => void patchSelected({ origin: e.target.value as LeadOrigin })}
                >
                  {(Object.keys(ORIGIN_LABEL) as LeadOrigin[]).map((o) => (
                    <option key={o} value={o}>
                      {ORIGIN_LABEL[o]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={scoring}
                onClick={() => void runScore()}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {scoring ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {lang === "es" ? "Clasificar con IA (Lead Score)" : "Classify with AI (Lead Score)"}
              </button>
              <ol className="mt-4 list-decimal space-y-2 pl-4 text-sm text-[var(--ink)]">
                {selected.scoreReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ol>
              {showScoreDetail && selectedDecay ? (
                <div className="mt-3 space-y-1 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-3 text-xs tabular-nums text-[var(--ink-muted)]">
                  <p>
                    {lang === "es" ? "Base" : "Base"} {selectedDecay.base} →{" "}
                    {lang === "es" ? "efectivo" : "effective"} {selectedDecay.effective}
                  </p>
                  <p>
                    {selectedDecay.days}d · factor {selectedDecay.factor.toFixed(2)} ·{" "}
                    {selectedCold}
                  </p>
                  <p className="text-[var(--ink)]">
                    {whyById.get(selected.id)}
                  </p>
                </div>
              ) : null}
              <div className="mt-5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-3 text-sm">
                <p className="font-semibold text-[var(--ink)]">{t(lang, "human_action")}</p>
                <p className="mt-1 text-[var(--ink-muted)]">{t(lang, "human_action_body")}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const ok = window.confirm(
                    lang === "es" ? "¿Eliminar este lead del Hub?" : "Delete this lead from the Hub?",
                  );
                  if (ok) void hub.deleteLead(selected.id);
                }}
                className="mt-4 text-xs font-semibold text-[var(--danger)] underline"
              >
                {lang === "es" ? "Eliminar lead" : "Delete lead"}
              </button>
            </>
          ) : (
            <p className="text-sm text-[var(--ink-muted)]">
              {lang === "es" ? "No hay leads en el Hub." : "No leads in the Hub."}
            </p>
          )}
        </Card>
        )}
      </div>
      <MobileLeadScoreSheet
        open={isMobile && scoreSheetOpen}
        lead={selected}
        lang={lang}
        onClose={() => setScoreSheetOpen(false)}
      />
    </div>
  );
}

function priorityFromScoreSafe(score: number) {
  if (score >= 85) return "muy_alta" as const;
  if (score >= 70) return "alta" as const;
  if (score >= 50) return "media" as const;
  return "baja" as const;
}

function ClientsPanel({ lang }: { lang: Lang }) {
  const hub = useDataHub();
  const { push } = useNotifications();
  const clients = hub.clients;
  const [q, setQ] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<ClientSegment | "all" | "contact_month">(
    "all",
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; client: Client } | null>(
    null,
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeFlash, setAnalyzeFlash] = useState<string | null>(null);

  const contactQueue = useMemo(() => clientsToContactThisMonth(clients), [clients]);

  const list = useMemo(() => {
    let base = [...clients].sort((a, b) => b.reactivationPriority - a.reactivationPriority);
    if (segmentFilter === "contact_month") {
      base = clientsToContactThisMonth(base);
    } else if (segmentFilter !== "all") {
      base = base.filter((c) => c.segment === segmentFilter);
    }
    const query = q.trim().toLowerCase();
    if (!query) return base;
    return base.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.phone.includes(query) ||
        c.city.toLowerCase().includes(query) ||
        c.id.toLowerCase().includes(query) ||
        c.dni.toLowerCase().includes(query) ||
        SEGMENT_LABEL[c.segment].toLowerCase().includes(query),
    );
  }, [q, clients, segmentFilter]);

  const clientView = useMemo(() => {
    let ltv = 0;
    let risk = 0;
    let contactHits = 0;
    const contactIds = new Set(contactQueue.map((c) => c.id));
    for (const c of list) {
      ltv += c.ltv || 0;
      if (c.segment === "dormido" || c.segment === "en_riesgo") risk += 1;
      if (contactIds.has(c.id)) contactHits += 1;
    }
    return { count: list.length, ltv, risk, contactHits };
  }, [list, contactQueue]);

  function statusTone(s: Client["status"]): "good" | "warn" | "bad" | "neutral" {
    if (s === "al_dia") return "good";
    if (s === "alta_prioridad") return "bad";
    if (s === "dormido") return "warn";
    return "neutral";
  }

  function segmentTone(s: Client["segment"]): "good" | "warn" | "bad" | "brand" | "neutral" {
    if (s === "vip" || s === "embajador") return "brand";
    if (s === "dormido" || s === "en_riesgo") return "warn";
    if (s === "recurrente" || s === "activo") return "good";
    return "neutral";
  }

  async function saveClient(c: Client) {
    await hub.saveClient(c);
    setOpenId(c.id);
    setModal(null);
    showMobileTicket({
      title: lang === "es" ? "Cliente guardado" : "Client saved",
      subtitle: lang === "es" ? "Ficha actualizada en el CRM" : "Record updated in the CRM",
      headline: c.name,
      meta: c.email,
      fields: [
        { label: lang === "es" ? "Segmento" : "Segment", value: c.segment || "—" },
        { label: lang === "es" ? "Teléfono" : "Phone", value: c.phone || "—" },
        { label: "Email", value: c.email || "—" },
        { label: "DNI", value: c.dni || "—" },
      ],
      chips: c.segment ? [c.segment] : undefined,
      primaryLabel: lang === "es" ? "Hecho" : "Done",
    });
  }

  async function runIntelligence(scope: "all" | "one", one?: Client) {
    setAnalyzing(true);
    setAnalyzeFlash(null);
    try {
      const targets = scope === "one" && one ? [one] : clients;
      let contactHits = 0;
      for (const c of targets) {
        const result = await classifyCustomer(c);
        const updated = applyIntelligenceToClient(c, result);
        await hub.saveClient(updated);
        if (result.contactThisMonth) {
          contactHits += 1;
          push({
            kind: "client",
            tone: "warn",
            actor: c.name,
            statusLabel: lang === "es" ? "CONTACTAR ESTE MES" : "CONTACT THIS MONTH",
            body:
              lang === "es"
                ? `${SEGMENT_LABEL[result.segment]} · prob. volver ${result.returnProbability}% · avisar al equipo`
                : `${SEGMENT_LABEL[result.segment]} · return prob. ${result.returnProbability}% · notify team`,
            detail: result.reactivationWhy,
            section: "clientes",
            entityId: c.id,
          });
        }
      }
      setAnalyzeFlash(
        lang === "es"
          ? `Análisis listo (${targets.length} cliente${targets.length === 1 ? "" : "s"}) · ${contactHits} en cola de contacto · fuente: ${aiReady() ? providerLabel() : "heurística"}`
          : `Analysis done (${targets.length} client${targets.length === 1 ? "" : "s"}) · ${contactHits} in contact queue · source: ${aiReady() ? providerLabel() : "heuristic"}`,
      );
      setSegmentFilter("contact_month");
    } finally {
      setAnalyzing(false);
    }
  }

  const segmentChips: { id: typeof segmentFilter; label: string }[] = [
    { id: "all", label: lang === "es" ? "Todos" : "All" },
    { id: "contact_month", label: lang === "es" ? "Contactar este mes" : "Contact this month" },
    { id: "vip", label: "VIP" },
    { id: "dormido", label: lang === "es" ? "Dormidos" : "Dormant" },
    { id: "embajador", label: lang === "es" ? "Embajadores" : "Ambassadors" },
    { id: "en_riesgo", label: lang === "es" ? "En riesgo" : "At risk" },
    { id: "recurrente", label: lang === "es" ? "Recurrentes" : "Repeat" },
    { id: "activo", label: lang === "es" ? "Activos" : "Active" },
  ];

  return (
    <div className="space-y-5">
      <Card
        title={
          lang === "es"
            ? "Clientes para contactar este mes"
            : "Clients to contact this month"
        }
        subtitle={
          lang === "es"
            ? "La IA clasifica y avisa al equipo. No escribe al viajero. Ahí está el dinero de la recurrencia."
            : "AI ranks and notifies the team. It never messages the traveller. That's the recurrence money."
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone="bad">
            {contactQueue.length} {lang === "es" ? "en cola" : "queued"}
          </Badge>
          <button
            type="button"
            disabled={analyzing || clients.length === 0}
            onClick={() => void runIntelligence("all")}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {analyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {lang === "es"
              ? "Analizar cartera con IA"
              : "Analyze portfolio with AI"}
          </button>
          <span className="text-xs text-[var(--ink-muted)]">
            {aiReady()
              ? `${providerLabel()} API`
              : lang === "es"
                ? "Heurística (configura IA en Ajustes)"
                : "Heuristic (configure AI in Settings)"}
          </span>
        </div>
        {analyzeFlash && <p className="mb-3 text-sm text-[var(--accent)]">{analyzeFlash}</p>}
        {contactQueue.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">
            {lang === "es"
              ? "Nadie en cola. Ejecuta el análisis o completa historial / opens Brevo / último viaje."
              : "Queue empty. Run analysis or complete history / Brevo opens / last trip."}
          </p>
        ) : (
          <ul className="space-y-2">
            {contactQueue.slice(0, 8).map((c) => {
              const months = monthsSinceTrip(c.lastTripAt);
              const lastRoute = c.history[0]?.route
                ? ROUTE_LABEL[c.history[0].route]
                : c.preferredRoute
                  ? ROUTE_LABEL[c.preferredRoute]
                  : "—";
              return (
                <li
                  key={`q-${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-strong)] px-3 py-3 shadow-sm"
                >
                  <div>
                    <p className="font-semibold text-[var(--ink)]">
                      {c.name}{" "}
                      <span className="font-mono text-xs font-normal text-[var(--ink-muted)]">
                        {c.id}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-[var(--ink-muted)]">
                      {lang === "es" ? "Último viaje" : "Last trip"} {lastRoute}
                      {months != null
                        ? ` · ${lang === "es" ? "hace" : ""} ${months} ${lang === "es" ? "meses" : "mo ago"}`
                        : ""}
                      {" · "}
                      Brevo {c.brevoOpens}
                      {" · "}
                      {!c.lastOutboundAt
                        ? lang === "es"
                          ? "Nunca recibió llamada"
                          : "Never called"
                        : lang === "es"
                          ? `Último contacto ${c.lastOutboundAt}`
                          : `Last contact ${c.lastOutboundAt}`}
                      {" · "}
                      {lang === "es" ? "Prob. volver" : "Return prob."}{" "}
                      {c.returnProbability ?? c.reactivationPriority}%
                    </p>
                    <p className="mt-1 text-xs text-[var(--ink)]">{c.reactivationWhy}</p>
                  </div>
                  <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                    <Badge tone={segmentTone(c.segment)}>{SEGMENT_LABEL[c.segment]}</Badge>
                    <EntityActionBar
                      phone={c.phone}
                      onEdit={() => setModal({ mode: "edit", client: { ...c } })}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4 rounded-xl border border-dashed border-[var(--glass-border)] p-3 text-sm text-[var(--ink-muted)]">
          <Phone className="mr-2 inline h-4 w-4 text-[var(--accent)]" />
          {lang === "es"
            ? "La IA no llama ni escribe. Solo mete al cliente en esta lista y dispara aviso interno."
            : "AI does not call or write. It only queues the client and fires an internal alert."}
        </div>
      </Card>

      <Card
        title={t(lang, "reactivation")}
        subtitle={
          lang === "es"
            ? "Ficha 360º: VIP · dormidos · embajadores · en riesgo · alto valor. Alta/edición + Llamar/WhatsApp humano."
            : "360° record: VIP · dormant · ambassadors · at risk · high value. Create/edit + human Call/WhatsApp."
        }
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                lang === "es"
                  ? "Buscar por nombre, email, teléfono, DNI, ciudad o segmento…"
                  : "Search by name, email, phone, tax ID, city or segment…"
              }
              className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] py-2.5 pl-10 pr-3 text-sm text-[var(--ink)] outline-none ring-[var(--accent)] placeholder:text-[var(--ink-muted)] focus:ring-2"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">
              {list.length} {lang === "es" ? "clientes" : "clients"}
            </Badge>
            <button
              type="button"
              onClick={() => setModal({ mode: "create", client: blankClient() })}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              {lang === "es" ? "Añadir cliente" : "Add client"}
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {segmentChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setSegmentFilter(chip.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition",
                segmentFilter === chip.id
                  ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-[var(--ink)]"
                  : "border-[var(--glass-border)] text-[var(--ink-muted)] hover:border-[var(--accent)]",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <ViewTotals
          className="mb-4"
          headline={{
            label: lang === "es" ? "LTV (vista)" : "LTV (view)",
            value: formatEur(clientView.ltv, lang),
          }}
          totals={[
            {
              label: lang === "es" ? "Clientes" : "Clients",
              value: String(clientView.count),
            },
            {
              label: lang === "es" ? "En cola contacto" : "Contact queue",
              value: String(clientView.contactHits),
              tone: clientView.contactHits > 0 ? "negative" : undefined,
            },
            {
              label: lang === "es" ? "Riesgo / dormidos" : "At risk / dormant",
              value: String(clientView.risk),
              tone: clientView.risk > 0 ? "negative" : "positive",
            },
          ]}
        />

        <ul className="space-y-3">
          {list.map((c) => {
            const open = openId === c.id;
            const highValue = (c.ltv ?? 0) >= 10_000 || (c.avgTicket ?? 0) >= 5_500;
            return (
              <li
                key={c.id}
                className="overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-strong)] shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : c.id)}
                  className="flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">
                        {c.name.slice(0, 1) || "?"}
                      </span>
                      <div>
                        <p className="font-semibold text-[var(--ink)]">
                          {c.name || (lang === "es" ? "(Sin nombre)" : "(Untitled)")}{" "}
                          <span className="font-mono text-xs font-normal text-[var(--ink-muted)]">
                            {c.id}
                          </span>
                        </p>
                        <p className="text-xs text-[var(--ink-muted)]">
                          {c.city} · {c.phone}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <Badge tone={segmentTone(c.segment)}>{SEGMENT_LABEL[c.segment]}</Badge>
                      {highValue && (
                        <Badge tone="brand">
                          {lang === "es" ? "Alto valor" : "High value"}
                        </Badge>
                      )}
                      {c.contactThisMonth && (
                        <Badge tone="bad">
                          {lang === "es" ? "Contactar" : "Contact"}
                        </Badge>
                      )}
                      <Badge tone={statusTone(c.status)}>{STATUS_LABEL[c.status]}</Badge>
                      <Badge tone={clientPaymentTone(c.paymentStatus)}>
                        {PAYMENT_STATUS_LABEL[c.paymentStatus]}
                      </Badge>
                      <span className="text-sm font-semibold text-[var(--ink)]">
                        LTV {euro(c.ltv, lang)}
                      </span>
                    </div>
                    <EntityActionBar
                      className="justify-end self-end"
                      phone={c.phone}
                      onEdit={() => setModal({ mode: "edit", client: { ...c } })}
                      onDelete={() => {
                        const ok = window.confirm(
                          lang === "es"
                            ? "¿Eliminar este cliente del Hub?"
                            : "Delete this client from the Hub?",
                        );
                        if (ok) void hub.deleteClient(c.id);
                      }}
                    />
                  </div>
                </button>

                {open && (
                  <div className="border-t border-[var(--glass-border)] px-4 pb-4 pt-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-[var(--glass-border)] bg-[color-mix(in_oklab,var(--bg0)_50%,transparent)] p-3">
                        <p className="text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">
                          {lang === "es" ? "Prioridad reactivación" : "Reactivation priority"}
                        </p>
                        <p className="mt-1 font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
                          {c.reactivationPriority}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[var(--glass-border)] bg-[color-mix(in_oklab,var(--bg0)_50%,transparent)] p-3">
                        <p className="text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">
                          {lang === "es" ? "Prob. volver" : "Return prob."}
                        </p>
                        <p className="mt-1 font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
                          {c.returnProbability ?? "—"}%
                        </p>
                      </div>
                      <div className="rounded-xl border border-[var(--glass-border)] bg-[color-mix(in_oklab,var(--bg0)_50%,transparent)] p-3">
                        <p className="text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">
                          {t(lang, "trips")}
                        </p>
                        <p className="mt-1 font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
                          {c.trips}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[var(--glass-border)] bg-[color-mix(in_oklab,var(--bg0)_50%,transparent)] p-3">
                        <p className="text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">
                          NPS / Referidos
                        </p>
                        <p className="mt-1 font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
                          {c.nps ?? "—"} / {c.referrals}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2 text-sm text-[var(--ink)]">
                        <p>
                          <span className="text-[var(--ink-muted)]">DNI/NIF:</span> {c.dni || "—"}
                        </p>
                        <p>
                          <span className="text-[var(--ink-muted)]">
                            {lang === "es" ? "Dirección:" : "Address:"}
                          </span>{" "}
                          {c.address}
                        </p>
                        <p>
                          <span className="text-[var(--ink-muted)]">Email:</span> {c.email}
                        </p>
                        <p>
                          <span className="text-[var(--ink-muted)]">WhatsApp:</span> {c.phone}
                        </p>
                        <p>
                          <span className="text-[var(--ink-muted)]">
                            {lang === "es" ? "Contacto / emergencia:" : "Contact / emergency:"}
                          </span>{" "}
                          {c.contactPerson} · {c.emergencyPhone}
                        </p>
                        <p>
                          <span className="text-[var(--ink-muted)]">
                            {lang === "es" ? "Ciudad:" : "City:"}
                          </span>{" "}
                          {c.city}, {c.country}
                        </p>
                        <p>
                          <span className="text-[var(--ink-muted)]">
                            {lang === "es" ? "Medio de pago:" : "Payment method:"}
                          </span>{" "}
                          {PAYMENT_METHOD_LABEL[c.paymentMethod]}
                        </p>
                        <p>
                          <span className="text-[var(--ink-muted)]">
                            {lang === "es" ? "Saldo pendiente:" : "Pending balance:"}
                          </span>{" "}
                          {euro(c.pendingBalance, lang)}
                        </p>
                        <p>
                          <span className="text-[var(--ink-muted)]">
                            {lang === "es" ? "Experiencia:" : "Experience:"}
                          </span>{" "}
                          {EXPERIENCE_LABEL[c.experience]} · Docs:{" "}
                          {c.docsComplete ? "OK" : lang === "es" ? "Pendientes" : "Pending"}
                        </p>
                        <p>
                          <span className="text-[var(--ink-muted)]">Owner:</span> {c.owner}
                        </p>
                        <p>
                          <span className="text-[var(--ink-muted)]">
                            {lang === "es" ? "Alta:" : "Since:"}
                          </span>{" "}
                          {c.since}
                        </p>
                        <p>
                          <span className="text-[var(--ink-muted)]">
                            {lang === "es" ? "Origen primario:" : "Primary origin:"}
                          </span>{" "}
                          {ORIGIN_LABEL[c.originPrimary]}
                        </p>
                        <p>
                          <span className="text-[var(--ink-muted)]">Brevo opens:</span> {c.brevoOpens}
                        </p>
                        <p>
                          <span className="text-[var(--ink-muted)]">
                            {lang === "es" ? "Último contacto equipo:" : "Last team contact:"}
                          </span>{" "}
                          {c.lastOutboundAt ??
                            (lang === "es" ? "Nunca" : "Never")}
                        </p>
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="text-[var(--ink-muted)]">
                            {lang === "es" ? "Preferencia:" : "Preference:"}
                          </span>
                          <VehicleBadge vehicle={c.vehiclePref} />
                          {c.preferredRoute ? ROUTE_LABEL[c.preferredRoute] : "—"}
                        </p>
                        <p>
                          <span className="text-[var(--ink-muted)]">
                            {lang === "es" ? "Último viaje:" : "Last trip:"}
                          </span>{" "}
                          {c.lastTripAt ?? "—"}
                          {monthsSinceTrip(c.lastTripAt) != null
                            ? ` (${monthsSinceTrip(c.lastTripAt)} ${lang === "es" ? "meses" : "mo"})`
                            : ""}
                        </p>
                        <p>
                          <span className="text-[var(--ink-muted)]">
                            {lang === "es" ? "Interés siguiente:" : "Next interest:"}
                          </span>{" "}
                          {c.nextInterest ? ROUTE_LABEL[c.nextInterest] : "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                          {lang === "es" ? "Historial de expediciones" : "Expedition history"}
                        </p>
                        {c.history.length === 0 ? (
                          <p className="mt-2 text-sm text-[var(--ink-muted)]">
                            {lang === "es" ? "Sin viajes todavía." : "No trips yet."}
                          </p>
                        ) : (
                          <ul className="mt-2 space-y-2">
                            {c.history.map((h) => (
                              <li
                                key={`${h.route}-${h.date}`}
                                className="rounded-lg border border-[var(--glass-border)] px-3 py-2 text-sm text-[var(--ink)]"
                              >
                                <span className="font-medium">{ROUTE_LABEL[h.route]}</span>
                                <span className="text-[var(--ink-muted)]">
                                  {" "}
                                  · {h.date} · {h.vehicle} · {euro(h.amount, lang)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="mt-3 rounded-lg border border-dashed border-[var(--glass-border)] bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] p-3 text-sm text-[var(--ink)]">
                          <strong>{lang === "es" ? "Nota interna:" : "Internal note:"}</strong>{" "}
                          {c.notes}
                        </p>
                        <p className="mt-2 text-sm text-[var(--ink-muted)]">{c.reactivationWhy}</p>
                        {c.intelligenceSource && (
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">
                            Intelligence: {c.intelligenceSource}
                            {c.intelligenceAt ? ` · ${c.intelligenceAt.slice(0, 16)}` : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={analyzing}
                        onClick={() => void runIntelligence("one", c)}
                        className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {analyzing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {lang === "es" ? "Reclasificar con IA" : "Reclassify with AI"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setModal({ mode: "edit", client: { ...c } })}
                        className="inline-flex items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-strong)] px-3 py-2 text-sm font-semibold text-[var(--ink)]"
                      >
                        <Pencil className="h-4 w-4" />
                        {lang === "es" ? "Editar datos" : "Edit details"}
                      </button>
                      <EntityActionBar className="justify-end" phone={c.phone} />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {modal && (
        <ClientFormModal
          lang={lang}
          mode={modal.mode}
          initial={modal.client}
          onClose={() => setModal(null)}
          onSave={saveClient}
        />
      )}
    </div>
  );
}


function KnowledgePanel({ lang }: { lang: Lang }) {
  const hub = useDataHub();
  const [tab, setTab] = useState<"ask" | "docs" | "playbook">("ask");
  const [question, setQuestion] = useState(
    lang === "es" ? "¿Cuánto costó Mongolia 2025?" : "How much did Mongolia 2025 cost?",
  );
  const [asking, setAsking] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [result, setResult] = useState<KnowledgeAskResult | null>(null);
  const [lastTokens, setLastTokens] = useState<{ out: number; max: number } | null>(null);
  const [usage, setUsage] = useState(() => loadAiUsage());
  const [threads, setThreads] = useState<AiThread[]>(() => listAiThreads());
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>();
  const [docs, setDocs] = useState<KnowledgeDoc[]>(() => loadKnowledgeDocs());
  const askAbortRef = useRef<AbortController | null>(null);
  const [docForm, setDocForm] = useState({
    title: "",
    kind: "pdf" as KnowledgeDocKind,
    content: "",
    fileRef: "",
    tags: "",
  });

  useEffect(() => {
    function onHubRefresh() {
      setDocs(loadKnowledgeDocs());
    }
    window.addEventListener("mps-hub-refreshed", onHubRefresh);
    return () => {
      window.removeEventListener("mps-hub-refreshed", onHubRefresh);
      askAbortRef.current?.abort();
    };
  }, []);

  // El drawer global (AiAssistantHost) escucha ask-bus.
  // Aquí solo sincronizamos la pregunta en la UI si el usuario está en esta sección.
  useEffect(() => {
    return onAskRequested((q) => {
      setTab("ask");
      setQuestion(q);
    });
  }, []);

  const [active, setActive] = useState(0);
  const [cat, setCat] = useState<"all" | KnowledgeItem["category"]>("all");
  const filtered =
    cat === "all" ? KNOWLEDGE_ANSWERS : KNOWLEDGE_ANSWERS.filter((k) => k.category === cat);
  const item = filtered[Math.min(active, filtered.length - 1)] ?? filtered[0];
  const threadGroups = useMemo(() => groupThreadsByRecency(threads), [threads]);

  const cats: { id: typeof cat; label: string }[] = [
    { id: "all", label: lang === "es" ? "Todas" : "All" },
    { id: "ops", label: "Ops" },
    { id: "margen", label: lang === "es" ? "Margen" : "Margin" },
    { id: "clientes", label: lang === "es" ? "Clientes" : "Clients" },
    { id: "legal", label: "Legal" },
    { id: "contenido", label: lang === "es" ? "Contenido" : "Content" },
    { id: "stack", label: "Stack" },
  ];

  // Prompts sugeridos: un cursor vacío no dice qué sabe hacer el asistente.
  // Cubren las tres cosas que de verdad se preguntan: coste, operativa y
  // dinero — no ejemplos decorativos.
  const examples =
    lang === "es"
      ? [
          "¿Cuánto costó Mongolia 2025?",
          "¿Qué hotel usamos en Namibia?",
          "¿Cuál fue el margen medio de Alaska?",
          "¿Qué leads debería llamar hoy y por qué?",
          "¿Qué reservas salen este mes con saldo pendiente?",
          "¿Qué facturas llevan más de 30 días sin cobrar?",
        ]
      : [
          "How much did Mongolia 2025 cost?",
          "Which hotel did we use in Namibia?",
          "What was Alaska’s average margin?",
          "Which leads should I call today, and why?",
          "Which trips depart this month with money outstanding?",
          "Which invoices are over 30 days uncollected?",
        ];

  function persistDocs(next: KnowledgeDoc[]) {
    setDocs(next);
    saveKnowledgeDocs(next);
  }

  async function runAsk(q?: string) {
    const text = (q ?? question).trim();
    if (!text) return;
    askAbortRef.current?.abort();
    const ac = new AbortController();
    askAbortRef.current = ac;
    setQuestion(text);
    setAsking(true);
    setStreamText("");
    setResult(null);
    try {
      const res = await askKnowledgeStream(
        text,
        {
          docs,
          reservations: hub.reservations,
          invoices: hub.invoices,
          clients: hub.clients,
          expeditions: EXPEDITIONS,
          faq: KNOWLEDGE_ANSWERS,
        },
        (chunk) => setStreamText((prev) => prev + chunk),
        ac.signal,
      );
      setResult(res);
      setStreamText(res.answer);
      const settings = loadAiSettings();
      const out = estimateTokens(res.answer);
      setLastTokens({ out, max: settings.maxOutputTokens });
      setUsage(recordAiUsage({ prompt: text, reply: res.answer }));
      const thread = upsertAiThread({
        id: activeThreadId,
        question: text,
        answer: res.answer,
        tokensOut: out,
        tokensMax: settings.maxOutputTokens,
      });
      setActiveThreadId(thread.id);
      setThreads(listAiThreads());
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setResult({
        answer: err instanceof Error ? err.message : String(err),
        sources: [],
        chunksUsed: [],
        engine: "retrieval",
        why: [lang === "es" ? "Error al consultar" : "Query error"],
      });
    } finally {
      setAsking(false);
    }
  }

  function loadThread(thread: AiThread) {
    setActiveThreadId(thread.id);
    const lastUser = [...thread.messages].reverse().find((m) => m.role === "user");
    const lastAsst = [...thread.messages].reverse().find((m) => m.role === "assistant");
    if (lastUser) setQuestion(lastUser.content);
    if (lastAsst) {
      setResult({
        answer: lastAsst.content,
        why: [
          lang === "es"
            ? "Recuperado del historial local de este hilo."
            : "Restored from this thread’s local history.",
        ],
        sources: [lang === "es" ? "Historial local" : "Local history"],
        engine: "retrieval",
        chunksUsed: [],
      });
      if (lastAsst.tokensOut != null && lastAsst.tokensMax != null) {
        setLastTokens({ out: lastAsst.tokensOut, max: lastAsst.tokensMax });
      }
    }
    setTab("ask");
    setStreamText(lastAsst?.content ?? "");
  }

  function addDoc() {
    if (!docForm.title.trim() || !docForm.content.trim()) return;
    const next = upsertKnowledgeDoc(docs, {
      title: docForm.title.trim(),
      kind: docForm.kind,
      content: docForm.content.trim(),
      fileRef: docForm.fileRef.trim() || undefined,
      tags: docForm.tags
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      source: "manual",
    });
    persistDocs(next);
    setDocForm({ title: "", kind: "pdf", content: "", fileRef: "", tags: "" });
  }

  function ThreadGroup({
    label,
    items,
  }: {
    label: string;
    items: AiThread[];
  }) {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
          {label}
        </p>
        {items.map((th) => (
          <button
            key={th.id}
            type="button"
            onClick={() => loadThread(th)}
            className={cn(
              "block w-full rounded-lg px-2.5 py-2 text-left text-xs transition",
              activeThreadId === th.id
                ? "bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--ink)]"
                : "text-[var(--ink-muted)] hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)]",
            )}
          >
            <span className="line-clamp-2 font-semibold">{th.title}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card
        title={lang === "es" ? "Asistente de conocimiento · solo equipo" : "Knowledge Assistant · team only"}
        subtitle={
          lang === "es"
            ? "Siempre busca primero en docs + Hub (heurística). Si la IA está activa en Ajustes, resume esos fragmentos. Si no hay IA o falla → solo heurística. Nunca habla con el viajero."
            : "Always searches docs + Hub first (heuristic). If AI is on in Settings, it summarizes those chunks. If AI is off or fails → heuristic only. Never messages the traveller."
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["ask", lang === "es" ? "Preguntar" : "Ask"],
              ["docs", lang === "es" ? "Base documental" : "Document base"],
              ["playbook", lang === "es" ? "Playbook Q&A" : "Q&A playbook"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                tab === id
                  ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--ink)]"
                  : "border-[var(--glass-border)] text-[var(--ink-muted)]",
              )}
            >
              {label}
            </button>
          ))}
          <Badge tone="brand">
            {docs.length} {lang === "es" ? "docs" : "docs"}
          </Badge>
          <Badge tone={aiReady() ? "good" : "neutral"}>
            {aiReady()
              ? lang === "es"
                ? `IA + heurística · ${providerLabel()}`
                : `AI + heuristic · ${providerLabel()}`
              : lang === "es"
                ? "Solo heurística (sin IA)"
                : "Heuristic only (no AI)"}
          </Badge>
          <button
            type="button"
            className="mps-choice rounded-lg px-3 py-1.5 text-xs font-semibold"
            onClick={() => {
              setActiveThreadId(undefined);
              setResult(null);
              setQuestion("");
            }}
          >
            {lang === "es" ? "Nuevo hilo" : "New thread"}
          </button>
        </div>
      </Card>

      {tab === "ask" && (
        <div className="grid gap-5 lg:grid-cols-6">
          <Card
            title={lang === "es" ? "Historial" : "History"}
            subtitle={lang === "es" ? "Hoy / esta semana" : "Today / this week"}
            className="lg:col-span-1"
          >
            <div className="max-h-[420px] space-y-4 overflow-y-auto">
              <ThreadGroup
                label={lang === "es" ? "Hoy" : "Today"}
                items={threadGroups.today}
              />
              <ThreadGroup
                label={lang === "es" ? "Esta semana" : "This week"}
                items={threadGroups.week}
              />
              <ThreadGroup
                label={lang === "es" ? "Anteriores" : "Older"}
                items={threadGroups.older}
              />
              {threads.length === 0 ? (
                <p className="text-xs text-[var(--ink-muted)]">
                  {lang === "es"
                    ? "Aún no hay hilos. Haz una pregunta."
                    : "No threads yet. Ask something."}
                </p>
              ) : null}
            </div>
          </Card>

          <Card
            title={lang === "es" ? "Pregunta del CEO" : "CEO question"}
            subtitle={
              lang === "es"
                ? "Ejemplos: coste Mongolia 2025 · hotel Namibia · margen Alaska"
                : "Examples: Mongolia 2025 cost · Namibia hotel · Alaska margin"
            }
            className="lg:col-span-2"
          >
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm text-[var(--ink)] outline-none ring-[var(--accent)] focus:ring-2"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => void runAsk(ex)}
                  className="rounded-full border border-[var(--glass-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-muted)] hover:border-[var(--accent)]"
                >
                  {ex}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={asking}
              onClick={() => void runAsk()}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {asking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {lang === "es"
                ? aiReady()
                  ? `Consultar (IA · ${providerLabel()})`
                  : "Consultar (heurística)"
                : aiReady()
                  ? `Ask (AI · ${providerLabel()})`
                  : "Ask (heuristic)"}
            </button>
          </Card>

          <Card
            title={lang === "es" ? "Respuesta con fuentes" : "Answer with sources"}
            className="lg:col-span-3"
          >
            {!result && !streamText && !asking ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <span className="mps-ai-fab is-alive" aria-hidden>
                  <Sparkles className="h-5 w-5" />
                </span>
                <p className="text-sm font-semibold text-[var(--ink)]">
                  {lang === "es" ? "¿En qué te ayudo con la operación?" : "How can I help with ops?"}
                </p>
                <p className="max-w-sm text-sm text-[var(--ink-muted)]">
                  {lang === "es"
                    ? "Docs + Hub primero; IA resume en streaming si está activa. Respuestas cortas para ahorrar tokens."
                    : "Docs + Hub first; AI streams a summary if enabled. Short answers to save tokens."}
                </p>
                <p className="text-[11px] tabular-nums text-[var(--ink-muted)]">
                  {lang === "es" ? "Uso" : "Usage"} · {formatTokenK(usage.inputTokens)} in /{" "}
                  {formatTokenK(usage.outputTokens)} out · {usage.messages} msg
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {asking ? (
                    <Badge tone="brand">
                      {lang === "es" ? "Escribiendo…" : "Streaming…"}
                    </Badge>
                  ) : result ? (
                    <Badge tone={result.engine === "ai" ? "good" : "neutral"}>
                      {result.engine === "ai"
                        ? lang === "es"
                          ? `Modo IA · ${result.provider ?? providerLabel()}`
                          : `AI mode · ${result.provider ?? providerLabel()}`
                        : lang === "es"
                          ? "Modo heurística / retrieval"
                          : "Heuristic / retrieval mode"}
                    </Badge>
                  ) : null}
                  {lastTokens && !asking ? (
                    <span className="text-[11px] tabular-nums text-[var(--ink-muted)]">
                      {lastTokens.out}/{lastTokens.max} tokens
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]">
                  {streamText || result?.answer || ""}
                  {asking ? (
                    <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-[var(--accent)] align-middle" />
                  ) : null}
                </p>
                {result && !asking ? (
                  <>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  {lang === "es" ? "Por qué importa" : "Why it matters"}
                </p>
                <ul className="mt-2 space-y-2">
                  {result.why.map((w) => (
                    <li
                      key={w}
                      className="flex gap-2 rounded-lg border border-[var(--glass-border)] px-3 py-2 text-sm text-[var(--ink)]"
                    >
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                      {w}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  {t(lang, "sources")}
                </p>
                <ul className="mt-2 space-y-1">
                  {result.sources.map((s) => (
                    <li key={s} className="flex items-center gap-2 text-sm text-[var(--ink)]">
                      <BookOpen className="h-4 w-4 text-[var(--accent)]" />
                      {s}
                    </li>
                  ))}
                </ul>
                {result.chunksUsed.length > 0 && (
                  <details className="mt-4 rounded-xl border border-[var(--glass-border)] p-3 text-xs text-[var(--ink-muted)]">
                    <summary className="cursor-pointer font-semibold text-[var(--ink)]">
                      {lang === "es"
                        ? `Fragmentos RAG (${result.chunksUsed.length})`
                        : `RAG chunks (${result.chunksUsed.length})`}
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {result.chunksUsed.map((c) => (
                        <li key={c.id}>
                          <strong className="text-[var(--ink)]">{c.title}</strong>
                          <span className="block opacity-80">{c.sourceLabel}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                  </>
                ) : null}
              </>
            )}
            <p className="mt-5 flex items-start gap-2 rounded-xl bg-[var(--glass)] p-3 text-xs text-[var(--ink-muted)]">
              <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0" />
              {lang === "es"
                ? "Si no hay dato, decir “no está en el sistema” — no inventar. Nunca responde al viajero."
                : "If data is missing, say “not in the system” — never invent. Never answers the traveler."}
            </p>
          </Card>
        </div>
      )}

      {tab === "docs" && (
        <div className="grid gap-5 lg:grid-cols-5">
          <Card
            title={lang === "es" ? "Registrar documento" : "Register document"}
            subtitle={
              lang === "es"
                ? "PDF (pega extracto), rutas, precios, costes, contratos, hoteles, proveedores, histórico"
                : "PDF (paste extract), routes, prices, costs, contracts, hotels, suppliers, history"
            }
            className="lg:col-span-2"
          >
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase text-[var(--ink-muted)]">
                {lang === "es" ? "Título" : "Title"}
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-2 text-sm font-normal normal-case text-[var(--ink)]"
                  value={docForm.title}
                  onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                />
              </label>
              <label className="block text-xs font-semibold uppercase text-[var(--ink-muted)]">
                {lang === "es" ? "Tipo" : "Kind"}
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-2 text-sm font-normal normal-case text-[var(--ink)]"
                  value={docForm.kind}
                  onChange={(e) =>
                    setDocForm({ ...docForm, kind: e.target.value as KnowledgeDocKind })
                  }
                >
                  {(Object.keys(KNOWLEDGE_KIND_LABEL) as KnowledgeDocKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KNOWLEDGE_KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold uppercase text-[var(--ink-muted)]">
                {lang === "es" ? "Archivo / ref (PDF…)" : "File / ref (PDF…)"}
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-2 text-sm font-normal normal-case text-[var(--ink)]"
                  value={docForm.fileRef}
                  onChange={(e) => setDocForm({ ...docForm, fileRef: e.target.value })}
                  placeholder="Mongolia_2025_costes.pdf"
                />
              </label>
              <label className="block text-xs font-semibold uppercase text-[var(--ink-muted)]">
                Tags
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-2 text-sm font-normal normal-case text-[var(--ink)]"
                  value={docForm.tags}
                  onChange={(e) => setDocForm({ ...docForm, tags: e.target.value })}
                  placeholder="mongolia, 2025, coste"
                />
              </label>
              <label className="block text-xs font-semibold uppercase text-[var(--ink-muted)]">
                {lang === "es" ? "Contenido indexable" : "Indexable content"}
                <textarea
                  rows={8}
                  className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-2 text-sm font-normal normal-case text-[var(--ink)]"
                  value={docForm.content}
                  onChange={(e) => setDocForm({ ...docForm, content: e.target.value })}
                  placeholder={
                    lang === "es"
                      ? "Pega el extracto del PDF o ficha…"
                      : "Paste PDF extract or sheet…"
                  }
                />
              </label>
              <button
                type="button"
                onClick={addDoc}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                {lang === "es" ? "Indexar en Knowledge" : "Index in Knowledge"}
              </button>
            </div>
          </Card>

          <Card
            title={lang === "es" ? "Documentos indexados" : "Indexed documents"}
            className="lg:col-span-3"
          >
            <ul className="max-h-[560px] space-y-2 overflow-y-auto">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[var(--ink)]">{d.title}</p>
                      <p className="mt-1 text-xs text-[var(--ink-muted)]">
                        {KNOWLEDGE_KIND_LABEL[d.kind]}
                        {d.fileRef ? ` · ${d.fileRef}` : ""} · {d.source}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => persistDocs(deleteKnowledgeDoc(docs, d.id))}
                      className="text-xs font-semibold text-[var(--danger)] underline"
                    >
                      {lang === "es" ? "Eliminar" : "Delete"}
                    </button>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-[var(--ink-muted)]">{d.content}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[var(--ink-muted)]">
              {lang === "es"
                ? "Además se indexan en vivo: expediciones, reservas (hoteles/proveedores), facturas y el playbook."
                : "Also live-indexed: expeditions, bookings (hotels/suppliers), invoices and the playbook."}
            </p>
          </Card>
        </div>
      )}

      {tab === "playbook" && (
        <>
          <Card title={t(lang, "knowledge_q")}>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {cats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCat(c.id);
                    setActive(0);
                  }}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-semibold",
                    cat === c.id
                      ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--ink)]"
                      : "border-[var(--glass-border)] text-[var(--ink-muted)]",
                  )}
                >
                  {c.label}
                </button>
              ))}
              <Badge tone="brand">
                {filtered.length} {lang === "es" ? "preguntas" : "questions"}
              </Badge>
            </div>
          </Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title={lang === "es" ? "Cola de preguntas" : "Question queue"}>
              <ul className="max-h-[520px] space-y-2 overflow-y-auto">
                {filtered.map((k, i) => (
                  <li key={k.q}>
                    <button
                      type="button"
                      onClick={() => setActive(i)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-3 text-left text-sm transition",
                        active === i
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                          : "border-[var(--glass-border)] bg-[var(--glass)] text-[var(--ink)] hover:bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]",
                      )}
                    >
                      <span className="mb-1 block text-[10px] font-semibold uppercase opacity-80">
                        {k.category}
                      </span>
                      {k.q}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
            {item && (
              <Card title={t(lang, "knowledge_a")}>
                <p className="text-sm leading-relaxed text-[var(--ink)]">{item.a}</p>
                <button
                  type="button"
                  onClick={() => {
                    setTab("ask");
                    void runAsk(item.q);
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-strong)] px-3 py-2 text-sm font-semibold text-[var(--ink)]"
                >
                  <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                  {lang === "es"
                    ? aiReady()
                      ? `Preguntar con IA + heurística (${providerLabel()})`
                      : "Preguntar con heurística (docs + Hub)"
                    : aiReady()
                      ? `Ask with AI + heuristic (${providerLabel()})`
                      : "Ask with heuristic (docs + Hub)"}
                </button>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  {lang === "es" ? "Por qué importa" : "Why it matters"}
                </p>
                <ul className="mt-2 space-y-2">
                  {item.why.map((w) => (
                    <li
                      key={w}
                      className="flex gap-2 rounded-lg border border-[var(--glass-border)] px-3 py-2 text-sm text-[var(--ink)]"
                    >
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                      {w}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  {t(lang, "sources")}
                </p>
                <ul className="mt-2 space-y-1">
                  {item.sources.map((s) => (
                    <li key={s} className="flex items-center gap-2 text-sm text-[var(--ink)]">
                      <BookOpen className="h-4 w-4 text-[var(--accent)]" />
                      {s}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AutomationsPanel({ lang }: { lang: Lang }) {
  return <AutomationsEcosystemPanel lang={lang} />;
}

function ProposalPanel({ lang }: { lang: Lang }) {
  const es = lang === "es";
  const hub = useDataHub();
  const businessKpis = useMemo(
    () =>
      computeBusinessKpis(lang, {
        leads: hub.leads,
        clients: hub.clients,
        expeditions: EXPEDITIONS,
        hubUpdatedAt: hub.meta?.updatedAt ?? null,
      }),
    [lang, hub.leads, hub.clients, hub.meta?.updatedAt],
  );

  return (
    <div className="space-y-5">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
          {es ? "Propuesta para el fundador" : "Proposal for the founder"} · {COMPANY.name}
        </p>
        <h2 className="mt-2 font-[family-name:var(--mps-display)] text-3xl text-[var(--ink)]">
          {es
            ? "Menos caos en el día a día. Más tiempo para vender y acompañar."
            : "Less daily chaos. More time to sell and care for travellers."}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--ink-muted)] md:text-base">
          {es ? (
            <>
              <strong className="text-[var(--ink)]">{COMPANY.ceo}</strong>, esto no es «más software».
              Es un sistema interno para que Campo Norte sepa de dónde vienen los clientes, a quién llamar
              hoy, y cuánto deja cada salida — sin que ninguna máquina hable con el viajero.{" "}
              <strong className="text-[var(--ink)]">{GOLDEN_RULE}</strong>
            </>
          ) : (
            <>
              <strong className="text-[var(--ink)]">{COMPANY.ceo}</strong>, this is not “more software”.
              It’s an internal system so Campo Norte knows where clients come from, who to call today, and
              what each departure earns — without any machine messaging the traveller.{" "}
              <strong className="text-[var(--ink)]">{GOLDEN_RULE}</strong>
            </>
          )}
        </p>
        <p className="mt-3 text-sm italic text-[var(--accent)]">«{COMPANY.tagline}»</p>
      </Card>

      <Card title={es ? "El problema, en cristiano" : "The problem, plainly"}>
        <ul className="space-y-3 text-sm leading-relaxed text-[var(--ink)] md:text-base">
          {(es
            ? [
                "Los datos viven en Excel, el correo de Sofía y la newsletter. Nadie ve el negocio entero en una sola pantalla.",
                "No sabemos de verdad de dónde llega cada interesado (web, recomendación, email…). Sin eso, no se puede mejorar lo que funciona.",
                "Sofía pierde muchas horas ordenando leads, haciendo seguimiento y pensando contenido — tiempo que debería ir a cerrar viajes y cuidar clientes.",
              ]
            : [
                "Data lives in sheets, Sofía's inbox and the newsletter. Nobody sees the whole business on one screen.",
                "We don’t really know where each lead comes from (web, referral, email…). Without that, you can’t double down on what works.",
                "Sofía burns hours sorting leads, chasing follow-ups and drafting content — time that should go to closing trips and caring for clients.",
              ]
          ).map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {(es
          ? [
              [
                "1 · Orden",
                "Una sola base del negocio",
                "Leads, clientes y reservas en el mismo sitio. Sabemos el origen de casi todos los interesados.",
              ],
              [
                "2 · Prioridad",
                "A quién llamar hoy",
                "El sistema ordena leads y clientes dormidos. Sofía o Marta llaman; la máquina solo prepara la lista.",
              ],
              [
                "3 · Claridad",
                "Números para decidir",
                "Cuánto falta para el millón, ocupación por salida y margen por ruta — actualizado cada día.",
              ],
            ]
          : [
              [
                "1 · Order",
                "One place for the business",
                "Leads, clients and bookings together. We know where almost every prospect came from.",
              ],
              [
                "2 · Priority",
                "Who to call today",
                "The system ranks leads and dormant clients. Sofía or Marta call; the machine only prepares the list.",
              ],
              [
                "3 · Clarity",
                "Numbers to decide",
                "Gap to €1M, occupancy per departure and margin per route — updated every day.",
              ],
            ]
        ).map(([phase, title, body]) => (
          <Card key={title}>
            <Badge tone="brand">{phase}</Badge>
            <p className="mt-3 font-semibold text-[var(--ink)]">{title}</p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">{body}</p>
          </Card>
        ))}
      </div>

      <Card
        title={es ? "Lo que Sofía mide en 6 meses" : "What Sofía measures in 6 months"}
        subtitle={
          es
            ? "Metas de negocio (no de tecnología). Los números vivos salen del Hub."
            : "Business goals (not tech goals). Live numbers come from the Hub."
        }
      >
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {businessKpis.map((k) => (
            <li
              key={k.id}
              className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--ink)]">{k.title}</p>
                <Badge tone={k.tone}>{k.display}</Badge>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">{k.detail}</p>
              {k.target != null && k.current != null && k.unit === "pct" && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--ink)_10%,transparent)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{
                      width: `${Math.min(100, Math.round((k.current / k.target) * 100))}%`,
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card title={es ? "Las primeras 2–4 semanas (en cristiano)" : "First 2–4 weeks (plainly)"}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-4">
            <p className="flex items-center gap-2 font-semibold text-[var(--ink)]">
              <Zap className="h-4 w-4 text-[var(--accent)]" />{" "}
              {es ? "Qué tienes en la mano" : "What you get"}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--ink-muted)]">
              {(es
                ? [
                    "Todos los interesados y clientes juntos (traídos del Excel / newsletter)",
                    "En cada ficha: «¿de dónde vino esta persona?»",
                    "Cada semana: lista de los 15 más calientes + quienes hace tiempo no viajan",
                  ]
                : [
                    "All prospects and clients together (from sheets / newsletter)",
                    "On every record: “where did this person come from?”",
                    "Each week: top 15 hot leads + people who haven’t travelled in a while",
                  ]
              ).map((li) => (
                <li key={li}>{li}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-4">
            <p className="flex items-center gap-2 font-semibold text-[var(--ink)]">
              <Target className="h-4 w-4 text-[var(--accent)]" />{" "}
              {es ? "Cómo notarás que funciona" : "How you’ll know it works"}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--ink-muted)]">
              {(es
                ? [
                    "En las reuniones ya no preguntáis «¿esto de dónde salió?»",
                    "Sofía trabaja una lista corta, no el buzón entero",
                    "Marta o Sofía llaman de verdad a esa lista (persona, no robot)",
                  ]
                : [
                    "Meetings stop asking “where did this come from?”",
                    "Sofía works a short list, not the whole inbox",
                    "Marta or Sofía actually call that list (a person, not a bot)",
                  ]
              ).map((li) => (
                <li key={li}>{li}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card title={es ? "Quién está en la mesa" : "Who’s at the table"}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {TEAM.map((person) => (
            <li
              key={person.name}
              className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm"
            >
              <span className="font-semibold text-[var(--ink)]">{person.name}</span>
              <span className="text-[var(--ink-muted)]"> — {person.role}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={es ? "Lo que no negociamos" : "What we don’t negotiate"}>
        <p className="text-sm leading-relaxed text-[var(--ink)] md:text-base">
          {es ? (
            <>
              Ningún sistema escribe al viajero. Ni WhatsApp automático, ni email robot, ni chat.
              La tecnología ordena, avisa al equipo y prepara borradores.{" "}
              <strong>Quien firma la relación con el cliente es siempre una persona de Campo Norte.</strong>
            </>
          ) : (
            <>
              No system writes to the traveller. No auto-WhatsApp, no robot email, no chatbot. Tech
              sorts, alerts the team and drafts copy.{" "}
              <strong>A Campo Norte person always owns the client relationship.</strong>
            </>
          )}
        </p>
      </Card>

      <Card title={es ? "Mensaje de cierre (entrevista)" : "Closing line (interview)"}>
        <p className="text-sm leading-relaxed text-[var(--ink)] md:text-base">
          {es ? (
            <>
              No vengo a sustituir el trato humano que hace única a Campo Norte. Vengo a quitaros de encima
              el trabajo repetitivo de detrás: ordenar leads, recordar a quién llamar, ver el margen
              y preparar textos. Así Sofía y el equipo pueden dedicar más horas a lo que de verdad
              vende: <strong>confianza, camino y experiencia premium</strong>.
            </>
          ) : (
            <>
              I’m not here to replace the human care that makes Campo Norte unique. I’m here to take the
              repetitive backstage work off your plate: sorting leads, remembering who to call,
              seeing margin and drafting copy. So Sofía and the team spend more hours on what
              actually sells: <strong>trust, the road and a premium experience</strong>.
            </>
          )}
        </p>
      </Card>

      <Card
        title={es ? "Números del caso (transparentes)" : "Case numbers (transparent)"}
        subtitle={
          es
            ? "Cifras del business case / demo. Si alguna no cuadra con la realidad, se ajusta en la primera semana."
            : "Figures from the business case / demo. If any don’t match reality, we adjust in week one."
        }
      >
        <ul className="space-y-2">
          {MPS_ASSUMPTIONS.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-2 text-sm"
            >
              <span className="font-semibold text-[var(--ink)]">{a.label}:</span>{" "}
              <span className="text-[var(--accent)]">{a.value}</span>
              <span className="text-[var(--ink-muted)]"> — {a.rationale}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/** Carrusel de capturas retirado: el deck ajeno ya no forma parte del repo público. */
function SlidesPanel({ lang }: { lang: Lang }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Card
        title={lang === "es" ? "Presentación" : "Presentation"}
        subtitle={
          lang === "es"
            ? "Campo Norte · Growth OS (demo ficticia)"
            : "Campo Norte · Growth OS (fictional demo)"
        }
      >
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
          {lang === "es"
            ? "Las capturas y el PDF del business case anterior se retiraron del repositorio. Usa la sección «Presentación» del menú para el pitch en texto de la demo Campo Norte (datos y personas ficticias)."
            : "Previous business-case captures and PDF were removed from the repository. Use the «Presentation» menu section for the Campo Norte demo pitch (fictional data and people)."}
        </p>
      </Card>
    </div>
  );
}

export function MpsCrmApp() {
  const { user } = useAuth();
  const [section, setSection] = useState<Section>("dashboard");
  const [lang, setLang] = useState<Lang>("es");
  const [prefs, setPrefs] = useState<UserPrefs>(() => loadUserPrefs(user?.id));
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [aiSnap, setAiSnap] = useState(() => loadAiSettings());
  const hub = useDataHub();
  const isMobile = useIsMobile();
  const role = user?.role ?? "guide";
  const theme = prefs.theme;
  const showUsersNav = canManageCrmUsers(role);
  const visibleNav = NAV_IDS.filter((item) => canAccessSection(role, item.id));
  const aiConnected = aiReady(aiSnap);
  const aiStatusLabel = `${providerLabel(aiSnap)}: ${aiConnected ? "ON" : "OFF"}`;

  useEffect(() => {
    const syncAi = () => setAiSnap(loadAiSettings());
    syncAi();
    const id = window.setInterval(syncAi, 2500);
    window.addEventListener("storage", syncAi);
    window.addEventListener("focus", syncAi);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("storage", syncAi);
      window.removeEventListener("focus", syncAi);
    };
  }, [section]);

  const sectionPanels = (
    <>
      {section === "hub" && <HubPanel lang={lang} />}
      {section === "dashboard" && <WmsDashboardPanel lang={lang} />}
      {section === "stock" && <WmsStockPanel lang={lang} />}
      {section === "huecos" && <WmsSlotsPanel lang={lang} />}
      {section === "picking" && <WmsPickingPanel lang={lang} />}
      {section === "palets" && <WmsPalletsPanel lang={lang} />}
      {section === "flota" && <WmsFleetPanel lang={lang} />}
      {section === "recepcion" && <WmsInboundPanel lang={lang} />}
      {section === "expedicion" && <WmsOutboundPanel lang={lang} />}
      {section === "operarios" && <WmsOperatorsPanel lang={lang} />}
      {section === "costes" && <WmsCostsPanel lang={lang} />}
      {section === "leads" && <LeadsPanel lang={lang} />}
      {section === "clientes" && <ClientsPanel lang={lang} />}
      {section === "reservas" && <ReservationsPanel lang={lang} />}
      {section === "facturas" && <InvoicesVerifactuPanel lang={lang} />}
      {section === "tesoreria" && <TreasurySection lang={lang} />}
      {section === "aprobaciones" && <ApprovalsSection lang={lang} />}
      {section === "equipo" && <TeamSection lang={lang} />}
      {section === "contenido" && <ContentFactoryPanel lang={lang} />}
      {section === "conocimiento" && <KnowledgePanel lang={lang} />}
      {section === "automatizaciones" && <AutomationsPanel lang={lang} />}
      {section === "propuesta" && <ProposalPanel lang={lang} />}
      {section === "slides" && <SlidesPanel lang={lang} />}
      {section === "ajustes" && <SettingsPanel lang={lang} onPrefsChange={setPrefs} />}
      {section === "usuarios" && <UsersDirectoryPanel lang={lang} />}
    </>
  );

  useEffect(() => {
    const next = loadUserPrefs(user?.id);
    setPrefs(next);
    applyUserPrefsToDocument(next);
  }, [user?.id]);

  useEffect(() => {
    applyUserPrefsToDocument(prefs);
  }, [prefs]);

  useEffect(() => {
    if (!canAccessSection(role, section)) {
      setSection("dashboard");
    }
  }, [role, section]);

  useEffect(() => {
    if (!user) return;
    const kind = sectionToAccessEvent(section);
    if (!kind) return;
    void trackAccess(kind, user, section);
  }, [section, user]);

  useEffect(() => {
    function onNavigateEvent(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (detail && canAccessSection(role, detail as Section)) {
        setSection(detail as Section);
      }
    }
    window.addEventListener("mps-navigate", onNavigateEvent);
    return () => window.removeEventListener("mps-navigate", onNavigateEvent);
  }, [role]);

  function setTheme(next: Theme) {
    if (!user) return;
    const updated = { ...prefs, theme: next };
    setPrefs(updated);
    saveUserPrefs(user.id, updated);
    applyUserPrefsToDocument(updated);
  }

  if (!hub.ready) {
    return (
      <div className="mps-crm mps-bg flex min-h-screen items-center justify-center text-[var(--ink)]">
        <p className="text-sm text-[var(--ink-muted)]">
          {lang === "es" ? "Cargando base de datos…" : "Loading Data Hub…"}
        </p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="mps-crm mps-bg relative min-h-[100dvh]">
        <MobileCrmShell
          lang={lang}
          section={section}
          onNavigate={setSection}
          onOpenProfile={() => setProfileOpen(true)}
          onLangChange={setLang}
          prefs={prefs}
          onPrefsChange={setPrefs}
        >
          {sectionPanels}
          <AiAssistantHost lang={lang} />
        </MobileCrmShell>
        {user && (
          <ProfileModal
            open={profileOpen}
            onClose={() => setProfileOpen(false)}
            subject={user}
            role={user.role}
            lang={lang === "es" ? "es" : "en"}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mps-crm mps-bg relative min-h-screen">
      <aside
        className={cn(
          "glass-sidebar fixed inset-y-0 left-0 z-40 flex flex-col transition-[width]",
          collapsed ? "w-[80px]" : "w-[240px]",
        )}
      >
        <div className={cn("border-b border-white/10", collapsed ? "px-2 py-3" : "px-3 py-4")}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-[var(--accent)] text-center shadow-md"
                title="Campo Norte"
              >
                <span className="font-[family-name:var(--mps-display)] text-base leading-none font-bold text-white">
                  CN
                </span>
                <span className="mt-0.5 text-[8px] font-bold tracking-[0.12em] text-white/95">
                  NORTE
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="rounded-lg border border-white/20 bg-white/10 p-1.5 text-white hover:bg-white/20"
                aria-label="Expandir menú"
                title="Expandir menú"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5 px-1">
                <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--accent)] text-center shadow-md">
                  <span className="font-[family-name:var(--mps-display)] text-sm leading-none font-bold text-white">
                    CN
                  </span>
                  <span className="mt-0.5 text-[7px] font-bold tracking-[0.12em] text-white/95">
                    NORTE
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-[family-name:var(--mps-display)] text-xl tracking-tight text-white">
                    Campo Norte
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--sidebar-muted)]">
                    {t(lang, "brand_sub")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="shrink-0 rounded-lg border border-white/20 bg-white/10 p-1.5 text-white hover:bg-white/20"
                aria-label="Compactar menú"
                title="Compactar menú"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto p-2">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            const navPill = (isActive: boolean) =>
              cn(
                "flex w-full items-center justify-start gap-2 rounded-full border px-3 py-2.5 text-left text-sm font-medium transition",
                collapsed && "justify-center px-2",
                isActive
                  ? "border-[color-mix(in_oklab,var(--accent)_60%,transparent)] bg-[color-mix(in_oklab,var(--accent)_32%,transparent)] text-white shadow-[0_0_14px_color-mix(in_oklab,var(--accent)_28%,transparent)]"
                  : "border-transparent bg-transparent text-slate-200 hover:bg-white/10 hover:text-white",
              );
            if (item.id === "ajustes") {
              const usersActive = section === "usuarios";
              return (
                <div key={item.id} className="space-y-1.5">
                  <button
                    type="button"
                    title={t(lang, item.labelKey)}
                    onClick={() => setSection("ajustes")}
                    className={navPill(active)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <span className="min-w-0 flex-1 truncate text-left">
                        {t(lang, item.labelKey)}
                      </span>
                    )}
                  </button>
                  {showUsersNav && !collapsed && (
                    <button
                      type="button"
                      onClick={() => setSection("usuarios")}
                      className={cn(navPill(usersActive), "py-2 pl-4 text-xs")}
                    >
                      <UsersRound className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-left">
                        {t(lang, "nav_users")}
                      </span>
                    </button>
                  )}
                  {showUsersNav && collapsed && (
                    <button
                      type="button"
                      title={t(lang, "nav_users")}
                      onClick={() => setSection("usuarios")}
                      className={navPill(usersActive)}
                    >
                      <UsersRound className="h-4 w-4 shrink-0" />
                    </button>
                  )}
                </div>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                title={t(lang, item.labelKey)}
                onClick={() => setSection(item.id)}
                className={navPill(active)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <span className="min-w-0 flex-1 truncate text-left">
                    {t(lang, item.labelKey)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 space-y-1.5 border-t border-white/10 p-2">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2.5 py-1">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  aiConnected
                    ? "bg-[var(--ok)] animate-[notif-blink_1.05s_ease-in-out_infinite]"
                    : "bg-[var(--danger)] opacity-80",
                )}
                title={aiStatusLabel}
                aria-label={aiStatusLabel}
              />
              <button
                type="button"
                title={lang === "es" ? "Soporte" : "Support"}
                onClick={() => setSupportOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                <CircleHelp className="h-4 w-4" />
              </button>
              <AppleSwitch
                size="sm"
                checked={theme === "dark"}
                label={t(lang, "theme_dark")}
                onChange={(on) => setTheme(on ? "dark" : "light")}
              />
              <AppleSwitch
                size="sm"
                checked={lang === "en"}
                label={lang === "es" ? "English" : "Español"}
                onChange={(on) => setLang(on ? "en" : "es")}
              />
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSection("ajustes")}
                className="flex w-full items-center justify-start gap-2 rounded-full px-3 py-2 text-left transition hover:bg-white/5"
                title={
                  lang === "es" ? "Ir a ajustes de IA" : "Go to AI settings"
                }
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    aiConnected
                      ? "bg-[var(--ok)] animate-[notif-blink_1.05s_ease-in-out_infinite]"
                      : "bg-[var(--danger)] opacity-90",
                  )}
                />
                <span
                  className={cn(
                    "truncate text-left text-xs font-medium",
                    aiConnected ? "text-slate-200" : "text-slate-400",
                  )}
                >
                  {aiStatusLabel}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSupportOpen(true)}
                className="flex w-full items-center justify-start gap-2 rounded-full border border-transparent bg-transparent px-3 py-2.5 text-left text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                <CircleHelp className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-left">
                  {lang === "es" ? "Soporte" : "Support"}
                </span>
              </button>

              <div className="flex items-center gap-2 rounded-full px-3 py-2">
                {theme === "dark" ? (
                  <Moon className="h-4 w-4 shrink-0 text-slate-200" />
                ) : (
                  <Sun className="h-4 w-4 shrink-0 text-slate-200" />
                )}
                <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-200">
                  {theme === "dark" ? t(lang, "theme_dark") : t(lang, "theme_light")}
                </span>
                <AppleSwitch
                  size="sm"
                  checked={theme === "dark"}
                  label={t(lang, "theme_dark")}
                  onChange={(on) => setTheme(on ? "dark" : "light")}
                />
              </div>
              <div className="flex items-center gap-2 rounded-full px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-left text-sm font-medium uppercase tracking-wide text-slate-200">
                  {lang === "es" ? "ES" : "EN"} · {t(lang, "lang")}
                </span>
                <AppleSwitch
                  size="sm"
                  checked={lang === "en"}
                  label={lang === "es" ? "English" : "Español"}
                  onChange={(on) => setLang(on ? "en" : "es")}
                />
              </div>
            </>
          )}
        </div>
      </aside>

      <div
        className={cn(
          "relative min-h-screen transition-[margin]",
          collapsed ? "ml-[80px]" : "ml-[240px]",
        )}
      >
        <AppHeader
          title={
            section === "usuarios"
              ? t(lang, "nav_users")
              : t(lang, NAV_IDS.find((n) => n.id === section)?.labelKey ?? "nav_hub")
          }
          subtitle={t(lang, "internal_only")}
          hubBadge={
            hub.mode === "supabase"
              ? t(lang, "live_badge_supabase")
              : hub.meta?.seededFromDemo
                ? t(lang, "live_badge_local_seed")
                : t(lang, "live_badge_local")
          }
          onRefresh={async () => {
            await hub.refresh();
            setAiSnap(loadAiSettings());
          }}
          onNavigate={(s) => setSection(s)}
          onOpenProfile={() => setProfileOpen(true)}
        />

        <main className="px-4 py-5 md:px-6 md:py-6">
          {sectionPanels}
          <AiAssistantHost lang={lang} />

          <footer className="mt-8 flex flex-wrap items-center gap-2 border-t border-[var(--glass-border)] pt-4 text-xs text-[var(--ink-muted)]">
            <Lightbulb className="h-3.5 w-3.5" />
            {t(lang, "footer")} · {COMPANY.legal}
            <span className="mx-1">·</span>
            <a href="/legal#aviso" className="hover:text-[var(--accent)] hover:underline">
              {lang === "es" ? "Aviso legal" : "Legal notice"}
            </a>
            <a href="/legal#privacidad" className="hover:text-[var(--accent)] hover:underline">
              {lang === "es" ? "Privacidad" : "Privacy"}
            </a>
            <a href="/legal#cookies" className="hover:text-[var(--accent)] hover:underline">
              Cookies
            </a>
          </footer>
        </main>

        {user && (
          <ProfileModal
            open={profileOpen}
            onClose={() => setProfileOpen(false)}
            subject={user}
            role={user.role}
            lang={lang === "es" ? "es" : "en"}
          />
        )}
        <SupportModal
          open={supportOpen}
          onClose={() => setSupportOpen(false)}
          lang={lang}
        />
      </div>
    </div>
  );
}

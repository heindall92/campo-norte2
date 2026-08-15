import type { AutomationJob } from "./demo-data";
import { AUTOMATIONS } from "./demo-data";

/** Módulos del CRM a los que se puede vincular un nodo / flujo */
export type CrmModule =
  | "data_hub"
  | "leads"
  | "clientes"
  | "reservas"
  | "facturas"
  | "pagos"
  | "contenido"
  | "conocimiento"
  | "dashboard"
  | "gestoria"
  | "brevo"
  | "ninguno";

export type NodeKind =
  | "trigger"
  | "webhook"
  | "cron"
  | "http"
  | "form"
  | "set"
  | "if"
  | "switch"
  | "merge"
  | "delay"
  | "crm_lead"
  | "crm_client"
  | "crm_reserva"
  | "crm_factura"
  | "crm_pago"
  | "crm_content"
  | "score"
  | "notify"
  | "export"
  | "code";

export interface FlowNodeConfig {
  values: Record<string, string>;
  form: { key: string; label: string; type: string; required?: boolean }[];
  api: {
    method: string;
    url: string;
    headers: string;
    body: string;
  };
  /** Vinculación libre a entidad CRM */
  crmLink: {
    module: CrmModule;
    entityField: string;
    action: string;
  };
  notes: string;
  /** Color override (hex) */
  color?: string;
}

export interface FlowNode {
  id: string;
  kind: NodeKind;
  label: string;
  x: number;
  y: number;
  config: FlowNodeConfig;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface FlowGraph {
  id: string;
  automationId: string;
  name: string;
  status: AutomationJob["status"];
  description: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  updatedAt: string;
  /** Personalización de flujo */
  enabled: boolean;
  tags: string[];
  priority: "alta" | "media" | "baja";
  schedule: string;
  crmModules: CrmModule[];
}

export const CRM_MODULE_LABEL: Record<CrmModule, string> = {
  data_hub: "Data Hub",
  leads: "Lead Intelligence",
  clientes: "Customer Intelligence",
  reservas: "Reservas & logística",
  facturas: "Facturas · Veri*FACTU",
  pagos: "Cobros / pasarelas",
  contenido: "Content Factory",
  conocimiento: "Knowledge",
  dashboard: "Dashboard",
  gestoria: "Export gestoría",
  brevo: "Brevo",
  ninguno: "— Sin vínculo —",
};

export const NODE_KIND_LABEL: Record<NodeKind, string> = {
  trigger: "Trigger manual",
  webhook: "Webhook",
  cron: "Cron / schedule",
  http: "HTTP / API",
  form: "Formulario",
  set: "Set values",
  if: "IF",
  switch: "Switch",
  merge: "Merge",
  delay: "Wait / delay",
  crm_lead: "CRM · Lead",
  crm_client: "CRM · Cliente",
  crm_reserva: "CRM · Reserva",
  crm_factura: "CRM · Factura",
  crm_pago: "CRM · Pago",
  crm_content: "CRM · Contenido",
  score: "Scoring",
  notify: "Aviso interno",
  export: "Export",
  code: "Code / expresión",
};

export const NODE_KIND_COLOR: Record<NodeKind, string> = {
  trigger: "#ea580c",
  webhook: "#c2410c",
  cron: "#d97706",
  http: "#2563eb",
  form: "#7c3aed",
  set: "#0f766e",
  if: "#ca8a04",
  switch: "#a16207",
  merge: "#64748b",
  delay: "#78716c",
  crm_lead: "#0369a1",
  crm_client: "#0e7490",
  crm_reserva: "#15803d",
  crm_factura: "#b45309",
  crm_pago: "#047857",
  crm_content: "#6d28d9",
  score: "#db2777",
  notify: "#4f46e5",
  export: "#334155",
  code: "#1e293b",
};

/** Paleta para personalizar nodos */
export const NODE_COLOR_PRESETS = [
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#ea580c",
  "#db2777",
  "#15803d",
  "#b45309",
  "#334155",
];

export function cfg(partial: Partial<FlowNodeConfig> = {}): FlowNodeConfig {
  return {
    values: partial.values ?? {},
    form: partial.form ?? [],
    api: partial.api ?? { method: "GET", url: "", headers: "{}", body: "" },
    crmLink: partial.crmLink ?? {
      module: "ninguno",
      entityField: "",
      action: "",
    },
    notes: partial.notes ?? "",
    color: partial.color,
  };
}

function buildGraphFor(a: AutomationJob, index: number): FlowGraph {
  const baseY = 90;
  const step = 190;
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  const moduleGuess: CrmModule =
    a.id === "A-01" || a.id === "A-02"
      ? "leads"
      : a.id === "A-04"
        ? "reservas"
        : a.id === "A-05"
          ? "pagos"
          : a.id === "A-06" || a.id === "A-10"
            ? "facturas"
            : a.id === "A-07"
              ? "clientes"
              : a.id === "A-08"
                ? "contenido"
                : a.id === "A-09"
                  ? "dashboard"
                  : a.id === "A-11"
                    ? "conocimiento"
                    : a.id === "A-03"
                      ? "brevo"
                      : "data_hub";

  nodes.push({
    id: `${a.id}-n1`,
    kind: index % 2 === 0 ? "webhook" : "cron",
    label: a.trigger.slice(0, 40),
    x: 40,
    y: baseY,
    config: cfg({
      values: { cadence: a.cadence, source: a.from },
      form:
        a.id === "A-01"
          ? [
              { key: "name", label: "Nombre", type: "text", required: true },
              { key: "email", label: "Email", type: "email", required: true },
              { key: "utm_source", label: "UTM", type: "text" },
            ]
          : [],
      api: {
        method: "POST",
        url: `https://hooks.internal/${a.id.toLowerCase()}`,
        headers: '{"Content-Type":"application/json"}',
        body: '{"event":"{{$json}}"}',
      },
      crmLink: { module: moduleGuess, entityField: "id", action: "on_event" },
      notes: a.note,
    }),
  });

  nodes.push({
    id: `${a.id}-n2`,
    kind: "set",
    label: "Mapear al Hub",
    x: 40 + step,
    y: baseY,
    config: cfg({
      values: {
        entity: moduleGuess,
        never_message_client: "true",
        payload: "={{$json}}",
      },
      crmLink: { module: "data_hub", entityField: "*", action: "upsert" },
    }),
  });

  const crmKind: NodeKind =
    moduleGuess === "leads"
      ? "crm_lead"
      : moduleGuess === "clientes"
        ? "crm_client"
        : moduleGuess === "reservas"
          ? "crm_reserva"
          : moduleGuess === "facturas"
            ? "crm_factura"
            : moduleGuess === "pagos"
              ? "crm_pago"
              : moduleGuess === "contenido"
                ? "crm_content"
                : moduleGuess === "brevo"
                  ? "http"
                  : a.id === "A-10"
                    ? "crm_factura"
                    : "score";

  nodes.push({
    id: `${a.id}-n3`,
    kind: crmKind,
    label: `Acción · ${CRM_MODULE_LABEL[moduleGuess]}`,
    x: 40 + step * 2,
    y: baseY,
    config: cfg({
      values: { target: a.to },
      api: {
        method: "POST",
        url: `https://hub.internal/api/${moduleGuess}`,
        headers: '{"Authorization":"Bearer {{$env.HUB_TOKEN}}"}',
        body: '{"data":"{{$json}}"}',
      },
      crmLink: { module: moduleGuess, entityField: "record", action: "write" },
      notes: a.arguments[0] ?? "",
    }),
  });

  nodes.push({
    id: `${a.id}-n4`,
    kind: "if",
    label: "¿OK?",
    x: 40 + step * 3,
    y: baseY,
    config: cfg({
      values: { condition: "={{$json.ok}} === true" },
      notes: a.neverDoes,
    }),
  });

  nodes.push({
    id: `${a.id}-n5`,
    kind: "notify",
    label: "Aviso interno",
    x: 40 + step * 4,
    y: baseY - 55,
    config: cfg({
      values: { channel: "internal", audience: "Sofía/Marta" },
      crmLink: { module: "ninguno", entityField: "", action: "notify_team" },
    }),
  });

  nodes.push({
    id: `${a.id}-n6`,
    kind: a.id === "A-10" ? "export" : "notify",
    label: a.id === "A-10" ? "CSV gestoría" : "Log / audit",
    x: 40 + step * 4,
    y: baseY + 70,
    config: cfg({
      crmLink: {
        module: a.id === "A-10" ? "gestoria" : "dashboard",
        entityField: "export",
        action: "write_file",
      },
    }),
  });

  for (let i = 0; i < 3; i++) {
    edges.push({ id: `${a.id}-e${i}`, from: nodes[i].id, to: nodes[i + 1].id });
  }
  edges.push({ id: `${a.id}-e3t`, from: nodes[3].id, to: nodes[4].id, label: "true" });
  edges.push({ id: `${a.id}-e3f`, from: nodes[3].id, to: nodes[5].id, label: "else" });

  return {
    id: `FLOW-${a.id}`,
    automationId: a.id,
    name: a.name,
    status: a.status,
    description: a.note,
    nodes,
    edges,
    updatedAt: new Date().toISOString().slice(0, 10),
    enabled: a.status !== "error",
    tags: [moduleGuess, "core", a.status],
    priority: a.id === "A-01" || a.id === "A-07" ? "alta" : "media",
    schedule: a.cadence,
    crmModules: [moduleGuess, "data_hub"],
  };
}

/** Catálogo de plantillas rápidas para crear muchas automatizaciones CRM */
export const FLOW_TEMPLATES: {
  id: string;
  name: string;
  description: string;
  modules: CrmModule[];
  build: () => FlowGraph;
}[] = [
  {
    id: "tpl-lead-capture",
    name: "Captura lead web → Hub",
    description: "Formulario + UTM + ficha lead + aviso owner",
    modules: ["leads", "data_hub"],
    build: () => templateChain("Lead web", "leads", "crm_lead"),
  },
  {
    id: "tpl-lead-ollama",
    name: "Formulario → Ollama → seguimiento",
    description:
      "Pipeline completo A-01: dedupe · score API Ollama · origen · dashboard · aviso · follow-up",
    modules: ["leads", "data_hub", "dashboard"],
    build: () => buildLeadCaptureOllamaFlow(),
  },
  {
    id: "tpl-dormido",
    name: "Cola dormidos → aviso Sofía",
    description: "Cron diario + score reactivación + notify (sin WA auto)",
    modules: ["clientes"],
    build: () => templateChain("Dormidos", "clientes", "crm_client", "cron"),
  },
  {
    id: "tpl-reserva-prep",
    name: "Reserva → checklist logística",
    description: "Al confirmar reserva: docs, lodges, contactos",
    modules: ["reservas"],
    build: () => templateChain("Prep viaje", "reservas", "crm_reserva"),
  },
  {
    id: "tpl-pago",
    name: "Webhook pago → saldo + factura",
    description: "Stripe/PayPal/SEPA → ficha + borrador REAV",
    modules: ["pagos", "facturas", "clientes"],
    build: () => templateChain("Cobro", "pagos", "crm_pago", "webhook"),
  },
  {
    id: "tpl-verifactu",
    name: "Factura → Veri*FACTU + gestoría",
    description: "Emitir, hash, clave 05, export CSV",
    modules: ["facturas", "gestoria"],
    build: () => templateChain("Veri*FACTU", "facturas", "crm_factura"),
  },
  {
    id: "tpl-content",
    name: "Cierre viaje → Content Factory",
    description: "Borrador NL/WA/RRSS para edición humana",
    modules: ["contenido", "reservas"],
    build: () => templateChain("Content", "contenido", "crm_content"),
  },
  {
    id: "tpl-brevo-sync",
    name: "Brevo opens → scoring",
    description: "Solo lectura Brevo → engagement en ficha",
    modules: ["brevo", "leads", "clientes"],
    build: () => templateChain("Brevo sync", "brevo", "score", "cron"),
  },
  {
    id: "tpl-ocupacion",
    name: "Ocupación → dashboard",
    description: "Cambio de plazas actualiza KPIs",
    modules: ["dashboard", "reservas"],
    build: () => templateChain("Ocupación", "dashboard", "crm_reserva"),
  },
  {
    id: "tpl-docs",
    name: "Docs pendientes → aviso office",
    description: "Detecta docs_pendientes y notifica a Marta",
    modules: ["reservas", "clientes"],
    build: () => templateChain("Docs", "reservas", "crm_reserva", "cron"),
  },
  {
    id: "tpl-blank",
    name: "Canvas en blanco",
    description: "Empieza desde cero y conecta lo que quieras",
    modules: ["ninguno"],
    build: () => emptyFlow("Flujo libre CRM"),
  },
];

function templateChain(
  name: string,
  module: CrmModule,
  kind: NodeKind,
  triggerKind: NodeKind = "webhook",
): FlowGraph {
  const id = `A-${Math.floor(200 + Math.random() * 700)}`;
  const n1 = newNode(triggerKind, 50, 100);
  n1.label = `${name} · start`;
  n1.config.crmLink = { module, entityField: "trigger", action: "start" };
  const n2 = newNode("set", 260, 100);
  n2.config.values = { module, map: "={{$json}}" };
  const n3 = newNode(kind, 470, 100);
  n3.config.crmLink = { module, entityField: "id", action: "upsert" };
  const n4 = newNode("notify", 680, 100);
  n4.config.values = { never_client: "true" };
  return {
    id: `FLOW-${id}`,
    automationId: id,
    name,
    status: "aviso",
    description: `Plantilla vinculada a ${CRM_MODULE_LABEL[module]}`,
    nodes: [n1, n2, n3, n4],
    edges: [
      { id: `${id}-e0`, from: n1.id, to: n2.id },
      { id: `${id}-e1`, from: n2.id, to: n3.id },
      { id: `${id}-e2`, from: n3.id, to: n4.id },
    ],
    updatedAt: new Date().toISOString().slice(0, 10),
    enabled: true,
    tags: [module, "template"],
    priority: "media",
    schedule: "manual / webhook",
    crmModules: [module],
  };
}

export function buildLeadCaptureOllamaFlow(): FlowGraph {
  const id = "A-01";
  const mk = (
    kind: NodeKind,
    label: string,
    x: number,
    y: number,
    notes: string,
    values: Record<string, string> = {},
  ): FlowNode => {
    const n = newNode(kind, x, y);
    n.label = label;
    n.config.notes = notes;
    n.config.values = values;
    n.config.crmLink = {
      module: kind === "score" || kind === "crm_lead" ? "leads" : kind === "notify" ? "leads" : "data_hub",
      entityField: "email",
      action: kind === "score" ? "ollama_classify" : kind === "crm_lead" ? "upsert" : "pipeline",
    };
    return n;
  };

  const n1 = mk(
    "webhook",
    "Formulario web",
    40,
    80,
    "Trigger Make/n8n · POST payload nombre/email/UTM/destino",
    { path: "/hooks/web-form", method: "POST" },
  );
  const n2 = mk(
    "crm_lead",
    "Crear Lead",
    240,
    80,
    "Alta en Data Hub · Lead Intelligence",
    { action: "create" },
  );
  const n3 = mk(
    "if",
    "Buscar duplicados",
    440,
    80,
    "Deduplica por email/teléfono · merge si existe",
    { field: "email", op: "exists_in_hub" },
  );
  const n4 = mk(
    "score",
    "Clasificar con IA (Ollama)",
    640,
    40,
    "API Ollama · score explicable · NUNCA escribe al viajero",
    { provider: "ollama", endpoint: "/api/ollama/chat" },
  );
  const n5 = mk(
    "set",
    "Añadir origen / UTM",
    640,
    160,
    "utm_source → origin CRM · campaña · medium",
    { map: "utm→origin" },
  );
  const n6 = mk(
    "http",
    "Actualizar Dashboard",
    840,
    80,
    "Persistir Hub → KPIs origen/score se refrescan solos",
    { target: "data_hub" },
  );
  const n7 = mk(
    "notify",
    "Avisar responsable",
    1040,
    40,
    "Notificación interna Sofía/Marta · sin canal al cliente",
    { never_client: "true" },
  );
  const n8 = mk(
    "delay",
    "Programar seguimiento",
    1040,
    160,
    "Cola seguimiento 4h (score≥80) o 24h · humano llama",
    { hours_high: "4", hours_std: "24" },
  );

  return {
    id: `FLOW-${id}`,
    automationId: id,
    name: "Captura web → Lead + Ollama + seguimiento",
    status: "ok",
    description:
      "Orquestación real en el CRM: formulario → lead → dedupe → score Ollama → origen → dashboard → aviso → seguimiento. Exportable a Make/n8n.",
    nodes: [n1, n2, n3, n4, n5, n6, n7, n8],
    edges: [
      { id: `${id}-e0`, from: n1.id, to: n2.id },
      { id: `${id}-e1`, from: n2.id, to: n3.id },
      { id: `${id}-e2`, from: n3.id, to: n4.id, label: "ok" },
      { id: `${id}-e3`, from: n3.id, to: n5.id, label: "merge" },
      { id: `${id}-e4`, from: n4.id, to: n5.id },
      { id: `${id}-e5`, from: n5.id, to: n6.id },
      { id: `${id}-e6`, from: n6.id, to: n7.id },
      { id: `${id}-e7`, from: n6.id, to: n8.id },
    ],
    updatedAt: new Date().toISOString().slice(0, 10),
    enabled: true,
    tags: ["leads", "ollama", "a-01", "webhook"],
    priority: "alta",
    schedule: "tiempo real · webhook",
    crmModules: ["leads", "data_hub", "dashboard"],
  };
}

export function buildInitialFlows(): FlowGraph[] {
  return AUTOMATIONS.map((a, i) =>
    a.id === "A-01" ? buildLeadCaptureOllamaFlow() : buildGraphFor(a, i),
  );
}

export function emptyFlow(name = "Nuevo flujo CRM"): FlowGraph {
  const id = `A-${String(Math.floor(100 + Math.random() * 800))}`;
  const n1 = newNode("trigger", 80, 120);
  const n2 = newNode("set", 300, 120);
  const n3 = newNode("crm_lead", 520, 120);
  return {
    id: `FLOW-${id}`,
    automationId: id,
    name,
    status: "aviso",
    description: "Flujo libre — personaliza nodos y vínculos CRM",
    nodes: [n1, n2, n3],
    edges: [
      { id: `${id}-e0`, from: n1.id, to: n2.id },
      { id: `${id}-e1`, from: n2.id, to: n3.id },
    ],
    updatedAt: new Date().toISOString().slice(0, 10),
    enabled: true,
    tags: ["custom"],
    priority: "media",
    schedule: "manual",
    crmModules: ["data_hub"],
  };
}

export function exportFlowJson(flow: FlowGraph) {
  const blob = new Blob([JSON.stringify(flow, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${flow.id}-${flow.name.replace(/\s+/g, "-").slice(0, 40)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAllFlowsJson(flows: FlowGraph[]) {
  const blob = new Blob([JSON.stringify({ version: 1, flows }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `camponorte-crm-flows-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function newNode(kind: NodeKind, x: number, y: number): FlowNode {
  const id = `N-${Date.now().toString(36)}-${Math.floor(Math.random() * 99)}`;
  const moduleDefault: CrmModule =
    kind === "crm_lead"
      ? "leads"
      : kind === "crm_client"
        ? "clientes"
        : kind === "crm_reserva"
          ? "reservas"
          : kind === "crm_factura"
            ? "facturas"
            : kind === "crm_pago"
              ? "pagos"
              : kind === "crm_content"
                ? "contenido"
                : kind === "export"
                  ? "gestoria"
                  : "ninguno";

  return {
    id,
    kind,
    label: NODE_KIND_LABEL[kind],
    x,
    y,
    config: cfg({
      values:
        kind === "set"
          ? { key: "value" }
          : kind === "if"
            ? { condition: "={{$json.ok}}" }
            : kind === "delay"
              ? { wait_minutes: "15" }
              : {},
      form:
        kind === "form"
          ? [{ key: "field", label: "Campo", type: "text", required: true }]
          : [],
      api:
        kind === "http" || kind === "webhook"
          ? {
              method: "POST",
              url: "https://hub.internal/api/",
              headers: "{}",
              body: "",
            }
          : { method: "GET", url: "", headers: "{}", body: "" },
      crmLink: {
        module: moduleDefault,
        entityField: moduleDefault === "ninguno" ? "" : "id",
        action: moduleDefault === "ninguno" ? "" : "upsert",
      },
      notes: "",
    }),
  };
}

export function cloneNode(node: FlowNode): FlowNode {
  return {
    ...structuredClone(node),
    id: `N-${Date.now().toString(36)}-c`,
    x: node.x + 36,
    y: node.y + 36,
    label: `${node.label} (copia)`,
  };
}

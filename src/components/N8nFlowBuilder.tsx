import {
  buildInitialFlows,
  cloneNode,
  CRM_MODULE_LABEL,
  emptyFlow,
  exportAllFlowsJson,
  exportFlowJson,
  FLOW_TEMPLATES,
  newNode,
  NODE_COLOR_PRESETS,
  NODE_KIND_COLOR,
  NODE_KIND_LABEL,
  type CrmModule,
  type FlowGraph,
  type FlowNode,
  type NodeKind,
} from "@/lib/flow-data";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Copy,
  Download,
  GitBranch,
  Link2,
  Pencil,
  Plus,
  Power,
  Save,
  Sparkles,
  Trash2,
  Unlink,
  Workflow,
} from "lucide-react";
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const KINDS = Object.keys(NODE_KIND_LABEL) as NodeKind[];
const CRM_MODULES = Object.keys(CRM_MODULE_LABEL) as CrmModule[];

function nodeCenter(n: FlowNode) {
  return { x: n.x + 90, y: n.y + 30 };
}

function nodeColor(n: FlowNode) {
  return n.config.color || NODE_KIND_COLOR[n.kind];
}

export function N8nFlowBuilder({ lang }: { lang: Lang }) {
  const [flows, setFlows] = useState<FlowGraph[]>(() => buildInitialFlows());
  const [activeId, setActiveId] = useState(() => buildInitialFlows()[0]?.id ?? "");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState(false);
  const [submenu, setSubmenu] = useState<"flows" | "templates" | "nodes" | "connect" | "inspector">(
    "flows",
  );
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [filterModule, setFilterModule] = useState<CrmModule | "all">("all");
  const [query, setQuery] = useState("");
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);

  const flow = useMemo(
    () => flows.find((f) => f.id === activeId) ?? flows[0],
    [flows, activeId],
  );

  const filteredFlows = useMemo(() => {
    return flows.filter((f) => {
      const modOk =
        filterModule === "all" ||
        f.crmModules.includes(filterModule) ||
        f.tags.includes(filterModule);
      const q = query.trim().toLowerCase();
      const textOk =
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.automationId.toLowerCase().includes(q) ||
        f.tags.some((t) => t.includes(q));
      return modOk && textOk;
    });
  }, [flows, filterModule, query]);

  const selected = flow?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  function updateFlow(patch: Partial<FlowGraph> | ((f: FlowGraph) => FlowGraph)) {
    if (!flow) return;
    setFlows((prev) =>
      prev.map((f) => {
        if (f.id !== flow.id) return f;
        return typeof patch === "function" ? patch(f) : { ...f, ...patch, updatedAt: new Date().toISOString().slice(0, 10) };
      }),
    );
  }

  function updateNode(nodeId: string, patch: Partial<FlowNode>) {
    updateFlow((f) => ({
      ...f,
      nodes: f.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
    }));
  }

  function updateNodeConfig(
    nodeId: string,
    patch: {
      values?: Record<string, string>;
      form?: FlowNode["config"]["form"];
      api?: Partial<FlowNode["config"]["api"]>;
      crmLink?: Partial<FlowNode["config"]["crmLink"]>;
      notes?: string;
      color?: string;
    },
  ) {
    updateFlow((f) => ({
      ...f,
      nodes: f.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          config: {
            ...n.config,
            values: patch.values ?? n.config.values,
            form: patch.form ?? n.config.form,
            notes: patch.notes ?? n.config.notes,
            color: patch.color ?? n.config.color,
            api: { ...n.config.api, ...(patch.api ?? {}) },
            crmLink: { ...n.config.crmLink, ...(patch.crmLink ?? {}) },
          },
        };
      }),
    }));
  }

  function onNodePointerDown(e: ReactPointerEvent, node: FlowNode) {
    e.stopPropagation();
    setSelectedEdgeId(null);

    if (submenu === "connect" || connectFrom) {
      if (!connectFrom) {
        setConnectFrom(node.id);
        setSelectedNodeId(node.id);
        return;
      }
      if (connectFrom !== node.id) {
        updateFlow((f) => ({
          ...f,
          edges: [
            ...f.edges,
            {
              id: `e-${connectFrom}-${node.id}-${Date.now().toString(36)}`,
              from: connectFrom,
              to: node.id,
              label: "",
            },
          ],
        }));
        setConnectFrom(null);
      }
      setSelectedNodeId(node.id);
      return;
    }

    setSelectedNodeId(node.id);
    setSubmenu("inspector");
    dragRef.current = { id: node.id, ox: e.clientX - node.x, oy: e.clientY - node.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onCanvasPointerMove(e: ReactPointerEvent) {
    const d = dragRef.current;
    if (!d || !flow) return;
    updateNode(d.id, {
      x: Math.max(8, e.clientX - d.ox),
      y: Math.max(8, e.clientY - d.oy),
    });
  }

  function onCanvasPointerUp() {
    dragRef.current = null;
  }

  function createFlow() {
    const f = emptyFlow(lang === "es" ? "Flujo libre CRM" : "Free CRM flow");
    setFlows((prev) => [f, ...prev]);
    setActiveId(f.id);
    setSelectedNodeId(f.nodes[0]?.id ?? null);
    setEditingMeta(true);
    setSubmenu("inspector");
  }

  function addFromTemplate(tplId: string) {
    const tpl = FLOW_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    const f = tpl.build();
    setFlows((prev) => [f, ...prev]);
    setActiveId(f.id);
    setSelectedNodeId(f.nodes[0]?.id ?? null);
    setSubmenu("inspector");
  }

  function duplicateFlow() {
    if (!flow) return;
    const copy: FlowGraph = {
      ...structuredClone(flow),
      id: `FLOW-COPY-${Date.now().toString(36)}`,
      name: `${flow.name} (copia)`,
      automationId: `A-${Math.floor(100 + Math.random() * 800)}`,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    setFlows((prev) => [copy, ...prev]);
    setActiveId(copy.id);
  }

  function deleteFlow() {
    if (!flow || flows.length <= 1) return;
    const next = flows.filter((f) => f.id !== flow.id);
    setFlows(next);
    setActiveId(next[0].id);
    setSelectedNodeId(null);
  }

  function addNode(kind: NodeKind) {
    if (!flow) return;
    const n = newNode(kind, 100 + (flow.nodes.length % 5) * 40, 140 + (flow.nodes.length % 4) * 50);
    updateFlow((f) => {
      const modules = new Set(f.crmModules);
      if (n.config.crmLink.module !== "ninguno") modules.add(n.config.crmLink.module);
      return { ...f, nodes: [...f.nodes, n], crmModules: [...modules] };
    });
    setSelectedNodeId(n.id);
    setSubmenu("inspector");
  }

  function duplicateSelectedNode() {
    if (!flow || !selected) return;
    const c = cloneNode(selected);
    updateFlow((f) => ({ ...f, nodes: [...f.nodes, c] }));
    setSelectedNodeId(c.id);
  }

  function removeSelectedNode() {
    if (!flow || !selectedNodeId) return;
    updateFlow((f) => ({
      ...f,
      nodes: f.nodes.filter((n) => n.id !== selectedNodeId),
      edges: f.edges.filter((e) => e.from !== selectedNodeId && e.to !== selectedNodeId),
    }));
    setSelectedNodeId(null);
  }

  function removeSelectedEdge() {
    if (!selectedEdgeId) return;
    updateFlow((f) => ({ ...f, edges: f.edges.filter((e) => e.id !== selectedEdgeId) }));
    setSelectedEdgeId(null);
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (Array.isArray(data.flows)) {
          setFlows((prev) => [...data.flows, ...prev]);
        } else if (data.nodes && data.edges) {
          const f = { ...data, id: `FLOW-IMP-${Date.now().toString(36)}` } as FlowGraph;
          setFlows((prev) => [f, ...prev]);
          setActiveId(f.id);
        }
      } catch {
        /* ignore bad file in demo */
      }
    };
    reader.readAsText(file);
  }

  if (!flow) return null;

  const ok = flows.filter((f) => f.status === "ok").length;
  const enabledCount = flows.filter((f) => f.enabled).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          [lang === "es" ? "Flujos" : "Flows", String(flows.length)],
          [lang === "es" ? "Activos" : "Enabled", String(enabledCount)],
          ["OK", `${ok}/${flows.length}`],
          [lang === "es" ? "Nodos" : "Nodes", String(flow.nodes.length)],
          [lang === "es" ? "Enlaces" : "Edges", String(flow.edges.length)],
        ].map(([k, v]) => (
          <div
            key={k}
            className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-strong)] p-3"
          >
            <p className="text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">{k}</p>
            <p className="mt-1 font-[family-name:var(--mps-display)] text-2xl text-[var(--ink)]">
              {v}
            </p>
          </div>
        ))}
      </div>

      {/* Submenú */}
      <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-strong)] p-3 shadow-[var(--shadow)]">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Workflow className="h-4 w-4 text-[var(--accent)]" />
          <p className="text-sm font-semibold text-[var(--ink)]">
            {lang === "es"
              ? "Submenú · automatizaciones libres vinculadas al CRM"
              : "Submenu · free CRM-linked automations"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={createFlow}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            {lang === "es" ? "Crear flujo libre" : "Create free flow"}
          </button>
          <button
            type="button"
            onClick={() => setSubmenu("templates")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-3 py-2 text-xs font-semibold text-[var(--ink)]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {lang === "es" ? "Plantillas CRM" : "CRM templates"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingMeta(true);
              setSubmenu("flows");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-3 py-2 text-xs font-semibold text-[var(--ink)]"
          >
            <Pencil className="h-3.5 w-3.5" />
            {lang === "es" ? "Personalizar flujo" : "Customize flow"}
          </button>
          <button
            type="button"
            onClick={duplicateFlow}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-3 py-2 text-xs font-semibold text-[var(--ink)]"
          >
            <GitBranch className="h-3.5 w-3.5" />
            {lang === "es" ? "Duplicar" : "Duplicate"}
          </button>
          <button
            type="button"
            onClick={() =>
              updateFlow({ enabled: !flow.enabled, status: flow.enabled ? "aviso" : "ok" })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-3 py-2 text-xs font-semibold text-[var(--ink)]"
          >
            <Power className="h-3.5 w-3.5" />
            {flow.enabled
              ? lang === "es"
                ? "Desactivar"
                : "Disable"
              : lang === "es"
                ? "Activar"
                : "Enable"}
          </button>
          <button
            type="button"
            onClick={() => exportFlowJson(flow)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-3 py-2 text-xs font-semibold text-[var(--ink)]"
          >
            <Download className="h-3.5 w-3.5" />
            JSON
          </button>
          <button
            type="button"
            onClick={() => exportAllFlowsJson(flows)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-3 py-2 text-xs font-semibold text-[var(--ink)]"
          >
            <Download className="h-3.5 w-3.5" />
            {lang === "es" ? "Exportar todos" : "Export all"}
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-3 py-2 text-xs font-semibold text-[var(--ink)]">
            {lang === "es" ? "Importar JSON" : "Import JSON"}
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJson(f);
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => updateFlow({ status: "ok", enabled: true })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-3 py-2 text-xs font-semibold text-[var(--ink)]"
          >
            <Save className="h-3.5 w-3.5" />
            {lang === "es" ? "Guardar" : "Save"}
          </button>
          <button
            type="button"
            onClick={deleteFlow}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 px-3 py-2 text-xs font-semibold text-rose-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {lang === "es" ? "Eliminar" : "Delete"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1 border-t border-[var(--glass-border)] pt-3">
          {(
            [
              ["flows", lang === "es" ? "Flujos" : "Flows"],
              ["templates", lang === "es" ? "Plantillas" : "Templates"],
              ["nodes", lang === "es" ? "Añadir nodos" : "Add nodes"],
              ["connect", lang === "es" ? "Conectar" : "Connect"],
              ["inspector", lang === "es" ? "Inspector" : "Inspector"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setSubmenu(id);
                if (id !== "connect") setConnectFrom(null);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold",
                submenu === id
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--glass)] text-[var(--ink-muted)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {submenu === "flows" && (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={lang === "es" ? "Buscar flujo…" : "Search flow…"}
                className="min-w-[160px] flex-1 rounded-lg border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1.5 text-sm text-[var(--ink)]"
              />
              <select
                value={filterModule}
                onChange={(e) => setFilterModule(e.target.value as CrmModule | "all")}
                className="rounded-lg border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1.5 text-xs text-[var(--ink)]"
              >
                <option value="all">{lang === "es" ? "Todos los módulos CRM" : "All CRM modules"}</option>
                {CRM_MODULES.filter((m) => m !== "ninguno").map((m) => (
                  <option key={m} value={m}>
                    {CRM_MODULE_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>

            {editingMeta && (
              <div className="grid gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-xs text-[var(--ink-muted)]">
                  {lang === "es" ? "Nombre" : "Name"}
                  <input
                    className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1.5 text-sm text-[var(--ink)]"
                    value={flow.name}
                    onChange={(e) => updateFlow({ name: e.target.value })}
                  />
                </label>
                <label className="text-xs text-[var(--ink-muted)]">
                  {lang === "es" ? "Descripción" : "Description"}
                  <input
                    className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1.5 text-sm text-[var(--ink)]"
                    value={flow.description}
                    onChange={(e) => updateFlow({ description: e.target.value })}
                  />
                </label>
                <label className="text-xs text-[var(--ink-muted)]">
                  {lang === "es" ? "Schedule / cadencia" : "Schedule"}
                  <input
                    className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1.5 text-sm text-[var(--ink)]"
                    value={flow.schedule}
                    onChange={(e) => updateFlow({ schedule: e.target.value })}
                  />
                </label>
                <label className="text-xs text-[var(--ink-muted)]">
                  Status
                  <select
                    className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1.5 text-sm text-[var(--ink)]"
                    value={flow.status}
                    onChange={(e) =>
                      updateFlow({ status: e.target.value as FlowGraph["status"] })
                    }
                  >
                    <option value="ok">ok</option>
                    <option value="aviso">aviso</option>
                    <option value="error">error</option>
                  </select>
                </label>
                <label className="text-xs text-[var(--ink-muted)]">
                  {lang === "es" ? "Prioridad" : "Priority"}
                  <select
                    className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1.5 text-sm text-[var(--ink)]"
                    value={flow.priority}
                    onChange={(e) =>
                      updateFlow({ priority: e.target.value as FlowGraph["priority"] })
                    }
                  >
                    <option value="alta">alta</option>
                    <option value="media">media</option>
                    <option value="baja">baja</option>
                  </select>
                </label>
                <label className="text-xs text-[var(--ink-muted)]">
                  Tags ({lang === "es" ? "coma" : "comma"})
                  <input
                    className="mt-1 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1.5 text-sm text-[var(--ink)]"
                    value={flow.tags.join(", ")}
                    onChange={(e) =>
                      updateFlow({
                        tags: e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
                <label className="text-xs text-[var(--ink-muted)] sm:col-span-2">
                  {lang === "es" ? "Módulos CRM vinculados" : "Linked CRM modules"}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {CRM_MODULES.filter((m) => m !== "ninguno").map((m) => {
                      const on = flow.crmModules.includes(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            const set = new Set(flow.crmModules);
                            if (on) set.delete(m);
                            else set.add(m);
                            updateFlow({ crmModules: [...set] });
                          }}
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                            on
                              ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--ink)]"
                              : "border-[var(--glass-border)] text-[var(--ink-muted)]",
                          )}
                        >
                          {CRM_MODULE_LABEL[m]}
                        </button>
                      );
                    })}
                  </div>
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setEditingMeta(false)}
                    className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {lang === "es" ? "Listo" : "Done"}
                  </button>
                </div>
              </div>
            )}

            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {filteredFlows.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setActiveId(f.id);
                    setSelectedNodeId(f.nodes[0]?.id ?? null);
                  }}
                  className={cn(
                    "max-w-[240px] truncate rounded-lg border px-2.5 py-1.5 text-left text-xs",
                    f.id === flow.id
                      ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] font-semibold text-[var(--ink)]"
                      : "border-[var(--glass-border)] text-[var(--ink-muted)]",
                    !f.enabled && "opacity-50",
                  )}
                  title={f.name}
                >
                  <span className="font-mono text-[10px]">
                    {f.automationId} · {f.priority}
                  </span>
                  <br />
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {submenu === "templates" && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {FLOW_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => addFromTemplate(tpl.id)}
                className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-3 text-left hover:border-[var(--accent)]"
              >
                <p className="text-sm font-semibold text-[var(--ink)]">{tpl.name}</p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">{tpl.description}</p>
                <p className="mt-2 text-[10px] text-[var(--accent)]">
                  {tpl.modules.map((m) => CRM_MODULE_LABEL[m]).join(" · ")}
                </p>
              </button>
            ))}
          </div>
        )}

        {submenu === "nodes" && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-[var(--ink-muted)]">
              {lang === "es"
                ? "Añade nodos libres. Los de CRM escriben en Lead / Cliente / Reserva / Factura / Pago / Contenido."
                : "Add free nodes. CRM nodes write to Lead / Client / Booking / Invoice / Payment / Content."}
            </p>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => addNode(k)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white"
                  style={{ background: NODE_KIND_COLOR[k] }}
                >
                  + {NODE_KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
        )}

        {submenu === "connect" && (
          <div className="mt-3 space-y-2 text-sm text-[var(--ink)]">
            <p className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
              <Link2 className="h-4 w-4" />
              {lang === "es"
                ? "Modo conectar: clic en nodo origen → clic en destino. Selecciona una línea para eliminarla."
                : "Connect mode: click source node → click target. Select an edge to delete it."}
            </p>
            {connectFrom && (
              <p className="text-xs font-semibold text-[var(--accent)]">
                {lang === "es" ? "Origen:" : "From:"} {connectFrom} → …
              </p>
            )}
            {selectedEdgeId && (
              <button
                type="button"
                onClick={removeSelectedEdge}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-400/40 px-2 py-1 text-xs font-semibold text-rose-600"
              >
                <Unlink className="h-3.5 w-3.5" />
                {lang === "es" ? "Eliminar enlace" : "Delete edge"}
              </button>
            )}
          </div>
        )}

        {submenu === "inspector" && selected && (
          <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-3">
              <p className="text-xs font-semibold uppercase text-[var(--ink-muted)]">
                {lang === "es" ? "Nodo" : "Node"}
              </p>
              <label className="block text-xs text-[var(--ink-muted)]">
                Label
                <input
                  className="mt-1 w-full rounded-md border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1 text-sm text-[var(--ink)]"
                  value={selected.label}
                  onChange={(e) => updateNode(selected.id, { label: e.target.value })}
                />
              </label>
              <label className="block text-xs text-[var(--ink-muted)]">
                Tipo
                <select
                  className="mt-1 w-full rounded-md border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1 text-sm text-[var(--ink)]"
                  value={selected.kind}
                  onChange={(e) =>
                    updateNode(selected.id, { kind: e.target.value as NodeKind })
                  }
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {NODE_KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[10px] text-[var(--ink-muted)]">Color</p>
              <div className="flex flex-wrap gap-1">
                {NODE_COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="h-5 w-5 rounded-full border border-white/40"
                    style={{ background: c }}
                    onClick={() => updateNodeConfig(selected.id, { color: c })}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={duplicateSelectedNode}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {lang === "es" ? "Clonar" : "Clone"}
                </button>
                <button
                  type="button"
                  onClick={removeSelectedNode}
                  className="text-xs font-semibold text-rose-600"
                >
                  {lang === "es" ? "Eliminar" : "Delete"}
                </button>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-3">
              <p className="text-xs font-semibold uppercase text-[var(--ink-muted)]">
                {lang === "es" ? "Vínculo CRM" : "CRM link"}
              </p>
              <label className="block text-xs text-[var(--ink-muted)]">
                Módulo
                <select
                  className="mt-1 w-full rounded-md border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1 text-sm text-[var(--ink)]"
                  value={selected.config.crmLink.module}
                  onChange={(e) => {
                    const module = e.target.value as CrmModule;
                    updateNodeConfig(selected.id, {
                      crmLink: { module },
                    });
                    updateFlow((f) => {
                      const set = new Set(f.crmModules);
                      if (module !== "ninguno") set.add(module);
                      return { ...f, crmModules: [...set] };
                    });
                  }}
                >
                  {CRM_MODULES.map((m) => (
                    <option key={m} value={m}>
                      {CRM_MODULE_LABEL[m]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-[var(--ink-muted)]">
                Campo entidad
                <input
                  className="mt-1 w-full rounded-md border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1 font-mono text-xs text-[var(--ink)]"
                  value={selected.config.crmLink.entityField}
                  onChange={(e) =>
                    updateNodeConfig(selected.id, {
                      crmLink: { entityField: e.target.value },
                    })
                  }
                  placeholder="id / email / reservationId…"
                />
              </label>
              <label className="block text-xs text-[var(--ink-muted)]">
                Acción
                <input
                  className="mt-1 w-full rounded-md border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1 font-mono text-xs text-[var(--ink)]"
                  value={selected.config.crmLink.action}
                  onChange={(e) =>
                    updateNodeConfig(selected.id, { crmLink: { action: e.target.value } })
                  }
                  placeholder="upsert / score / notify…"
                />
              </label>
            </div>

            <div className="space-y-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-3">
              <p className="text-xs font-semibold uppercase text-[var(--ink-muted)]">Values</p>
              {Object.entries(selected.config.values).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[1fr_1.2fr] gap-1">
                  <input
                    className="rounded-md border border-[var(--glass-border)] bg-[var(--bg0)] px-1.5 py-1 font-mono text-[10px] text-[var(--ink)]"
                    value={k}
                    onChange={(e) => {
                      const entries = Object.entries(selected.config.values);
                      const next: Record<string, string> = {};
                      for (const [kk, vv] of entries) {
                        next[kk === k ? e.target.value : kk] = vv;
                      }
                      updateNodeConfig(selected.id, { values: next });
                    }}
                  />
                  <input
                    className="rounded-md border border-[var(--glass-border)] bg-[var(--bg0)] px-1.5 py-1 font-mono text-[10px] text-[var(--ink)]"
                    value={v}
                    onChange={(e) =>
                      updateNodeConfig(selected.id, {
                        values: { ...selected.config.values, [k]: e.target.value },
                      })
                    }
                  />
                </div>
              ))}
              <button
                type="button"
                className="text-xs font-semibold text-[var(--accent)]"
                onClick={() =>
                  updateNodeConfig(selected.id, {
                    values: {
                      ...selected.config.values,
                      [`key_${Object.keys(selected.config.values).length + 1}`]: "",
                    },
                  })
                }
              >
                + value
              </button>
              <p className="pt-1 text-xs font-semibold uppercase text-[var(--ink-muted)]">Form</p>
              {selected.config.form.map((field, idx) => (
                <div key={field.key + idx} className="grid grid-cols-2 gap-1">
                  <input
                    className="rounded-md border border-[var(--glass-border)] bg-[var(--bg0)] px-1.5 py-1 text-xs text-[var(--ink)]"
                    value={field.label}
                    onChange={(e) => {
                      const form = selected.config.form.map((f, i) =>
                        i === idx ? { ...f, label: e.target.value } : f,
                      );
                      updateNodeConfig(selected.id, { form });
                    }}
                  />
                  <input
                    className="rounded-md border border-[var(--glass-border)] bg-[var(--bg0)] px-1.5 py-1 font-mono text-[10px] text-[var(--ink)]"
                    value={field.type}
                    onChange={(e) => {
                      const form = selected.config.form.map((f, i) =>
                        i === idx ? { ...f, type: e.target.value } : f,
                      );
                      updateNodeConfig(selected.id, { form });
                    }}
                  />
                </div>
              ))}
              <button
                type="button"
                className="text-xs font-semibold text-[var(--accent)]"
                onClick={() =>
                  updateNodeConfig(selected.id, {
                    form: [
                      ...selected.config.form,
                      {
                        key: `f_${selected.config.form.length + 1}`,
                        label: "Campo",
                        type: "text",
                      },
                    ],
                  })
                }
              >
                + campo
              </button>
            </div>

            <div className="space-y-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] p-3">
              <p className="text-xs font-semibold uppercase text-[var(--ink-muted)]">API</p>
              <div className="flex gap-2">
                <select
                  className="rounded-md border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1 text-xs text-[var(--ink)]"
                  value={selected.config.api.method}
                  onChange={(e) =>
                    updateNodeConfig(selected.id, { api: { method: e.target.value } })
                  }
                >
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <input
                  className="min-w-0 flex-1 rounded-md border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1 font-mono text-[10px] text-[var(--ink)]"
                  value={selected.config.api.url}
                  onChange={(e) =>
                    updateNodeConfig(selected.id, { api: { url: e.target.value } })
                  }
                />
              </div>
              <textarea
                rows={2}
                className="w-full rounded-md border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1 font-mono text-[10px] text-[var(--ink)]"
                value={selected.config.api.headers}
                onChange={(e) =>
                  updateNodeConfig(selected.id, { api: { headers: e.target.value } })
                }
                placeholder="headers JSON"
              />
              <textarea
                rows={3}
                className="w-full rounded-md border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1 font-mono text-[10px] text-[var(--ink)]"
                value={selected.config.api.body}
                onChange={(e) =>
                  updateNodeConfig(selected.id, { api: { body: e.target.value } })
                }
                placeholder="body"
              />
              <textarea
                rows={2}
                className="w-full rounded-md border border-[var(--glass-border)] bg-[var(--bg0)] px-2 py-1 text-xs text-[var(--ink)]"
                value={selected.config.notes}
                onChange={(e) => updateNodeConfig(selected.id, { notes: e.target.value })}
                placeholder={lang === "es" ? "Notas del nodo" : "Node notes"}
              />
            </div>
          </div>
        )}

        {submenu === "inspector" && !selected && (
          <p className="mt-3 text-xs text-[var(--ink-muted)]">
            {lang === "es"
              ? "Selecciona un nodo para personalizar label, tipo, color, vínculo CRM, values, form y API."
              : "Select a node to customize label, type, color, CRM link, values, form and API."}
          </p>
        )}
      </div>

      {/* Canvas */}
      <div className="overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-strong)] shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--glass-border)] px-4 py-3">
          <div>
            <h3 className="font-[family-name:var(--mps-display)] text-lg text-[var(--ink)]">
              {flow.name}
            </h3>
            <p className="text-xs text-[var(--ink-muted)]">
              {flow.automationId} · {flow.schedule} ·{" "}
              {flow.crmModules.map((m) => CRM_MODULE_LABEL[m]).join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!flow.enabled && (
              <span className="rounded-md border border-[var(--glass-border)] px-2 py-0.5 text-xs text-[var(--ink-muted)]">
                OFF
              </span>
            )}
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs font-semibold",
                flow.status === "ok"
                  ? "border-emerald-500/40 text-emerald-700"
                  : flow.status === "error"
                    ? "border-rose-500/40 text-rose-700"
                    : "border-amber-500/40 text-amber-700",
              )}
            >
              {flow.status}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "relative h-[480px] overflow-auto bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklab,var(--ink)_12%,transparent)_1px,transparent_0)] [background-size:18px_18px]",
            submenu === "connect" && "cursor-crosshair",
          )}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerLeave={onCanvasPointerUp}
          onClick={() => {
            if (submenu !== "connect") {
              setSelectedNodeId(null);
              setSelectedEdgeId(null);
            }
          }}
        >
          <svg className="pointer-events-none absolute inset-0 h-full w-[1400px] min-w-full">
            {flow.edges.map((e) => {
              const from = flow.nodes.find((n) => n.id === e.from);
              const to = flow.nodes.find((n) => n.id === e.to);
              if (!from || !to) return null;
              const a = nodeCenter(from);
              const b = nodeCenter(to);
              const midX = (a.x + b.x) / 2;
              const path = `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`;
              const active = e.id === selectedEdgeId;
              return (
                <g key={e.id} className="pointer-events-auto">
                  <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                    className="cursor-pointer"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelectedEdgeId(e.id);
                      setSelectedNodeId(null);
                      setSubmenu("connect");
                    }}
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke={
                      active
                        ? "#e11d48"
                        : "color-mix(in oklab, var(--accent) 70%, #64748b)"
                    }
                    strokeWidth={active ? 3 : 2.2}
                    className="pointer-events-none"
                  />
                  {e.label && (
                    <text
                      x={midX}
                      y={(a.y + b.y) / 2 - 6}
                      textAnchor="middle"
                      style={{ fontSize: 10, fill: "var(--ink-muted)" }}
                    >
                      {e.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {flow.nodes.map((n) => {
            const active = n.id === selectedNodeId || connectFrom === n.id;
            const color = nodeColor(n);
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onPointerDown={(e) => onNodePointerDown(e, n)}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "absolute w-[180px] select-none rounded-xl border-2 bg-[var(--bg0)] shadow-md",
                  active && "ring-2 ring-[var(--accent)]",
                )}
                style={{ left: n.x, top: n.y, borderColor: color, cursor: "grab" }}
              >
                <div
                  className="rounded-t-[10px] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
                  style={{ background: color }}
                >
                  {NODE_KIND_LABEL[n.kind]}
                </div>
                <div className="px-2.5 py-2">
                  <p className="text-xs font-semibold leading-snug text-[var(--ink)]">{n.label}</p>
                  <p className="mt-1 truncate text-[9px] text-[var(--accent)]">
                    {CRM_MODULE_LABEL[n.config.crmLink.module]}
                    {n.config.crmLink.action ? ` · ${n.config.crmLink.action}` : ""}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[9px] text-[var(--ink-muted)]">
                    {n.config.api.url ||
                      Object.keys(n.config.values).slice(0, 2).join(", ") ||
                      "—"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <p className="border-t border-[var(--glass-border)] px-4 py-2 text-[11px] text-[var(--ink-muted)]">
          {lang === "es"
            ? "Libre y fluido: plantillas CRM, nodos tipados, conectar a mano, clonar, colores, import/export JSON hacia n8n/Make. Nunca envía solo al cliente."
            : "Free and fluid: CRM templates, typed nodes, manual connect, clone, colors, import/export JSON to n8n/Make. Never auto-sends to the customer."}
        </p>
      </div>
    </div>
  );
}

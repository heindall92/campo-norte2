/** Configuración multi-proveedor (solo uso interno — la IA no habla con clientes). */

import { allowClientAiKeys } from "@/lib/runtime";

export type AiProvider = "ollama" | "openai" | "claude" | "gemini";
export type OllamaMode = "cloud" | "local";

/** @deprecated usar AiSettings */
export type OllamaSettings = AiSettings;

export interface AiSettings {
  enabled: boolean;
  provider: AiProvider;
  /** Solo Ollama: cloud (ollama.com) o local */
  ollamaMode: OllamaMode;
  /** Solo Ollama local/cloud base sin /api */
  ollamaBaseUrl: string;
  apiKeys: Record<AiProvider, string>;
  models: Record<AiProvider, string>;
  /**
   * Tope de tokens de salida por respuesta (ahorro de API).
   * La demo de referencia muestra el consumo; aquí además lo limitamos.
   */
  maxOutputTokens: number;
  /** Inyecta system prompt de respuestas cortas (tablas + lectura rápida). */
  conciseMode: boolean;
}

export const AI_SETTINGS_KEY = "mps-ai-settings-v1";
/** Legacy key — se migra al cargar */
export const OLLAMA_SETTINGS_KEY = "mps-ollama-settings-v1";

export const AI_PROVIDER_LABEL: Record<AiProvider, string> = {
  ollama: "Ollama",
  openai: "OpenAI",
  claude: "Claude (Anthropic)",
  gemini: "Gemini (Google)",
};

export const AI_PROVIDER_DOCS: Record<AiProvider, string> = {
  ollama: "https://ollama.com/settings",
  openai: "https://platform.openai.com/api-keys",
  claude: "https://console.anthropic.com/settings/keys",
  gemini: "https://aistudio.google.com/apikey",
};

export const DEFAULT_AI_MODELS: Record<AiProvider, string> = {
  ollama: "llama3.2",
  openai: "gpt-4o-mini",
  claude: "claude-sonnet-4-20250514",
  gemini: "gemini-2.0-flash",
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: false,
  provider: "ollama",
  ollamaMode: "cloud",
  ollamaBaseUrl: "https://ollama.com",
  apiKeys: { ollama: "", openai: "", claude: "", gemini: "" },
  models: { ...DEFAULT_AI_MODELS },
  maxOutputTokens: 600,
  conciseMode: true,
};

/** Compat: mismos campos que el antiguo OllamaSettings */
export const DEFAULT_OLLAMA_SETTINGS: AiSettings = DEFAULT_AI_SETTINGS;

function envDefaults(): Partial<AiSettings> {
  const provider = import.meta.env.VITE_AI_PROVIDER as AiProvider | undefined;
  const enabled = import.meta.env.VITE_AI_ENABLED === "true";

  const keys: Partial<Record<AiProvider, string>> = {
    ollama: (import.meta.env.VITE_OLLAMA_API_KEY as string | undefined) ?? "",
    openai: (import.meta.env.VITE_OPENAI_API_KEY as string | undefined) ?? "",
    claude: (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined) ?? "",
    gemini: (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? "",
  };

  const models: Partial<Record<AiProvider, string>> = {
    ollama: (import.meta.env.VITE_OLLAMA_MODEL as string | undefined) ?? undefined,
    openai: (import.meta.env.VITE_OPENAI_MODEL as string | undefined) ?? undefined,
    claude: (import.meta.env.VITE_CLAUDE_MODEL as string | undefined) ?? undefined,
    gemini: (import.meta.env.VITE_GEMINI_MODEL as string | undefined) ?? undefined,
  };

  const ollamaBaseUrl = import.meta.env.VITE_OLLAMA_BASE_URL as string | undefined;
  const ollamaMode = import.meta.env.VITE_OLLAMA_MODE as OllamaMode | undefined;

  const out: Partial<AiSettings> = {};
  if (provider && provider in DEFAULT_AI_MODELS) out.provider = provider;
  if (enabled || Object.values(keys).some(Boolean)) out.enabled = true;
  if (ollamaBaseUrl) out.ollamaBaseUrl = ollamaBaseUrl.replace(/\/$/, "");
  if (ollamaMode === "cloud" || ollamaMode === "local") out.ollamaMode = ollamaMode;

  out.apiKeys = { ...DEFAULT_AI_SETTINGS.apiKeys, ...keys };
  out.models = {
    ...DEFAULT_AI_MODELS,
    ...Object.fromEntries(
      Object.entries(models).filter(([, v]) => Boolean(v)),
    ),
  } as Record<AiProvider, string>;

  return out;
}

function migrateLegacyOllama(): Partial<AiSettings> | null {
  try {
    const raw = localStorage.getItem(OLLAMA_SETTINGS_KEY);
    if (!raw) return null;
    const old = JSON.parse(raw) as {
      enabled?: boolean;
      mode?: OllamaMode;
      baseUrl?: string;
      apiKey?: string;
      model?: string;
    };
    return {
      enabled: old.enabled ?? false,
      provider: "ollama",
      ollamaMode: old.mode === "local" ? "local" : "cloud",
      ollamaBaseUrl: (old.baseUrl || "https://ollama.com").replace(/\/$/, ""),
      apiKeys: { ...DEFAULT_AI_SETTINGS.apiKeys, ollama: old.apiKey?.trim() || "" },
      models: {
        ...DEFAULT_AI_MODELS,
        ollama: old.model?.trim() || DEFAULT_AI_MODELS.ollama,
      },
    };
  } catch {
    return null;
  }
}

export function loadAiSettings(): AiSettings {
  const fromEnv = envDefaults();
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY);
    if (!raw) {
      const legacy = migrateLegacyOllama();
      const merged = {
        ...DEFAULT_AI_SETTINGS,
        ...legacy,
        ...fromEnv,
        apiKeys: {
          ...DEFAULT_AI_SETTINGS.apiKeys,
          ...legacy?.apiKeys,
          ...fromEnv.apiKeys,
        },
        models: {
          ...DEFAULT_AI_MODELS,
          ...legacy?.models,
          ...fromEnv.models,
        },
      };
      return merged;
    }
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return {
      ...DEFAULT_AI_SETTINGS,
      ...fromEnv,
      ...parsed,
      provider: (parsed.provider || fromEnv.provider || "ollama") as AiProvider,
      ollamaMode:
        parsed.ollamaMode === "local" || fromEnv.ollamaMode === "local" ? "local" : "cloud",
      ollamaBaseUrl: (
        parsed.ollamaBaseUrl ||
        fromEnv.ollamaBaseUrl ||
        DEFAULT_AI_SETTINGS.ollamaBaseUrl
      ).replace(/\/$/, ""),
      maxOutputTokens: Math.min(
        4000,
        Math.max(128, Number(parsed.maxOutputTokens) || DEFAULT_AI_SETTINGS.maxOutputTokens),
      ),
      conciseMode: parsed.conciseMode !== false,
      apiKeys: {
        ...DEFAULT_AI_SETTINGS.apiKeys,
        ...fromEnv.apiKeys,
        ...parsed.apiKeys,
      },
      models: {
        ...DEFAULT_AI_MODELS,
        ...fromEnv.models,
        ...parsed.models,
      },
    };
  } catch {
    return { ...DEFAULT_AI_SETTINGS, ...fromEnv } as AiSettings;
  }
}

/** @deprecated usar loadAiSettings */
export function loadOllamaSettings(): AiSettings {
  return loadAiSettings();
}

export function saveAiSettings(settings: AiSettings): void {
  const clean: AiSettings = {
    ...settings,
    ollamaBaseUrl: settings.ollamaBaseUrl.replace(/\/$/, ""),
    maxOutputTokens: Math.min(4000, Math.max(128, Number(settings.maxOutputTokens) || 600)),
    conciseMode: settings.conciseMode !== false,
    apiKeys: {
      ollama: settings.apiKeys.ollama.trim(),
      openai: settings.apiKeys.openai.trim(),
      claude: settings.apiKeys.claude.trim(),
      gemini: settings.apiKeys.gemini.trim(),
    },
    models: {
      ollama: settings.models.ollama.trim() || DEFAULT_AI_MODELS.ollama,
      openai: settings.models.openai.trim() || DEFAULT_AI_MODELS.openai,
      claude: settings.models.claude.trim() || DEFAULT_AI_MODELS.claude,
      gemini: settings.models.gemini.trim() || DEFAULT_AI_MODELS.gemini,
    },
  };
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(clean));
}

/** @deprecated usar saveAiSettings */
export function saveOllamaSettings(settings: AiSettings): void {
  saveAiSettings(settings);
}

export function activeApiKey(settings: AiSettings = loadAiSettings()): string {
  return settings.apiKeys[settings.provider] || "";
}

export function activeModel(settings: AiSettings = loadAiSettings()): string {
  return settings.models[settings.provider] || DEFAULT_AI_MODELS[settings.provider];
}

export function aiReady(settings: AiSettings = loadAiSettings()): boolean {
  if (!settings.enabled) return false;
  const model = activeModel(settings);
  if (!model) return false;
  if (settings.provider === "ollama" && settings.ollamaMode === "local") return true;
  // Producción: keys en Vercel env → listo sin pegar key en el navegador.
  if (!allowClientAiKeys()) return true;
  return Boolean(activeApiKey(settings));
}

/** @deprecated usar aiReady */
export function ollamaReady(settings: AiSettings = loadAiSettings()): boolean {
  return aiReady(settings);
}

export function providerLabel(settings: AiSettings = loadAiSettings()): string {
  return AI_PROVIDER_LABEL[settings.provider];
}

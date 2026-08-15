export {
  AI_PROVIDER_DOCS,
  AI_PROVIDER_LABEL,
  AI_SETTINGS_KEY,
  DEFAULT_AI_MODELS,
  DEFAULT_AI_SETTINGS,
  DEFAULT_OLLAMA_SETTINGS,
  OLLAMA_SETTINGS_KEY,
  activeApiKey,
  activeModel,
  aiReady,
  loadAiSettings,
  loadOllamaSettings,
  ollamaReady,
  providerLabel,
  saveAiSettings,
  saveOllamaSettings,
  type AiProvider,
  type AiSettings,
  type OllamaMode,
  type OllamaSettings,
} from "./settings";
export {
  aiChat,
  ollamaChat,
  parseJsonFromModel,
  testAiConnection,
  type AiChatFormat,
  type AiChatMessage,
  type AiChatResult,
  type OllamaChatMessage,
  type OllamaChatResult,
} from "./chat";
export {
  applyIntelligenceToClient,
  buildClientSignals,
  classifyCustomer,
  classifyCustomerHeuristic,
  clientsToContactThisMonth,
  monthsSinceTrip,
  type CustomerIntelligenceResult,
  type IntelligenceSource,
} from "./customer-intelligence";
export {
  applyScoreToLead,
  priorityFromScore,
  priorityLabel,
  scoreLead,
  scoreLeadHeuristic,
  type LeadPriority,
  type LeadScoreResult,
  type LeadScoreSource,
} from "./lead-scoring";
export {
  DEFAULT_LEAD_PRIORITY_MODE,
  LEAD_PRIORITY_MODES,
  isLeadPriorityMode,
  leadPriorityModeHint,
  leadPriorityModeLabel,
  rankLeads,
  sortLeadsByMode,
  type LeadPriorityMode,
  type RankedLead,
} from "./lead-priority";
export {
  deleteKnowledgeDoc,
  KNOWLEDGE_DOCS_KEY,
  KNOWLEDGE_KIND_LABEL,
  loadKnowledgeDocs,
  saveKnowledgeDocs,
  SEED_KNOWLEDGE_DOCS,
  upsertKnowledgeDoc,
  type KnowledgeDoc,
  type KnowledgeDocKind,
} from "./knowledge-store";
export {
  askKnowledge,
  askKnowledgeStream,
  buildKnowledgeChunks,
  retrieveKnowledgeChunks,
  type KnowledgeAskResult,
  type KnowledgeChunk,
  type KnowledgeCorpusInput,
} from "./knowledge-rag";
export { aiChatStream } from "./chat-stream";
export {
  coldByDate,
  coldByLabel,
  decayedScore,
  daysSince,
  DEFAULT_HALF_LIFE_DAYS,
} from "./lead-scoring-core";
export {
  inferOriginFromForm,
  runLeadCapturePipeline,
  type LeadPipelineResult,
  type PipelineStepLog,
  type WebFormLeadPayload,
} from "./lead-pipeline";

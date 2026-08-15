/**
 * Historial local del asistente (threads).
 * Patrón sidebar HOY / ESTA SEMANA de la demo — sin backend propio.
 */

export const AI_THREADS_KEY = "mps-ai-threads-v1";

export interface AiThreadMessage {
  role: "user" | "assistant";
  content: string;
  at: string;
  tokensOut?: number;
  tokensMax?: number;
}

export interface AiThread {
  id: string;
  title: string;
  updatedAt: string;
  messages: AiThreadMessage[];
}

function loadAll(): AiThread[] {
  try {
    const raw = localStorage.getItem(AI_THREADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AiThread[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(threads: AiThread[]): void {
  try {
    localStorage.setItem(AI_THREADS_KEY, JSON.stringify(threads.slice(0, 40)));
  } catch {
    /* ignore */
  }
}

export function listAiThreads(): AiThread[] {
  return loadAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function upsertAiThread(input: {
  id?: string;
  question: string;
  answer: string;
  tokensOut?: number;
  tokensMax?: number;
}): AiThread {
  const all = loadAll();
  const now = new Date().toISOString();
  const id = input.id ?? `th-${Date.now()}`;
  const existing = all.find((t) => t.id === id);
  const userMsg: AiThreadMessage = { role: "user", content: input.question, at: now };
  const asstMsg: AiThreadMessage = {
    role: "assistant",
    content: input.answer,
    at: now,
    tokensOut: input.tokensOut,
    tokensMax: input.tokensMax,
  };

  if (existing) {
    existing.messages.push(userMsg, asstMsg);
    existing.updatedAt = now;
    existing.title = existing.title || input.question.slice(0, 48);
    saveAll(all);
    return existing;
  }

  const thread: AiThread = {
    id,
    title: input.question.slice(0, 48),
    updatedAt: now,
    messages: [userMsg, asstMsg],
  };
  all.unshift(thread);
  saveAll(all);
  return thread;
}

export function groupThreadsByRecency(threads: AiThread[], now = new Date()) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const weekAgo = new Date(startOfToday);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const today: AiThread[] = [];
  const week: AiThread[] = [];
  const older: AiThread[] = [];

  for (const t of threads) {
    const d = new Date(t.updatedAt);
    if (d >= startOfToday) today.push(t);
    else if (d >= weekAgo) week.push(t);
    else older.push(t);
  }
  return { today, week, older };
}

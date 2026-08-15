/**
 * Canal para la IA contextual.
 *
 * El patrón (docs/GAP-DEMO-ANATOMIA.md §7): la IA se invoca DESDE la tarjeta
 * o la fila, con el contexto ya cargado. El panel lateral global
 * (`AiAssistantHost`) escucha el evento; ya no hace falta saltar a Conocimiento.
 */

export const ASK_EVENT = "mps-ask-assistant";
export const ASK_OPEN_EVENT = "mps-ask-open";

let pending: string | null = null;

export type RequestAskOptions = {
  /**
   * Si true, también navega a Conocimiento (historial / docs).
   * Por defecto false: el drawer global basta.
   */
  navigate?: boolean;
};

/**
 * Encola una pregunta y abre el asistente contextual.
 */
export function requestAsk(question: string, options?: RequestAskOptions): void {
  const text = question.trim();
  if (!text) return;
  pending = text;
  if (typeof window === "undefined") return;
  if (options?.navigate) {
    window.dispatchEvent(new CustomEvent("mps-navigate", { detail: "conocimiento" }));
  }
  window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: text }));
}

/** Abre el drawer vacío (FAB) sin lanzar pregunta. */
export function openAssistant(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ASK_OPEN_EVENT));
}

/**
 * Recoge la pregunta pendiente y la borra.
 */
export function consumePendingAsk(): string | null {
  const text = pending;
  pending = null;
  return text;
}

/** Suscripción al canal de preguntas. */
export function onAskRequested(handler: (question: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<string>).detail;
    if (typeof detail === "string" && detail.trim()) handler(detail);
  };
  window.addEventListener(ASK_EVENT, listener);
  return () => window.removeEventListener(ASK_EVENT, listener);
}

/** Suscripción a «abrir drawer vacío». */
export function onAssistantOpen(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = () => handler();
  window.addEventListener(ASK_OPEN_EVENT, listener);
  return () => window.removeEventListener(ASK_OPEN_EVENT, listener);
}

export function askAboutTopic(topic: string): string {
  return `Explícame la situación de ${topic}: qué muestran los números, qué lo explica y qué harías esta semana.`;
}

export function askAboutLead(name: string, reason: string): string {
  return `El lead ${name} aparece en la cola de acción porque: ${reason}. ¿Qué le digo y con qué prioridad frente al resto?`;
}

export function askAboutReservation(trip: string, reason: string): string {
  return `La reserva ${trip} requiere atención: ${reason}. ¿Qué pasos doy y en qué orden?`;
}

export function askAboutInvoice(number: string, reason: string): string {
  return `La factura ${number} requiere atención: ${reason}. ¿Cómo lo resuelvo sin incumplir la normativa?`;
}

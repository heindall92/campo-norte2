/** IDs de dominio demo. No son UUID de Postgres. */
export function wmsUid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function correlationId(seed?: string): string {
  return seed ?? wmsUid("corr");
}

export type WmsSyncKind = "load" | "save";

export type WmsSyncNotice = {
  kind: WmsSyncKind;
  message: string;
};

type Listener = (notice: WmsSyncNotice | null) => void;

const listeners = new Set<Listener>();
let current: WmsSyncNotice | null = null;

export function wmsSyncMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "No se pudo sincronizar el almacén";
}

export function peekWmsSyncError(): WmsSyncNotice | null {
  return current;
}

export function publishWmsSyncError(kind: WmsSyncKind, err: unknown): void {
  current = { kind, message: wmsSyncMessage(err) };
  for (const listener of listeners) listener(current);
}

export function clearWmsSyncError(): void {
  current = null;
  for (const listener of listeners) listener(null);
}

export function subscribeWmsSyncError(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

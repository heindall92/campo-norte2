import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { playNotificationDing } from "@/lib/notification-sound";
import {
  NOTIFICATIONS_KEY,
  type AppNotification,
  type NotificationKind,
  type NotificationTone,
  type AppSection,
} from "./types";

export interface PushNotificationInput {
  kind: NotificationKind;
  tone?: NotificationTone;
  actor: string;
  statusLabel: string;
  body: string;
  detail?: string;
  section?: AppSection;
  entityId?: string;
  /** Si false, no reproduce el ding. Default true. */
  silent?: boolean;
}

export interface NotificationsContextValue {
  items: AppNotification[];
  unreadCount: number;
  push: (input: PushNotificationInput) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clear: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

function load(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<AppNotification[]>(() => load());

  useEffect(() => {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(items.slice(0, 200)));
  }, [items]);

  const push = useCallback((input: PushNotificationInput) => {
    const next: AppNotification = {
      id: `N-${Date.now()}-${Math.floor(Math.random() * 999)}`,
      kind: input.kind,
      tone: input.tone ?? "info",
      actor: input.actor,
      statusLabel: input.statusLabel,
      body: input.body,
      detail: input.detail,
      createdAt: new Date().toISOString(),
      read: false,
      section: input.section,
      entityId: input.entityId,
    };
    setItems((prev) => [next, ...prev].slice(0, 200));
    if (!input.silent) playNotificationDing();
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback((id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items,
      unreadCount: items.filter((n) => !n.read).length,
      push,
      markAllRead,
      markRead,
      clear,
    }),
    [items, push, markAllRead, markRead, clear],
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications debe usarse dentro de NotificationsProvider");
  return ctx;
}

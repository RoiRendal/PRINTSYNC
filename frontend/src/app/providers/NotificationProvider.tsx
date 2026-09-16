import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type NotificationType = 'stock' | 'order' | 'system';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: number;
  link?: string;
}

export interface NotificationSettings {
  stockAlertsEnabled: boolean;
  exportAlertsEnabled: boolean;
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  settings: NotificationSettings;
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
  toggleStockAlerts: () => void;
  toggleExportAlerts: () => void;
}

const NOTIFICATIONS_KEY = 'printsync.notifications';
const SETTINGS_KEY = 'printsync.notificationSettings';

const DEFAULT_SETTINGS: NotificationSettings = {
  stockAlertsEnabled: true,
  exportAlertsEnabled: true,
};

function loadNotifications(): Notification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Notification[];
    // Keep only last 7 days
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return parsed.filter((n) => n.createdAt > cutoff);
  } catch {
    return [];
  }
}

function saveNotifications(notifications: Notification[]) {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  } catch {
    // ignore storage errors
  }
}

function loadSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<NotificationSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: NotificationSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(loadNotifications);
  const [settings, setSettings] = useState<NotificationSettings>(loadSettings);

  useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const addNotification = useCallback(
    (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
      const id = `${notification.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setNotifications((prev) => {
        // Prevent duplicate messages within 5 minutes
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        const isDuplicate = prev.some(
          (n) =>
            n.title === notification.title &&
            n.message === notification.message &&
            n.createdAt > fiveMinutesAgo
        );
        if (isDuplicate) return prev;
        return [{ ...notification, id, read: false, createdAt: Date.now() }, ...prev];
      });
    },
    []
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const toggleStockAlerts = useCallback(() => {
    setSettings((prev) => ({ ...prev, stockAlertsEnabled: !prev.stockAlertsEnabled }));
  }, []);

  const toggleExportAlerts = useCallback(() => {
    setSettings((prev) => ({ ...prev, exportAlertsEnabled: !prev.exportAlertsEnabled }));
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      settings,
      addNotification,
      markAsRead,
      markAllAsRead,
      dismissNotification,
      clearAll,
      toggleStockAlerts,
      toggleExportAlerts,
    }),
    [notifications, unreadCount, settings, addNotification, markAsRead, markAllAsRead, dismissNotification, clearAll, toggleStockAlerts, toggleExportAlerts]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return ctx;
}

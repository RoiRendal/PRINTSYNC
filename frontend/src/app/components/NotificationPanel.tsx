import React from 'react';
import { Bell, Box, PackageSearch, X, CheckCheck, Trash2 } from 'lucide-react';
import { useNotifications, type Notification } from '../providers/NotificationProvider';
import { cn } from '../../shared/lib/cn';

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function NotificationIcon({ type }: { type: Notification['type'] }) {
  switch (type) {
    case 'stock':
      return <Box className="h-4 w-4" aria-hidden="true" />;
    case 'order':
      return <PackageSearch className="h-4 w-4" aria-hidden="true" />;
    default:
      return <Bell className="h-4 w-4" aria-hidden="true" />;
  }
}

export const NotificationPanel = React.forwardRef<
  HTMLDivElement,
  { onClose: () => void }
>(({ onClose }, ref) => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
  } = useNotifications();

  return (
    <div
      ref={ref}
      className="surface-panel absolute right-0 top-full z-[100] mt-2 w-80 overflow-hidden rounded-2xl sm:w-96"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-macos-text-muted dark:text-zinc-500" aria-hidden="true" />
          <h3 className="text-sm font-bold text-macos-text dark:text-zinc-100">Notifications</h3>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-macos-red px-1.5 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {notifications.length > 0 && (
            <>
              <button
                type="button"
                onClick={markAllAsRead}
                title="Mark all as read"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-macos-text-muted hover:bg-[var(--app-state-hover)] hover:text-macos-text dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={clearAll}
                title="Clear all"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-macos-text-muted hover:bg-[var(--app-state-hover)] hover:text-macos-red dark:text-zinc-400 dark:hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </>
          )}
          {/*
            Always rendered, unlike the two above: the panel can be empty, and
            without this the only way to dismiss it would be to click outside it.
          */}
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close notifications"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-macos-text-muted hover:bg-[var(--app-state-hover)] hover:text-macos-text dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto scrollbar-hide">
        <>
          {notifications.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center"
            >
              {/* Solid now: at 40% this icon measured 2.0:1 on the panel, and
                  zinc-600 measured 1.80:1 in dark — both under the 3:1 floor. */}
              <Bell className="h-8 w-8 text-[var(--app-text-muted)]" aria-hidden="true" />
              <p className="text-xs font-semibold text-macos-text-muted dark:text-zinc-500">No notifications yet</p>
              <p className="text-[10px] text-[var(--app-text-muted)]">Alerts for stock and orders appear here.</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  'group relative flex gap-3 border-b px-4 py-3 last:border-b-0',
                  notification.read ? 'bg-transparent' : 'bg-[#f7f7f7] dark:bg-[#373739]'
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold',
                    /* Amber and gray map onto the tint tokens. The blue chip does
                       not: --app-tint-blue is the composite of macos-blue, which
                       is a grey in this palette, so using it here would turn a
                       blue chip grey. Its dark values are the composite of the
                       real Tailwind blue this chip actually paints with. */
                    notification.type === 'stock'
                      ? 'border-amber-200 bg-amber-50 text-amber-600 dark:border-[var(--app-border-hairline)] dark:bg-[var(--app-tint-amber)] dark:text-amber-400'
                      : notification.type === 'order'
                        ? 'border-blue-200 bg-blue-50 text-blue-600 dark:border-[#31466a] dark:bg-[#2e3542] dark:text-blue-400'
                        : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-[var(--app-border-hairline)] dark:bg-[var(--app-tint-gray)] dark:text-gray-400'
                  )}
                >
                  <NotificationIcon type={notification.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-xs font-bold', notification.read ? 'text-macos-text-muted dark:text-zinc-500' : 'text-macos-text dark:text-zinc-100')}>
                      {notification.title}
                    </p>
                    <span className="shrink-0 text-[10px] text-[var(--app-text-muted)]">
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-macos-text-muted dark:text-zinc-400">
                    {notification.message}
                  </p>
                </div>
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100">
                  {!notification.read && (
                    <button
                      type="button"
                      onClick={() => markAsRead(notification.id)}
                      title="Mark as read"
                      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-macos-text-muted hover:bg-[var(--app-state-hover)] hover:text-macos-text dark:text-zinc-500 dark:hover:text-zinc-100"
                    >
                      <CheckCheck className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => dismissNotification(notification.id)}
                    title="Dismiss"
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-macos-text-muted hover:bg-[var(--app-state-hover)] hover:text-macos-red dark:text-zinc-500 dark:hover:text-red-300"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))
          )}
        </>
      </div>
    </div>
  );
});

NotificationPanel.displayName = 'NotificationPanel';

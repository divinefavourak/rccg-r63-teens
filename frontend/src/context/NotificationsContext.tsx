/**
 * NotificationsContext
 * 
 * Derives real notifications from existing API data:
 * - Today's/recent devotionals → "New Devotional" notifications
 * - Upcoming events → "Upcoming Event" notifications
 * - Account creation (static, session-based) → "Welcome" notification
 * 
 * Persists read state to localStorage so it survives page refresh.
 */

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import { BookOpen, Calendar, User, type LucideIcon } from 'lucide-react';

export interface AppNotification {
    id: string;
    title: string;
    body: string;
    time: string;           // human-readable e.g. "2m ago", "3 days ago"
    rawTime: number;        // epoch ms for sorting
    read: boolean;
    icon: LucideIcon;
    iconColor: string;
    href?: string;
}

interface NotificationsContextType {
    notifications: AppNotification[];
    unreadCount: number;
    markRead: (id: string) => void;
    markAllRead: () => void;
    loading: boolean;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const READ_KEY = 'rccg_read_notifications';

const getReadIds = (): Set<string> => {
    try {
        const raw = localStorage.getItem(READ_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
};

const saveReadIds = (ids: Set<string>) => {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
};

const timeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'yesterday';
    return `${days} days ago`;
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
    const buildNotifications = useCallback(async (): Promise<AppNotification[]> => {
        const readIds = getReadIds();
        const items: AppNotification[] = [];

        // 1. Recent devotionals (last 7 days)
        try {
            const { data } = await api.get('/content/devotionals/?limit=5');
            const devotionals = Array.isArray(data) ? data : data.results ?? [];
            const cutoff = Date.now() - 7 * 24 * 3600000; // 7 days ago

            for (const d of devotionals) {
                const ts = new Date(d.published_at || d.date).getTime();
                if (ts < cutoff) continue;

                const isToday = new Date(d.date).toDateString() === new Date().toDateString();
                items.push({
                    id: `dev_${d.id}`,
                    title: isToday ? "Today's Devotional is ready!" : 'New Devotional Published',
                    body: d.title || 'A new devotional has been published.',
                    time: timeAgo(d.published_at || d.date),
                    rawTime: ts,
                    read: readIds.has(`dev_${d.id}`),
                    icon: BookOpen,
                    iconColor: 'text-primary-600 bg-primary-50 dark:bg-primary-900/30',
                    href: `/devotionals/${d.id}`,
                });
            }
        } catch (_) { /* silent */ }

        // 2. Upcoming events (next 30 days) — only published events, no auth required
        try {
            const { data } = await api.get('/events/events/?status=published&ordering=start_datetime&limit=5');
            const events = Array.isArray(data) ? data : data.results ?? [];
            const now = Date.now();
            const future = now + 30 * 24 * 3600000;

            for (const ev of events) {
                const ts = new Date(ev.start_datetime).getTime();
                if (ts < now || ts > future) continue;

                const daysLeft = Math.ceil((ts - now) / 86400000);
                items.push({
                    id: `ev_${ev.id}`,
                    title: 'Upcoming Event',
                    body: `${ev.title} is in ${daysLeft === 1 ? '1 day' : `${daysLeft} days`}.`,
                    time: timeAgo(ev.start_datetime),
                    rawTime: ts,
                    read: readIds.has(`ev_${ev.id}`),
                    icon: Calendar,
                    iconColor: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30',
                    href: `/events/${ev.id}`,
                });
            }
        } catch (_) { /* silent */ }

        // 3. Static welcome notification (always shown once)
        const welcomeId = 'welcome_static';
        items.push({
            id: welcomeId,
            title: 'Welcome to Faith Tribe 🎉',
            body: 'Explore devotionals, events, and resources curated just for you.',
            time: 'earlier',
            rawTime: 0,
            read: readIds.has(welcomeId),
            icon: User,
            iconColor: 'text-green-600 bg-green-50 dark:bg-green-900/30',
        });

        // Sort: newest first
        items.sort((a, b) => b.rawTime - a.rawTime);
        return items;
    }, []);

    /*
      Two API calls used to fire on every single page load — including the
      anonymous landing page, where nothing renders a notification — and the
      results were thrown away and refetched on every navigation, because the
      provider is mounted above the router and remounts with it.

      Through the query cache they are fetched once and reused for five minutes.
      The list is also the same for everyone (recent devotionals and upcoming
      events, both public), so the key carries no user identity.
    */
    const { data, isPending } = useQuery({
        queryKey: ['notifications-feed'],
        queryFn: buildNotifications,
        staleTime: 5 * 60 * 1000,
    });

    // Read state lives in localStorage, not in the fetched data, so it is held
    // separately and merged on render rather than by mutating the cache.
    const [readVersion, setReadVersion] = useState(0);

    const notifications = useMemo(() => {
        const ids = getReadIds();
        // readVersion is the dependency that re-runs this after a mark-read;
        // getReadIds reads localStorage, which React cannot observe on its own.
        void readVersion;
        return (data ?? []).map(n => ({ ...n, read: ids.has(n.id) }));
    }, [data, readVersion]);

    const markRead = useCallback((id: string) => {
        const ids = getReadIds();
        ids.add(id);
        saveReadIds(ids);
        setReadVersion(v => v + 1);
    }, []);

    const markAllRead = useCallback(() => {
        const ids = getReadIds();
        (data ?? []).forEach(n => ids.add(n.id));
        saveReadIds(ids);
        setReadVersion(v => v + 1);
    }, [data]);

    const unreadCount = notifications.filter(n => !n.read).length;

    // Memoised: this object was rebuilt on every render, so every consumer of
    // the context re-rendered whenever anything above it did.
    const value = useMemo(
        () => ({ notifications, unreadCount, markRead, markAllRead, loading: isPending }),
        [notifications, unreadCount, markRead, markAllRead, isPending],
    );

    return (
        <NotificationsContext.Provider value={value}>
            {children}
        </NotificationsContext.Provider>
    );
};

export const useNotifications = () => {
    const ctx = useContext(NotificationsContext);
    if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
    return ctx;
};

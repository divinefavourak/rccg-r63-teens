import api from '../api/axios';

const MEDIA_BASE = import.meta.env.VITE_MEDIA_URL || 'http://localhost:8000';

/** Prepend backend base URL to relative media paths returned by Django */
const resolveMediaUrl = (path: string | null | undefined): string | null => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${MEDIA_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
};

export interface Devotional {
    id: string;
    date: string;
    title: string;
    slug: string;
    memory_verse_passage: string;
    memory_verse_content: string;
    cover_image: string | null;
    has_audio: boolean;
    view_count: number;
    status: string;
    published_at: string;
}

export interface Manual {
    id: string;
    series: string | null;
    series_title: string;
    week_number: number;
    week_start_date: string;
    week_end_date: string;
    title: string;
    slug: string;
    theme: string;
    cover_image: string | null;
    target_age_group: string;
    has_pdf: boolean;
    view_count: number;
    status: string;
}

export interface Podcast {
    id: string;
    title: string;
    description: string;
    duration: string;
    url: string;
    host: string;
    publishedAt: string;
    thumbnail?: string;
}

export const contentService = {
    async getDevotionals(): Promise<Devotional[]> {
        const { data } = await api.get('/content/devotionals/');
        const items: Devotional[] = Array.isArray(data) ? data : data.results ?? [];
        return items.map(d => ({ ...d, cover_image: resolveMediaUrl(d.cover_image) }));
    },

    async getManuals(): Promise<Manual[]> {
        const { data } = await api.get('/content/manuals/');
        const items: Manual[] = Array.isArray(data) ? data : data.results ?? [];
        return items.map(m => ({ ...m, cover_image: resolveMediaUrl(m.cover_image) }));
    },

    // No podcasts endpoint exists in the backend yet
    async getPodcasts(): Promise<Podcast[]> {
        return [];
    },
};

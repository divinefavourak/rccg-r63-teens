
export interface Devotional {
    id: string;
    title: string;
    date: string; // ISO Date
    preview: string;
    content: string;
    author: string;
    image?: string;
}

export interface Manual {
    id: string;
    title: string;
    description: string;
    category: 'Teacher' | 'Student' | 'General';
    url: string; // PDF link
    coverImage?: string;
}

export interface Podcast {
    id: string;
    title: string;
    description: string;
    duration: string; // e.g., "45 min"
    url: string; // Audio link
    host: string;
    publishedAt: string;
    thumbnail?: string;
}

class MockContentService {
    async getDevotionals(): Promise<Devotional[]> {
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate delay
        return [
            {
                id: '1',
                title: 'Walking in Dominion',
                date: new Date().toISOString(),
                preview: 'God has called us to walk in dominion over every situation...',
                content: 'Full devotional content goes here...',
                author: 'Pastor Adeboye',
                image: 'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8YmlibGV8ZW58MHx8MHx8fDA%3D'
            },
            {
                id: '2',
                title: 'The Power of Praise',
                date: new Date(Date.now() - 86400000).toISOString(),
                preview: 'Praise is a weapon that confuses the enemy...',
                content: 'Full devotional content goes here...',
                author: 'Pastor Folu Adeboye',
                image: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fHdvcnNoaXB8ZW58MHx8MHx8fDA%3D'
            }
        ];
    }

    async getManuals(): Promise<Manual[]> {
        await new Promise(resolve => setTimeout(resolve, 800));
        return [
            {
                id: '1',
                title: 'Teens Zeal Manual 2025',
                description: 'The official Sunday School manual for teenagers.',
                category: 'Student',
                url: '#',
                coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8Ym9va3xlbnwwfHwwfHx8MA%3D%3D'
            },
            {
                id: '2',
                title: 'Teachers Manual 2025',
                description: 'Guide for teachers for the 2025 calendar year.',
                category: 'Teacher',
                url: '#',
                coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTZ8fGJvb2t8ZW58MHx8MHx8fDA%3D'
            }
        ];
    }

    async getPodcasts(): Promise<Podcast[]> {
        await new Promise(resolve => setTimeout(resolve, 800));
        return [
            {
                id: '1',
                title: 'Navigating Peer Pressure',
                description: 'Real talk on how to stand your ground in a changing world.',
                duration: '24 min',
                url: '#',
                host: 'Faith Tribe Team',
                publishedAt: '2025-01-10',
                thumbnail: 'https://images.unsplash.com/photo-1478737270239-2f02b77ac6d5?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cG9kY2FzdHxlbnwwfHwwfHx8MA%3D%3D'
            },
            {
                id: '2',
                title: 'Social Media & Faith',
                description: 'Can you be an influencer for Christ?',
                duration: '32 min',
                url: '#',
                host: 'Special Guest',
                publishedAt: '2025-01-05',
                thumbnail: 'https://images.unsplash.com/photo-1559523161-0fc0d8b38a7a?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fHBvZGNhc3R8ZW58MHx8MHx8fDA%3D'
            }
        ];
    }
}

export const mockContentService = new MockContentService();

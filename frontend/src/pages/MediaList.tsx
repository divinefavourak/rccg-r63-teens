import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { m } from 'framer-motion';
import { Clock } from 'lucide-react';
import api from '../api/axios';
import { type MediaEpisode } from '../types';
import Seo from '../components/Seo';
import VideoPlayer from '../components/VideoPlayer';
import SitePage, { CARD, PROSE_LINK, Section } from '../components/site/SitePage';
import PageHeader from '../components/site/PageHeader';
import { AboutSection, EmptyState, Segmented, SkeletonGrid } from '../components/site/ContentBlocks';
import FloatingObject from '../components/site/FloatingObject';
import { fadeUp, stagger } from '../components/site/motion';
import { OBJECTS } from '../assets/site';

const MEDIA_BASE = import.meta.env.VITE_MEDIA_URL || 'http://localhost:8000';

const resolveUrl = (path: string | null | undefined): string | null => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${MEDIA_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
};

const getMediaUrl = (item: MediaEpisode): string | null => {
    if (item.media_type === 'video') {
        return resolveUrl(item.video_url || item.video_file);
    }
    return resolveUrl(item.audio_url || item.audio_file);
};

type Filter = 'all' | 'audio' | 'video';

const MediaCard = ({ item }: { item: MediaEpisode }) => {
    const mediaUrl = getMediaUrl(item);
    const thumbnail = resolveUrl(item.thumbnail);

    return (
        <m.li variants={fadeUp} className={`${CARD} group flex flex-col overflow-hidden`}>
            <div className="relative aspect-video overflow-hidden bg-ink">
                {item.media_type === 'video' && mediaUrl ? (
                    <VideoPlayer src={mediaUrl} poster={thumbnail} title={item.title} />
                ) : (
                    <div className="relative flex h-full flex-col items-center justify-center gap-3 bg-pop-violet px-4">
                        {thumbnail ? (
                            <img src={thumbnail} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-40" />
                        ) : (
                            <FloatingObject src={OBJECTS.headphone} className="size-20" />
                        )}
                        {mediaUrl && (
                            <audio controls preload="none" className="relative w-full max-w-xs">
                                <source src={mediaUrl} />
                            </audio>
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-1 flex-col gap-2 p-5">
                <div className="flex items-center justify-between gap-3 text-label-sm">
                    <span className={`rounded-full px-2.5 py-1 text-pop-on ${item.media_type === 'video' ? 'bg-pop-pink' : 'bg-pop-sky'}`}>
                        {item.media_type === 'video' ? 'Video' : 'Audio'}
                    </span>
                    {item.duration_formatted && (
                        <span className="flex items-center gap-1 text-content-muted">
                            <Clock size={14} aria-hidden /> {item.duration_formatted}
                        </span>
                    )}
                </div>
                <h3 className="line-clamp-2 text-title-md">{item.title}</h3>
                {item.description && <p className="line-clamp-2 text-body-sm text-content-secondary">{item.description}</p>}
            </div>
        </m.li>
    );
};

const MediaList = () => {
    const [filter, setFilter] = useState<Filter>('all');
    // The rows remember which filter they answer. "Loading" is then simply "the
    // rows on hand are for another filter", with no flag to set and reset.
    const [result, setResult] = useState<{ filter: Filter; items: MediaEpisode[] } | null>(null);
    const loading = result?.filter !== filter;
    const media = result?.items ?? [];

    useEffect(() => {
        let cancelled = false;
        const url = filter === 'all' ? '/media/episodes/' : `/media/episodes/?media_type=${filter}`;
        api.get(url)
            .then(({ data }) => {
                if (!cancelled) setResult({ filter, items: Array.isArray(data) ? data : data.results || [] });
            })
            .catch((error) => {
                console.error('Failed to fetch media', error);
                if (!cancelled) setResult({ filter, items: [] });
            });
        return () => {
            cancelled = true;
        };
    }, [filter]);

    return (
        <SitePage>
            <Seo path="/media" />

            <PageHeader
                eyebrow="PODCASTS & VIDEO"
                title="Podcasts & worship video"
                intro="Messages, choir ministrations and teaching from the region, free to stream in your browser."
                tone="bg-pop-pink"
                object={OBJECTS.headphone}
            />

            <Section className="pt-8 lg:pt-10">
                <Segmented<Filter>
                    label="Show"
                    value={filter}
                    onChange={setFilter}
                    options={[
                        { value: 'all', label: 'All' },
                        { value: 'audio', label: 'Audio' },
                        { value: 'video', label: 'Video' },
                    ]}
                />
            </Section>

            <Section className="pt-6">
                {loading ? (
                    <SkeletonGrid count={3} height="h-80" />
                ) : media.length === 0 ? (
                    <EmptyState object={OBJECTS.music} title="Nothing here yet.">
                        New recordings from camps and services are added as they are ready.
                    </EmptyState>
                ) : (
                    <m.ul
                        initial="hidden"
                        animate="show"
                        variants={stagger(0.05)}
                        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6"
                    >
                        {media.map((item) => (
                            <MediaCard key={item.id} item={item} />
                        ))}
                    </m.ul>
                )}
            </Section>

            <div className="pb-16 lg:pb-24">
                <AboutSection id="about-media" title="What is in the library">
                    <p>
                        The library holds what the region has already recorded: messages from camps and conferences,
                        choir and worship ministrations, and teaching series. It is not a live stream — everything here
                        plays from the beginning, at whatever hour suits you.
                    </p>
                    <p>
                        For the written side of the same ministry, the{' '}
                        <Link to="/devotionals" className={PROSE_LINK}>
                            daily devotional
                        </Link>{' '}
                        is published every morning, and the{' '}
                        <Link to="/manuals" className={PROSE_LINK}>
                            weekly teaching manual
                        </Link>{' '}
                        is what classes study on Sunday.
                    </p>
                </AboutSection>
            </div>
        </SitePage>
    );
};

export default MediaList;

import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { m } from 'framer-motion';
import toast from 'react-hot-toast';
import { Check, Heart, Share2 } from 'lucide-react';
import api from '../api/axios';
import { type Devotional } from '../types';
import { useAuthContext } from '../context/AuthContext';
import Seo from '../components/Seo';
import SitePage, { CARD, Section } from '../components/site/SitePage';
import PageHeader from '../components/site/PageHeader';
import { NextLinks } from '../components/site/ContentBlocks';
import SiteButton from '../components/site/SiteButton';
import { IN_VIEW, fadeUp, stagger } from '../components/site/motion';
import { articleLd } from '../../seo/schema.mjs';
import { devotionalDescription, devotionalTitle } from '../../seo/site.mjs';
import { formatAPIDate } from '../utils/dates';

const PILL =
    'inline-flex h-12 items-center gap-2 rounded-full border-[1.5px] border-ink px-5 text-body-md-strong transition-transform duration-150 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

/** A coloured block for one of the reading's short parts: key point, prayer. */
const Callout = ({ label, tone, children }: { label: string; tone: string; children: ReactNode }) => (
    <m.div variants={fadeUp} className={`flex flex-col gap-2 rounded-3xl p-5 text-pop-on lg:p-6 ${tone}`}>
        <p className="text-label-sm uppercase tracking-[0.08em]">{label}</p>
        <div className="text-title-md">{children}</div>
    </m.div>
);

const DevotionalDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthContext();
    // The reading remembers which id it answers, so moving from one devotional
    // to another shows the skeleton without a separate loading flag.
    const [loaded, setLoaded] = useState<{ id: string; devotional: Devotional } | null>(null);
    const devotional = loaded && loaded.id === id ? loaded.devotional : null;
    const [isRead, setIsRead] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(0);
    const [streak, setStreak] = useState<{ streak_days: number; total_read: number } | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (!id) return;

        api.get(`/content/devotionals/${id}/`)
            .then(({ data }) => {
                if (cancelled) return;
                setLoaded({ id, devotional: data });
                setLikesCount(data.likes_count ?? 0);
            })
            .catch(() => {
                if (cancelled) return;
                toast.error('Devotional not found');
                navigate('/devotionals', { replace: true });
            });

        if (isAuthenticated) {
            api.get('/content/devotionals/my_reads/')
                .then(({ data }) => {
                    if (cancelled) return;
                    setIsRead(Boolean(data.read_ids?.includes(id)));
                    setIsLiked(Boolean(data.like_ids?.includes(id)));
                    setStreak({ streak_days: data.streak_days, total_read: data.total_read });
                })
                .catch(() => {
                    // Not fatal: the reading still shows without the streak.
                });
        }

        return () => {
            cancelled = true;
        };
    }, [id, isAuthenticated, navigate]);

    const markAsRead = async () => {
        if (!devotional || isRead) return;
        try {
            const { data } = await api.post(`/content/devotionals/${id}/mark_read/`);
            setIsRead(true);
            setStreak({ streak_days: data.streak_days, total_read: data.total_read });
            toast.success(
                data.streak_days > 1
                    ? `${data.streak_days}-day streak. Keep it going!`
                    : 'Marked as read. Come back tomorrow to start a streak.',
            );
        } catch (error) {
            console.error(error);
            toast.error('Could not mark as read');
        }
    };

    const toggleLike = async () => {
        if (!devotional) return;
        try {
            const { data } = await api.post(`/content/devotionals/${id}/toggle_like/`);
            setIsLiked(data.liked);
            setLikesCount(data.likes_count);
        } catch {
            toast.error('Could not update like');
        }
    };

    const handleShare = async () => {
        const url = window.location.href;
        const title = devotional?.title || 'Daily Devotional';
        const text = devotional?.memory_verse_content
            ? `"${devotional.memory_verse_content}" — ${devotional.memory_verse_passage}`
            : 'Today’s devotional on Faith Tribe';

        try {
            if (navigator.share) {
                await navigator.share({ title, text, url });
            } else {
                await navigator.clipboard.writeText(url);
                toast.success('Link copied');
            }
            // Record the share on the backend (best-effort).
            api.post(`/content/devotionals/${id}/record_share/`).catch(() => {});
        } catch (err) {
            if ((err as { name?: string })?.name !== 'AbortError') toast.error('Could not share');
        }
    };

    if (!devotional) {
        return (
            <SitePage>
                <Section className="pt-1 lg:pt-4">
                    <div aria-busy="true" aria-label="Loading" className="h-[360px] animate-pulse rounded-[36px] bg-surface-sunken lg:rounded-[48px]" />
                </Section>
                <Section narrow className="pb-16 pt-8">
                    <div className="h-[420px] animate-pulse rounded-[28px] bg-surface-sunken" />
                </Section>
            </SitePage>
        );
    }

    const canonicalPath = `/devotionals/${devotional.id}`;
    // The same function the build used to write this page's file, so the meta
    // description a crawler reads and the one React sets are the same sentence.
    const description = devotionalDescription(devotional);
    const trail = [
        { name: 'Home', path: '/' },
        { name: 'Teenage Open Heavens', path: '/devotionals' },
        { name: devotional.title, path: canonicalPath },
    ];
    const verse = devotional.memory_verse_content || devotional.memory_verse || devotional.scripture_text;
    const verseRef = devotional.memory_verse_passage || devotional.scripture_reference || devotional.anchor_scripture;
    const prayer = devotional.prayer || devotional.prayer_point;
    const hymnFirstLine = devotional.hymn?.split('\n').find((line) => line.trim())?.trim();

    return (
        <SitePage>
            {/*
                The head is built from the same module the build script uses, so
                the file a crawler fetches and the document a browser renders
                describe the same article with the same canonical. `trail` gives
                both a BreadcrumbList and the visible trail in the header.
            */}
            <Seo
                path={canonicalPath}
                title={devotionalTitle(devotional)}
                description={description}
                image={devotional.cover_image || undefined}
                type="article"
                lastModified={devotional.updated_at || devotional.date}
                trail={trail}
                jsonLd={articleLd({
                    url: canonicalPath,
                    title: devotional.title,
                    description,
                    datePublished: devotional.date,
                    dateModified: devotional.updated_at,
                    image: devotional.cover_image || undefined,
                    author: devotional.author,
                })}
            />

            <PageHeader
                trail={trail}
                eyebrow={formatAPIDate(
                    devotional.date,
                    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
                    'en-GB',
                ).toUpperCase()}
                title={devotional.title}
                intro={devotional.author ? `By ${devotional.author}` : undefined}
                tone="bg-pop-green"
                aside={
                    verse ? (
                        <div className="flex flex-col gap-4 rounded-[28px] bg-ink p-6 text-on-ink lg:p-7">
                            <p className="text-label-sm uppercase tracking-[0.08em] text-pop-lime">Memorise</p>
                            <blockquote className="font-reader text-body-lg italic">“{verse}”</blockquote>
                            {verseRef && <p className="text-label-md">— {verseRef}</p>}
                            {(devotional.bible_text_passage || devotional.bible_in_one_year) && (
                                <div className="flex flex-col gap-1 border-t border-white/15 pt-4 text-body-sm">
                                    {devotional.bible_text_passage && (
                                        <p>
                                            <span className="opacity-70">Read: </span>
                                            <span className="font-semibold">{devotional.bible_text_passage}</span>
                                        </p>
                                    )}
                                    {devotional.bible_in_one_year && (
                                        <p>
                                            <span className="opacity-70">Bible in one year: </span>
                                            <span className="font-semibold">{devotional.bible_in_one_year}</span>
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : undefined
                }
            />

            <Section narrow className="pt-8 lg:pt-12">
                <m.article
                    initial="hidden"
                    animate="show"
                    variants={stagger(0.08, 0.2)}
                    className={`${CARD} flex flex-col gap-8 p-6 lg:p-10`}
                >
                    {devotional.bible_text_content && (
                        <m.section variants={fadeUp} aria-labelledby="scripture-text" className="flex flex-col gap-3 rounded-3xl bg-surface-sunken p-5 lg:p-6">
                            <h2 id="scripture-text" className="text-label-sm uppercase tracking-[0.08em] text-content-muted">
                                {devotional.bible_text_passage ? `Bible reading · ${devotional.bible_text_passage}` : 'Bible reading'}
                            </h2>
                            <p className="whitespace-pre-wrap font-reader text-body-md leading-7 text-content-secondary">
                                {devotional.bible_text_content}
                            </p>
                        </m.section>
                    )}

                    <m.section variants={fadeUp} aria-labelledby="message" className="flex flex-col gap-4">
                        <h2 id="message" className="text-label-sm uppercase tracking-[0.08em] text-content-brand">
                            Message
                        </h2>
                        <div className="site-prose" dangerouslySetInnerHTML={{ __html: devotional.content }} />
                    </m.section>

                    {(devotional.key_point || prayer || devotional.action_point || devotional.confession) && (
                        <div className="flex flex-col gap-3">
                            {devotional.key_point && (
                                <Callout label="Key point" tone="bg-pop-sky">
                                    {devotional.key_point}
                                </Callout>
                            )}
                            {devotional.action_point && (
                                <Callout label="Action point" tone="bg-pop-amber">
                                    {devotional.action_point}
                                </Callout>
                            )}
                            {prayer && (
                                <Callout label="Prayer point" tone="bg-pop-lime">
                                    {prayer}
                                </Callout>
                            )}
                            {devotional.confession && (
                                <Callout label="Confession" tone="bg-pop-violet">
                                    {devotional.confession}
                                </Callout>
                            )}
                        </div>
                    )}

                    {devotional.hymn && (
                        // A hymn runs to forty lines. Folded, it no longer pushes
                        // the actions off the bottom of a phone screen.
                        <m.details variants={fadeUp} className="group/hymn rounded-3xl bg-surface-sunken">
                            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-3xl p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [&::-webkit-details-marker]:hidden">
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="text-label-sm uppercase tracking-[0.08em] text-content-muted">Hymn</span>
                                    {hymnFirstLine && <span className="truncate text-title-sm">{hymnFirstLine}</span>}
                                </span>
                                <span
                                    aria-hidden
                                    className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-raised text-title-md transition-transform duration-300 group-open/hymn:rotate-45"
                                >
                                    +
                                </span>
                            </summary>
                            <p className="whitespace-pre-wrap px-5 pb-6 text-center font-reader text-body-md leading-7 text-content-secondary">
                                {devotional.hymn}
                            </p>
                        </m.details>
                    )}

                    {/* Actions */}
                    <m.div variants={fadeUp} className="flex flex-col gap-5 border-t border-line-strong pt-6">
                        {isAuthenticated && streak && (streak.streak_days > 0 || streak.total_read > 0) && (
                            <div className="flex items-center gap-5 rounded-3xl bg-pop-amber px-5 py-4 text-pop-on">
                                <div className="text-center">
                                    <p className="text-display">{streak.streak_days}</p>
                                    <p className="text-label-sm uppercase tracking-[0.08em]">Day streak</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-display">{streak.total_read}</p>
                                    <p className="text-label-sm uppercase tracking-[0.08em]">Read</p>
                                </div>
                                <p className="flex-1 text-body-sm">
                                    {streak.streak_days <= 1
                                        ? 'Come back tomorrow to keep it going.'
                                        : `${streak.streak_days} days in a row. Don’t break the chain.`}
                                </p>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3">
                            {isAuthenticated && (
                                <button
                                    type="button"
                                    onClick={markAsRead}
                                    disabled={isRead}
                                    className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-body-md-strong text-on-ink transition-transform duration-150 hover:-translate-y-0.5 disabled:pointer-events-none disabled:bg-pop-green disabled:text-pop-on focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                                >
                                    {isRead ? (
                                        <>
                                            <Check size={18} aria-hidden /> Read today
                                        </>
                                    ) : (
                                        'Mark as read'
                                    )}
                                </button>
                            )}
                            {isAuthenticated && (
                                <button type="button" onClick={toggleLike} aria-pressed={isLiked} className={PILL}>
                                    <Heart size={18} aria-hidden className={isLiked ? 'fill-pop-pink text-pop-pink' : ''} />
                                    {isLiked ? 'Liked' : 'Like'}
                                    {likesCount > 0 && <span className="text-content-muted">{likesCount}</span>}
                                </button>
                            )}
                            <button type="button" onClick={handleShare} className={PILL}>
                                <Share2 size={18} aria-hidden /> Share
                            </button>
                        </div>

                        {!isAuthenticated && (
                            <div className="flex flex-col gap-3 rounded-3xl bg-surface-sunken p-5 lg:flex-row lg:items-center lg:justify-between">
                                <p className="text-body-md text-content-secondary">
                                    Keep a reading streak and get tomorrow’s devotional on your phone.
                                </p>
                                <div className="flex shrink-0 gap-3">
                                    <SiteButton to="/#install">Get the app</SiteButton>
                                    <Link
                                        to="/login"
                                        className="inline-flex h-12 items-center rounded-full px-4 text-body-md-strong underline underline-offset-4 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                                    >
                                        Log in
                                    </Link>
                                </div>
                            </div>
                        )}
                    </m.div>
                </m.article>
            </Section>

            <m.div {...IN_VIEW} variants={fadeUp} className="pb-16 lg:pb-24">
                <NextLinks
                    title="More to read"
                    links={[
                        { to: '/devotionals', label: 'All devotionals', note: 'Every Teenage Open Heavens reading, newest first.' },
                        { to: '/manuals', label: 'This week’s study manual', note: 'The lesson your class studies on Sunday.' },
                    ]}
                />
            </m.div>
        </SitePage>
    );
};

export default DevotionalDetail;

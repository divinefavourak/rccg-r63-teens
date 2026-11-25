import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { m } from 'framer-motion';
import api from '../api/axios';
import { type Devotional } from '../types';
import Seo from '../components/Seo';
import SitePage, { CARD, FIELD, PROSE_LINK, Section } from '../components/site/SitePage';
import PageHeader from '../components/site/PageHeader';
import { AboutSection, EmptyState, NextLinks, SkeletonGrid } from '../components/site/ContentBlocks';
import { POP_TONES } from '../components/site/tones';
import FloatingObject from '../components/site/FloatingObject';
import SiteButton from '../components/site/SiteButton';
import { IN_VIEW, fadeUp, stagger } from '../components/site/motion';
import { OBJECTS } from '../assets/site';
import { itemListLd } from '../../seo/schema.mjs';
import { formatAPIDate } from '../utils/dates';

/** The verse reference a card shows, from whichever field this row carries. */
const verseOf = (d: Devotional) =>
    d.memory_verse_passage || d.bible_text_passage || d.scripture_reference || d.anchor_scripture || '';

const dayOf = (d: Devotional, style: 'short' | 'long' = 'short') =>
    formatAPIDate(
        d.date,
        style === 'long'
            ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
            : { day: 'numeric', month: 'short', year: 'numeric' },
        'en-GB',
    );

/** One reading in the grid. The colour is fixed by position so it does not
 *  flicker as the list reloads. */
const DevotionalTile = ({ devotional, tone }: { devotional: Devotional; tone: string }) => (
    <m.li variants={fadeUp}>
        <Link
            to={`/devotionals/${devotional.id}`}
            className={`${CARD} group flex h-full flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
        >
            <div className={`flex min-h-[140px] flex-col justify-end gap-2 p-5 text-pop-on ${tone}`}>
                <span className="text-label-sm uppercase tracking-[0.08em]">{dayOf(devotional)}</span>
                <h3 className="line-clamp-2 text-title-lg">{devotional.title}</h3>
            </div>
            <div className="flex flex-1 items-center justify-between gap-3 p-5">
                <span className="truncate text-body-sm text-content-secondary">{verseOf(devotional)}</span>
                <span className="shrink-0 text-label-md text-content-primary group-hover:underline">Read →</span>
            </div>
        </Link>
    </m.li>
);

/**
 * The archive of Teenage Open Heavens.
 *
 * The page is written for two readers. A teenager decides in one line whether
 * today's reading is worth four minutes; a search engine needs a page that
 * says plainly what this content is, who writes it and how often it changes.
 * Both are served by the header and by the section under the list, which is
 * where the page explains itself in prose rather than in cards.
 *
 * The list asks for 60 rows instead of the default 20. Every row is a link to a
 * devotional, and the only other path to an old reading is the sitemap; sixty
 * recent ones is what a crawler will follow to reach the archive.
 */
const DevotionalList = () => {
    const [devotionals, setDevotionals] = useState<Devotional[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const searchId = useId();
    const dateId = useId();

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams({ status: 'published', page_size: '60', ordering: '-date' });
                if (selectedDate) params.set('date', selectedDate);
                const { data } = await api.get(`/content/devotionals/?${params.toString()}`);
                // Paginated endpoints return { results }, hard-sliced actions an array.
                if (!cancelled) {
                    setDevotionals(Array.isArray(data) ? data : data.results || []);
                    setFailed(false);
                }
            } catch (error) {
                console.error('Failed to fetch devotionals', error);
                if (!cancelled) {
                    setDevotionals([]);
                    setFailed(true);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [selectedDate, attempt]);

    const term = searchQuery.trim().toLowerCase();
    const filtered = devotionals.filter(
        (d) => !term || d.title.toLowerCase().includes(term) || (d.content || '').toLowerCase().includes(term),
    );
    const filtering = Boolean(term || selectedDate);
    // With no filter on, the newest reading leads as a wide card: it is what
    // most visitors came for.
    const [latest, ...rest] = filtered;
    const grid = filtering ? filtered : rest;

    const clearFilters = () => {
        setSelectedDate('');
        setSearchQuery('');
    };

    return (
        <SitePage>
            <Seo
                path="/devotionals"
                jsonLd={
                    devotionals.length
                        ? itemListLd({
                              url: '/devotionals',
                              name: 'Teenage Open Heavens — daily devotionals',
                              items: devotionals.slice(0, 20).map((item) => ({
                                  url: `/devotionals/${item.id}`,
                                  name: item.title,
                                  datePublished: item.date,
                                  image: item.cover_image,
                              })),
                          })
                        : undefined
                }
            />

            <PageHeader
                eyebrow="DAILY DEVOTIONAL"
                title="Teenage Open Heavens"
                intro="The daily devotional for teenagers: a short reading, a memory verse to keep, a key point and a prayer point. A new one is published every morning, and the archive stays open."
                tone="bg-pop-green"
                object={OBJECTS.sun}
            />

            {/* Filters */}
            <Section className="pt-8 lg:pt-10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label htmlFor={searchId} className="sr-only">
                        Search devotionals by title or topic
                    </label>
                    <input
                        id={searchId}
                        type="search"
                        placeholder="Search a topic, like “friends” or “fear”"
                        className={`${FIELD} sm:max-w-[420px]`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <div className="flex items-center gap-3">
                        <label htmlFor={dateId} className="text-label-md text-content-secondary">
                            Date
                        </label>
                        <input
                            id={dateId}
                            type="date"
                            className={`${FIELD} w-auto`}
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                        {filtering && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="rounded-full px-3 py-2 text-label-md text-content-primary underline underline-offset-4 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            </Section>

            <Section className="pt-6">
                {loading ? (
                    <SkeletonGrid height="h-56" />
                ) : failed ? (
                    // Said plainly, not as "no matches": a failed request with
                    // no filter on used to tell the reader to clear filters
                    // they had never set.
                    <EmptyState object={OBJECTS.wifi} title="The devotionals didn’t load.">
                        <button
                            type="button"
                            onClick={() => setAttempt((n) => n + 1)}
                            className="text-label-md underline underline-offset-4 hover:no-underline"
                        >
                            Try again
                        </button>
                    </EmptyState>
                ) : filtered.length === 0 ? (
                    <EmptyState
                        object={OBJECTS.zoom}
                        title={filtering ? 'No devotionals match that.' : 'No devotionals published yet.'}
                    >
                        {filtering && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="text-label-md underline underline-offset-4 hover:no-underline"
                            >
                                Clear the filters
                            </button>
                        )}
                    </EmptyState>
                ) : (
                    <div className="flex flex-col gap-5 lg:gap-6">
                        {!filtering && latest && (
                            <m.div initial="hidden" animate="show" variants={stagger(0.08)}>
                                <Link
                                    to={`/devotionals/${latest.id}`}
                                    className="group relative flex flex-col gap-4 overflow-hidden rounded-[36px] bg-ink p-6 text-on-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink lg:flex-row lg:items-end lg:justify-between lg:rounded-[48px] lg:p-12"
                                >
                                    <div className="flex max-w-[720px] flex-col gap-3">
                                        <m.span
                                            variants={fadeUp}
                                            className="w-fit rounded-full bg-pop-green px-3 py-1.5 text-label-sm tracking-[0.08em] text-pop-on"
                                        >
                                            LATEST · {dayOf(latest, 'long').toUpperCase()}
                                        </m.span>
                                        <m.h2 variants={fadeUp} className="text-display lg:text-display-xl">
                                            {latest.title}
                                        </m.h2>
                                        {latest.memory_verse_content && (
                                            <m.p
                                                variants={fadeUp}
                                                className="line-clamp-3 font-reader text-body-lg italic opacity-90"
                                            >
                                                “{latest.memory_verse_content}”
                                                {latest.memory_verse_passage && (
                                                    <span className="not-italic"> — {latest.memory_verse_passage}</span>
                                                )}
                                            </m.p>
                                        )}
                                    </div>
                                    <m.span
                                        variants={fadeUp}
                                        className="inline-flex h-14 w-fit shrink-0 items-center rounded-full bg-pop-green px-7 text-body-md-strong text-pop-on transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:scale-[1.03]"
                                    >
                                        Read it now
                                    </m.span>
                                    <FloatingObject
                                        src={OBJECTS.candle}
                                        className="pointer-events-none absolute -right-2 -top-4 hidden size-28 lg:block"
                                    />
                                </Link>
                            </m.div>
                        )}

                        {grid.length > 0 && (
                            <m.ul
                                initial="hidden"
                                animate="show"
                                variants={stagger(0.04)}
                                className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6"
                            >
                                {grid.map((devotional, i) => (
                                    <DevotionalTile
                                        key={devotional.id}
                                        devotional={devotional}
                                        tone={POP_TONES[i % POP_TONES.length]}
                                    />
                                ))}
                            </m.ul>
                        )}
                    </div>
                )}
            </Section>

            <AboutSection id="about-the-devotional" title="What is Teenage Open Heavens?">
                <p>
                    Teenage Open Heavens is the daily devotional of the Redeemed Christian Church of God, written for
                    teenagers rather than for adults. Each day&rsquo;s reading opens with a passage of Scripture and a
                    memory verse, carries a short message, and ends with a key point and a prayer point you can pray
                    in your own words.
                </p>
                <p>
                    Every reading here is published free, without an account, and it stays available afterwards — so
                    a missed morning is not a lost one. If you would rather read on your phone with the verse, the
                    Bible text and a reminder in one place, the{' '}
                    <Link to="/#install" className={PROSE_LINK}>
                        Faith Tribe app
                    </Link>{' '}
                    carries today&rsquo;s devotional, the whole Bible and your reading streak.
                </p>
            </AboutSection>

            <NextLinks
                title="Keep going after today’s reading"
                links={[
                    { to: '/manuals', label: 'This week’s study manual', note: 'The teaching manual for your class, week by week.' },
                    { to: '/media', label: 'Podcasts and worship', note: 'Messages and ministration to listen to on the way.' },
                    { to: '/events', label: 'Camps and events', note: 'What is coming up in Region 63, and how to register.' },
                    { to: '/help', label: 'Questions', note: 'Accounts, notifications and how to get the app.' },
                ]}
            />

            <Section narrow className="pb-16 pt-10 lg:pb-24">
                <m.div {...IN_VIEW} variants={fadeUp}>
                    <SiteButton to="/#install">Get the Faith Tribe app</SiteButton>
                </m.div>
            </Section>
        </SitePage>
    );
};

export default DevotionalList;

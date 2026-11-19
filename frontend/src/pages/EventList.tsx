import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { m } from 'framer-motion';
import { Calendar, MapPin, Users } from 'lucide-react';
import api from '../api/axios';
import { type Event } from '../types';
import Seo from '../components/Seo';
import SitePage, { CARD, FIELD, PROSE_LINK, Section } from '../components/site/SitePage';
import PageHeader from '../components/site/PageHeader';
import { AboutSection, EmptyState, Segmented, SkeletonGrid } from '../components/site/ContentBlocks';
import { fadeUp, stagger } from '../components/site/motion';
import { OBJECTS } from '../assets/site';
import { itemListLd } from '../../seo/schema.mjs';
import {
    eventDay,
    eventDayParts,
    eventPlace,
    eventPriceLabel,
    eventTime,
    isUpcoming,
    spotsLeft,
} from '../lib/eventDisplay';

type Filter = 'upcoming' | 'all' | 'past';

const EventCard = ({ event }: { event: Event }) => {
    const upcoming = isUpcoming(event);
    const price = eventPriceLabel(event);
    const left = spotsLeft(event);
    const place = eventPlace(event);

    return (
        <m.li variants={fadeUp}>
            <Link
                to={`/events/${event.id}`}
                className={`${CARD} group flex h-full flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
            >
                <div className="relative aspect-[4/3] overflow-hidden bg-pop-amber">
                    {event.cover_image ? (
                        <img
                            src={event.cover_image}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center text-pop-on">
                            <span className="text-display-xl">{eventDayParts(event.start_datetime).day}</span>
                            <span className="text-label-md uppercase tracking-[0.1em]">
                                {eventDayParts(event.start_datetime).month}
                            </span>
                        </div>
                    )}
                    <div className="absolute inset-x-3 top-3 flex justify-between gap-2">
                        {price ? (
                            <span className="rounded-full bg-ink px-3 py-1 text-label-sm text-on-ink">{price}</span>
                        ) : (
                            <span />
                        )}
                        <span
                            className={`rounded-full px-3 py-1 text-label-sm ${upcoming ? 'bg-pop-green text-pop-on' : 'bg-surface-raised text-content-secondary'}`}
                        >
                            {upcoming ? 'Upcoming' : 'Past'}
                        </span>
                    </div>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-5">
                    <h3 className="text-title-md">{event.title}</h3>
                    <ul className="mt-auto flex flex-col gap-1.5 text-body-sm text-content-secondary">
                        <li className="flex items-start gap-2">
                            <Calendar size={16} aria-hidden className="mt-0.5 shrink-0" />
                            <span>
                                {eventDay(event.start_datetime)} · {eventTime(event.start_datetime)}
                            </span>
                        </li>
                        {place && (
                            <li className="flex items-start gap-2">
                                <MapPin size={16} aria-hidden className="mt-0.5 shrink-0" />
                                <span className="line-clamp-2">{place}</span>
                            </li>
                        )}
                        {upcoming && left !== null && (
                            <li className="flex items-start gap-2">
                                <Users size={16} aria-hidden className="mt-0.5 shrink-0" />
                                <span>{left === 0 ? 'Fully booked' : `${left} places left`}</span>
                            </li>
                        )}
                    </ul>
                    <span className="text-label-md group-hover:underline">See details →</span>
                </div>
            </Link>
        </m.li>
    );
};

const EventList = () => {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('upcoming');
    const searchId = useId();

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            try {
                // Filter on the server before the 60-row page is cut. A
                // client-side filter saw only the first 60 ever-published
                // events, so once those had started the Upcoming tab was empty
                // even when newer events existed.
                const params = new URLSearchParams({
                    status: 'published',
                    page_size: '60',
                    ordering: filter === 'past' ? '-start_datetime' : 'start_datetime',
                });
                if (filter !== 'all') params.set('upcoming', String(filter === 'upcoming'));

                const { data } = await api.get(`/events/events/?${params.toString()}`);
                if (!cancelled) setEvents(Array.isArray(data) ? data : data.results || []);
            } catch {
                if (!cancelled) {
                    console.error('Failed to fetch events');
                    setEvents([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [filter]);

    // The server has already applied the upcoming/past boundary. Searching
    // only narrows the page that was returned.
    const term = searchQuery.trim().toLowerCase();
    const filtered = events.filter(
        (e) => !term || e.title.toLowerCase().includes(term) || (e.venue || '').toLowerCase().includes(term),
    );

    return (
        <SitePage>
            <Seo
                path="/events"
                jsonLd={
                    events.length
                        ? itemListLd({
                              url: '/events',
                              name: 'Camps, retreats and events for RCCG Region 63 teenagers',
                              itemType: 'Event',
                              items: events.slice(0, 20).map((item) => ({
                                  url: `/events/${item.id}`,
                                  name: item.title,
                                  startDate: item.start_datetime,
                                  image: item.cover_image,
                              })),
                          })
                        : undefined
                }
            />

            <PageHeader
                eyebrow="EVENTS & CAMPS"
                title="Camps, retreats & events"
                intro="Everything Region 63 is running for teenagers, in one place. Register online, pay by card or bank transfer, and carry your ticket on your phone to the door."
                tone="bg-pop-amber"
                object={OBJECTS.travel}
            />

            <Section className="pt-8 lg:pt-10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label htmlFor={searchId} className="sr-only">
                        Search events by name or venue
                    </label>
                    <input
                        id={searchId}
                        type="search"
                        placeholder="Search events or venues"
                        className={`${FIELD} sm:max-w-[420px]`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Segmented<Filter>
                        label="Which events"
                        value={filter}
                        onChange={setFilter}
                        options={[
                            { value: 'upcoming', label: 'Upcoming' },
                            { value: 'all', label: 'All' },
                            { value: 'past', label: 'Past' },
                        ]}
                    />
                </div>
            </Section>

            <Section className="pt-6">
                {loading ? (
                    <SkeletonGrid count={3} height="h-96" />
                ) : filtered.length === 0 ? (
                    <EmptyState
                        object={OBJECTS.calendar}
                        title={term ? 'No events match that.' : filter === 'upcoming' ? 'Nothing coming up just yet.' : 'No events here.'}
                    >
                        {filter === 'upcoming' && !term
                            ? 'New camps and hangouts are announced here and in the app. Check the past events to see what the region runs.'
                            : null}
                    </EmptyState>
                ) : (
                    <m.ul
                        initial="hidden"
                        animate="show"
                        variants={stagger(0.06)}
                        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6"
                    >
                        {filtered.map((event) => (
                            <EventCard key={event.id} event={event} />
                        ))}
                    </m.ul>
                )}
            </Section>

            {/*
                What the cards cannot say: who runs these, what the money is
                for, and what happens after you register. A parent deciding
                whether to send a 14-year-old to a four-day camp needs this
                before they need a button.
            */}
            <AboutSection id="about-events" title="How a Region 63 event works">
                <p>
                    Events are run by the parishes, areas and provinces of RCCG Region 63 Junior Church, and
                    coordinated by the region&rsquo;s teen leaders. Camps and retreats are residential and usually run
                    for three or four days; hangouts and competitions are single days. Each listing says which, where,
                    and what it costs.
                </p>
                <p>
                    Registration is a short form — the teenager&rsquo;s details, and for anyone under eighteen, a
                    parent or guardian&rsquo;s name, phone number and consent. If there is a price, you pay at the end
                    through Squad, or upload proof of a bank transfer. Your ticket arrives on the screen and by email,
                    and a leader scans it at the door.
                </p>
                <p>
                    Nothing is shared publicly: only the leaders for that event see the registrations, and the health
                    details on the form exist so that someone can act if a teen is taken ill at camp. What is
                    collected, and who can see it, is set out in the{' '}
                    <Link to="/privacy" className={PROSE_LINK}>
                        privacy notice
                    </Link>
                    .
                </p>
            </AboutSection>

            <Section narrow className="pb-16 pt-10 lg:pb-24">
                <h2 className="text-title-lg">Before you ask</h2>
                <dl className="mt-4 flex flex-col gap-3">
                    {[
                        {
                            q: 'Can I pay at the venue?',
                            a: (
                                <>
                                    Ask the organisers for that event — the listing names them, with an email and a
                                    phone number.
                                </>
                            ),
                        },
                        {
                            q: 'I registered and have no ticket.',
                            a: (
                                <>
                                    Confirmation can take a few minutes after a payment.{' '}
                                    <Link to="/ticket-not-found" className={PROSE_LINK}>
                                        Look up a ticket
                                    </Link>
                                    .
                                </>
                            ),
                        },
                        {
                            q: 'I need to change a registration.',
                            a: (
                                <>
                                    Write to the event&rsquo;s organisers as early as you can. Changes and refunds are
                                    their decision, not the site&rsquo;s.
                                </>
                            ),
                        },
                    ].map((item) => (
                        <div key={item.q} className={`${CARD} p-5`}>
                            <dt className="text-title-sm">{item.q}</dt>
                            <dd className="mt-1 text-body-md text-content-secondary">{item.a}</dd>
                        </div>
                    ))}
                </dl>
            </Section>
        </SitePage>
    );
};

export default EventList;

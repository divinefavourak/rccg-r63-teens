import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import toast from 'react-hot-toast';
import { Calendar, Clock, Globe, Mail, MapPin, Phone, Ticket } from 'lucide-react';
import api from '../api/axios';
import { type Event } from '../types';
import { useAuthContext } from '../context/AuthContext';
import Seo from '../components/Seo';
import Markdown from '../components/Markdown';
import SitePage, { CARD, PROSE_LINK, Section } from '../components/site/SitePage';
import PageHeader from '../components/site/PageHeader';
import { NextLinks } from '../components/site/ContentBlocks';
import EventRegistrationDialog, { type Prefill } from '../components/site/EventRegistrationDialog';
import { IN_VIEW, fadeUp, stagger } from '../components/site/motion';
import { OBJECTS } from '../assets/site';
import { eventLd } from '../../seo/schema.mjs';
import { eventDescription } from '../../seo/site.mjs';
import { eventDay, eventPlace, eventPriceLabel, eventTime, spotsLeft } from '../lib/eventDisplay';

/** One titled card in the event's main column. */
const Block = ({ title, children }: { title: string; children: ReactNode }) => (
    <m.section {...IN_VIEW} variants={fadeUp} className={`${CARD} flex flex-col gap-4 p-6 lg:p-8`}>
        <h2 className="text-title-lg">{title}</h2>
        {children}
    </m.section>
);

const Fact = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
    <li className="flex items-start gap-2 text-body-md-strong">
        <span aria-hidden className="mt-0.5 shrink-0">
            {icon}
        </span>
        <span>{children}</span>
    </li>
);

const EventDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuthContext();

    // The event remembers which id it answers; see DevotionalDetail.
    const [loaded, setLoaded] = useState<{ id: string; event: Event } | null>(null);
    const event = loaded && loaded.id === id ? loaded.event : null;
    const [dialogOpen, setDialogOpen] = useState(false);
    const [registered, setRegistered] = useState(false);
    // Read once per visit. Registration state should not flip mid-render.
    const [now] = useState(() => Date.now());

    useEffect(() => {
        let cancelled = false;
        if (!id) return;
        api.get(`/events/events/${id}/`)
            .then(({ data }) => {
                if (!cancelled) setLoaded({ id, event: data });
            })
            .catch(() => {
                if (cancelled) return;
                toast.error('Event not found');
                navigate('/events', { replace: true });
            });
        return () => {
            cancelled = true;
        };
    }, [id, navigate]);

    const closeDialog = useCallback(() => setDialogOpen(false), []);
    const onRegistered = useCallback(() => {
        setDialogOpen(false);
        setRegistered(true);
    }, []);

    const openDialog = () => {
        if (!user) {
            toast('Log in to register for this event');
            navigate('/login');
            return;
        }
        setDialogOpen(true);
    };

    if (!event) {
        return (
            <SitePage>
                <Section className="pt-1 lg:pt-4">
                    <div aria-busy="true" aria-label="Loading" className="h-[420px] animate-pulse rounded-[36px] bg-surface-sunken lg:rounded-[48px]" />
                </Section>
            </SitePage>
        );
    }

    const started = new Date(event.start_datetime).getTime() <= now;
    const regOpen = event.registration_status === 'open';
    const canRegister = !started && regOpen && !registered;
    const price = eventPriceLabel(event);
    const left = spotsLeft(event);
    const place = eventPlace(event);

    const canonicalPath = `/events/${event.id}`;
    // Shared with the build, so the file and the document agree.
    const description = eventDescription(event as unknown as Record<string, unknown>);
    const trail = [
        { name: 'Home', path: '/' },
        { name: 'Events', path: '/events' },
        { name: event.title, path: canonicalPath },
    ];

    const status = registered
        ? 'YOU ARE REGISTERED'
        : started
          ? new Date(event.end_datetime || event.start_datetime).getTime() < now
              ? 'PAST EVENT'
              : 'HAPPENING NOW'
          : regOpen
            ? 'REGISTRATION OPEN'
            : 'REGISTRATION CLOSED';

    const u = user as (typeof user & { phone?: string; province?: string; parish?: string }) | null;
    const prefill: Prefill = {
        name: u?.first_name && u?.last_name ? `${u.first_name} ${u.last_name}` : undefined,
        email: u?.email,
        phone: u?.phone,
        province: u?.province,
        parish: u?.parish,
    };

    const schedule = (event.schedule ?? []) as { time?: string; title?: string; description?: string }[];
    const faqs = (event.faqs ?? []) as { question?: string; answer?: string }[];

    return (
        <SitePage>
            {/*
                Event structured data, built from this event (and in the file the
                build writes), so it describes the event the reader is looking at.
            */}
            <Seo
                path={canonicalPath}
                title={event.title}
                description={description}
                image={event.cover_image || undefined}
                type="website"
                lastModified={event.updated_at || event.start_datetime}
                trail={trail}
                jsonLd={eventLd(event, canonicalPath)}
            />

            <PageHeader
                trail={trail}
                eyebrow={status}
                title={event.title}
                tone="bg-pop-amber"
                object={event.cover_image ? undefined : OBJECTS.calendar}
                aside={
                    event.cover_image ? (
                        // The flier whole. It is usually words on a poster, and
                        // the old page cropped it into a background under a
                        // gradient, which made the words unreadable.
                        <img
                            src={event.cover_image}
                            alt={`Flier for ${event.title}`}
                            className="max-h-[520px] w-full rounded-[28px] object-contain shadow-elevation-3"
                        />
                    ) : undefined
                }
            >
                <ul className="flex flex-col gap-2">
                    <Fact icon={<Calendar size={18} />}>
                        {eventDay(event.start_datetime, 'long')}
                        {event.end_datetime && eventDay(event.end_datetime) !== eventDay(event.start_datetime)
                            ? ` – ${eventDay(event.end_datetime, 'long')}`
                            : ''}
                    </Fact>
                    <Fact icon={<Clock size={18} />}>{eventTime(event.start_datetime)}</Fact>
                    {place && <Fact icon={<MapPin size={18} />}>{place}</Fact>}
                </ul>
                {canRegister && (
                    <button
                        type="button"
                        onClick={openDialog}
                        className="inline-flex h-14 items-center gap-2 rounded-full bg-ink px-7 text-body-md-strong text-on-ink transition-transform duration-150 hover:-translate-y-0.5 hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:hidden"
                    >
                        <Ticket size={18} aria-hidden /> Register{price ? ` · ${price}` : ''}
                    </button>
                )}
            </PageHeader>

            <Section className="pt-8 lg:pt-12">
                <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
                    <div className="flex flex-col gap-5">
                        <Block title="About this event">
                            {event.description ? (
                                // Written in the small Markdown of lib/markdown.ts.
                                <Markdown source={event.description} tone="site" className="text-body-md text-content-secondary lg:text-body-lg" />
                            ) : event.short_description ? (
                                <p className="text-body-md text-content-secondary">{event.short_description}</p>
                            ) : (
                                <p className="text-body-md text-content-muted">The organisers have not added a description yet.</p>
                            )}
                        </Block>

                        <Block title="Details">
                            <dl className="grid grid-cols-2 gap-4 text-body-sm">
                                {event.event_type && (
                                    <div>
                                        <dt className="text-content-muted">Type</dt>
                                        <dd className="text-body-md-strong capitalize">{event.event_type.replace(/_/g, ' ')}</dd>
                                    </div>
                                )}
                                {event.end_datetime && (
                                    <div>
                                        <dt className="text-content-muted">Ends</dt>
                                        <dd className="text-body-md-strong">{eventDay(event.end_datetime)}</dd>
                                    </div>
                                )}
                                {event.max_attendees ? (
                                    <div>
                                        <dt className="text-content-muted">Capacity</dt>
                                        <dd className="text-body-md-strong">{event.max_attendees} people</dd>
                                    </div>
                                ) : null}
                                {left !== null && (
                                    <div>
                                        <dt className="text-content-muted">Places left</dt>
                                        <dd className="text-body-md-strong">{left === 0 ? 'Fully booked' : left}</dd>
                                    </div>
                                )}
                                {(event.is_virtual || event.is_hybrid) && (
                                    <div>
                                        <dt className="text-content-muted">Format</dt>
                                        <dd className="text-body-md-strong">{event.is_hybrid ? 'In person and online' : 'Online'}</dd>
                                    </div>
                                )}
                            </dl>
                            {event.virtual_link && (
                                <p className="flex items-center gap-2 text-body-sm">
                                    <Globe size={16} aria-hidden className="shrink-0" />
                                    <span className="text-content-muted">{event.virtual_platform || 'Online link'}:</span>
                                    <a href={event.virtual_link} target="_blank" rel="noopener noreferrer" className={`${PROSE_LINK} break-all`}>
                                        {event.virtual_link}
                                    </a>
                                </p>
                            )}
                        </Block>

                        {event.what_to_bring && event.what_to_bring.length > 0 && (
                            <Block title="What to bring">
                                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body-md text-content-secondary">
                                    {event.what_to_bring.map((item, i) => (
                                        <li key={i}>{item}</li>
                                    ))}
                                </ul>
                            </Block>
                        )}

                        {schedule.length > 0 && (
                            <Block title="Schedule">
                                <ol className="flex flex-col gap-3">
                                    {schedule.map((item, i) => (
                                        <li key={i} className="flex gap-4 text-body-md">
                                            {item.time && <span className="w-16 shrink-0 text-body-md-strong">{item.time}</span>}
                                            <div>
                                                {item.title && <p className="text-body-md-strong">{item.title}</p>}
                                                {item.description && <p className="text-body-sm text-content-secondary">{item.description}</p>}
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </Block>
                        )}

                        {faqs.length > 0 && (
                            <Block title="Questions">
                                <dl className="flex flex-col gap-4">
                                    {faqs.map((faq, i) => (
                                        <div key={i}>
                                            {faq.question && <dt className="text-body-md-strong">{faq.question}</dt>}
                                            {faq.answer && <dd className="mt-1 text-body-md text-content-secondary">{faq.answer}</dd>}
                                        </div>
                                    ))}
                                </dl>
                            </Block>
                        )}

                        {event.organizer_name && (
                            <Block title="Organiser">
                                <p className="text-body-md-strong">{event.organizer_name}</p>
                                <ul className="flex flex-col gap-1.5 text-body-sm text-content-secondary">
                                    {event.organizer_email && (
                                        <li className="flex items-center gap-2">
                                            <Mail size={16} aria-hidden />
                                            <a href={`mailto:${event.organizer_email}`} className={PROSE_LINK}>
                                                {event.organizer_email}
                                            </a>
                                        </li>
                                    )}
                                    {event.organizer_phone && (
                                        <li className="flex items-center gap-2">
                                            <Phone size={16} aria-hidden />
                                            <a href={`tel:${event.organizer_phone.replace(/\s+/g, '')}`} className={PROSE_LINK}>
                                                {event.organizer_phone}
                                            </a>
                                        </li>
                                    )}
                                </ul>
                            </Block>
                        )}
                    </div>

                    {/* Sidebar: the price and the one action. */}
                    <m.aside
                        initial="hidden"
                        animate="show"
                        variants={stagger(0.06, 0.2)}
                        className={`${CARD} flex flex-col gap-5 p-6 lg:sticky lg:top-6`}
                    >
                        <m.div variants={fadeUp} className="flex items-baseline justify-between gap-3">
                            <span className="text-label-md text-content-secondary">Admission</span>
                            <span className="text-display">{price ?? '—'}</span>
                        </m.div>

                        {event.max_attendees && typeof event.registration_count === 'number' ? (
                            <m.div variants={fadeUp} className="flex flex-col gap-2">
                                <div className="flex justify-between text-body-sm">
                                    <span className="text-content-secondary">Registered</span>
                                    <span className="text-body-md-strong">
                                        {event.registration_count} / {event.max_attendees}
                                    </span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
                                    <div
                                        className="h-full rounded-full bg-pop-green"
                                        style={{ width: `${Math.min((event.registration_count / event.max_attendees) * 100, 100)}%` }}
                                    />
                                </div>
                            </m.div>
                        ) : null}

                        <m.div variants={fadeUp}>
                            {registered ? (
                                <p className="rounded-full bg-pop-green px-5 py-4 text-center text-body-md-strong text-pop-on">
                                    You are registered
                                </p>
                            ) : (
                                <button
                                    type="button"
                                    onClick={openDialog}
                                    disabled={!canRegister}
                                    className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink text-body-md-strong text-on-ink transition-transform duration-150 enabled:hover:-translate-y-0.5 disabled:bg-surface-sunken disabled:text-content-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                                >
                                    <Ticket size={18} aria-hidden />
                                    {canRegister ? 'Register now' : status === 'PAST EVENT' ? 'This event has ended' : 'Registration closed'}
                                </button>
                            )}
                        </m.div>

                        {canRegister && left !== null && (
                            <m.p variants={fadeUp} className="text-center text-body-sm text-content-secondary">
                                {left === 0 ? 'Fully booked' : `${left} places left`}
                            </m.p>
                        )}
                        {!user && canRegister && (
                            <m.p variants={fadeUp} className="text-center text-body-sm text-content-muted">
                                You will be asked to log in first.
                            </m.p>
                        )}
                    </m.aside>
                </div>
            </Section>

            <div className="pb-16 lg:pb-24">
                <NextLinks
                    title="More from Faith Tribe"
                    links={[
                        { to: '/events', label: 'All events', note: 'Camps, retreats and hangouts across Region 63.' },
                        { to: '/devotionals', label: 'Today’s devotional', note: 'A few minutes with God before the day starts.' },
                    ]}
                />
            </div>

            {dialogOpen && (
                <EventRegistrationDialog event={event} prefill={prefill} onClose={closeDialog} onRegistered={onRegistered} />
            )}
        </SitePage>
    );
};

export default EventDetail;

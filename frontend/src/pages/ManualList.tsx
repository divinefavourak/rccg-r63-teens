import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { m } from 'framer-motion';
import { Download } from 'lucide-react';
import api from '../api/axios';
import { type Manual } from '../types';
import Seo from '../components/Seo';
import SitePage, { CARD, PROSE_LINK, Section } from '../components/site/SitePage';
import PageHeader from '../components/site/PageHeader';
import { AboutSection, EmptyState, SkeletonGrid } from '../components/site/ContentBlocks';
import { POP_TONES } from '../components/site/tones';
import FloatingObject from '../components/site/FloatingObject';
import { fadeUp, stagger } from '../components/site/motion';
import { OBJECTS } from '../assets/site';

const AGE_LABELS: Record<string, string> = {
    all: 'All ages',
    children: 'Children (6–8)',
    pre_teen: 'Pre-teen (9–12)',
    teen: 'Teen (13–19)',
    superteen: 'Superteen (20–25)',
    adult: 'Adult (26+)',
};

const ManualCard = ({ manual, tone }: { manual: Manual; tone: string }) => {
    const pdf = manual.pdf_file || manual.pdf_url || '';

    return (
        <m.li variants={fadeUp} className={`${CARD} group flex flex-col overflow-hidden`}>
            <div className={`relative aspect-[16/10] overflow-hidden ${tone}`}>
                {manual.cover_image ? (
                    <img src={manual.cover_image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                    <FloatingObject src={OBJECTS.notebook} className="absolute left-1/2 top-1/2 size-28 -translate-x-1/2 -translate-y-1/2" />
                )}
            </div>
            <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center gap-2 text-label-sm">
                    {manual.target_age_group && (
                        <span className="rounded-full bg-surface-sunken px-2.5 py-1">
                            {AGE_LABELS[manual.target_age_group] || manual.target_age_group}
                        </span>
                    )}
                    {manual.week_number > 0 && <span className="text-content-muted">Week {manual.week_number}</span>}
                    {manual.week_start_date && (
                        <span className="text-content-muted">
                            ·{' '}
                            {new Date(manual.week_start_date).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                timeZone: 'UTC',
                            })}
                        </span>
                    )}
                </div>
                <h3 className="text-title-md">{manual.title}</h3>
                {manual.theme && <p className="line-clamp-2 text-body-sm text-content-secondary">{manual.theme}</p>}

                <div className="mt-auto pt-2">
                    {pdf ? (
                        <div className="flex gap-2">
                            <a
                                href={pdf}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-ink text-body-md-strong text-on-ink transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                            >
                                Open the PDF
                            </a>
                            <a
                                href={pdf}
                                download
                                aria-label={`Download ${manual.title}`}
                                className="grid size-12 shrink-0 place-items-center rounded-full border-[1.5px] border-ink transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                            >
                                <Download size={18} aria-hidden />
                            </a>
                        </div>
                    ) : (
                        <p className="text-body-sm text-content-muted">The PDF for this week is not uploaded yet.</p>
                    )}
                </div>
            </div>
        </m.li>
    );
};

const ManualList = () => {
    const [manuals, setManuals] = useState<Manual[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        api.get('/content/manuals/?page_size=60&ordering=-week_start_date')
            .then(({ data }) => {
                if (!cancelled) setManuals(Array.isArray(data) ? data : data.results || []);
            })
            .catch(() => console.error('Failed to fetch manuals'))
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <SitePage>
            <Seo path="/manuals" />

            <PageHeader
                eyebrow="STUDY MANUALS"
                title="Teaching manuals"
                intro="The study manual used in Junior Church classes, week by week and by age group. Open one in the browser or download the PDF — free, for teachers and for the teens they teach."
                tone="bg-pop-violet"
                object={OBJECTS.notebook}
            />

            <Section className="pt-8 lg:pt-10">
                {loading ? (
                    <SkeletonGrid count={3} height="h-80" />
                ) : manuals.length === 0 ? (
                    <EmptyState object={OBJECTS.fileText} title="No manuals published yet.">
                        They appear here as each week&rsquo;s edition is released. Teachers: ask your parish
                        coordinator for this week&rsquo;s copy in the meantime.
                    </EmptyState>
                ) : (
                    <m.ul
                        initial="hidden"
                        animate="show"
                        variants={stagger(0.05)}
                        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6"
                    >
                        {manuals.map((manual, i) => (
                            <ManualCard key={manual.id} manual={manual} tone={POP_TONES[(i + 2) % POP_TONES.length]} />
                        ))}
                    </m.ul>
                )}
            </Section>

            {/*
                A teacher arrives here mid-week with a class on Sunday and no
                idea which edition is current. This says what the manual is, how
                it is organised, and what to do when the week's edition is
                missing from the list.
            */}
            <div className="pb-16 lg:pb-24">
                <AboutSection id="about-manuals" title="About the weekly manual">
                    <p>
                        Every week, RCCG Junior Church publishes a teaching manual for each age group — children,
                        pre-teens, teens and superteens. Each edition carries a theme, a Scripture passage, the lesson
                        itself and questions for the class, and it is studied on the same Sunday across the region so
                        that a teen who moves parish does not fall behind.
                    </p>
                    <p>
                        Teachers use the PDF to prepare and to print. Teens who missed the class, or who want to read
                        the lesson again, can open the same file here. If this week&rsquo;s edition is not listed yet,
                        it has not been uploaded — check back, or ask your parish coordinator.
                    </p>
                    <p>
                        The manual is not the same as the{' '}
                        <Link to="/devotionals" className={PROSE_LINK}>
                            daily devotional
                        </Link>
                        . The devotional is read at home, one short reading a day; the manual is the class lesson.
                    </p>
                </AboutSection>
            </div>
        </SitePage>
    );
};

export default ManualList;

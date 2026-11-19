import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { Ticket, X } from 'lucide-react';
import api from '../../api/axios';
import type { Event } from '../../types';
import { FIELD } from './SitePage';

// Province values matching the Django backend Province choices.
const PROVINCES = [
    { value: 'lagos_province_9', label: 'Lagos Province 9' },
    { value: 'lagos_province_28', label: 'Lagos Province 28' },
    { value: 'lagos_province_69', label: 'Lagos Province 69' },
    { value: 'lagos_province_84', label: 'Lagos Province 84' },
    { value: 'lagos_province_86', label: 'Lagos Province 86' },
    { value: 'lagos_province_104', label: 'Lagos Province 104' },
    { value: 'regional_hq', label: 'Regional Headquarter' },
];

interface RegForm {
    attendee_name: string;
    attendee_email: string;
    attendee_phone: string;
    attendee_age: string;
    attendee_gender: string;
    attendee_province: string;
    attendee_parish: string;
    guardian_name: string;
    guardian_phone: string;
    guardian_email: string;
    guardian_relationship: string;
    guardian_consent: boolean;
    emergency_contact_name: string;
    emergency_contact_phone: string;
    emergency_contact_relationship: string;
    medical_conditions: string;
    allergies: string;
    dietary_restrictions: string;
    special_needs: string;
}

const EMPTY: RegForm = {
    attendee_name: '',
    attendee_email: '',
    attendee_phone: '',
    attendee_age: '',
    attendee_gender: '',
    attendee_province: '',
    attendee_parish: '',
    guardian_name: '',
    guardian_phone: '',
    guardian_email: '',
    guardian_relationship: '',
    guardian_consent: false,
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
    medical_conditions: '',
    allergies: '',
    dietary_restrictions: '',
    special_needs: '',
};

/** What the signed-in user already told us, so they do not type it twice. */
export type Prefill = {
    name?: string;
    email?: string;
    phone?: string;
    province?: string;
    parish?: string;
};

type Props = {
    event: Event;
    prefill: Prefill;
    onClose: () => void;
    onRegistered: () => void;
};

const Field = ({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) => (
    <label className={`flex flex-col gap-1.5 ${wide ? 'md:col-span-2' : ''}`}>
        <span className="text-label-md text-content-secondary">{label}</span>
        {children}
    </label>
);

const Group = ({ title, note, children }: { title: string; note?: string; children: ReactNode }) => (
    <fieldset className="flex flex-col gap-4 border-t border-line-strong pt-5 first:border-t-0 first:pt-0">
        <legend className="contents">
            <span className="text-title-sm">{title}</span>
            {note && <span className="ml-2 text-body-sm text-content-muted">{note}</span>}
        </legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
);

/**
 * The registration form for one event, as a dialog over the event page.
 *
 * The fields and the request are the ones the event page always sent; only the
 * frame changed, from the old dark-mode panel to the website's surfaces, with
 * proper dialog semantics: Escape closes it, focus moves into it on open, and
 * the page behind stops scrolling.
 */
const EventRegistrationDialog = ({ event, prefill, onClose, onRegistered }: Props) => {
    const [form, setForm] = useState<RegForm>(() => ({
        ...EMPTY,
        attendee_name: prefill.name || '',
        attendee_email: prefill.email || '',
        attendee_phone: prefill.phone || '',
        attendee_province: prefill.province || '',
        attendee_parish: prefill.parish || '',
    }));
    const [submitting, setSubmitting] = useState(false);
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);

    // Held in a ref so the effect below runs once. With `onClose` as a
    // dependency, a parent passing an inline function would re-run it on every
    // render, and each run moves focus back to the panel: mid-word, out of
    // whichever field was being typed in.
    const closeRef = useRef(onClose);
    useEffect(() => {
        closeRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeRef.current();
        };
        window.addEventListener('keydown', onKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        panelRef.current?.focus();
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflow;
        };
    }, []);

    const handleInput = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        setForm((prev) => ({ ...prev, [name]: val }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!form.guardian_consent) {
            toast.error('Guardian consent is required');
            return;
        }
        setSubmitting(true);
        try {
            await api.post(`/events/events/${event.id}/register/`, {
                ...form,
                attendee_age: Number(form.attendee_age),
            });
            toast.success('Registered. A confirmation is on its way to your email.');
            onRegistered();
        } catch (error: unknown) {
            const detail = (error as { response?: { data?: unknown } })?.response?.data;
            const msg = detail
                ? typeof detail === 'string'
                    ? detail
                    : JSON.stringify(detail)
                : 'Registration failed. You may already be registered.';
            toast.error(msg.length < 200 ? msg : 'Registration failed. Check the form and try again.');
            console.error('Registration error:', detail);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 font-sans text-content-primary antialiased backdrop-blur-sm">
            <div className="flex min-h-full items-start justify-center p-4 py-10" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
                <div
                    ref={panelRef}
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    className="w-full max-w-2xl rounded-[32px] bg-surface-base shadow-elevation-3 focus:outline-none"
                >
                    <div className="flex items-start justify-between gap-4 border-b border-line-strong p-6">
                        <div>
                            <h2 id={titleId} className="text-title-lg">
                                Register
                            </h2>
                            <p className="mt-0.5 text-body-sm text-content-secondary">{event.title}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                        >
                            <X size={20} aria-hidden />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6">
                        <Group title="Attendee">
                            <Field label="Full name *" wide>
                                <input name="attendee_name" required value={form.attendee_name} onChange={handleInput} className={FIELD} placeholder="e.g. Chidi Okafor" autoComplete="name" />
                            </Field>
                            <Field label="Email *">
                                <input name="attendee_email" type="email" required value={form.attendee_email} onChange={handleInput} className={FIELD} autoComplete="email" />
                            </Field>
                            <Field label="Phone *">
                                <input name="attendee_phone" type="tel" required value={form.attendee_phone} onChange={handleInput} className={FIELD} placeholder="080xxxxxxxx" autoComplete="tel" />
                            </Field>
                            <Field label="Age *">
                                <input name="attendee_age" type="number" min="1" max="25" required value={form.attendee_age} onChange={handleInput} className={FIELD} />
                            </Field>
                            <Field label="Gender">
                                <select name="attendee_gender" value={form.attendee_gender} onChange={handleInput} className={FIELD}>
                                    <option value="">Select…</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </Field>
                            <Field label="Province *">
                                <select name="attendee_province" required value={form.attendee_province} onChange={handleInput} className={FIELD}>
                                    <option value="">Select province…</option>
                                    {PROVINCES.map((p) => (
                                        <option key={p.value} value={p.value}>
                                            {p.label}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Parish *">
                                <input
                                    name="attendee_parish"
                                    required
                                    disabled={!form.attendee_province}
                                    value={form.attendee_parish}
                                    onChange={handleInput}
                                    className={`${FIELD} disabled:opacity-50`}
                                    placeholder="e.g. RCCG Victory Parish"
                                />
                            </Field>
                        </Group>

                        <Group title="Parent or guardian">
                            <Field label="Name *" wide>
                                <input name="guardian_name" required value={form.guardian_name} onChange={handleInput} className={FIELD} placeholder="Parent or guardian’s full name" />
                            </Field>
                            <Field label="Phone *">
                                <input name="guardian_phone" type="tel" required value={form.guardian_phone} onChange={handleInput} className={FIELD} placeholder="080xxxxxxxx" />
                            </Field>
                            <Field label="Email *">
                                <input name="guardian_email" type="email" required value={form.guardian_email} onChange={handleInput} className={FIELD} />
                            </Field>
                            <Field label="Relationship to the attendee *" wide>
                                <select name="guardian_relationship" required value={form.guardian_relationship} onChange={handleInput} className={FIELD}>
                                    <option value="">Select…</option>
                                    <option value="parent">Parent</option>
                                    <option value="guardian">Guardian</option>
                                    <option value="sibling">Sibling</option>
                                    <option value="uncle">Uncle</option>
                                    <option value="aunt">Aunt</option>
                                    <option value="other">Other</option>
                                </select>
                            </Field>
                        </Group>

                        <Group title="Emergency contact">
                            <Field label="Name" wide>
                                <input name="emergency_contact_name" value={form.emergency_contact_name} onChange={handleInput} className={FIELD} />
                            </Field>
                            <Field label="Phone">
                                <input name="emergency_contact_phone" type="tel" value={form.emergency_contact_phone} onChange={handleInput} className={FIELD} placeholder="080xxxxxxxx" />
                            </Field>
                            <Field label="Relationship">
                                <input name="emergency_contact_relationship" value={form.emergency_contact_relationship} onChange={handleInput} className={FIELD} placeholder="e.g. Parent, Sibling" />
                            </Field>
                        </Group>

                        <Group title="Health" note="Optional. Seen only by the event’s leaders.">
                            <Field label="Medical conditions">
                                <input name="medical_conditions" value={form.medical_conditions} onChange={handleInput} className={FIELD} placeholder="e.g. Asthma" />
                            </Field>
                            <Field label="Allergies">
                                <input name="allergies" value={form.allergies} onChange={handleInput} className={FIELD} placeholder="e.g. Peanuts" />
                            </Field>
                            <Field label="Dietary needs">
                                <input name="dietary_restrictions" value={form.dietary_restrictions} onChange={handleInput} className={FIELD} placeholder="e.g. Vegetarian" />
                            </Field>
                            <Field label="Special needs">
                                <input name="special_needs" value={form.special_needs} onChange={handleInput} className={FIELD} placeholder="e.g. Wheelchair access" />
                            </Field>
                        </Group>

                        <label className="flex cursor-pointer items-start gap-3 rounded-3xl bg-pop-amber p-5 text-pop-on">
                            <input
                                type="checkbox"
                                name="guardian_consent"
                                checked={form.guardian_consent}
                                onChange={handleInput}
                                className="mt-1 size-4 shrink-0 accent-[#1c1916]"
                            />
                            <span className="text-body-sm">
                                I, the parent or guardian, consent to this registration, confirm the details are
                                accurate, and permit the attendee to take part in this event.
                            </span>
                        </label>

                        <div className="flex flex-col-reverse gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={onClose}
                                className="h-14 flex-1 rounded-full border-[1.5px] border-ink text-body-md-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting || !form.guardian_consent}
                                className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-ink text-body-md-strong text-on-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                            >
                                {submitting ? (
                                    <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-on-ink border-t-transparent" />
                                ) : (
                                    <Ticket size={18} aria-hidden />
                                )}
                                {submitting ? 'Sending…' : 'Complete registration'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EventRegistrationDialog;

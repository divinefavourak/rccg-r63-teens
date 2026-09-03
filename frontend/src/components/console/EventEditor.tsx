/**
 * Create or edit an event.
 *
 * Only six fields are genuinely required by the model — title, event_type,
 * description, start_datetime, end_datetime, venue. Everything else is
 * `blank=True`, `null=True` or has a default, so the form asks for those six up
 * front and folds the rest into optional sections. A form that demands
 * twenty-odd fields for a Saturday youth service is a form nobody fills in.
 *
 * `scope_node` defaults to the Console's current scope. That is the field that
 * decides who can see and manage the event afterwards (`events/scoping.py`), so
 * leaving it unset would create an event visible everywhere — almost never what
 * was meant.
 */
import { useState } from 'react';
import api from '../../api/axios';
import { Btn, Modal } from './primitives';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';

/** `Event.EventType` choices. */
const EVENT_TYPES = [
  ['service', 'Service'],
  ['conference', 'Conference'],
  ['camp', 'Camp'],
  ['retreat', 'Retreat'],
  ['workshop', 'Workshop'],
  ['outreach', 'Outreach'],
  ['concert', 'Concert'],
  ['competition', 'Competition'],
  ['training', 'Training'],
  ['other', 'Other'],
] as const;

export interface EventDraft {
  id?: string;
  title?: string;
  event_type?: string;
  description?: string;
  short_description?: string;
  start_datetime?: string;
  end_datetime?: string;
  venue?: string;
  address?: string;
  city?: string;
  state?: string;
  is_free?: boolean;
  price?: string | number | null;
  max_attendees?: number | null;
  registration_status?: string;
  status?: string;
}

/** `<input type="datetime-local">` wants `YYYY-MM-DDTHH:mm`, ISO gives more. */
const toLocalInput = (iso?: string) => (iso ? iso.slice(0, 16) : '');

const Field = ({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) => (
  <label className="block">
    <span className="block text-[11px] font-medium text-console-body">
      {label}
      {required && <span className="ml-0.5 text-console-danger">*</span>}
    </span>
    {children}
    {hint && (
      <span className="mt-0.5 block text-[11px] leading-snug text-console-subtle">
        {hint}
      </span>
    )}
  </label>
);

const inputCls =
  'mt-1 w-full rounded-console-md border border-console-border bg-console-surface px-2.5 py-2 text-[13px] text-console-text outline-none transition-colors focus:border-console-action';

export const EventEditor = ({
  event,
  onClose,
  onSaved,
}: {
  event?: EventDraft;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const { scopeNode } = useConsoleAuth();
  const editing = Boolean(event?.id);

  const [form, setForm] = useState<EventDraft>({
    title: event?.title ?? '',
    event_type: event?.event_type ?? 'service',
    description: event?.description ?? '',
    short_description: event?.short_description ?? '',
    start_datetime: toLocalInput(event?.start_datetime),
    end_datetime: toLocalInput(event?.end_datetime),
    venue: event?.venue ?? '',
    address: event?.address ?? '',
    city: event?.city ?? '',
    state: event?.state ?? '',
    is_free: event?.is_free ?? true,
    price: event?.price ?? '',
    max_attendees: event?.max_attendees ?? null,
    registration_status: event?.registration_status ?? 'open',
    status: event?.status ?? 'draft',
  });
  const [showMore, setShowMore] = useState(false);
  /*
    Optional cover image. The model field was required until now, which is why
    creating an event from here failed with "No file was submitted." — it is
    optional on both sides, and events are the one surface where real ministry
    photography belongs (docs/09-design-principles.md).
  */
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const required = ['title', 'description', 'start_datetime', 'end_datetime', 'venue'] as const;
  const missing = required.filter((k) => !String(form[k] ?? '').trim());
  const endsBeforeStart =
    form.start_datetime && form.end_datetime
      ? form.end_datetime < form.start_datetime
      : false;
  const ready = missing.length === 0 && !endsBeforeStart;

  const save = async () => {
    setBusy(true);
    setErrors({});
    try {
      const payload: Record<string, unknown> = {
        ...form,
        // datetime-local has no timezone; the backend stores in Africa/Lagos
        // terms, so send it as-is rather than converting to UTC and shifting
        // every event by an hour.
        start_datetime: form.start_datetime,
        end_datetime: form.end_datetime,
        // A free event with a price is contradictory; the model allows both, so
        // the form resolves it rather than storing something incoherent.
        price: form.is_free ? null : form.price || null,
        max_attendees: form.max_attendees || null,
        scope_node: scopeNode?.id ?? null,
      };

      // Only switch to multipart when there is actually a file. A JSON body is
      // simpler for the common case, and DRF's ImageField rejects the empty
      // string a multipart form would otherwise send for "no image".
      let body: unknown = payload;
      let config: { headers?: Record<string, string> } = {};
      if (coverImage) {
        const fd = new FormData();
        for (const [k, v] of Object.entries(payload)) {
          if (v === null || v === undefined) continue;
          fd.append(k, String(v));
        }
        fd.append('cover_image', coverImage);
        body = fd;
        config = { headers: { 'Content-Type': 'multipart/form-data' } };
      }

      if (editing) await api.patch(`/events/events/${event!.id}/`, body, config);
      else await api.post('/events/events/', body, config);

      onSaved();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } })
        ?.response?.data;
      // DRF returns {field: [messages]} — surface them next to their fields
      // instead of collapsing everything into one banner.
      const mapped: Record<string, string> = {};
      if (data && typeof data === 'object') {
        for (const [k, v] of Object.entries(data)) {
          mapped[k] = Array.isArray(v) ? String(v[0]) : String(v);
        }
      }
      setErrors(
        Object.keys(mapped).length
          ? mapped
          : { __all__: 'Could not save this event.' },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={editing ? `Edit ${event?.title}` : 'New event'}
      subtitle={
        scopeNode
          ? `Scoped to ${scopeNode.name} — everyone at or below it will see this.`
          : undefined
      }
      onClose={onClose}
      width={620}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="primary" disabled={!ready || busy} onClick={save}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Create event'}
          </Btn>
        </>
      }
    >
      {errors.__all__ && (
        <div className="mb-3 rounded-console-md bg-console-danger-bg px-3 py-2 text-[13px] text-console-danger">
          {errors.__all__}
        </div>
      )}

      <div className="space-y-3">
        <Field label="Title" required>
          <input
            autoFocus
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            className={inputCls}
            placeholder="Teens Camp 2026"
          />
          {errors.title && (
            <span className="mt-0.5 block text-[11px] text-console-danger">
              {errors.title}
            </span>
          )}
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type" required>
            <select
              value={form.event_type}
              onChange={(e) => set('event_type', e.target.value)}
              className={inputCls}
            >
              {EVENT_TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Venue" required>
            <input
              value={form.venue}
              onChange={(e) => set('venue', e.target.value)}
              className={inputCls}
              placeholder="Redemption Camp"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Starts" required>
            <input
              type="datetime-local"
              value={form.start_datetime}
              onChange={(e) => set('start_datetime', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Ends" required>
            <input
              type="datetime-local"
              value={form.end_datetime}
              onChange={(e) => set('end_datetime', e.target.value)}
              className={inputCls}
            />
            {endsBeforeStart && (
              <span className="mt-0.5 block text-[11px] text-console-danger">
                The end has to come after the start.
              </span>
            )}
          </Field>
        </div>

        <Field
          label="Description"
          required
          hint="What is this, who is it for, and why should a teen come?"
        >
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className={inputCls}
          />
        </Field>

        <div className="rounded-console-md border border-console-border p-3">
          <label className="flex items-center gap-2 text-[13px] text-console-body">
            <input
              type="checkbox"
              checked={form.is_free}
              onChange={(e) => set('is_free', e.target.checked)}
            />
            This event is free
          </label>
          {!form.is_free && (
            <Field label="Price (₦)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={String(form.price ?? '')}
                onChange={(e) => set('price', e.target.value)}
                className={inputCls}
              />
            </Field>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="text-[12px] font-medium text-console-action hover:underline"
        >
          {showMore ? 'Fewer options' : 'More options'}
        </button>

        {showMore && (
          <div className="space-y-3 rounded-console-md bg-console-tinted p-3">
            <Field
              label="Cover image"
              hint={
                coverImage
                  ? `${coverImage.name} — shown on the event card and the share preview.`
                  : 'Optional. Shown on the event card and the share preview.'
              }
            >
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCoverImage(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-[12px] text-console-body file:mr-3 file:rounded-console-sm file:border-0 file:bg-console-action-light file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-console-action"
              />
            </Field>

            <Field label="Short description" hint="One line, used in listings.">
              <input
                value={form.short_description}
                onChange={(e) => set('short_description', e.target.value)}
                className={inputCls}
                maxLength={500}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="City">
                <input
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="State">
                <input
                  value={form.state}
                  onChange={(e) => set('state', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Address">
              <textarea
                rows={2}
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                className={inputCls}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Capacity" hint="Leave blank for no limit.">
                <input
                  type="number"
                  min="1"
                  value={form.max_attendees ?? ''}
                  onChange={(e) =>
                    set(
                      'max_attendees',
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Registration">
                <select
                  value={form.registration_status}
                  onChange={(e) => set('registration_status', e.target.value)}
                  className={inputCls}
                >
                  <option value="not_open">Not open yet</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="full">Full</option>
                </select>
              </Field>
            </div>

            <Field
              label="Status"
              hint="Draft is only visible to staff. Published is live to teens."
            >
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                className={inputCls}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
          </div>
        )}

        {missing.length > 0 && (
          <p className="text-[11px] text-console-subtle">
            Still needed: {missing.join(', ').replace(/_/g, ' ')}.
          </p>
        )}
      </div>
    </Modal>
  );
};

export default EventEditor;

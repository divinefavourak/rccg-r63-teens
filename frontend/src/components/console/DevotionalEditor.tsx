/**
 * Write or edit a devotional.
 *
 * The Console could preview and approve devotionals but not author one — the
 * only way to write a devotional was the legacy admin panel. This is the
 * missing half of `pages/console/Content.tsx`: tap an empty day on the calendar
 * and write the devotional for it.
 *
 * Four fields are genuinely required: date, title, content, and — because
 * `content/services/review.py::validate_publishable` blocks publishing without
 * it — the memory verse. That last one is the Verse of the Day, the thing
 * `docs/01-vision.md` builds the whole daily habit around, so the form treats it
 * as required rather than letting someone write a devotional that cannot ship.
 * Everything else on the model is `blank=True` and lives under an optional
 * section, because a form that demands twenty fields is a form nobody fills in.
 *
 * `date` is unique on the model, so creating one for a day that already has a
 * devotional returns a 400 — surfaced against the field rather than as a generic
 * failure, since "that day is taken" is actionable and "could not save" is not.
 */
import { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { Btn, Modal } from './primitives';
import { todayISO } from '../../utils/dates';

export interface DevotionalDraft {
  id?: string;
  title?: string;
  date?: string;
  content?: string;
  key_point?: string;
  memory_verse_passage?: string;
  memory_verse_content?: string;
  bible_text_passage?: string;
  bible_text_content?: string;
  bible_in_one_year?: string;
  prayer?: string;
  confession?: string;
  action_point?: string;
  hymn?: string;
  author?: string;
  status?: string;
}

const Field = ({
  label,
  hint,
  error,
  children,
  required,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}) => (
  <label className="block">
    <span className="block text-[11px] font-medium text-console-body">
      {label}
      {required && <span className="ml-0.5 text-console-danger">*</span>}
    </span>
    {children}
    {error ? (
      <span className="mt-0.5 block text-[11px] leading-snug text-console-danger">
        {error}
      </span>
    ) : (
      hint && (
        <span className="mt-0.5 block text-[11px] leading-snug text-console-subtle">
          {hint}
        </span>
      )
    )}
  </label>
);

const inputCls =
  'mt-1 w-full rounded-console-md border border-console-border bg-console-surface px-2.5 py-2 text-[13px] text-console-text outline-none transition-colors focus:border-console-action';

export const DevotionalEditor = ({
  devotional,
  defaultDate,
  onClose,
  onSaved,
}: {
  /** Existing record to edit. Omit to create. */
  devotional?: DevotionalDraft;
  /** Pre-fill the date when opened from an empty calendar cell. */
  defaultDate?: string;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const editing = Boolean(devotional?.id);

  const [form, setForm] = useState({
    title: devotional?.title ?? '',
    // todayISO(), not toISOString() — see src/utils/dates.ts.
    date: devotional?.date?.slice(0, 10) ?? defaultDate ?? todayISO(),
    content: devotional?.content ?? '',
    key_point: devotional?.key_point ?? '',
    memory_verse_passage: devotional?.memory_verse_passage ?? '',
    memory_verse_content: devotional?.memory_verse_content ?? '',
    bible_text_passage: devotional?.bible_text_passage ?? '',
    bible_text_content: devotional?.bible_text_content ?? '',
    bible_in_one_year: devotional?.bible_in_one_year ?? '',
    prayer: devotional?.prayer ?? '',
    confession: devotional?.confession ?? '',
    action_point: devotional?.action_point ?? '',
    hymn: devotional?.hymn ?? '',
    author: devotional?.author ?? '',
  });

  const [showOptional, setShowOptional] = useState(false);
  /*
    Optional cover image. Kept out of `form` because it is a File, not a string —
    the payload below only switches to multipart when one is actually attached.
  */
  const [coverImage, setCoverImage] = useState<File | null>(null);
  /** URL of the image already on the record, so an edit shows what is there. */
  const [existingCover, setExistingCover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /*
    Load the full record when opened with only an id.

    The calendar's list rows carry title, date and status but not the body,
    memory verse or the optional sections — the list serializer omits them.
    Without this fetch the form would open blank over a devotional that has
    content, and look like the content had been lost.
  */
  const needsFetch = Boolean(devotional?.id && devotional?.content === undefined);
  const [loading, setLoading] = useState(needsFetch);

  useEffect(() => {
    if (!needsFetch) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/content/devotionals/${devotional!.id}/`);
        if (cancelled) return;
        setForm((prev) => {
          const next = { ...prev };
          for (const key of Object.keys(prev) as (keyof typeof prev)[]) {
            const value = (data as Record<string, unknown>)[key];
            if (typeof value === 'string') next[key] = key === 'date' ? value.slice(0, 10) : value;
          }
          return next;
        });
        if (typeof data.cover_image === 'string' && data.cover_image) {
          setExistingCover(data.cover_image);
        }
        // Reveal the optional block when it already holds something, so nothing
        // that exists is hidden behind a collapsed section.
        if (
          data.bible_text_passage || data.bible_text_content || data.prayer ||
          data.confession || data.action_point || data.hymn || data.bible_in_one_year
        ) {
          setShowOptional(true);
        }
      } catch {
        if (!cancelled) setErrors({ __all__: 'Could not load this devotional.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsFetch, devotional]);

  /*
    One object URL per selected file, revoked when it changes or the modal
    closes. Calling URL.createObjectURL() inline in the JSX would mint a new
    blob URL on every render and never release any of them.
  */
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!coverImage) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(coverImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [coverImage]);

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const ready = useMemo(
    () =>
      Boolean(
        form.title.trim() &&
          form.date &&
          form.content.trim() &&
          form.memory_verse_passage.trim() &&
          form.memory_verse_content.trim(),
      ),
    [form],
  );

  /** Rough reading time, the same 200wpm the Today card promises against. */
  const readingMinutes = useMemo(() => {
    const words = form.content.trim().split(/\s+/).filter(Boolean).length;
    return words ? Math.max(1, Math.round(words / 200)) : 0;
  }, [form.content]);

  const save = async (status: 'draft' | 'in_review') => {
    setBusy(true);
    setErrors({});
    try {
      // Send only what was filled in. Posting '' for every optional field would
      // overwrite existing content with blanks on an edit.
      const payload: Record<string, unknown> = { status };
      for (const [k, v] of Object.entries(form)) {
        if (typeof v === 'string' && v.trim() === '' && editing) continue;
        payload[k] = v;
      }

      // JSON for the common case; multipart only when there is a file. DRF's
      // ImageField rejects the empty string a multipart form would otherwise
      // send for "no image".
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

      if (editing) await api.patch(`/content/devotionals/${devotional!.id}/`, body, config);
      else await api.post('/content/devotionals/', body, config);

      onSaved();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } })
        ?.response?.data;
      // DRF returns {field: [messages]} — surface each next to its own field
      // rather than collapsing everything into one banner.
      const mapped: Record<string, string> = {};
      if (data && typeof data === 'object') {
        for (const [k, v] of Object.entries(data)) {
          mapped[k] = Array.isArray(v) ? String(v[0]) : String(v);
        }
      }
      // `date` is unique on the model, so this is the common failure and it
      // deserves a sentence someone can act on.
      if (mapped.date && /exist/i.test(mapped.date)) {
        mapped.date = 'A devotional already exists for this day. Open that day to edit it.';
      }
      setErrors(
        Object.keys(mapped).length
          ? mapped
          : { __all__: 'Could not save this devotional.' },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={editing ? `Edit ${devotional?.title || 'devotional'}` : 'New devotional'}
      subtitle="One day, one verse, one message. The memory verse becomes the Verse of the Day."
      onClose={onClose}
      width={680}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="secondary" disabled={!ready || busy || loading} onClick={() => save('draft')}>
            {busy ? 'Saving…' : 'Save draft'}
          </Btn>
          {/*
            Submitting for review is a separate action from saving. The pipeline
            is draft -> in_review -> approved -> published
            (docs/07-feature-specifications.md §5), and someone half-way through
            writing needs to be able to stop without entering a queue.
          */}
          <Btn variant="primary" disabled={!ready || busy || loading} onClick={() => save('in_review')}>
            {busy ? 'Saving…' : 'Submit for review'}
          </Btn>
        </>
      }
    >
      {loading && (
        <div className="mb-3 text-[13px] text-console-muted">Loading devotional…</div>
      )}

      {errors.__all__ && (
        <div className="mb-3 rounded-console-md bg-console-danger-bg px-3 py-2 text-[13px] text-console-danger">
          {errors.__all__}
        </div>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_170px]">
          <Field label="Title" required error={errors.title}>
            <input
              className={inputCls}
              value={form.title}
              onChange={set('title')}
              placeholder="Standing Firm"
              maxLength={255}
            />
          </Field>
          <Field
            label="Date"
            required
            error={errors.date}
            hint={editing ? undefined : 'One devotional per day.'}
          >
            <input
              type="date"
              className={inputCls}
              value={form.date}
              onChange={set('date')}
            />
          </Field>
        </div>

        <Field
          label="Memory verse reference"
          required
          error={errors.memory_verse_passage}
          hint="This becomes the Verse of the Day."
        >
          <input
            className={inputCls}
            value={form.memory_verse_passage}
            onChange={set('memory_verse_passage')}
            placeholder="John 3:16"
          />
        </Field>

        <Field label="Memory verse text" required error={errors.memory_verse_content}>
          <textarea
            className={`${inputCls} min-h-[64px] resize-y`}
            value={form.memory_verse_content}
            onChange={set('memory_verse_content')}
            placeholder="For God so loved the world…"
          />
        </Field>

        <Field
          label="Devotional"
          required
          error={errors.content}
          hint={
            readingMinutes
              ? `About ${readingMinutes} min to read.`
              : 'The body a teen reads. Short paragraphs read better on a phone.'
          }
        >
          <textarea
            className={`${inputCls} min-h-[200px] resize-y leading-relaxed`}
            value={form.content}
            onChange={set('content')}
          />
        </Field>

        <Field
          label="Key point"
          error={errors.key_point}
          hint="One sentence. Shown as the excerpt on the Today card and in search results."
        >
          <input
            className={inputCls}
            value={form.key_point}
            onChange={set('key_point')}
            maxLength={500}
            placeholder="God's love is not earned."
          />
        </Field>

        {/*
          Cover image sits with the required fields rather than under "more
          options": it is the picture that shows on the Today card and on a
          WhatsApp share, so it is worth seeing, not worth hunting for.
          Still optional — docs/09-design-principles.md keeps the daily
          spiritual surfaces typographic, so most devotionals will not have one.
        */}
        <Field
          label="Cover image"
          error={errors.cover_image}
          hint={
            coverImage
              ? `${coverImage.name} — replaces the current image on save.`
              : 'Optional. Used on the card and the share preview.'
          }
        >
          <div className="mt-1 flex items-center gap-3">
            {(previewUrl || existingCover) && (
              <img
                src={previewUrl ?? existingCover!}
                alt=""
                className="h-12 w-16 shrink-0 rounded-console-sm border border-console-border object-cover"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverImage(e.target.files?.[0] ?? null)}
              className="block w-full text-[12px] text-console-body file:mr-3 file:rounded-console-sm file:border-0 file:bg-console-action-light file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-console-action"
            />
            {coverImage && (
              <button
                type="button"
                onClick={() => setCoverImage(null)}
                className="shrink-0 text-[12px] text-console-muted hover:text-console-danger"
              >
                Clear
              </button>
            )}
          </div>
        </Field>

        <button
          type="button"
          onClick={() => setShowOptional((v) => !v)}
          className="text-[12px] font-medium text-console-action hover:underline"
        >
          {showOptional ? 'Hide' : 'Add'} Bible reading, prayer and other sections
        </button>

        {showOptional && (
          <div className="space-y-3 rounded-console-md border border-console-border p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Bible reading reference" error={errors.bible_text_passage}>
                <input
                  className={inputCls}
                  value={form.bible_text_passage}
                  onChange={set('bible_text_passage')}
                  placeholder="Psalm 139:14-15"
                />
              </Field>
              <Field label="Bible in one year" error={errors.bible_in_one_year}>
                <input
                  className={inputCls}
                  value={form.bible_in_one_year}
                  onChange={set('bible_in_one_year')}
                  placeholder="Exodus 24-27"
                />
              </Field>
            </div>

            <Field label="Bible reading text" error={errors.bible_text_content}>
              <textarea
                className={`${inputCls} min-h-[80px] resize-y`}
                value={form.bible_text_content}
                onChange={set('bible_text_content')}
              />
            </Field>

            <Field label="Prayer" error={errors.prayer}>
              <textarea
                className={`${inputCls} min-h-[64px] resize-y`}
                value={form.prayer}
                onChange={set('prayer')}
              />
            </Field>

            <Field label="Confession" error={errors.confession}>
              <textarea
                className={`${inputCls} min-h-[64px] resize-y`}
                value={form.confession}
                onChange={set('confession')}
              />
            </Field>

            <Field
              label="Action point"
              error={errors.action_point}
              hint="Something a teen can actually do today."
            >
              <textarea
                className={`${inputCls} min-h-[64px] resize-y`}
                value={form.action_point}
                onChange={set('action_point')}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Hymn" error={errors.hymn}>
                <input className={inputCls} value={form.hymn} onChange={set('hymn')} />
              </Field>
              <Field
                label="Author"
                error={errors.author}
                hint="Leave blank to use the default."
              >
                <input className={inputCls} value={form.author} onChange={set('author')} />
              </Field>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default DevotionalEditor;

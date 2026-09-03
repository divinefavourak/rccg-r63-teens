/**
 * Upload a podcast episode or video.
 *
 * Posts `multipart/form-data` to `/media/episodes/`. The serializer takes a
 * generic write-only `file` field and routes it to `audio_file` or `video_file`
 * based on `media_type`, and detects duration server-side with mutagen — so the
 * client sends one file and one type, not a matrix of format-specific fields.
 *
 * Two things this does that a bare `<input type=file>` does not:
 *
 * * **Reports progress.** These are large files on Nigerian mobile connections.
 *   A form that appears frozen for four minutes gets cancelled and retried,
 *   which is worse for everyone than the same wait with a bar.
 * * **Previews the thumbnail before upload**, from an object URL. Picking the
 *   wrong image is the commonest mistake here and the only way to catch it is to
 *   see it.
 */
import { useEffect, useRef, useState } from 'react';
import { FileAudio, FileVideo, Image as ImageIcon, Upload, X } from 'lucide-react';
import api from '../../api/axios';
import { Btn, Modal } from './primitives';

interface SeriesOption {
  id: string;
  title: string;
}

const inputCls =
  'mt-1 w-full rounded-console-md border border-console-border bg-console-surface px-2.5 py-2 text-[13px] text-console-text outline-none transition-colors focus:border-console-action';

export const MediaUploader = ({
  series,
  onClose,
  onUploaded,
}: {
  series: SeriesOption[];
  onClose: () => void;
  onUploaded: () => void;
}) => {
  const [title, setTitle] = useState('');
  const [mediaType, setMediaType] = useState<'audio' | 'video'>('audio');
  const [seriesId, setSeriesId] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('draft');
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const thumbInput = useRef<HTMLInputElement>(null);

  // Object URLs are a leak if not revoked — the browser holds the whole file in
  // memory until you do, and these are large.
  useEffect(() => {
    if (!thumbnail) {
      setThumbPreview(null);
      return;
    }
    const url = URL.createObjectURL(thumbnail);
    setThumbPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [thumbnail]);

  const ready = Boolean(title.trim() && file);

  const upload = async () => {
    if (!ready) return;
    setProgress(0);
    setError(null);

    const body = new FormData();
    body.append('title', title.trim());
    body.append('media_type', mediaType);
    body.append('status', status);
    if (description.trim()) body.append('description', description.trim());
    if (seriesId) body.append('series', seriesId);
    if (file) body.append('file', file);
    if (thumbnail) body.append('thumbnail', thumbnail);

    try {
      await api.post('/media/episodes/', body, {
        // Let the browser set the boundary; hardcoding the header breaks it.
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      onUploaded();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } })
        ?.response?.data;
      const detail =
        data &&
        Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
          .join(' · ');
      setError(detail || 'The upload failed. Check the file type and size.');
      setProgress(null);
    }
  };

  const FileIcon = mediaType === 'audio' ? FileAudio : FileVideo;

  return (
    <Modal
      title="Upload media"
      subtitle="Length is detected from the file — you do not need to enter it."
      onClose={onClose}
      width={560}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={progress !== null}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            disabled={!ready || progress !== null}
            onClick={upload}
          >
            {progress !== null ? `Uploading ${progress}%` : 'Upload'}
          </Btn>
        </>
      }
    >
      {error && (
        <div className="mb-3 rounded-console-md bg-console-danger-bg px-3 py-2 text-[13px] text-console-danger">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <label className="block">
          <span className="block text-[11px] font-medium text-console-body">
            Title <span className="text-console-danger">*</span>
          </span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
            placeholder="Standing Firm — Part 1"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="block text-[11px] font-medium text-console-body">
              Type
            </span>
            <select
              value={mediaType}
              onChange={(e) => {
                setMediaType(e.target.value as 'audio' | 'video');
                // The accepted extensions change, so an already-picked file may
                // no longer be valid. Clearing is less confusing than leaving a
                // .mp3 selected under "video".
                setFile(null);
              }}
              className={inputCls}
            >
              <option value="audio">Audio / podcast</option>
              <option value="video">Video</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-[11px] font-medium text-console-body">
              Series <span className="text-console-subtle">(optional)</span>
            </span>
            <select
              value={seriesId}
              onChange={(e) => setSeriesId(e.target.value)}
              className={inputCls}
            >
              <option value="">Standalone</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* The file */}
        <div>
          <span className="block text-[11px] font-medium text-console-body">
            File <span className="text-console-danger">*</span>
          </span>
          <input
            ref={fileInput}
            type="file"
            accept={mediaType === 'audio' ? 'audio/*' : 'video/*'}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="mt-1 flex w-full items-center gap-3 rounded-console-md border border-dashed border-console-border-strong px-3 py-3 text-left transition-colors hover:bg-console-tinted"
          >
            <FileIcon size={18} className="shrink-0 text-console-subtle" />
            {file ? (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-console-text">
                  {file.name}
                </span>
                <span className="block text-[11px] text-console-subtle">
                  {formatBytes(file.size)}
                </span>
              </span>
            ) : (
              <span className="text-[13px] text-console-muted">
                Choose {mediaType === 'audio' ? 'an audio' : 'a video'} file
              </span>
            )}
            {file && (
              <X
                size={15}
                className="shrink-0 text-console-subtle"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
              />
            )}
          </button>
        </div>

        {/* Thumbnail, with a preview */}
        <div>
          <span className="block text-[11px] font-medium text-console-body">
            Thumbnail <span className="text-console-subtle">(optional)</span>
          </span>
          <input
            ref={thumbInput}
            type="file"
            accept="image/*"
            onChange={(e) => setThumbnail(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={() => thumbInput.current?.click()}
              className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-console-md border border-dashed border-console-border-strong transition-colors hover:bg-console-tinted"
            >
              {thumbPreview ? (
                <img
                  src={thumbPreview}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon size={18} className="text-console-subtle" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-console-muted">
                {thumbnail
                  ? thumbnail.name
                  : 'A 16:9 image. Without one the list shows a placeholder.'}
              </p>
              {thumbnail && (
                <button
                  type="button"
                  onClick={() => setThumbnail(null)}
                  className="mt-0.5 text-[11px] text-console-danger hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <label className="block">
          <span className="block text-[11px] font-medium text-console-body">
            Description <span className="text-console-subtle">(optional)</span>
          </span>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className="block text-[11px] font-medium text-console-body">
            Status
          </span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputCls}
          >
            <option value="draft">Draft — staff only</option>
            <option value="published">Published — live to teens</option>
          </select>
        </label>

        {progress !== null && (
          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-console-tinted">
              <div
                className="h-full rounded-full bg-console-action transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-console-muted">
              <Upload size={11} />
              {progress < 100
                ? 'Uploading — keep this tab open.'
                : 'Processing on the server…'}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export default MediaUploader;

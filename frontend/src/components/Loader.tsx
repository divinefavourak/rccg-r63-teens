/**
 * The application's loading state.
 *
 * One component for every "we are fetching something before we can show you
 * anything" moment — route chunks, auth checks, the Console bootstrap. Before
 * this there were three different spinners in three different palettes (amber
 * on white, yellow on `#1a0505`, emerald on stone), which made a slow route
 * transition look like a navigation into a different product.
 *
 * Design notes:
 *
 * * The ring is a **two-tone arc**, not a chasing dot. An arc communicates
 *   indeterminate progress without implying a position on a track.
 * * The label is optional and defaults to nothing. "Loading…" under a spinner is
 *   redundant; the label earns its place only when it says *what* is loading
 *   ("Checking your access…"), which tells the user whether to expect a login
 *   prompt or a screen.
 * * Colours come from the `--console-*` tokens, so it inverts correctly in dark
 *   mode without a second implementation.
 */

interface LoaderProps {
  /** What is being waited on. Omit for a bare spinner. */
  label?: string;
  /** `page` fills the viewport; `inline` sits inside a card or panel. */
  variant?: 'page' | 'inline';
  size?: number;
}

export const Loader = ({
  label,
  variant = 'page',
  size = 32,
}: LoaderProps) => {
  const spinner = (
    <span
      className="inline-block shrink-0 animate-spin rounded-full"
      style={{
        width: size,
        height: size,
        borderWidth: Math.max(2, Math.round(size / 14)),
        borderStyle: 'solid',
        // Inline loaders sit on unknown backgrounds — inside a solid green
        // button, most often — so they draw from the inherited text colour
        // instead of the token palette, which would vanish against it.
        borderColor:
          variant === 'inline'
            ? 'color-mix(in srgb, currentColor 30%, transparent)'
            : 'var(--console-border)',
        borderTopColor:
          variant === 'inline' ? 'currentColor' : 'var(--console-action)',
      }}
      role="status"
      aria-label={label ?? 'Loading'}
    />
  );

  if (variant === 'inline') {
    return (
      // The label inherits its colour rather than fixing one, because inline
      // loaders sit inside buttons whose text colour is already decided — a
      // muted grey label on a solid green button would be unreadable.
      <span className="inline-flex items-center gap-2 text-[13px]">
        {spinner}
        {label}
      </span>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-console-canvas">
      {spinner}
      {label && (
        <p className="text-[13px] text-console-muted">{label}</p>
      )}
    </div>
  );
};

export default Loader;

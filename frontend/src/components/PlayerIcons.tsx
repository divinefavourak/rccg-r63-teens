/**
 * The video player's own icons, drawn for Faith Tribe rather than taken from
 * an icon library: on the 24px grid with round ends and joins, like the app's
 * brand marks. Solid shapes for the things you press most (play, pause,
 * sound), lines for the rest.
 *
 * The app draws the same set from the same path data
 * (`mobile/src/components/PlayerIcons.tsx`); change both together.
 */

type Part = { d: string; solid?: boolean };
type Glyph = { parts: Part[]; label?: string };

// A three-quarter circle around (12, 12.5), open at the top on the side the
// arrow points to, with a rounded arrowhead where it starts.
const ARC_FORWARD = 'M12 4.5A8 8 0 1 0 18.93 8.5';
const HEAD_FORWARD = 'M9.6 2.1L12 4.5 9.6 6.9';
const ARC_BACK = 'M12 4.5A8 8 0 1 1 5.07 8.5';
const HEAD_BACK = 'M14.4 2.1L12 4.5l2.4 2.4';

const GLYPHS = {
    // A soft-cornered triangle whose middle sits on the centre line, so it
    // looks centred in a round button without nudging.
    play: {
        parts: [
            { d: 'M8 5.6v12.8a1.1 1.1 0 0 0 1.68.94l10.1-6.4a1.1 1.1 0 0 0 0-1.88L9.68 4.66A1.1 1.1 0 0 0 8 5.6z', solid: true },
        ],
    },
    pause: {
        parts: [
            { d: 'M7 5.5h2.6A1.4 1.4 0 0 1 11 6.9v10.2a1.4 1.4 0 0 1-1.4 1.4H7a1.4 1.4 0 0 1-1.4-1.4V6.9A1.4 1.4 0 0 1 7 5.5z', solid: true },
            { d: 'M14.4 5.5H17a1.4 1.4 0 0 1 1.4 1.4v10.2a1.4 1.4 0 0 1-1.4 1.4h-2.6a1.4 1.4 0 0 1-1.4-1.4V6.9a1.4 1.4 0 0 1 1.4-1.4z', solid: true },
        ],
    },
    // Back to the start: the back arrow around a small play mark.
    replay: {
        parts: [
            { d: ARC_BACK },
            { d: HEAD_BACK },
            { d: 'M10.2 9.7v5.6a.6.6 0 0 0 .92.5l4.3-2.8a.6.6 0 0 0 0-1l-4.3-2.8a.6.6 0 0 0-.92.5z', solid: true },
        ],
    },
    skipBack: { parts: [{ d: ARC_BACK }, { d: HEAD_BACK }], label: '10' },
    skipForward: { parts: [{ d: ARC_FORWARD }, { d: HEAD_FORWARD }], label: '10' },
    // Four rounded corners, opening out to go full screen and folding in to leave.
    fullscreen: {
        parts: [
            { d: 'M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9' },
            { d: 'M15 4h2.5A2.5 2.5 0 0 1 20 6.5V9' },
            { d: 'M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15' },
            { d: 'M9 20H6.5A2.5 2.5 0 0 1 4 17.5V15' },
        ],
    },
    exitFullscreen: {
        parts: [
            { d: 'M9 4v2.5A2.5 2.5 0 0 1 6.5 9H4' },
            { d: 'M20 9h-2.5A2.5 2.5 0 0 1 15 6.5V4' },
            { d: 'M15 20v-2.5a2.5 2.5 0 0 1 2.5-2.5H20' },
            { d: 'M4 15h2.5A2.5 2.5 0 0 1 9 17.5V20' },
        ],
    },
    sound: {
        parts: [
            { d: 'M4 9.6v4.8a1 1 0 0 0 1 1h2.6l4.1 3.3a.8.8 0 0 0 1.3-.62V5.92a.8.8 0 0 0-1.3-.62L7.6 8.6H5a1 1 0 0 0-1 1z', solid: true },
            { d: 'M16 9.5a3.6 3.6 0 0 1 0 5' },
            { d: 'M18.6 7a7.2 7.2 0 0 1 0 10' },
        ],
    },
    muted: {
        parts: [
            { d: 'M4 9.6v4.8a1 1 0 0 0 1 1h2.6l4.1 3.3a.8.8 0 0 0 1.3-.62V5.92a.8.8 0 0 0-1.3-.62L7.6 8.6H5a1 1 0 0 0-1 1z', solid: true },
            { d: 'M16.5 9.5l5 5M21.5 9.5l-5 5' },
        ],
    },
    close: { parts: [{ d: 'M6 9.5l6 6 6-6' }] },
    // Shown on the side of a double tap.
    rushBack: { parts: [{ d: 'M18.5 7l-5 5 5 5M11.5 7l-5 5 5 5' }] },
    rushForward: { parts: [{ d: 'M5.5 7l5 5-5 5M12.5 7l5 5-5 5' }] },
} satisfies Record<string, Glyph>;

export type PlayerIconName = keyof typeof GLYPHS;

export function PlayerIcon({ name, size = 24 }: { name: PlayerIconName; size?: number }) {
    const glyph: Glyph = GLYPHS[name];
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
            {glyph.parts.map((part, i) =>
                part.solid ? (
                    <path key={i} d={part.d} fill="currentColor" />
                ) : (
                    <path
                        key={i}
                        d={part.d}
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ),
            )}
            {glyph.label && (
                <text
                    x={12}
                    y={14.9}
                    fontSize={6.4}
                    fontWeight={700}
                    fill="currentColor"
                    textAnchor="middle"
                    style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                >
                    {glyph.label}
                </text>
            )}
        </svg>
    );
}

/** The loading ring, the same as the app's: a circle with one quarter left open. */
export function PlayerSpinner({ size = 24 }: { size?: number }) {
    return (
        <span
            role="status"
            aria-label="Loading"
            className="block animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
            style={{ width: size, height: size, animationDuration: '800ms', animationTimingFunction: 'linear' }}
        />
    );
}

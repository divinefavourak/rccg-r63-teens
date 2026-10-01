import { memo } from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

/**
 * The marks that carry the product's identity, and so cannot come from a
 * general-purpose icon font.
 *
 * The leaf/growth motif is the brand (09-design-principles.md: "organic growth
 * motifs — the 🌱 identity"), the Bible book-cross owns the centre nav slot
 * (05-navigation.md: "Bible is center"), and the flame is the streak. Each is
 * ported path-for-path from the web design's `icons.tsx`.
 *
 * All of them are memoised: they render inside list rows and animated
 * containers where the parent re-renders far more often than the mark changes.
 */

interface MarkProps {
  size?: number;
  color?: string;
}

/** The identity mark — a sprouting leaf. Logo lockups and empty states. */
export const LeafMark = memo(function LeafMark({ size = 32, color = 'currentColor' }: MarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M22 6C22 6 10 10 8 20c4-2 8-2 11-5"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M10 26c0-4 2-8 8-12" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
});

/** The same motif on the 24px UI grid, for inline use beside text. */
export const LeafGlyph = memo(function LeafGlyph({ size = 24, color = 'currentColor' }: MarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 8C8 10 5.9 16.17 3.82 19.83l1.36.79C7 18 9 14 17 14V8z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M17 8c0 0-4 7-9 11" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
});

/** Small white leaf stamped inside a completed day on the week tracker. */
export const LeafTick = memo(function LeafTick({ size = 12, color = '#fff' }: MarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path
        d="M9 2C9 2 4 4 3 8c1.5-.8 3-.8 4.5-2"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M4 10c0-1.5.8-3 3-4.5" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
});

/** The Bible mark: a closed book carrying a cross. Centre nav slot. */
export const BibleMark = memo(function BibleMark({
  size = 24,
  color = 'currentColor',
  filled = false,
}: MarkProps & { filled?: boolean }) {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <G fill={color}>
          <Path d="M12 2L4 6v13l8-3 8 3V6l-8-4z" />
          <Rect x="11" y="5" width="2" height="10" rx="1" fill="#fff" fillOpacity={0.85} />
          <Rect x="8" y="8" width="8" height="2" rx="1" fill="#fff" fillOpacity={0.85} />
        </G>
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L4 6v13l8-3 8 3V6l-8-4z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 5v10" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M8.5 9h7" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
});

/** Streak flame. Amber by default — the one celebration colour. */
export const FlameMark = memo(function FlameMark({ size = 18, color = '#E8951A' }: MarkProps) {
  return (
    <Svg width={size} height={size * 1.25} viewBox="0 0 32 40" fill="none">
      <Path
        d="M16 2C16 2 8 12 8 22a8 8 0 0016 0c0-2.5-.7-4.5-1.6-6C20.5 19 18.5 23 15 23a3.5 3.5 0 010-7c1.4 0 2.7.5 3.7 1.4C17.5 11 16 2 16 2z"
        fill={color}
      />
    </Svg>
  );
});

/**
 * Placeholder avatar — an illustrated Nigerian teen rather than a grey
 * silhouette, per 09-design-principles.md ("Nigerian teens should see
 * themselves"). Used until a real profile photo exists.
 */
export const AvatarMark = memo(function AvatarMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Circle cx="20" cy="20" r="20" fill="#2D6340" />
      <Ellipse cx="20" cy="34" rx="10" ry="7" fill="#C68B5A" />
      <Ellipse cx="20" cy="22" rx="8" ry="9" fill="#C68B5A" />
      <Ellipse cx="20" cy="14" rx="11" ry="9" fill="#2A1A0A" />
      <Ellipse cx="16" cy="11" rx="4" ry="3.5" fill="#3A2510" />
      <Ellipse cx="24" cy="11" rx="4" ry="3.5" fill="#3A2510" />
      <Ellipse cx="16.5" cy="22" rx="1.4" ry="1.4" fill="#2A1A0A" />
      <Ellipse cx="23.5" cy="22" rx="1.4" ry="1.4" fill="#2A1A0A" />
      <Circle cx="17" cy="21.4" r="0.5" fill="#fff" />
      <Circle cx="24" cy="21.4" r="0.5" fill="#fff" />
      <Ellipse cx="20" cy="25" rx="1.5" ry="1" fill="#B07A4A" />
      <Path
        d="M17 27.5 Q20 30 23 27.5"
        stroke="#B07A4A"
        strokeWidth={1.2}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M12 34 Q20 38 28 34"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
        opacity={0.5}
      />
    </Svg>
  );
});

/** Leaf divider used between a devotional's title and its body. */
export const LeafDivider = memo(function LeafDivider({ color = '#3A7D52' }: { color?: string }) {
  return (
    <Svg width={28} height={20} viewBox="0 0 28 20" fill="none">
      <Path
        d="M22 2C22 2 10 6 8 14c3-1.5 6-1.5 8.5-4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M8 18c0-3 1.5-6 6-9" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
});

/**
 * The signed-out illustration: a figure with the brand leaf sprouting from it.
 */
export const GuestMark = memo(function GuestMark({ size = 56, color = '#3A7D52' }: MarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <Circle cx="28" cy="20" r="10" fill={color} opacity={0.7} />
      <Path d="M12 48a16 16 0 0132 0" fill={color} opacity={0.5} />
      <Path d="M34 10 Q44 4 46 -2 Q38 6 34 12" fill={color} />
      <Path d="M34 12 Q30 6 28 8" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
});

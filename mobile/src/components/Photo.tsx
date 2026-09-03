import { memo } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Photography, with the loading and failure behaviour the product needs.
 *
 * The web design's `Img` fades in on load and falls back to a flat colour on
 * error. `expo-image` gives us that plus the parts that actually matter on a
 * Nigerian data plan: a disk cache that survives app restarts, and
 * `recyclingKey`, which lets a virtualised list reuse one native view per row
 * instead of allocating a fresh decoder for every scroll.
 *
 * 09-design-principles.md limits photography to Tribe and Library — the daily
 * spiritual surfaces (Today, Bible) stay illustrated to protect calm.
 */

/** A tiny neutral blurhash: something warm resolves before the photo lands. */
const PLACEHOLDER_HASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

export interface PhotoProps {
  uri: string;
  /** Shown while loading and if the fetch fails. */
  fallbackColor?: string;
  /** Stable id so virtualised lists can recycle the native view. */
  recyclingKey?: string;
  style?: ViewStyle;
  /**
   * Dark gradient laid over the image so overlaid text stays legible. `top`
   * and `bottom` are the alpha at each end.
   */
  scrim?: { top: number; bottom: number };
  accessibilityLabel?: string;
}

function PhotoBase({
  uri,
  fallbackColor = '#F2EAE0',
  recyclingKey,
  style,
  scrim,
  accessibilityLabel,
}: PhotoProps) {
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: fallbackColor }, style]}>
      <Image
        source={uri}
        recyclingKey={recyclingKey}
        placeholder={{ blurhash: PLACEHOLDER_HASH }}
        // Keep decoded frames in memory for the session and bytes on disk
        // across launches — event banners are re-shown constantly.
        cachePolicy="memory-disk"
        contentFit="cover"
        transition={300}
        accessible={!!accessibilityLabel}
        accessibilityLabel={accessibilityLabel}
        style={{ width: '100%', height: '100%' }}
      />
      {scrim && (
        <LinearGradient
          colors={[`rgba(0,0,0,${scrim.top})`, `rgba(0,0,0,${scrim.bottom})`]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          pointerEvents="none"
        />
      )}
    </View>
  );
}

export const Photo = memo(PhotoBase);

import { memo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

/**
 * The two institutional marks.
 *
 * Both shipped as circular badges on solid square backgrounds — RCCG on black,
 * Faith Tribe on teal — which would have shown as coloured boxes on the warm
 * off-white surfaces and worse in dark mode. Each was cropped to its own circle
 * with real alpha, so they sit on any surface without a plate behind them.
 *
 * They are photographic marks, not icons: no tinting, no recolouring. The leaf
 * in `BrandMarks.tsx` remains the *product* mark used at icon sizes, where a
 * detailed seal would turn to mush.
 */
const RCCG = require('../../assets/rccg-logo.png');
const FAITH_TRIBE = require('../../assets/faith-tribe-logo.png');

interface LogoProps {
  size?: number;
}

function Mark({ source, size, label }: { source: number; size: number; label: string }) {
  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={source}
        contentFit="contain"
        cachePolicy="memory"
        transition={0}
        accessibilityLabel={label}
        style={{ width: size, height: size }}
      />
    </View>
  );
}

export const RccgLogo = memo(function RccgLogo({ size = 40 }: LogoProps) {
  return <Mark source={RCCG} size={size} label="The Redeemed Christian Church of God" />;
});

export const FaithTribeLogo = memo(function FaithTribeLogo({ size = 40 }: LogoProps) {
  return <Mark source={FAITH_TRIBE} size={size} label="Faith Tribe, RCCG Region 63" />;
});

/**
 * Both marks together, overlapped.
 *
 * The pairing the web app uses in its auth shell and footer: RCCG first as the
 * parent body, Faith Tribe tucked behind it.
 */
export const LogoLockup = memo(function LogoLockup({ size = 44 }: LogoProps) {
  return (
    <View className="flex-row items-center" style={{ height: size }}>
      <RccgLogo size={size} />
      <View style={{ marginLeft: -size * 0.28 }}>
        <FaithTribeLogo size={size} />
      </View>
    </View>
  );
});

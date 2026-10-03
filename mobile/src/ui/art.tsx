import { memo } from 'react';
import { type ImageStyle, type StyleProp } from 'react-native';
import { Image } from 'expo-image';

/**
 * The picture library: 3D objects (3dicons, CC0) and line drawings (Open
 * Doodles, CC0). The drawings are stand-ins until commissioned illustrations
 * of Nigerian teens exist.
 *
 * Each file is `require`d by name on purpose. Metro bundles every asset a
 * module graph can reach, so a dynamic lookup over a folder would ship all of
 * it; a literal table ships exactly these.
 */
const OBJECTS = {
  bell: require('../../assets/3d/bell.webp'),
  calendar: require('../../assets/3d/calendar.webp'),
  'chat-bubble': require('../../assets/3d/chat-bubble.webp'),
  crown: require('../../assets/3d/crown.webp'),
  fire: require('../../assets/3d/fire.webp'),
  flash: require('../../assets/3d/flash.webp'),
  gift: require('../../assets/3d/gift.webp'),
  lock: require('../../assets/3d/lock.webp'),
  'map-pin': require('../../assets/3d/map-pin.webp'),
  notebook: require('../../assets/3d/notebook.webp'),
  rocket: require('../../assets/3d/rocket.webp'),
  star: require('../../assets/3d/star.webp'),
  target: require('../../assets/3d/target.webp'),
  'thumb-up': require('../../assets/3d/thumb-up.webp'),
  trophy: require('../../assets/3d/trophy.webp'),
} as const;

const DRAWINGS = {
  dancing: { source: require('../../assets/art/dancing.svg'), ratio: 207 / 174.9 },
  groovy: { source: require('../../assets/art/groovy.svg'), ratio: 92.4 / 75.4 },
  jumping: { source: require('../../assets/art/jumping.svg'), ratio: 841 / 682 },
  loving: { source: require('../../assets/art/loving.svg'), ratio: 849 / 607 },
  meditating: { source: require('../../assets/art/meditating.svg'), ratio: 92.4 / 71 },
  plant: { source: require('../../assets/art/plant.svg'), ratio: 815 / 763 },
  reading: { source: require('../../assets/art/reading.svg'), ratio: 178.7 / 207 },
  selfie: { source: require('../../assets/art/selfie.svg'), ratio: 98.1 / 140 },
  sitting: { source: require('../../assets/art/sitting.svg'), ratio: 768 / 709 },
  'sitting-reading': { source: require('../../assets/art/sitting-reading.svg'), ratio: 892 / 708 },
  strolling: { source: require('../../assets/art/strolling.svg'), ratio: 747 / 723 },
  'reading-side': { source: require('../../assets/art/reading-side.svg'), ratio: 142.5 / 88.2 },
} as const;

/** The seal and the stand-in event photo: bundled, so they show with no signal. */
export const RCCG_LOGO = require('../../assets/rccg-logo.png');
export const EVENT_PHOTO = require('../../assets/photos/event.webp');

export type ObjectName = keyof typeof OBJECTS;
export type DrawingName = keyof typeof DRAWINGS;

/**
 * A 3D object. Decorative: it never carries meaning on its own, so it is
 * hidden from screen readers and the text beside it does the talking.
 */
export const Object3D = memo(function Object3D({
  name,
  size,
  style,
}: {
  name: ObjectName;
  size: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={OBJECTS[name]}
      contentFit="contain"
      cachePolicy="memory-disk"
      transition={0}
      accessible={false}
      style={[{ width: size, height: size }, style]}
    />
  );
});

/** A line drawing, sized by width; height follows the drawing's own ratio. */
export const Drawing = memo(function Drawing({
  name,
  width,
  style,
}: {
  name: DrawingName;
  width: number;
  style?: StyleProp<ImageStyle>;
}) {
  const { source, ratio } = DRAWINGS[name];
  return (
    <Image
      source={source}
      contentFit="contain"
      cachePolicy="memory-disk"
      transition={0}
      accessible={false}
      style={[{ width, height: width / ratio }, style]}
    />
  );
});

/**
 * A drawing fitted inside a square, whichever way round it is. Covers and
 * thumbnails use this: a tall drawing sized by width alone would spill out of
 * the tile.
 */
export const DrawingIn = memo(function DrawingIn({ name, box }: { name: DrawingName; box: number }) {
  const { ratio } = DRAWINGS[name];
  return <Drawing name={name} width={ratio >= 1 ? box : box * ratio} />;
});

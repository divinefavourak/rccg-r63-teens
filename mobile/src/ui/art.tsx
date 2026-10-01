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
  'reading-side': { source: require('../../assets/art/reading-side.svg'), ratio: 142.5 / 88.2 },
} as const;

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

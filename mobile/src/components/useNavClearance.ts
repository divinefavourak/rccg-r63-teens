import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NAV } from '../theme/tokens';

/**
 * How much bottom padding a scrollable screen needs to clear the nav.
 *
 * The bottom nav is absolutely positioned so the transparent area around its
 * notch shows real screen content rather than the navigator's own background.
 * That takes it out of the layout flow, so it no longer reserves space and
 * every scroll view has to account for it — otherwise the last card sits
 * permanently underneath the bar.
 *
 * `extra` is added on top, for screens that also want breathing room.
 */
export function useNavClearance(extra = 0): number {
  const insets = useSafeAreaInsets();
  return NAV.height + insets.bottom + extra;
}
